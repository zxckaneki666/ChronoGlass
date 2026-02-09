import {WorkSession} from './types';

// --- CORE TIME ARCHITECTURE ---

/**
 * Generates a consistent Day Key (YYYY-MM-DD) based purely on LOCAL system time.
 */
export const getDayKey = (timestamp: number | Date): string => {
    const d = new Date(timestamp);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Returns the timestamp difference in milliseconds.
 * Handles running sessions (endTime = null) by using Date.now()
 */
export const calculateSessionDuration = (session: WorkSession): number => {
    const end = session.endTime || Date.now();
    return Math.max(0, end - session.startTime);
};

// --- FORMATTERS ---

export const formatDuration = (ms: number): string => {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

export const formatDurationHuman = (ms: number): string => {
    const hours = (ms / (1000 * 60 * 60)).toFixed(1);
    return `${hours}h`;
};

// --- AGGREGATION LOGIC ---

/**
 * Returns the timestamp of Monday 00:00:00 for the week of the given date.
 */
const getMondayTimestamp = (d: Date): number => {
    const date = new Date(d);
    const day = date.getDay(); // Sun=0, Mon=1, ...
    // Calculate difference to get to Monday
    // If today is Sunday (0), we need to go back 6 days.
    // If today is Monday (1), we go back 0 days.
    // If today is Tuesday (2), we go back 1 day.
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);

    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday.getTime();
}

/**
 * Calculates the total balance (overtime/undertime) across all history.
 * STRICTLY includes the current week's target debt.
 */
export const calculateWeeklyBalance = (sessions: WorkSession[], weeklyHoursTarget: number): number => {
    const sessionsByWeek = new Map<number, number>(); // Monday Timestamp -> Total Duration MS

    // 1. Group ALL existing sessions by their week
    sessions.forEach(s => {
        const d = new Date(s.startTime);
        const key = getMondayTimestamp(d);
        const dur = calculateSessionDuration(s);
        sessionsByWeek.set(key, (sessionsByWeek.get(key) || 0) + dur);
    });

    // 2. FORCE include the Current Week.
    // This ensures that as soon as Monday starts, we are in "debt" for the target hours.
    const currentMondayKey = getMondayTimestamp(new Date());
    if (!sessionsByWeek.has(currentMondayKey)) {
        sessionsByWeek.set(currentMondayKey, 0);
    }

    let totalBalance = 0;
    // Guard against NaN/Invalid settings
    const safeTarget = weeklyHoursTarget || 40;
    const targetMs = safeTarget * 60 * 60 * 1000;

    // 3. Sum up balance for every tracked week + current week
    sessionsByWeek.forEach((duration) => {
        totalBalance += (duration - targetMs);
    });

    return totalBalance;
};

export const generateCurrentWeekData = (sessions: WorkSession[]) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();

    // Get Monday of current week
    const mondayMs = getMondayTimestamp(today);
    const monday = new Date(mondayMs);

    const data = [];

    // Generate strictly 7 days starting from Monday
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dayKey = getDayKey(d);

        // Filter sessions strictly by local day key
        const daySessions = sessions.filter(s => getDayKey(s.startTime) === dayKey);
        const totalMs = daySessions.reduce((acc, s) => acc + calculateSessionDuration(s), 0);

        const isToday = getDayKey(today) === dayKey;

        data.push({
            name: days[d.getDay()],
            fullDate: dayKey,
            hours: parseFloat((totalMs / (1000 * 60 * 60)).toFixed(1)),
            isToday: isToday
        });
    }

    return data;
};

export interface WeeklyHistoryItem {
    weekStart: number;
    totalMs: number;
    balanceMs: number;
}

export const getHistoryByWeeks = (sessions: WorkSession[], weeklyTargetHours: number): WeeklyHistoryItem[] => {
    const map = new Map<number, number>();

    sessions.forEach(s => {
        const key = getMondayTimestamp(new Date(s.startTime));
        const dur = calculateSessionDuration(s);
        map.set(key, (map.get(key) || 0) + dur);
    });

    // Ensure current week exists in history view
    const currentKey = getMondayTimestamp(new Date());
    if (!map.has(currentKey)) {
        map.set(currentKey, 0);
    }

    const safeTarget = weeklyTargetHours || 40;
    const targetMs = safeTarget * 60 * 60 * 1000;

    const history: WeeklyHistoryItem[] = [];
    map.forEach((totalMs, weekStart) => {
        history.push({
            weekStart,
            totalMs,
            balanceMs: totalMs - targetMs
        });
    });

    // Sort descending (newest first)
    return history.sort((a, b) => b.weekStart - a.weekStart);
};
