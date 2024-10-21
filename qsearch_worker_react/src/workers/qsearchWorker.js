import Module from '../wasm/qsearch.js';

let qsearchModule = null;

Module({
  print: (text) => {
    // Capture the standard output and send it to the main thread
    self.postMessage({ action: 'consoleLog', message: text });
  },
  printErr: (text) => {
    // Capture the error output and send it to the main thread
    self.postMessage({ action: 'consoleError', message: text });
  }
}).then((initializedModule) => {
  qsearchModule = initializedModule;
  self.postMessage({ action: 'consoleLog', message: "Emscripten Module Initialized" });

  self.addEventListener('message', (event) => {
    if (event.data.action === 'runQsearch') {
      try {
        qsearchModule.run_qsearch();
        // Send the final result to the main thread
        self.postMessage({ action: 'qsearchComplete' });
      } catch (error) {
        self.postMessage({ action: 'qsearchError', message: error.message });
      }
    }
  });
});
