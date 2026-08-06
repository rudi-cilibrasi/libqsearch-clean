/// <reference lib="webworker" />

// Generated and checked in by `make wasm-calculator` with the pinned Emscripten image.
import createQSearchModule from "../wasm/qsearch.js";
import {getTreeInput} from "../functions/qtree";
import {validateMatrix} from "@/functions/matrix";
import {
  aggregateQSearchRuns,
  getQSearchBaseSeed,
  getQSearchRunCount,
  getQSearchSeeds,
} from "@/services/QSearchProtocol";
import type {QSearchNativeRun, QTreeResponse} from "@/types/qsearch";

interface ProcessNcdMatrixMessage {
  action: "processNcdMatrix";
  labels: string[];
  ncdMatrix: number[][];
  runCount?: number;
  baseSeed?: number;
}

interface TestConnectionMessage {
  action: "testConnection";
}

type IncomingMessage = ProcessNcdMatrixMessage | TestConnectionMessage;

const modulePromise = createQSearchModule({
  print: (message: string) => self.postMessage({action: "consoleLog", message}),
  printErr: (message: string) => self.postMessage({action: "consoleError", message}),
});

const restoreLeafLabels = (result: QTreeResponse, labels: readonly string[]): QTreeResponse => ({
  ...result,
  nodes: result.nodes.map((node) => ({
    ...node,
    label: node.index < labels.length ? labels[node.index] : node.label,
  })),
});

const parseNativeRun = (serialized: string, expectedSeed: number): QSearchNativeRun => {
  const run = JSON.parse(serialized) as Partial<QSearchNativeRun>;
  if (
    run.seed !== expectedSeed
    || !Number.isFinite(run.score)
    || !run.tree
    || !Array.isArray(run.tree.nodes)
  ) {
    throw new Error(`QSearch returned an invalid result for seed ${expectedSeed}`);
  }
  return run as QSearchNativeRun;
};

const processMatrix = async (message: ProcessNcdMatrixMessage): Promise<void> => {
  const validationError = validateMatrix(message.labels, message.ncdMatrix);
  if (validationError) throw new Error(`Matrix validation failed: ${validationError}`);

  const matrixInput = getTreeInput({labels: message.labels, ncdMatrix: message.ncdMatrix});
  if (!matrixInput) throw new Error("Unable to serialize the distance matrix for QSearch");

  const module = await modulePromise;
  const runCount = message.runCount ?? getQSearchRunCount(message.labels.length);
  const baseSeed = message.baseSeed ?? getQSearchBaseSeed(matrixInput);
  if (!Number.isInteger(baseSeed) || baseSeed < 0 || baseSeed > 0xffffffff) {
    throw new Error("QSearch base seed must be an unsigned 32-bit integer");
  }
  const seeds = getQSearchSeeds(baseSeed, runCount);
  const runs: QSearchNativeRun[] = [];

  // Runs are deliberately sequential. QSearch's native random generator is
  // process-global, and bounded sequential execution avoids multiplying WASM memory.
  for (let index = 0; index < seeds.length; index += 1) {
    const seed = seeds[index];
    const run = parseNativeRun(module.run_qsearch_seeded(matrixInput, seed), seed);
    // Keep the collision-free positional leaf identifiers until after topology
    // aggregation. Display labels are not guaranteed to be unique.
    runs.push(run);
    self.postMessage({
      action: "qsearchProgress",
      completedRuns: index + 1,
      totalRuns: seeds.length,
      seed,
    });
  }

  const result = restoreLeafLabels(aggregateQSearchRuns(runs, baseSeed), message.labels);
  self.postMessage({action: "treeJSON", result: JSON.stringify(result)});
};

self.onmessage = async (event: MessageEvent<IncomingMessage>): Promise<void> => {
  if (event.data.action === "testConnection") {
    await modulePromise;
    self.postMessage({action: "consoleLog", message: "QSearch worker ready"});
    return;
  }

  try {
    await processMatrix(event.data);
  } catch (error) {
    self.postMessage({
      action: "qsearchError",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

export type {};
