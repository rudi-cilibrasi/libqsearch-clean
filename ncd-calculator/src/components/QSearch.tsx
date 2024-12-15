import React, {useEffect, useRef, useState} from "react";

import QSearchWorker from "../workers/qsearchWorker.js?worker";
import {workerCode as gzipWorkerCode} from "../workers/gzipWorker.ts";
import {MatrixTree} from "./MatrixTree.tsx";
import {Loader} from "lucide-react";
import ListEditor, {SearchMode} from "./ListEditor.tsx";
import Header from "./Header.jsx";
import {LocalStorageKeyManager} from "../cache/LocalStorageKeyManager.ts";
import {CompressionService} from "@/services/CompressionService.ts";
import {useSearchParams} from "react-router-dom";
import {lzmaWorkerCode} from "@/workers/lzmaWorker.ts";


export interface QSearchProps {
  openLogin: boolean;
  setOpenLogin: (open: boolean) => void;
  authenticated: boolean;
  setAuthenticated: (auth: boolean) => void;
}

export const QSearch: React.FC<QSearchProps> = ({
                                                  openLogin,
                                                  setOpenLogin,
                                                  authenticated,
                                                  setAuthenticated
                                                }) => {
  const [ncdMatrix, setNcdMatrix] = useState([]);
  const [labels, setLabels] = useState([]);
  const [hasMatrix, setHasMatrix] = useState(false);
  const [ncdWorker, setNcdWorker] = useState<Worker | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [executionTime, setExecutionTime] = useState(performance.now());
  const qSearchWorkerRef = useRef<any>(null);
  const [qSearchTreeResult, setQSearchTreeResult] = useState([]);
  const [labelMap, setLabelMap] = useState(new Map());
  const labelMapRef = useRef(labelMap);
  const [isLoading, setIsLoading] = useState(false);
  const [isSeaarchDisabled, setIsSearchDisabled] = useState(false);
  const [confirmedSearchTerm, setConfirmedSearchTerm] = useState("");
  const [searchParams] = useSearchParams();
  const storageKeyManager = LocalStorageKeyManager.getInstance();


  const getSearchModeParamAsObj = (): SearchMode => {
    const mode = searchParams.get("searchMode");
    return {
      searchMode: mode
    } as SearchMode
  }


  const [currentCompressor, setCurrentCompressor] = useState("gzip");
  const [compressionInfo, setCompressionInfo] = useState<{
    algorithm: string;
    reason: string;
  } | null>(null);


  const initializeWorker = (algorithm: string): Worker => {
    // First, clean up existing worker
    if (ncdWorker) {
      ncdWorker.terminate();
    }
    let workerCode;
    switch (algorithm) {
      case "lzma":
        workerCode = lzmaWorkerCode;
        break;
      default:
        workerCode = gzipWorkerCode;
    }
    console.log(`Initializing ${algorithm} worker`);

    const blob = new Blob([workerCode], { type: "application/javascript" });
    const workerURL = URL.createObjectURL(blob);
    const worker = new Worker(workerURL);
    worker.onmessage = handleWorkerMessage;
    worker.onerror = (error) => {
      console.error('Worker error:', error);
      setErrorMsg(`Worker error: ${error.message}`);
      setIsLoading(false);
    };

    setNcdWorker(worker);
    setCurrentCompressor(algorithm);
    return worker;
  };


  useEffect(() => {
    const searchMode = searchParams.get('searchMode');
    if (searchMode) {
      localStorage.setItem('searchMode', searchMode);
    }

    storageKeyManager.initialize();
    initializeWorker('gzip'); // Initialize with default gzip instead
    qSearchWorkerRef.current = new QSearchWorker();
    if (qSearchWorkerRef.current) {
      qSearchWorkerRef.current.onmessage = handleQsearchMessage;
    }
  }, [searchParams]);


  const onNcdInput = async (ncdInput: NCDInput) => {
    if (!ncdInput?.contents?.length || !ncdInput?.labels?.length) {
      setErrorMsg("Invalid input data");
      setIsLoading(false);
      setIsSearchDisabled(false);
      return;
    }

    try {
      setIsLoading(true);
      console.log("Processing input:", {
        contentCount: ncdInput.contents.length,
        labelCount: ncdInput.labels.length
      });

      const contentSizes = ncdInput.contents.map(content =>
          new TextEncoder().encode(content).length
      );

      console.log("Content sizes:", contentSizes); // Debug log

      const sortedSizes = [...contentSizes].sort((a, b) => b - a);
      const compressionDecision = CompressionService.needsAdvancedCompression(
          sortedSizes[0],
          sortedSizes[1]
      );

      console.log("Compression decision:", compressionDecision); // Debug log

      setCompressionInfo({
        algorithm: compressionDecision.recommendedAlgo,
        reason: compressionDecision.reason
      });


      if (currentCompressor !== compressionDecision.recommendedAlgo) {
        const worker = initializeWorker(compressionDecision.recommendedAlgo);
        worker.postMessage(ncdInput);
      } else if (ncdWorker) {
        ncdWorker.postMessage(ncdInput);
      } else {
        throw new Error("Worker not initialized");
      }
    } catch (error) {
      console.error("Error in onNcdInput:", error);
      setErrorMsg(`Error processing input: ${error.message}`);
      setIsLoading(false);
    }
  };


  const handleWorkerMessage = (e: MessageEvent) => {
    const message = e.data;
    console.log("Worker message received:", message);

    if (message.type === "progress") {
      console.log(`Progress: ${JSON.stringify(message)}`);
    } else if (message.type === "result") {
      if (!message || !message.labels?.length || !message.ncdMatrix?.length) {
        setErrorMsg("Invalid result format received");
        resetDisplay();
      } else {
        console.log("Valid result received, displaying matrix");
        displayNcdMatrix(message);
      }
      setExecutionTime((prev) => performance.now() - prev);
      setIsLoading(false);
    } else if (message.type === "error") {
      console.error("Worker error:", message.message);
      setErrorMsg(`Compression error: ${message.message}`);
      setIsLoading(false);
    }
  };


  useEffect(() => {
    let isMounted = true;
    const searchMode = searchParams.get('searchMode');
    if (searchMode) {
      localStorage.setItem('searchMode', searchMode);
    }
    storageKeyManager.initialize();
    if (!ncdWorker) {
      try {
        initializeWorker('gzip');

        if (!isMounted) return;

        qSearchWorkerRef.current = new QSearchWorker();
        if (qSearchWorkerRef.current) {
          qSearchWorkerRef.current.onmessage = handleQsearchMessage;
        }
      } catch (error) {
        if (!isMounted) return;
        console.error('Worker initialization error:', error);
        setErrorMsg('Failed to initialize worker');
      }
    }
    return () => {
      if (ncdWorker) {
        ncdWorker.terminate();
      }
      if (qSearchWorkerRef.current) {
        qSearchWorkerRef.current.terminate();
      }
    };
  }, [searchParams]);

  const handleParsedFileContent = (parsedData: ParsedData) => {
    if (parsedData.valid) {
      handleValidFileContent(parsedData);
    } else {
      handleInvalidFileContent();
    }
  };

  interface ParsedData {
    data: Array<{
      accession: string;
      sequence: string;
    }>;
    valid: boolean;
  }

  const handleValidFileContent = (parsedData: ParsedData) => {
    setIsLoading(true);
    const map = {
      displayLabels: [] as string[],
      accessions: [] as string[],
    };
    for (let i = 0; i < parsedData.data.length; i++) {
      map.displayLabels.push(parsedData.data[i].accession);
      map.accessions.push(parsedData.data[i].accession);
    }
    const labelMap = getLabelMap(map);
    setLabelMap(labelMap);
    labelMapRef.current = labelMap;
    const ncdInput = getNcdInput(parsedData);
    ncdWorker?.postMessage(ncdInput);
  };

  const handleInvalidFileContent = () => {
    resetSearchResult("");
  };

  interface FastaData {
    data: Array<{
      accession: string;
      sequence: string;
    }>;
  }

  const getNcdInput = (parsedFasta: FastaData) => {
    const input: {
      contents: string[];
      labels: string[];
    } = {
      contents: [],
      labels: [],
    };
    for (let i = 0; i < parsedFasta.data.length; i++) {
      const fasta = parsedFasta.data[i];
      input.labels.push(fasta.accession);
      input.contents.push(fasta.sequence);
    }
    return input;
  };

  const displayNcdMatrix = (response: any) => {
    const { labels, ncdMatrix } = response;
    let displayNames = [];
    for (let i = 0; i < labels.length; i++) {
      displayNames.push(labelMapRef.current.get(labels[i]));
    }
    displayNames =
      displayNames.filter((d) => d != null).length === 0
        ? labels
        : displayNames;
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

  interface ProjectedInput {
    accessions: string[];
    displayLabels: string[];
  }

  const getLabelMap = (projectedInput: ProjectedInput) => {
    let map = new Map();
    const accessions = projectedInput.accessions;
    const labels = projectedInput.displayLabels;
    for (let i = 0; i < accessions.length; i++) {
      map.set(accessions[i], labels[i]);
    }
    return map;
  };

  /**
   * ncdInput: {
   *     contents: [],
   *     labels: [],
   * }
   *
   *
   */

  interface NCDInput {
    contents: string[];
    labels: string[];
  }

  useEffect(() => {
    return () => {
      if (ncdWorker) {
        ncdWorker.terminate();
      }
    };
  }, [ncdWorker]);

  const resetSearchResult = (message: string) => {
    setErrorMsg(message);
    setNcdMatrix([]);
    setLabels([]);
    labelMapRef.current = new Map();
    setLabelMap(new Map());
    setHasMatrix(false);
    setQSearchTreeResult([]);
  };

  const resetDisplay = () => {
    setErrorMsg("");
    setNcdMatrix([]);
    setLabels([]);
    labelMapRef.current = new Map();
    setLabelMap(new Map());
    setHasMatrix(false);
    setQSearchTreeResult(null);
  };

  const handleQsearchMessage = (event: MessageEvent) => {
    if (event.data.action === "qsearchComplete") {
      console.log("Qsearch complete");
    } else if (event.data.action === "qsearchError") {
      console.error("Qsearch error: " + event.data.message);
    } else if (event.data.action === "consoleLog") {
      console.log(event.data.message);
    } else if (event.data.action === "consoleError") {
      console.error(event.data.message);
    } else if (event.data.action === "treeJSON") {
      const result = JSON.parse(event.data.result);
      for (let i = 0; i < result.nodes.length; i++) {
        result.nodes[i].label = labelMapRef.current.get(result.nodes[i].label);
      }
      setQSearchTreeResult(result);
    }
    setIsLoading(false);
  };

  return (
    <>
      <Header
        openLogin={openLogin}
        setOpenLogin={setOpenLogin}
        setAuthenticated={setAuthenticated}
      />
      <div style={{ margin: "20px", textAlign: "center", width: "1100px" }}>
        <ListEditor
          onComputedNcdInput={onNcdInput}
          labelMapRef={labelMapRef}
          setLabelMap={setLabelMap}
          setIsLoading={setIsLoading}
          resetDisplay={resetDisplay}
          setOpenLogin={setOpenLogin}
          authenticated={authenticated}
          initialSearchMode={getSearchModeParamAsObj()}
        />
        {isLoading && (
          <div
            className="flex items-center gap-2 text-slate-600"
            style={{
              paddingLeft: "20px",
              color: "#bfdbfe",
            }}
          >
            <Loader className="animate-spin" size={20} />
            <span>
              Computing result using {currentCompressor.toUpperCase()}...
            </span>
          </div>
        )}
        {!isLoading && (
          <MatrixTree
            hasMatrix={hasMatrix}
            ncdMatrix={ncdMatrix}
            labels={labels}
            confirmedSearchTerm={confirmedSearchTerm}
            errorMsg={errorMsg}
            qSearchTreeResult={qSearchTreeResult}
            executionTime={executionTime}
          />
        )}

        {compressionInfo && !isLoading && (
            <div className="mt-2 mb-4 flex items-center justify-center gap-2 text-sm">
              <div className={`px-3 py-1 rounded-full ${
                  compressionInfo.algorithm === 'gzip'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-purple-100 text-purple-700'
              }`}>
                {compressionInfo.algorithm.toUpperCase()}
              </div>
              <span className="text-gray-600">{compressionInfo.reason}</span>
            </div>
        )}
      </div>
    </>
  );
};

export default QSearch;
