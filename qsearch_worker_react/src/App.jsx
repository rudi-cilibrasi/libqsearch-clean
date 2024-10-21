import React, { useEffect, useState, useRef } from 'react';
import QsearchWorker from './workers/qsearchWorker.js?worker';

import './App.css';

const App = () => {
  const [messages, setMessages] = useState([]);
  const [worker, setWorker] = useState(null);
  const messageBoxRef = useRef(null);

  useEffect(() => {
    const createWorker = () => {
      const qsearchWorker = new QsearchWorker();
      qsearchWorker.onmessage = (event) => {
        if (event.data) {
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
            newMessage = 'error: ' + event.data.message;
          }
  
          if (newMessage) {
            setMessages((prevMessages) => [...prevMessages, newMessage]);
          }
        }
      };
      return qsearchWorker;
    };
    const qsearchWorker = createWorker();
    setWorker(qsearchWorker);

    return () => {
      qsearchWorker.terminate();
    };
  }, []);

  useEffect(() => {
    if (messageBoxRef.current) {
      messageBoxRef.current.scrollTop = messageBoxRef.current.scrollHeight;
    }
  }, [messages]);

  const handleRunClick = () => {
    if (worker) {
      worker.postMessage({ action: 'runQsearch' });
    }
  };

  return (
    <div className="App">
      <h1>Multithreaded WASM test</h1>
      <h2>Quartet Search Tree</h2>
      <div>
        <button onClick={handleRunClick}>Run QSearch</button>
      </div>
      <p>Qsearch web app using a web worker and HTML DOM.</p>
      <div id="messageBox" className="message-box" ref={messageBoxRef}>
        {messages.map((message, index) => (
          <p key={index} className="message-text">{message}</p>
        ))}
      </div>
    </div>
  );
};

export default App;