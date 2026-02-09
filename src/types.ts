export interface SubActivity {
    id: string;
    title: string;
    startTime: number;
    endTime: number | null;
}

export interface WorkSession {
    id: string;
    startTime: number;
    endTime: number | null;
    date: string; // ISO String YYYY-MM-DD
    subActivities: SubActivity[];
    note?: string;
}

export interface AppSettings {
    weeklyHoursTarget: number;
    userName: string;
}

// Data structure for export/import
export interface AppData {
    sessions: WorkSession[];
    settings: AppSettings;
}

export type Period = 'week' | 'month' | 'year';
