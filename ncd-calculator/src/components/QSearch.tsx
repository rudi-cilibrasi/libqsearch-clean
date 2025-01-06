import React, { useRef, useState } from "react";
import QSearchWorker from "../workers/qsearchWorker.js?worker";
import { MatrixTree } from "./MatrixTree";
import ListEditor from "./ListEditor";
import Header from "./Header";
import { NCDProgress } from "./NCDProgress";
import { NCDInput } from "@/types/ncd";
import { useSearchParams } from "react-router-dom";
import { useCompression } from "@/hooks/useCompression";

interface QSearchProps {
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
  // State management
  const [ncdMatrix, setNcdMatrix] = useState<number[][]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [hasMatrix, setHasMatrix] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [qSearchTreeResult, setQSearchTreeResult] = useState<any[] | null>([]);
  const [labelMap, setLabelMap] = useState(new Map());
  const labelMapRef = useRef(labelMap);
  const [isLoading, setIsLoading] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<{
    algorithm: string;
    reason: string;
  } | null>(null);

  // Worker management
  const qSearchWorkerRef = useRef<Worker | null>(null);
  const [searchParams] = useSearchParams();

  // Initialize compression hook
  const {
    processContent,
    stats: compressionStats,
    error: compressionError
  } = useCompression({
    onProgress: (stats) => {
      console.log(`Processing: ${stats.processedPairs}/${stats.totalPairs} pairs`);
    }
  });

  // QSearch worker message handler
  const handleQsearchMessage = (event: MessageEvent) => {
    if (event.data.action === "treeJSON") {
      try {
        const result = JSON.parse(event.data.result);
        // Map labels using the current label map
        for (let i = 0; i < result.nodes.length; i++) {
          result.nodes[i].label = labelMapRef.current.get(result.nodes[i].label);
        }
        setQSearchTreeResult(result);
      } catch (error) {
        console.error("Error processing QSearch result:", error);
      }
    }
    setIsLoading(false);
  };

  // Initialize QSearch worker
  React.useEffect(() => {
    qSearchWorkerRef.current = new QSearchWorker();
    if (qSearchWorkerRef.current) {
      qSearchWorkerRef.current.onmessage = handleQsearchMessage;
    }

    return () => {
      if (qSearchWorkerRef.current) {
        qSearchWorkerRef.current.terminate();
      }
    };
  }, [searchParams]);

  // Handle NCD computation
  const onNcdInput = async (input: NCDInput) => {
    if (!input?.contents?.length || !input?.labels?.length) {
      setErrorMsg("Invalid input data");
      setIsLoading(false);
      return;
    }

    // Check authentication for large computations
    if (input.contents.length > 16 && !authenticated) {
      setOpenLogin(true);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMsg("");

      // Process content with appropriate compression
      const result = await processContent(input);

      if (!result) {
        throw new Error("Processing failed");
      }

      // Update compression info
      setCompressionInfo({
        algorithm: result.algorithm,
        reason: result.reason
      });

      // Display results
      const response = result.result;
      displayNcdMatrix(response);

    } catch (error) {
      console.error("Error processing input:", error);
      setErrorMsg(error instanceof Error ? error.message : "Processing failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Display matrix and trigger QSearch processing
  const displayNcdMatrix = (response: { labels: string[], ncdMatrix: number[][] }) => {
    const { labels: responseLabels, ncdMatrix: matrix } = response;

    // Map display names
    const displayNames = responseLabels.map(label => labelMapRef.current.get(label) || label);

    setLabels(displayNames);
    setNcdMatrix(matrix);
    setHasMatrix(true);

    // Trigger QSearch processing
    qSearchWorkerRef.current?.postMessage({
      action: "processNcdMatrix",
      labels: responseLabels,
      ncdMatrix: matrix,
    });
  };

  // Reset display state
  const resetDisplay = () => {
    setErrorMsg("");
    setNcdMatrix([]);
    setLabels([]);
    labelMapRef.current = new Map();
    setLabelMap(new Map());
    setHasMatrix(false);
    setQSearchTreeResult(null);
    setCompressionInfo(null);
  };

  return (
      <>
        <Header
            openLogin={openLogin}
            setOpenLogin={setOpenLogin}
            setAuthenticated={setAuthenticated}
        />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <ListEditor
              onComputedNcdInput={onNcdInput}
              labelMapRef={labelMapRef}
              setLabelMap={setLabelMap}
              setIsLoading={setIsLoading}
              resetDisplay={resetDisplay}
              setOpenLogin={setOpenLogin}
              authenticated={authenticated}
          />

          {/* Loading state */}
          {isLoading && (
              <div className="flex items-center gap-2 text-slate-600 my-4">
                {compressionInfo && (
                    <span>Computing result using {compressionInfo.algorithm.toUpperCase()}...</span>
                )}
                <NCDProgress stats={compressionStats}/>
              </div>
          )}

          {/* Error state */}
          {(errorMsg || compressionError) && (
              <div className="text-red-600 my-4">
                {errorMsg || compressionError}
              </div>
          )}

          {/* Results */}
          {!isLoading && (
              <MatrixTree
                  hasMatrix={hasMatrix}
                  ncdMatrix={ncdMatrix}
                  labels={labels}
                  errorMsg={errorMsg}
                  qSearchTreeResult={qSearchTreeResult}
              />
          )}

          {/* Compression info */}
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