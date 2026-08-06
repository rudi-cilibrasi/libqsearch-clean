import {describe, expect, test} from "vitest";
import {containsBareHpccImport} from "./verify-production-bundle.mjs";

describe("production bundle verification", () => {
    test.each([
        'import("@hpcc-js/wasm")',
        'import("@hpcc-js/wasm/graphviz")',
        'import {Graphviz} from "@hpcc-js/wasm/graphviz"',
    ])("detects a browser-incompatible bare module import in %s", (source) => {
        expect(containsBareHpccImport(source)).toBe(true);
    });

    test("accepts a bundled relative Graphviz chunk", () => {
        expect(containsBareHpccImport('import("./graphviz-D4x9.js")')).toBe(false);
    });
});
