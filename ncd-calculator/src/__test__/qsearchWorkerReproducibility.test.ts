import "@vitest/web-worker";
import {afterEach, describe, expect, test} from "vitest";
import QSearchWorker from "@/workers/qsearchWorker?worker";
import type {QTreeResponse} from "@/types/qsearch";

const workers: Worker[] = [];

const runSearch = (worker: Worker): Promise<QTreeResponse> => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("QSearch worker test timed out")), 30_000);
  const onMessage = (event: MessageEvent): void => {
    if (event.data.action === "qsearchError") {
      clearTimeout(timeout);
      worker.removeEventListener("message", onMessage);
      reject(new Error(event.data.message));
    }
    if (event.data.action === "treeJSON") {
      clearTimeout(timeout);
      worker.removeEventListener("message", onMessage);
      resolve(JSON.parse(event.data.result) as QTreeResponse);
    }
  };
  worker.addEventListener("message", onMessage);
  worker.postMessage({
    action: "processNcdMatrix",
    labels: ["A", "B", "C", "D"],
    ncdMatrix: [
      [0, 0.1, 0.8, 0.9],
      [0.1, 0, 0.85, 0.88],
      [0.8, 0.85, 0, 0.12],
      [0.9, 0.88, 0.12, 0],
    ],
    runCount: 3,
    baseSeed: 0x12345678,
  });
});

describe("QSearch WASM worker reproducibility", () => {
  afterEach(() => workers.splice(0).forEach((worker) => worker.terminate()));

  test("returns the same selected tree for the same matrix and seed schedule", async () => {
    const worker = new QSearchWorker();
    workers.push(worker);
    const first = await runSearch(worker);
    const second = await runSearch(worker);

    expect(second).toEqual(first);
    expect(first.search.runCount).toBe(3);
    expect(first.search.baseSeed).toBe(0x12345678);
    expect(first.search.supportKind).toBe("repeated-search-stability");
    expect(first.balancedSplit.leftLeafIndices).toHaveLength(2);
    expect(first.balancedSplit.rightLeafIndices).toHaveLength(2);
    expect(first.nodes.filter((node) => node.connections.length === 1).map((node) => node.label).sort())
      .toEqual(["A", "B", "C", "D"]);
  });
});
