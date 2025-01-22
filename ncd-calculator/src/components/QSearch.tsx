import React, {useEffect, useRef, useState} from "react";
import QSearchWorker from "../workers/qsearchWorker.js?worker";
import {MatrixTree} from "./MatrixTree";
import ListEditor from "./ListEditor";
import Header from "./Header";
import {NCDProgress} from "./NCDProgress";
import type {CompressionStats, NCDInput, NCDMatrixResponse, WorkerResultMessage} from "@/types/ncd";
import {useNCDCache} from "@/hooks/useNCDCache";
import {type CompressionAlgorithm, CompressionResponse, CompressionService} from "@/services/CompressionService";
import {CRCCacheEntry} from "@/cache/CRCCache.ts";
import {calculateCRC32} from "@/workers/shared/utils.ts";
import {useLabelManager} from "@/hooks/useLabelManager.ts";

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
                                                  setAuthenticated,
                                                }) => {
  const [ncdMatrix, setNcdMatrix] = useState<number[][]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [hasMatrix, setHasMatrix] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [qSearchTreeResult, setQSearchTreeResult] = useState<any[] | null>([]);
  const [labelMap, setLabelMap] = useState(new Map());
  const labelMapRef = useRef(labelMap);
  const [isLoading, setIsLoading] = useState(false);
  const labelManager = useLabelManager();
  const [compressionInfo, setCompressionInfo] = useState<{
    algorithm: CompressionAlgorithm;
    reason: string;
  } | null>(null);
  const [compressionStats, setCompressionStats] = useState({
    processedPairs: 0,
    totalPairs: 0,
    bytesProcessed: 0,
    startTime: 0,
    currentPair: null as [number, number] | null,
    lastNcdScore: null as number | null,
  });

  // Service and worker references
  const qSearchWorkerRef = useRef<Worker | null>(null);
  const compressionServiceRef = useRef<CompressionService>(
      CompressionService.getInstance()
  );
  const ncdCache = useNCDCache();

  // Handle QSearch worker messages
  const handleQsearchMessage = (event: MessageEvent) => {
    if (event.data.action === "treeJSON") {
      try {
        const result = JSON.parse(event.data.result);
        result.nodes = result.nodes.map(node => ({
          ...node,
          label: labelManager.getDisplayLabel(node.label) || ""
        }));
        setQSearchTreeResult(result);
      } catch (error) {
        console.error("Error processing QSearch result:", error);
      }
    }
    setIsLoading(false);
  };

  // Initialize QSearch worker
  useEffect(() => {
    qSearchWorkerRef.current = new QSearchWorker();
    if (qSearchWorkerRef.current) {
      qSearchWorkerRef.current.onmessage = handleQsearchMessage;
    }

    return () => {
      qSearchWorkerRef.current?.terminate();
      compressionServiceRef.current.terminate();
    };
  }, []);

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

      const [compressionDecision, cachedSizes] = CompressionService.preprocessNcdInput(input, ncdCache);

      setCompressionInfo(compressionDecision);

      const result = await compressionServiceRef.current.processContent(
          {
            ...input,
            cachedSizes: cachedSizes.size > 0 ? cachedSizes : undefined,
            algorithm: compressionDecision.algorithm,
          },
          (message) => {
            console.log(`Receiving new message from ${compressionDecision.algorithm} compression worker: ${JSON.stringify(message)}`)
            switch (message.type) {
              case "start":
                setCompressionStats((prev) => ({
                  ...prev,
                  totalPairs: message.totalPairs || 0,
                  startTime: performance.now(),
                }));
                break;
              case "progress":
                setCompressionStats((prev) => {
                      const newCompressionStats = {
                        ...prev,
                        processedPairs: prev.processedPairs + 1,
                        bytesProcessed: prev.bytesProcessed + (message.sizeXY || 0),
                        currentPair:
                            message.i !== undefined && message.j !== undefined
                                ? [message.i, message.j]
                                : null,
                        lastNcdScore: message.value || null,
                      }
                      return newCompressionStats as CompressionStats;
                    }
                );
                break;
            }
          }
      );

      if (!result) {
        throw new Error("Processing failed");
      }

      // Display results
      displayNcdMatrix(result as WorkerResultMessage);

      // Update cache with new compression data
      if ("newCompressionData" in result && result.newCompressionData) {
        result.newCompressionData.forEach((data) => {
          ncdCache.storeCompressedSize(
              compressionDecision.algorithm,
              [data.key1],
              data.size1
          );
          ncdCache.storeCompressedSize(
              compressionDecision.algorithm,
              [data.key2],
              data.size2
          );
          ncdCache.storeCompressedSize(
              compressionDecision.algorithm,
              [data.key1, data.key2].sort(),
              data.combinedSize
          );
        });
      }
    } catch (error) {
      console.error("Error in onNcdInput:", error);
      setErrorMsg(error instanceof Error ? error.message : "Processing failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Display matrix and trigger QSearch processing
  const displayNcdMatrix = (response: NCDMatrixResponse) => {
    const { labels: responseLabels, ncdMatrix: matrix } = response;
    const displayNames = responseLabels
        .filter(label => labelManager.hasDisplayLabel(label))
        .map(label => labelManager.getDisplayLabel(label) || label);
    setLabels(displayNames);
    setNcdMatrix(matrix);
    setHasMatrix(true);
    qSearchWorkerRef.current?.postMessage({
      action: "processNcdMatrix",
      labels: responseLabels.map(label => labelManager.normalizeId(label)),
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
    setCompressionStats({
      processedPairs: 0,
      totalPairs: 0,
      bytesProcessed: 0,
      startTime: 0,
      currentPair: null,
      lastNcdScore: null,
    });
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
                    <span>
                Computing result using {compressionInfo.algorithm.toUpperCase()}
                      ...
              </span>
                )}
                <NCDProgress stats={compressionStats}/>
              </div>
          )}

          {/* Error state */}
          {errorMsg && <div className="text-red-600 my-4">{errorMsg}</div>}

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
                <div
                    className={`px-3 py-1 rounded-full ${
                        compressionInfo.algorithm === "gzip"
                            ? "bg-blue-100 text-blue-700"
                            : compressionInfo.algorithm === "lzma"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-green-100 text-green-700"
                    }`}
                >
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
