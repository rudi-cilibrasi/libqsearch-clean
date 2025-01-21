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

// Handle Node.js built-in modules for browser
const handleBuiltins: Plugin = {
  name: 'handle-builtins',
  resolveId(source) {
    if (source === 'path' || source === 'fs') {
      return { id: 'virtual-' + source, external: true };
    }
  }
};

const configureWasmHeaders: Plugin = {
  name: 'configure-wasm-headers',
  configureServer: (server) => {
    server.middlewares.use((_req, res, next) => {
      // Only set WASM content type for .wasm files
      if (_req.url?.endsWith('.wasm')) {
        res.setHeader('Content-Type', 'application/wasm');
      }
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      next();
    });
  }
};

export default defineConfig({
  base: "./",
  plugins: [
    handleBuiltins,
    treatJsFilesAsJsx,
    react(),
    wasm(),
    topLevelAwait(),
    configureWasmHeaders
  ],
  test: {
    globals: true,
    testTimeout: 10_000,
    setupFiles: ["./vitest.setup.ts"],
    environment: "jsdom",
    include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    deps: {
      inline: ["vitest-canvas-mock"],
    },
  },
  server: {
    open: true,
    port: 3000,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  resolve: {
    alias: {
      "@": "/src",
    }
  },
  worker: {
    format: "es",
    plugins: [wasm()],
  },
  optimizeDeps: {
    exclude: ['zstd.wasm', 'zstd.js'],
    esbuildOptions: {
      target: 'es2020',
      supported: {
        'top-level-await': true
      }
    }
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      external: ['path', 'fs'],
      output: {
        format: 'es',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.wasm')) {
            return 'assets/wasm/[name][extname]';
          }
          return 'assets/[hash][extname]';
        }
      }
    },
    commonjsOptions: {
      include: [/lzma/, /node_modules/],
      transformMixedEsModules: true
    }
  },
  assetsInclude: ['**/*.wasm']
});