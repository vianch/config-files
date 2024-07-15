// Custom path for vanilla JavaScript

import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    root: 'web',
    build: {
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'web/creator.html')
            }
        },
        outDir: '../dist',
        assetsDir: 'assets',
    },
    server: {
        open: 'web/creator.html'
    }
});