import {WorkSession} from './types';

// --- CORE TIME ARCHITECTURE ---

/**
 * Generates a consistent Day Key (YYYY-MM-DD) based purely on LOCAL system time.
 * This is the "Source of Truth" for grouping data.
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

export const calculateWeeklyBalance = (sessions: WorkSession[], weeklyHoursTarget: number): number => {
    const sessionsByWeek = new Map<string, number>();

    sessions.forEach(s => {
        const d = new Date(s.startTime);
        // Standardize to ISO weeks logic roughly for accumulation
        const onejan = new Date(d.getFullYear(), 0, 1);
        const millisecs = d.getTime() - onejan.getTime();
        const weekIdx = Math.ceil((((millisecs / 86400000) + onejan.getDay() + 1) / 7));
        const key = `${d.getFullYear()}-W${weekIdx}`;

        const dur = calculateSessionDuration(s);
        sessionsByWeek.set(key, (sessionsByWeek.get(key) || 0) + dur);
    });

    let totalBalance = 0;
    const targetMs = weeklyHoursTarget * 60 * 60 * 1000;

    sessionsByWeek.forEach((duration) => {
        totalBalance += (duration - targetMs);
    });

    return totalBalance;
};

export const generateCurrentWeekData = (sessions: WorkSession[]) => {
    // Always Mon-Sun labels
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();

    // Calculate Monday of current week
    // getDay(): 0 = Sun, 1 = Mon ... 6 = Sat
    const currentDay = today.getDay();
    // If today is Sun (0), we want to go back 6 days to Mon.
    // If today is Mon (1), we go back 0 days.
    const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;

    const monday = new Date(today);
    monday.setDate(today.getDate() - distanceToMonday);

    const data = [];

    // Generate strictly 7 days starting from Monday
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dayKey = getDayKey(d);

        const daySessions = sessions.filter(s => getDayKey(s.startTime) === dayKey);
        const totalMs = daySessions.reduce((acc, s) => acc + calculateSessionDuration(s), 0);

        const isToday = getDayKey(today) === dayKey;

        data.push({
            name: days[d.getDay()], // This will output Mon, Tue, Wed, Thu, Fri, Sat, Sun sequentially
            fullDate: dayKey,
            hours: parseFloat((totalMs / (1000 * 60 * 60)).toFixed(1)),
            isToday: isToday
        });
    }

    return data;
};
