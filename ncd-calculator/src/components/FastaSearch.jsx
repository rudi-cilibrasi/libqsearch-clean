import { useEffect, useRef, useState } from "react";
import { workerCode } from "../workers/ncdWorker.js";
import { FileDrop } from "./FileDrop.jsx";
import MatrixTable from "./MatrixTable.jsx";
import {
  getFastaAccessionNumbersFromIds,
  getSequenceIdsBySearchTerm,
  parseFasta,
} from "../functions/getPublicFasta.js";
import {
  cacheAccession,
  cacheSearchTermAccessions,
  filterEmptyAccessions,
  getCachedDataByAccession,
  getCachedDataBySearchTerm,
  initCache,
  parseAccessionNumber,
} from "../functions/cache.js";

import QSearchWorker from "../workers/qsearchWorker.js?worker";
import { QSearchTree3D } from "./QSearchTree3D.jsx";
import { getGenbankSequences } from "../functions/getPublicGenbank.js";

export const FastaSearch = () => {
  const MAX_IDS_FETCH = 40;
  const [searchTerm, setSearchTerm] = useState("");
  const [numItems, setNumItems] = useState(5);
  const [ncdMatrix, setNcdMatrix] = useState([]);
  const [labels, setLabels] = useState([]);
  const [hasMatrix, setHasMatrix] = useState(false);
  const [ncdWorker, setNcdWorker] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmedSearchTerm, setConfirmedSearchTerm] = useState("");
  const [executionTime, setExecutionTime] = useState(performance.now());
  const qSearchWorkerRef = useRef(null);
  const [qSearchTreeResult, setQSearchTreeResult] = useState(null);
  const [labelMap, setLabelMap] = useState(new Map());
  const labelMapRef = useRef(labelMap);

  const setSearchTermRemoveErr = (searchTerm) => {
    setSearchTerm(searchTerm);
    setErrorMsg("");
  };

  useEffect(() => {
    initCache();
    runNCDWorker();
    qSearchWorkerRef.current = new QSearchWorker();
    qSearchWorkerRef.current.onmessage = handleQsearchMessage;
  }, []);

  const handleFastaData = (data) => {
    const parsed = parseFasta(data);
    ncdWorker.postMessage({
      labels: parsed.labels,
      contents: parsed.contents,
    });
  };

  const displayNcdMatrix = (response) => {
    const { labels, ncdMatrix } = response;
    const displayNames = [];
    for (let i = 0; i < labels.length; i++) {
      displayNames.push(labelMapRef.current.get(labels[i]));
    }
    setLabels(displayNames);
    setNcdMatrix(ncdMatrix);
    setHasMatrix(true);
    setErrorMsg("");
    qSearchWorkerRef.current.postMessage({
      action: "processNcdMatrix",
      labels,
      ncdMatrix,
    });
  };

  const runNCDWorker = () => {
    const blob = new Blob([workerCode], { type: "application/javascript" });
    const workerURL = URL.createObjectURL(blob);
    const worker = new Worker(workerURL);
    worker.onmessage = function (e) {
      const message = e.data;
      if (message.type === "progress") {
      } else if (message.type === "result") {
        if (
          !message ||
          message.labels.length === 0 ||
          message.ncdMatrix.length === 0
        ) {
          setErrorMsg("no result");
          resetDisplay();
        } else {
          displayNcdMatrix(message);
        }
        setExecutionTime((prev) => {
          return performance.now() - prev;
        });
      }
    };
    setNcdWorker(worker);
  };

  const getLabelMap = (parsedSequences) => {
    let map = new Map();
    const accessions = parsedSequences.accessions;
    const labels = parsedSequences.labels;
    for (let i = 0; i < accessions.length; i++) {
      map.set(accessions[i], labels[i]);
    }
    return map;
  };

  const performSearch = async () => {
    if (!searchTerm) {
      setErrorMsg("The search input is empty");
      return;
    }
    const itemsNum = numItems;
    setExecutionTime(performance.now());
    let searchTermCache = getCachedDataBySearchTerm(searchTerm);
    setQSearchTreeResult([]);
    if (!searchTermCache || searchTermCache.length === 0) {
      resetDisplay();
      console.log("Cache miss for search term: " + searchTerm);
      let ids = await getSequenceIdsBySearchTerm(searchTerm, MAX_IDS_FETCH);
      if (ids && ids.length !== 0) {
        let accessions = (await getFastaAccessionNumbersFromIds(ids)).filter(
          (accession) => accession != null
        );
        ids = ids.slice(0, numItems); // here we will only fetch the top `numItems` elements, the rest will be fetched on the next call
        accessions = filterEmptyAccessions(accessions).map(parseAccessionNumber);
        let parsedSequences = await getGenbankSequences(ids);
        if (accessions && accessions.length !== 0) {
          cacheSearchTermAccessions(
            searchTerm,
            accessions,
            parsedSequences.labels
          );
        }
        let contents = parsedSequences.contents;
        let accessionNumbers = parsedSequences.accessions;
        if (parsedSequences && Object.keys(parsedSequences).length !== 0) {
          const input = {
            contents: contents,
            labels: accessionNumbers,
          };
          let map = getLabelMap(parsedSequences);
          labelMapRef.current = map;
          setLabelMap(map);
          ncdWorker.postMessage(input);
          cacheAccession(parsedSequences);
          setConfirmedSearchTerm(searchTerm);
        }
      } else {
        setErrorMsg("no result");
        setNcdMatrix([]);
        setLabels([]);
        labelMapRef.current = new Map();
        setLabelMap(new Map());
        setHasMatrix(false);
        setQSearchTreeResult([]);
      }
    } else {
      handleCacheHit(searchTerm, searchTermCache, itemsNum);
    }
  };

  const handleCacheHit = async (searchTerm, searchTermCache, numItems) => {
    console.log(
      "Cache hit for term: " +
        searchTerm +
        ", existing accessions: " +
        searchTermCache
    );
    // cache: searchTerm -> [{ accession: ...; label: }, .... ]
    const cacheDataLen = searchTermCache.length;
    const idsToFetch = [];
    const input = {
      labels: [],
      contents: [],
      accessions: [],
    };

    const needsSearchTermCache = {
      accessions: [],
      labels: [],
    };

    for (let i = 0; i < cacheDataLen; i++) {
      const cur = searchTermCache[i];
      if (!cur.label || cur.label === "") {
        const remaining = searchTermCache.slice(
          i,
          Math.min(numItems, searchTermCache.length)
        );
        remaining.forEach((remain) => {
          idsToFetch.push(remain.accession);
        });
        break;
      } else {
        if (input.labels.length < numItems) {
          const sequence = getCachedDataByAccession(cur.accession);
          input.labels.push(cur.label);
          input.contents.push(sequence);
          input.accessions.push(cur.accession);
        } else {
          break;
        }
      }
    }
    if (idsToFetch.length == 0) {
      ncdWorker.postMessage({
        contents: input.contents,
        labels: input.accessions, // here we use accessions as labels
      });
    } else {
      const fetchedSequences = await getGenbankSequences(Array.from(new Set([...idsToFetch])));
      for (let i = 0; i < fetchedSequences.contents.length; i++) {
        input.contents.push(fetchedSequences.contents[i]);
        input.labels.push(fetchedSequences.labels[i]);
        input.accessions.push(fetchedSequences.accessions[i]);

        needsSearchTermCache.labels.push(fetchedSequences.labels[i]);
        needsSearchTermCache.accessions.push(fetchedSequences.accessions[i]);
      }
      const needsAccessionCache = {
        accessions: input.accessions,
        contents: input.contents,
      };
      cacheSearchTermAccessions(
        searchTerm,
        needsSearchTermCache.accessions,
        needsSearchTermCache.labels
      );
      cacheAccession(needsAccessionCache);
      ncdWorker.postMessage({
        contents: input.contents,
        labels: input.accessions, // here we use accessions as labels
      });
    }
    const map = getLabelMap(input);
    labelMapRef.current = map;
    setLabelMap(map);
    setConfirmedSearchTerm(searchTerm);
  };

  const resetDisplay = () => {
    setErrorMsg("");
    setNcdMatrix([]);
    setLabels([]);
    labelMapRef.current = new Map();
    setLabelMap(new Map());
    setHasMatrix(false);
  };

  const handleKeyDown = async (e) => {
    if (e.key === "Enter") {
      await performSearch();
    }
  };

  const handleQsearchMessage = (event) => {
    let newMessage = "";
    if (event.data.action === "qsearchComplete") {
      newMessage = "Qsearch complete";
    } else if (event.data.action === "qsearchError") {
      newMessage = "Qsearch error: " + event.data.message;
    } else if (event.data.action === "consoleLog") {
      newMessage = event.data.message;
    } else if (event.data.action === "consoleError") {
      console.error(event.data.message);
      newMessage = "Error: " + event.data.message;
    } else if (event.data.action === "treeJSON") {
      setQSearchTreeResult(JSON.parse(event.data.result));
    }
  };

  return (
    <div style={{ margin: "20px", textAlign: "center" }}>
      <h1 style={{ marginBottom: "20px" }}>NCD Calculator</h1>
      <div>
        <input
          type="text"
          placeholder="Enter search terms, e.g. buffalo"
          value={searchTerm}
          onChange={(e) => setSearchTermRemoveErr(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            padding: "10px",
            width: "300px",
            fontSize: "18px",
            border: "2px solid #4CAF50",
            borderRadius: "5px",
            outline: "none",
            transition: "border-color 0.3s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "#66bb6a")}
          onBlur={(e) => (e.target.style.borderColor = "#4CAF50")}
        />
        <select
          value={numItems}
          onChange={(e) => setNumItems(parseInt(e.target.value))}
          style={{
            padding: "10px",
            marginLeft: "10px",
            fontSize: "18px",
            border: "2px solid #4CAF50",
            borderRadius: "5px",
          }}
        >
          <option value="5">5</option>
          <option value="10">10</option>
          <option value="15">15</option>
          <option value="20">20</option>
          <option value="25">25</option>
          <option value="30">30</option>
          <option value="35">35</option>
          <option value="40">40</option>
        </select>
        <button
          onClick={() => performSearch()}
          style={{
            padding: "10px 20px",
            fontSize: "18px",
            marginLeft: "10px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            transition: "background-color 0.3s",
          }}
          onMouseEnter={(e) => (e.target.style.backgroundColor = "#45a049")}
          onMouseLeave={(e) => (e.target.style.backgroundColor = "#4CAF50")}
        >
          Search
        </button>
      </div>
      <div>
        <FileDrop onFastaData={handleFastaData} />
      </div>

      <div style={{ marginTop: "10px", textAlign: "left" }}>
        {hasMatrix && confirmedSearchTerm && (
          <div style={{ overflowX: "auto", maxWidth: "100%" }}>
            <MatrixTable
              ncdMatrix={ncdMatrix}
              labels={labels}
              searchTerm={confirmedSearchTerm}
              executionTime={executionTime}
            />
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {errorMsg && errorMsg.includes("no result") && (
            <p style={{ fontSize: "18px" }}>
              There is no result for{" "}
              <b>
                <i>{searchTerm}</i>
              </b>
            </p>
          )}
        </div>
        <div>
          {qSearchTreeResult &&
            qSearchTreeResult.nodes &&
            qSearchTreeResult.nodes.length !== 0 && (
              <QSearchTree3D data={qSearchTreeResult} />
            )}
        </div>
      </div>
    </div>
  );
};
