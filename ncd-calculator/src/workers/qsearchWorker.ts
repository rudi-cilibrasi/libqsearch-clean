// Import types for Emscripten module
interface EmscriptenModule {
  run_qsearch: (
    matrixString: string,
    callback: (treeJSON: string) => void
  ) => void;
}

interface QSearchModuleConfig {
  print: (text: string) => void;
  printErr: (text: string) => void;
}

// Define message types
interface ProcessNcdMatrixMessage {
  action: "processNcdMatrix";
  labels: string[];
  ncdMatrix: number[][];
}

interface ConsoleMessage {
  action: "consoleLog" | "consoleError";
  message: string;
}

interface TreeJSONMessage {
  action: "treeJSON";
  result: string;
}

interface QSearchCompleteMessage {
  action: "qsearchComplete";
}

interface QSearchErrorMessage {
  action: "qsearchError";
  message: string;
}

type WorkerMessage =
  | ProcessNcdMatrixMessage
  | ConsoleMessage
  | TreeJSONMessage
  | QSearchCompleteMessage
  | QSearchErrorMessage;

// Import the Emscripten module
import Module from "../wasm/qsearch.ts";
import { getTreeInput } from "../functions/qSearchTree";

let qsearchModule: EmscriptenModule | null = null;

// Initialize the Emscripten module
Module({
  print: (text: string) => {
    // Capture the standard output and send it to the main thread
    self.postMessage({
      action: "consoleLog",
      message: text,
    } as ConsoleMessage);
  },
  printErr: (text: string) => {
    // Capture the error output and send it to the main thread
    self.postMessage({
      action: "consoleError",
      message: text,
    } as ConsoleMessage);
  },
} as QSearchModuleConfig).then((initializedModule: EmscriptenModule) => {
  qsearchModule = initializedModule;
  self.postMessage({
    action: "consoleLog",
    message: "Emscripten Module Initialized",
  } as ConsoleMessage);

  self.addEventListener("message", (event: MessageEvent<WorkerMessage>) => {
    const { action } = event.data;

    self.postMessage({
      action: "consoleLog",
      message: "qsearchWorker received message " + action,
    } as ConsoleMessage);

    // Handle the processNcdMatrix action
    if (action === "processNcdMatrix") {
      const { labels, ncdMatrix } = event.data;

      // Format the NCD matrix as a string for passing to QSearch
      let matrixString = getTreeInput({ labels, ncdMatrix });

      self.postMessage({
        action: "consoleLog",
        message: "Sending matrix to qsearch WASM \n" + matrixString,
      } as ConsoleMessage);

      try {
        const callback = (treeJSON: string) => {
          // Send interim points to the main thread
          self.postMessage({
            action: "treeJSON",
            result: treeJSON,
          } as TreeJSONMessage);
        };

        // Check if module is initialized
        if (!qsearchModule) {
          throw new Error("QSearch module not initialized");
        }

        // Pass the matrix string to the C++ function
        qsearchModule.run_qsearch(matrixString, callback);

        self.postMessage({
          action: "qsearchComplete",
        } as QSearchCompleteMessage);
      } catch (error) {
        self.postMessage({
          action: "qsearchError",
          message: "QSearch internal error " + (error as Error).message,
        } as QSearchErrorMessage);
      }
    }
  });
});

// Add type declaration for Web Worker context
declare const self: DedicatedWorkerGlobalScope;
