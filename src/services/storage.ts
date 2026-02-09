import {AppData, AppSettings} from '../types';

const STORAGE_KEY = 'chronoglass_data_v1';

const DEFAULT_SETTINGS: AppSettings = {
    weeklyHoursTarget: 40,
    userName: 'User',
};

// @ts-ignore
const isTauri = !!(window.__TAURI_INTERNALS__ || window.__TAURI__);

export const api = {
    loadData: async (): Promise<AppData> => {
        let rawData: any = {};

        try {
            if (isTauri) {
                // @ts-ignore
                const {invoke} = await import('@tauri-apps/api/core');
                const jsonStr = await invoke('load_data') as string;

                if (jsonStr && jsonStr !== '{}' && jsonStr !== '') {
                    rawData = JSON.parse(jsonStr);
                }
            } else {
                const stored = localStorage.getItem(STORAGE_KEY);
                if (stored) {
                    rawData = JSON.parse(stored);
                }
            }
        } catch (e) {
            console.warn("Data load failed, falling back to defaults", e);
        }

        // Safely merge with defaults to ensure app doesn't crash on partial data
        return {
            sessions: Array.isArray(rawData.sessions) ? rawData.sessions : [],
            settings: {
                ...DEFAULT_SETTINGS,
                ...(rawData.settings || {})
            }
        };
    },

    saveData: async (data: AppData): Promise<void> => {
        const jsonStr = JSON.stringify(data, null, 2);

        try {
            if (isTauri) {
                // @ts-ignore
                const {invoke} = await import('@tauri-apps/api/core');
                await invoke('save_data', {content: jsonStr});
                return;
            }
        } catch (e) {
            console.error("Tauri save failed", e);
        }

        localStorage.setItem(STORAGE_KEY, jsonStr);
    },

    resetData: async (): Promise<void> => {
        try {
            if (isTauri) {
                // @ts-ignore
                const {invoke} = await import('@tauri-apps/api/core');
                await invoke('reset_data');
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        } catch (e) {
            console.error("Reset failed", e);
        }
    },

    // Changed return type to AppData | null for immediate UI updates
    importData: async (jsonData: string): Promise<AppData | null> => {
        try {
            const parsed = JSON.parse(jsonData) as any;

            // Basic validation: ensure at least sessions is an array
            if (Array.isArray(parsed.sessions)) {
                const validData: AppData = {
                    sessions: parsed.sessions,
                    settings: {
                        ...DEFAULT_SETTINGS,
                        ...(parsed.settings || {})
                    }
                };

                await api.saveData(validData);
                return validData;
            }
            return null;
        } catch (e) {
            console.error("Import failed", e);
            return null;
        }
    },

    // Setup listener for external API updates
    onExternalUpdate: async (callback: () => void) => {
        if (isTauri) {
            try {
                // @ts-ignore
                const {listen} = await import('@tauri-apps/api/event');
                return await listen('external-data-update', () => {
                    console.log("Received external update signal");
                    callback();
                });
            } catch (e) {
                console.warn("Event listener setup failed", e);
            }
        }
        return () => {
        };
    }
};
