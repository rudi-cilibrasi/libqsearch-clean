import {defineConfig, transformWithEsbuild} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    base: './',
    plugins: [{
        name: 'treat-js-files-as-jsx',
        // vite does not allow import jsx components in xxx.test.js files
        async transform(code, id) {
            if (!id.match(/src\/.*\.js$/)) return null
            return transformWithEsbuild(code, id, {
                loader: 'jsx',
                jsx: 'automatic',
            })
        },
    },react()],
    test: {
        globals: true,
        testTimeout: 10_000,
        setupFiles: ['./vitest.setup.js'],
        environment: 'jsdom',
        deps: {
            inline: ['vitest-canvas-mock'],
        },
    },
    server: {
        // this ensures that the browser opens upon api start
        open: true,
        // this sets a default port to 3000
        port: 3000,
    },
    resolve: {
        alias: {
            '@': '/src',
        },
    },
});