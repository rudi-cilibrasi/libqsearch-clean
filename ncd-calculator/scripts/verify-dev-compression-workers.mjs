import path from "node:path";
import {fileURLToPath} from "node:url";
import {createServer} from "vite";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const serviceModule = "/src/services/CompressionService.ts";
const workers = ["lzmaWorker", "zstdWorker"];

const server = await createServer({
    root: projectDirectory,
    configFile: path.join(projectDirectory, "vite.config.ts"),
    logLevel: "error",
    appType: "custom",
    server: {
        middlewareMode: true,
        hmr: false,
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
        if (!transformedWorker?.code || !transformedWorker.code.includes("postMessage")) {
            throw new Error(`Vite could not serve a usable ${worker} module: ${workerUrl}`);
        }
    }

    console.log("Development compression-worker verification passed: LZMA and ZSTD use native worker URLs.");
} finally {
    await server.close();
}
