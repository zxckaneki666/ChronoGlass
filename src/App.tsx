import React, {useState, useEffect, useMemo} from 'react';
import {
    Play, Square, Clock, Settings as SettingsIcon, Plus,
    Briefcase, Download, Upload, X, Activity, Trash2
} from './components/Icons';
import {GlassCard} from './components/GlassCard';
import {api} from './services/storage';
import {WorkSession, AppSettings, SubActivity} from './types';
import {
    calculateSessionDuration,
    formatDuration,
    formatDurationHuman,
    getDayKey,
    generateCurrentWeekData,
    calculateWeeklyBalance
} from './utils';
import {BarChart, Bar, Tooltip, ResponsiveContainer, Cell, CartesianGrid, XAxis} from 'recharts';

// --- Components ---

const SettingsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    settings: AppSettings;
    onSave: (s: AppSettings) => void;
    onImport: (f: File) => void;
    onExport: () => void;
    onClear: () => void;
}> = ({isOpen, onClose, settings, onSave, onImport, onExport, onClear}) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={onClose}></div>
            <GlassCard
                className="w-full max-w-lg p-8 relative z-10 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-semibold text-white">Settings</h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-6 h-6 text-white/70"/>
                    </button>
                </div>

                <div className="space-y-6 overflow-y-auto custom-scrollbar pr-2">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-white/60">Weekly Target (Hours)</label>
                        <input
                            type="number"
                            value={settings.weeklyHoursTarget}
                            onChange={(e) => onSave({...settings, weeklyHoursTarget: parseInt(e.target.value) || 0})}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:bg-white/10 transition-colors"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-white/60">User Name</label>
                        <input
                            type="text"
                            value={settings.userName}
                            onChange={(e) => onSave({...settings, userName: e.target.value})}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:bg-white/10 transition-colors"
                        />
                    </div>

                    <div className="pt-6 border-t border-white/10 grid grid-cols-2 gap-4">
                        <button
                            onClick={onExport}
                            className="py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 flex items-center justify-center gap-2 transition-colors font-medium border border-white/5"
                        >
                            <Download className="w-4 h-4"/> Export Data
                        </button>
                        <label
                            className="py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 flex items-center justify-center gap-2 transition-colors cursor-pointer font-medium border border-white/5">
                            <Upload className="w-4 h-4"/> Import Data
                            <input type="file" className="hidden" onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) onImport(file);
                                e.target.value = '';
                            }}/>
                        </label>
                    </div>

                    <div className="pt-6 border-t border-white/10">
                        <h3 className="text-xs font-bold text-red-400/70 uppercase tracking-widest mb-3">Danger
                            Zone</h3>
                        <button
                            onClick={onClear}
                            className="w-full py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 flex items-center justify-center gap-2 transition-colors font-medium"
                        >
                            <Trash2 className="w-4 h-4"/> Clear All History
                        </button>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
};

// --- Main App Component ---

const App: React.FC = () => {
    // --- State ---
    const [sessions, setSessions] = useState<WorkSession[]>([]);
    const [settings, setSettings] = useState<AppSettings>({weeklyHoursTarget: 40, userName: 'User'});
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [showSettings, setShowSettings] = useState(false);

    // UI State
    const [subActivityName, setSubActivityName] = useState('');
    const [isSubActivityInputVisible, setIsSubActivityInputVisible] = useState(false);

    // --- Initialization & Storage ---

    const loadAllData = async () => {
        try {
            const data = await api.loadData();
            if (data && Array.isArray(data.sessions)) {
                setSessions(data.sessions);
                setSettings(data.settings);

                const active = data.sessions.find(s => s.endTime === null);
                setActiveSessionId(active ? active.id : null);
            }
        } catch (e) {
            console.error("Failed to load initial data", e);
        }
    };

    useEffect(() => {
        loadAllData();
        const unlistenPromise = api.onExternalUpdate(loadAllData);
        return () => {
            unlistenPromise.then(unlisten => unlisten && unlisten());
        };
    }, []);

    useEffect(() => {
        if (sessions.length > 0) {
            api.saveData({sessions, settings});
        }
    }, [sessions, settings]);

    // --- Timer ---
    useEffect(() => {
        let interval: number;
        if (activeSessionId) {
            interval = window.setInterval(() => {
                const session = sessions.find(s => s.id === activeSessionId);
                if (session) {
                    setElapsedTime(Date.now() - session.startTime);
                }
            }, 1000);
        } else {
            setElapsedTime(0);
        }
        return () => clearInterval(interval);
    }, [activeSessionId, sessions]);

    // --- Handlers ---
    const handleStartSession = () => {
        const newSession: WorkSession = {
            id: crypto.randomUUID(),
            startTime: Date.now(),
            endTime: null,
            date: getDayKey(Date.now()), // Store date key for easier indexing, but we rely on startTime mostly
            subActivities: []
        };
        setSessions(prev => [...prev, newSession]);
        setActiveSessionId(newSession.id);
    };

    const handleStopSession = () => {
        if (!activeSessionId) return;
        setSessions(prev => prev.map(s => {
            if (s.id === activeSessionId) {
                const now = Date.now();
                const updatedSubs = s.subActivities.map(sub =>
                    sub.endTime === null ? {...sub, endTime: now} : sub
                );
                return {...s, endTime: now, subActivities: updatedSubs};
            }
            return s;
        }));
        setActiveSessionId(null);
        setElapsedTime(0);
        setIsSubActivityInputVisible(false);
    };

    const handleStopCurrentTask = () => {
        if (!activeSessionId) return;
        setSessions(prev => prev.map(s => {
            if (s.id === activeSessionId) {
                const updatedSubs = s.subActivities.map(sub =>
                    sub.endTime === null ? {...sub, endTime: Date.now()} : sub
                );
                return {...s, subActivities: updatedSubs};
            }
            return s;
        }));
    };

    const handleAddSubActivity = () => {
        if (!activeSessionId || !subActivityName.trim()) return;
        setSessions(prev => prev.map(s => {
            if (s.id === activeSessionId) {
                const closedSubs = s.subActivities.map(sub =>
                    sub.endTime === null ? {...sub, endTime: Date.now()} : sub
                );
                const newSub: SubActivity = {
                    id: crypto.randomUUID(),
                    title: subActivityName,
                    startTime: Date.now(),
                    endTime: null
                };
                return {...s, subActivities: [...closedSubs, newSub]};
            }
            return s;
        }));
        setSubActivityName('');
        setIsSubActivityInputVisible(false);
    };

    const handleImport = async (file: File) => {
        try {
            const text = await file.text();
            const importedData = await api.importData(text);
            if (importedData) {
                setSessions(importedData.sessions);
                setSettings(importedData.settings);
                const active = importedData.sessions.find(s => s.endTime === null);
                setActiveSessionId(active ? active.id : null);
                alert("Data imported successfully");
                setShowSettings(false);
            } else {
                alert("Invalid file format.");
            }
        } catch (e) {
            alert("Failed to read file.");
        }
    };

    const handleClearHistory = async () => {
        if (confirm("Are you sure?")) {
            await api.resetData();
            setSessions([]);
            setActiveSessionId(null);
            alert("Cleared.");
            setShowSettings(false);
        }
    };

    // --- Computed Data ---

    // Memoize chart data to prevent re-calculations during timer ticks
    const chartData = useMemo(() => generateCurrentWeekData(sessions), [sessions]);

    const balanceMs = calculateWeeklyBalance(sessions, settings.weeklyHoursTarget);
    const balanceHours = balanceMs / (1000 * 60 * 60);

    const todayKey = getDayKey(Date.now());
    const todaysSessions = sessions.filter(s => getDayKey(s.startTime) === todayKey);

    const activeSession = sessions.find(s => s.id === activeSessionId);
    const activeSubActivity = activeSession?.subActivities.find(sa => sa.endTime === null);

    const dailyActivities = useMemo(() => {
        let acts: { id: string, title: string, start: number, end: number | null }[] = [];
        todaysSessions.forEach(s => {
            s.subActivities.forEach(sub => {
                acts.push({id: sub.id, title: sub.title, start: sub.startTime, end: sub.endTime});
            });
        });
        return acts.sort((a, b) => b.start - a.start);
    }, [todaysSessions]);

    const monthTotal = useMemo(() => {
        const monthKey = todayKey.substring(0, 7); // YYYY-MM
        return sessions
            .filter(s => getDayKey(s.startTime).startsWith(monthKey))
            .reduce((acc, s) => acc + calculateSessionDuration(s), 0);
    }, [sessions, todayKey]);

    return (
        <div
            className="min-h-screen font-sans text-white/90 p-4 md:p-6 flex flex-col gap-5 max-w-7xl mx-auto selection:bg-purple-500/30">

            <SettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                settings={settings}
                onSave={setSettings}
                onImport={handleImport}
                onExport={() => { /* ... export logic ... */
                }}
                onClear={handleClearHistory}
            />

            <header data-tauri-drag-region
                    className="flex justify-between items-center cursor-default select-none pt-2">
                <div className="flex items-center gap-3 pointer-events-none">
                    <div
                        className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-900/20">
                        <Clock className="w-5 h-5 text-white"/>
                    </div>
                    <h1 className="text-xl font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
                        ChronoGlass
                    </h1>
                </div>
                <button onClick={() => setShowSettings(true)}
                        className="p-3 rounded-full hover:bg-white/10 transition-colors z-20">
                    <SettingsIcon className="w-6 h-6 text-white/70"/>
                </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* TIMER */}
                <GlassCard
                    className="lg:col-span-2 p-8 md:p-10 flex flex-col justify-between min-h-[300px] relative group">
                    <div
                        className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-900/10 pointer-events-none"/>
                    <div className="flex justify-between items-start relative z-10">
                        <div className="flex flex-col">
                            <span className="text-white/40 text-xs font-medium tracking-widest uppercase mb-1">Current Session</span>
                            <span
                                className={`text-6xl md:text-8xl font-light tracking-tighter tabular-nums transition-all ${activeSessionId ? 'text-white' : 'text-white/20'}`}>
                  {activeSessionId ? formatDuration(elapsedTime) : '00:00:00'}
                </span>
                        </div>
                        <div
                            className={`px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider border transition-colors ${activeSessionId ? 'bg-green-500/20 border-green-500/30 text-green-300' : 'bg-white/5 border-white/10 text-white/30'}`}>
                            {activeSessionId ? 'Active' : 'Idle'}
                        </div>
                    </div>

                    <div className="flex items-end gap-4 relative z-10 mt-8">
                        {!activeSessionId ? (
                            <button onClick={handleStartSession}
                                    className="flex-1 max-w-xs flex items-center justify-center gap-3 px-6 py-4 bg-white text-black rounded-2xl font-semibold text-lg hover:scale-[1.02] transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                                <Play className="w-5 h-5 fill-black"/> Start
                            </button>
                        ) : (
                            <div className="flex gap-3 w-full max-w-md">
                                <button onClick={() => setIsSubActivityInputVisible(true)}
                                        className="flex-1 bg-white/10 border border-white/10 hover:bg-white/20 text-white px-6 py-4 rounded-2xl font-medium transition-all flex items-center justify-center gap-2">
                                    <Plus className="w-5 h-5"/> Log Task
                                </button>
                                <button onClick={handleStopSession}
                                        className="bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 text-red-100 px-6 py-4 rounded-2xl font-medium transition-all flex items-center justify-center gap-2">
                                    <Square className="w-5 h-5 fill-current"/> Stop
                                </button>
                            </div>
                        )}
                    </div>

                    {activeSubActivity && (
                        <div
                            className="absolute bottom-6 right-6 md:bottom-8 md:right-8 flex items-center gap-3 bg-indigo-900/30 backdrop-blur-md pl-4 pr-2 py-2 rounded-full border border-indigo-500/30 shadow-lg z-20">
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"/>
                            <span
                                className="text-sm text-indigo-100 font-medium max-w-[120px] md:max-w-[200px] truncate">{activeSubActivity.title}</span>
                            <button onClick={(e) => {
                                e.stopPropagation();
                                handleStopCurrentTask();
                            }} className="p-1 hover:bg-white/10 rounded-full text-indigo-200 hover:text-white">
                                <X className="w-4 h-4"/>
                            </button>
                        </div>
                    )}
                </GlassCard>

                {/* STATS */}
                <div className="flex flex-col gap-5">
                    <GlassCard className="flex-1 p-6 relative overflow-hidden flex flex-col justify-center">
                        <div
                            className={`absolute -top-10 -right-10 w-40 h-40 blur-[60px] rounded-full opacity-20 pointer-events-none ${balanceHours >= 0 ? 'bg-green-500' : 'bg-red-500'}`}/>
                        <div className="relative z-10">
                            <h3 className="text-white/50 text-xs font-medium uppercase tracking-wide mb-2">Total
                                Balance</h3>
                            <div
                                className={`text-5xl font-medium tracking-tight mb-2 ${balanceHours >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                                {balanceHours > 0 ? '+' : ''}{balanceHours.toFixed(1)}h
                            </div>
                            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mb-2">
                                <div
                                    className={`h-full transition-all duration-1000 ${balanceHours >= 0 ? 'bg-green-400 ml-[50%]' : 'bg-red-400 mr-[50%] ml-auto'}`}
                                    style={{width: `${Math.min(Math.abs(balanceHours) * 2, 50)}%`}}
                                />
                            </div>
                        </div>
                    </GlassCard>

                    <GlassCard className="p-4 flex flex-col justify-between h-[180px]">
                        <div className="flex justify-between items-end mb-2 px-2">
                            <span className="text-xs text-white/50 uppercase">Current Week</span>
                            <span className="text-xs text-white/80 font-mono">{formatDurationHuman(monthTotal)} this month</span>
                        </div>
                        {/* FIXED HEIGHT CONTAINER TO PREVENT FLEX COLLAPSE */}
                        <div style={{width: '100%', height: '120px'}} className="relative z-20">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{top: 5, right: 0, left: 0, bottom: 5}}>
                                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)"/>
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{fill: 'rgba(255,255,255,0.4)', fontSize: 10}}
                                        interval={0}
                                        dy={5}
                                    />
                                    <Tooltip
                                        cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                        contentStyle={{
                                            backgroundColor: '#09090b',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '8px',
                                            fontSize: '12px',
                                            boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                                        }}
                                        itemStyle={{color: '#fff'}}
                                        formatter={(value: number) => [`${value} hrs`]}
                                        labelStyle={{display: 'none'}}
                                    />
                                    <Bar dataKey="hours" radius={[3, 3, 3, 3]} barSize={24} minPointSize={2}>
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`}
                                                  fill={entry.isToday ? '#818cf8' : 'rgba(255,255,255,0.15)'}/>
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </GlassCard>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1 min-h-0">
                {isSubActivityInputVisible && (
                    <div
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in">
                        <div className="w-full max-w-md space-y-4">
                            <h3 className="text-2xl font-medium text-white">What are you working on?</h3>
                            <input autoFocus type="text" value={subActivityName}
                                   onChange={(e) => setSubActivityName(e.target.value)}
                                   onKeyDown={(e) => e.key === 'Enter' && handleAddSubActivity()}
                                   className="w-full bg-white/10 border border-white/20 rounded-2xl px-6 py-5 text-xl text-white focus:outline-none focus:border-indigo-400"/>
                            <div className="flex gap-3">
                                <button onClick={handleAddSubActivity}
                                        className="flex-1 bg-indigo-600 text-white py-4 rounded-xl">Track
                                </button>
                                <button onClick={() => setIsSubActivityInputVisible(false)}
                                        className="px-8 py-4 text-white/60">Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <GlassCard className="lg:col-span-2 p-6 flex flex-col min-h-[300px]">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-indigo-500/10 rounded-lg"><Activity className="w-5 h-5 text-indigo-400"/>
                        </div>
                        <h3 className="text-lg font-medium text-white">Activity Log <span
                            className="text-xs text-white/40 block font-normal">Tasks for today</span></h3>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                        {dailyActivities.length === 0 ? (
                            <div
                                className="h-full flex flex-col items-center justify-center text-white/20 border-2 border-dashed border-white/5 rounded-2xl p-4">
                                <Briefcase className="w-8 h-8 mb-2 opacity-50"/>
                                <p>No specific tasks logged today.</p>
                            </div>
                        ) : (
                            dailyActivities.map((item) => (
                                <div key={item.id} className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div
                                            className="w-2 h-2 rounded-full bg-indigo-400 mt-2 shadow-[0_0_10px_rgba(99,102,241,0.5)]"/>
                                        <div className="w-0.5 flex-1 bg-indigo-500/10 my-1"/>
                                    </div>
                                    <div
                                        className="flex-1 bg-white/5 border border-white/5 p-4 rounded-xl flex justify-between items-center">
                                        <h4 className="text-white/90 font-medium">{item.title}</h4>
                                        <div className="text-right">
                                            <div
                                                className="text-sm font-mono text-white/60">{formatDuration(calculateSessionDuration({
                                                startTime: item.start,
                                                endTime: item.end
                                            } as any))}</div>
                                            <div
                                                className="text-xs text-white/30">{new Date(item.start).toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}</div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </GlassCard>

                <GlassCard className="p-6 flex flex-col">
                    <h3 className="text-white/60 text-sm font-medium uppercase tracking-wide mb-4">Sessions</h3>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                        {[...todaysSessions].reverse().map(session => (
                            <div key={session.id}
                                 className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/5">
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`w-1.5 h-1.5 rounded-full ${session.endTime ? 'bg-white/30' : 'bg-green-400 animate-pulse'}`}/>
                                    <span className="text-sm text-white/80">Work</span>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-white/40">
                                        {new Date(session.startTime).toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </div>
                                    <div className="text-xs text-white/60 font-medium mt-0.5">
                                        {formatDurationHuman(calculateSessionDuration(session))}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {todaysSessions.length === 0 &&
                            <p className="text-white/20 text-sm italic">No sessions today.</p>}
                    </div>
                </GlassCard>

            </div>
        </div>
    );
};

export default App;
