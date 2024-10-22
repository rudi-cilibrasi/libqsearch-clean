// App.jsx
//
// This React component serves as the main user interface for a multithreaded web application 
// that computes the Normalized Compression Distance (NCD) matrix and processes it using QSearch, 
// a C++ module compiled to WebAssembly.
//
// The component performs the following tasks:
//
// 1. **Initialize Two Web Workers:**
//    - It creates and manages two web workers: `ncdWorker` and `qsearchWorker`.
//      - `ncdWorker`: Computes the NCD matrix for a set of input strings (representing species or other entities).
//      - `qsearchWorker`: Processes the NCD matrix to build a quartet search tree using the QSearch algorithm in C++.
//    - Each worker is initialized using React's `useEffect` hook, ensuring proper setup and cleanup.
//
// 2. **Handle File Drag-and-Drop:**
//    - The component renders a drag-and-drop area that allows users to upload text files.
//    - When files are dropped, it reads the file contents, extracts the labels (file names without extensions), 
//      and prepares the content for NCD calculation.
//    - After files are dropped, the component automatically triggers the NCD calculation by sending the file 
//      labels and contents to the `ncdWorker`.
//
// 3. **NCD Matrix Calculation and Processing:**
//    - The `ncdWorker` computes the NCD matrix asynchronously, sending progress updates for each cell.
//    - Once the NCD matrix is fully computed, it is sent to the `qsearchWorker` for further processing.
//    - The `qsearchWorker` runs the QSearch algorithm on the matrix, and upon completion, sends a message 
//      back to indicate success or failure.
//
// 4. **Message Handling and User Feedback:**
//    - The component listens for messages from both workers, capturing progress updates, logs, and error messages.
//    - These messages are displayed in a message box within the UI, allowing users to see real-time updates 
//      during computation and processing.
//    - The message box automatically scrolls to the latest message to keep users informed.
//
// 5. **State Management:**
//    - The component uses React's state management (`useState`) to handle messages, file contents, file labels, 
//      and the state of each worker.
//    - React's `useRef` is used to keep a reference to the message box, enabling automatic scrolling.
//
// This component provides a user-friendly interface for multithreaded computation in a web environment, 
// leveraging WebAssembly and web workers to handle complex calculations without blocking the main UI thread.

import React, { useEffect, useState, useRef } from 'react';
import QsearchWorker from './workers/qsearchWorker.js?worker';
import NcdWorker from './workers/ncdWorker.js?worker';

import './App.css';

const App = () => {
  const [messages, setMessages] = useState([]);
  const [fileContents, setFileContents] = useState([]);
  const [fileLabels, setFileLabels] = useState([]);
  const messageBoxRef = useRef(null);

  // Use refs to store worker instances
  const qsearchWorkerRef = useRef(null);
  const ncdWorkerRef = useRef(null);

  // Initialize workers
  useEffect(() => {
    // Create QSearch worker
    qsearchWorkerRef.current = new QsearchWorker();
    qsearchWorkerRef.current.onmessage = handleQsearchMessage;

    // Create NCD worker
    ncdWorkerRef.current = new NcdWorker();
    ncdWorkerRef.current.onmessage = handleNcdMessage;

    console.log('Workers initialized.');

    return () => {
      // Cleanup workers on component unmount
      if (qsearchWorkerRef.current) qsearchWorkerRef.current.terminate();
      if (ncdWorkerRef.current) ncdWorkerRef.current.terminate();
    };
  }, []);

  useEffect(() => {
    if (messageBoxRef.current) {
      messageBoxRef.current.scrollTop = messageBoxRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle messages from the QSearch worker
  const handleQsearchMessage = (event) => {
    let newMessage = '';
    if (event.data.action === 'qsearchComplete') {
      newMessage = 'Qsearch complete';
    } else if (event.data.action === 'qsearchError') {
      newMessage = 'Qsearch error: ' + event.data.message;
    } else if (event.data.action === 'consoleLog') {
      console.log(event.data.message);
      newMessage = event.data.message;
    } else if (event.data.action === 'consoleError') {
      console.error(event.data.message);
      newMessage = 'Error: ' + event.data.message;
    }

    if (newMessage) {
      setMessages((prevMessages) => [...prevMessages, newMessage]);
    }
  };

  // Handle messages from the NCD worker
  const handleNcdMessage = (event) => {
    if (event.data.type === 'progress') {
      const { i, j, value } = event.data;
      setMessages((prevMessages) => [
        ...prevMessages,
        `NCD Progress: Cell [${i}, ${j}] = ${value}`,
      ]);
    } else if (event.data.type === 'result') {
      const ncdMatrix = event.data.ncdMatrix;
      const labels = event.data.labels;
      setMessages((prevMessages) => [
        ...prevMessages,
        'NCD calculation complete. Sending matrix to QSearch...',
      ]);

      // Send the NCD matrix to QSearch worker
      if (qsearchWorkerRef.current) {
        console.log('Sending NCD matrix to QSearch worker');
        qsearchWorkerRef.current.postMessage({ action: 'processNcdMatrix', labels, ncdMatrix });
      } else {
        console.log('Qsearch worker not available');
      }
    }
  };

  // Handle file drop
  const handleFileDrop = async (event) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    let newFileContents = [...fileContents];
    let newFileLabels = [...fileLabels];

    // This code removes the first line of each file and stores the rest of the content
    // This cleans files in FASTA format but may not work for all file types
    for (let file of files) {
      const content = await file.text();
      const lines = content.split('\n');
      if (lines.length > 1) {
        const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        newFileLabels.push(fileNameWithoutExt);
        newFileContents.push(lines.slice(1).join('\n'));
      }
    }

    setFileContents(newFileContents);
    setFileLabels(newFileLabels);

    // Trigger NCD calculation
    if (ncdWorkerRef.current) {
      setMessages((prevMessages) => [...prevMessages, 'Calculating NCD matrix...']);
      ncdWorkerRef.current.postMessage({ labels: newFileLabels, contents: newFileContents });
    } else {
      console.log('NCD worker not available');
    }
  };

  return (
    <div className="App">
      <h1>Multithreaded WASM Test</h1>
      <h2>Quartet Search Tree</h2>
      <div
        id="dropZone"
        className="drop-zone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
      >
        Drag & Drop Text Files Here
      </div>
      <div id="messageBox" className="message-box" ref={messageBoxRef}>
        {messages.map((message, index) => (
          <p key={index} className="message-text">{message}</p>
        ))}
      </div>
    </div>
  );
};

export default App;
