// qsearchWorker.js
//
// This web worker manages the interaction between the main thread and the QSearch C++ module,
// compiled to WebAssembly using Emscripten.
//
// It performs the following functions:
// 1. **Initialize the Emscripten Module:**
//    - The worker loads and initializes the QSearch WebAssembly module (`qsearch.js`).
//    - Standard output (`print`) and error output (`printErr`) from the C++ module are captured and sent
//      as messages to the main thread for logging.
//
// 2. **Handle 'processNcdMatrix' Messages:**
//    - The worker listens for incoming messages with the action type 'processNcdMatrix'.
//    - When this message is received, it contains:
//      - `labels`: An array of species names or other identifiers corresponding to each row of the NCD matrix.
//      - `ncdMatrix`: A 2D array representing the computed Normalized Compression Distance matrix.
//    - The worker formats the NCD matrix as a string, with each row containing a label followed by the NCD values
//      for that row, separated by spaces.
//
// 3. **Run QSearch with the NCD Matrix:**
//    - After formatting the matrix string, the worker passes it to the C++ function `run_qsearch()`.
//    - If the processing completes successfully, a 'qsearchComplete' message is sent to the main thread.
//    - If an error occurs, a 'qsearchError' message is sent to the main thread with the error details.
//
// The worker operates independently of the main UI thread, allowing asynchronous processing of the NCD matrix
// and interaction with the QSearch C++ logic without blocking the user interface.


import Module from '../wasm/qsearch.js';
import {getTreeInput} from "../functions/qSearchTree.js";

let qsearchModule = null;

// Initialize the Emscripten module
Module({
    print: (text) => {
        // Capture the standard output and send it to the main thread
        self.postMessage({action: 'consoleLog', message: text});
    },
    printErr: (text) => {
        // Capture the error output and send it to the main thread
        self.postMessage({action: 'consoleError', message: text});
    }
}).then((initializedModule) => {
    qsearchModule = initializedModule;
    self.postMessage({action: 'consoleLog', message: "Emscripten Module Initialized"});

    self.addEventListener('message', (event) => {
        const action = event.data.action;
        self.postMessage({action: 'consoleLog', message: "qsearchWorker received message " + action});

        // Handle the processNcdMatrix action
        if (action === 'processNcdMatrix') {
            const labels = event.data.labels;
            const ncdMatrix = event.data.ncdMatrix;

            // Format the NCD matrix as a string for passing to QSearch
            let matrixString = getTreeInput({labels, ncdMatrix});
            self.postMessage({action: 'consoleLog', message: "Sending matrix to qsearch WASM \n" + matrixString});
            try {
                const callback = (treeJSON) => {
                    // Send interim points to the main thread
                    self.postMessage({action: 'treeJSON', result: treeJSON});
                };
                // Pass the matrix string to the C++ function
                qsearchModule.run_qsearch(matrixString, callback);
                self.postMessage({action: 'qsearchComplete'});
            } catch (error) {
                self.postMessage({action: 'qsearchError', message: "QSearch internal error " + error.message});
            }
        }
    });
});
