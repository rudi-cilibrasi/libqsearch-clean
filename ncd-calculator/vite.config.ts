import { defineConfig, transformWithEsbuild, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

const treatJsFilesAsJsx: Plugin = {
  name: "treat-js-files-as-jsx",
  async transform(code: string, id: string) {
    if (!id.match(/src\/.*\.js$/)) return null;
    return transformWithEsbuild(code, id, {
      loader: "jsx",
      jsx: "automatic",
    });
  },
};

export default defineConfig({
  base: "./",
  plugins: [
    treatJsFilesAsJsx,
    react(),
    wasm(),
    topLevelAwait()
  ],
  test: {
    globals: true,
    testTimeout: 10_000,
    setupFiles: ["./vitest.setup.ts"],
    environment: "jsdom",
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    deps: {
      inline: ["vitest-canvas-mock"],
    },
  },
  server: {
    open: true,
    port: 3000,
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  worker: {
    format: 'es',
    plugins: [wasm()]
  },
  optimizeDeps: {
    exclude: ['lzma-js', '@bokuweb/zstd-wasm']
  }
});