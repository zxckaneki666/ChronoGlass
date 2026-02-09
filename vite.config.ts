import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {defineConfig, loadEnv} from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({mode}) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
        // Корень — папка src (где лежит index.html)
        root: 'src',
        base: './',

        // Выносим билд обратно в корень проекта
        build: {
            outDir: '../dist',
            emptyOutDir: true,
        },

        server: {
            port: 5173, // Стандарт для Tauri
            host: '127.0.0.1',
        },

        plugins: [react()],

        define: {
            'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
        },

        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            }
        }
    };
});
