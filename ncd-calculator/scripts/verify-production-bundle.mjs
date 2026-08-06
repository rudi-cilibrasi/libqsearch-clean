import {readdir, readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_BUILD_DIRECTORY = path.resolve(SCRIPT_DIRECTORY, "../dist");
const BROWSER_ASSET_EXTENSIONS = new Set([".html", ".js", ".mjs"]);

export const containsBareHpccImport = (source) => (
    /\bimport\s*\(\s*["']@hpcc-js\/wasm(?:\/[^"']*)?["']/.test(source)
    || /\bfrom\s*["']@hpcc-js\/wasm(?:\/[^"']*)?["']/.test(source)
);

const listBrowserAssets = async (directory) => {
    const entries = await readdir(directory, {withFileTypes: true});
    const nestedAssets = await Promise.all(entries.map(async (entry) => {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return listBrowserAssets(entryPath);
        return BROWSER_ASSET_EXTENSIONS.has(path.extname(entry.name)) ? [entryPath] : [];
    }));

    return nestedAssets.flat();
};

export const findBareHpccImports = async (buildDirectory = DEFAULT_BUILD_DIRECTORY) => {
    const assets = await listBrowserAssets(buildDirectory);
    const results = await Promise.all(assets.map(async (assetPath) => {
        const source = await readFile(assetPath, "utf8");
        return containsBareHpccImport(source) ? assetPath : null;
    }));

    return results.filter(Boolean);
};

export const verifyProductionBundle = async (buildDirectory = DEFAULT_BUILD_DIRECTORY) => {
    const invalidAssets = await findBareHpccImports(buildDirectory);
    if (invalidAssets.length === 0) return;

    const relativeAssets = invalidAssets.map((assetPath) => path.relative(buildDirectory, assetPath));
    throw new Error(
        "Production bundle contains unresolved @hpcc-js/wasm imports:\n"
        + relativeAssets.map((assetPath) => `- ${assetPath}`).join("\n")
    );
};

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
    try {
        await verifyProductionBundle();
        console.log("Production bundle verification passed: Graphviz has no bare module imports.");
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}
