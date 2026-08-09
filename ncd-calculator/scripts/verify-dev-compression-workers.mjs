import path from "node:path";
import {fileURLToPath} from "node:url";
import {createServer} from "vite";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const serviceModule = "/src/services/CompressionService.ts";
const workers = ["lzmaWorker", "zstdWorker", "gzipWorker", "brotliWorker"];

const server = await createServer({
    root: projectDirectory,
    configFile: path.join(projectDirectory, "vite.config.ts"),
    logLevel: "error",
    appType: "custom",
    server: {
        middlewareMode: true,
        hmr: false,
    },
    optimizeDeps: {
        noDiscovery: true,
        include: [],
    },
});

try {
    const transformedService = await server.transformRequest(serviceModule);
    if (!transformedService?.code) {
        throw new Error(`Vite did not transform ${serviceModule}.`);
    }
    if (/import\([^)]*\?worker["']/u.test(transformedService.code)) {
        throw new Error("CompressionService reintroduced a fragile dynamic ?worker module import.");
    }

    for (const worker of workers) {
        const workerUrl = transformedService.code.match(
            new RegExp(`"([^"]*${worker}\\.ts\\?worker_file&type=module)"`, "u"),
        )?.[1];
        if (!workerUrl) {
            throw new Error(`${worker} is not registered through Vite's native Worker URL transform.`);
        }
        const transformedWorker = await server.transformRequest(workerUrl);
        const hasWorkerRuntime = transformedWorker?.code
            && (
                transformedWorker.code.includes("postMessage")
                || transformedWorker.code.includes("startNcdCompressionWorker")
            );
        if (!hasWorkerRuntime) {
            throw new Error(`Vite could not serve a usable ${worker} module: ${workerUrl}`);
        }
    }

    // Let Vite finish dependency discovery before closing the middleware server.
    // Closing while the optimizer is still writing its cache cancels esbuild and
    // can make a successful worker check exit with code 13.
    await server.waitForRequestsIdle();
    console.log("Development compression-worker verification passed: all four compressors use native worker URLs.");
} finally {
    await server.close();
}
