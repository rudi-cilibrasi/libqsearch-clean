import path from "node:path";
import {fileURLToPath} from "node:url";
import {createServer} from "vite";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIRECTORY = path.resolve(SCRIPT_DIRECTORY, "..");
const LOADER_MODULE = "/src/services/GraphvizService.ts";

const server = await createServer({
    root: PROJECT_DIRECTORY,
    configFile: path.join(PROJECT_DIRECTORY, "vite.config.ts"),
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
    const transformedLoader = await server.transformRequest(LOADER_MODULE);
    if (!transformedLoader) {
        throw new Error(`Vite did not transform ${LOADER_MODULE}.`);
    }

    const graphvizImport = transformedLoader.code.match(/import\("([^"]*graphviz[^"]*)"\)/i)?.[1];
    if (!graphvizImport) {
        throw new Error("The Graphviz loader no longer contains a statically analyzable lazy import.");
    }

    if (graphvizImport.includes("/node_modules/.vite/deps/")) {
        throw new Error(
            "The Graphviz loader depends on Vite's hashed dependency cache: "
            + graphvizImport
        );
    }

    const transformedGraphviz = await server.transformRequest(graphvizImport);
    if (!transformedGraphviz?.code) {
        throw new Error(`Vite could not serve the resolved Graphviz module: ${graphvizImport}`);
    }

    console.log(`Development Graphviz verification passed: ${graphvizImport}`);
} finally {
    await server.close();
}
