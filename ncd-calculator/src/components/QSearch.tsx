import React, {useEffect, useRef, useState} from "react";
// @ts-ignore
import QSearchWorker from "../workers/qsearchWorker.js?worker";
import ListEditor from "./ListEditor";
import Header from "./Header";
import {NCDProgress} from "./NCDProgress";
import type {CompressionStats, NCDInput, NCDMatrixResponse} from "@/types/ncd";
import {useNCDCache} from "@/hooks/useNCDCache";
import {CompressionResponse, CompressionService} from "@/services/CompressionService";
import {useLabelManager} from "@/hooks/useLabelManager.ts";
import KGridVisualization from "@/components/KGridVisualization.tsx";
import {GridObject} from "@/services/kgrid.ts";
import {QTreeNode, QTreeResponse} from "@/components/QSearchTree3D.tsx";

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
  const [qSearchTreeResult, setQSearchTreeResult] = useState<QTreeResponse | undefined>();
  const [labelMap, setLabelMap] = useState(new Map());
  const labelMapRef = useRef(labelMap);
  const [isLoading, setIsLoading] = useState(false);
  const labelManager = useLabelManager();

  // Add gridObjects state for KGridVisualization
  const [gridObjects, setGridObjects] = useState<GridObject[]>([]);

  // Add optimization state tracking
  const [optimizationStartTime, setOptimizationStartTime] = useState<number | null>(null);
  // @ts-ignore
  const [optimizationEndTime, setOptimizationEndTime] = useState<number | null>(null);
  const [totalExecutionTime, setTotalExecutionTime] = useState<number | null>(null);
  const [iterationsPerSecond, setIterationsPerSecond] = useState<number | null>(null);
  // @ts-ignore
  const [iterations, setIterations] = useState(0);

  const [compressionInfo, setCompressionInfo] = useState<CompressionResponse | null>(null);
  const [compressionStats, setCompressionStats] = useState<CompressionStats>({
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

  // Add refs for tracking optimization performance
  const iterationCountRef = useRef(0);
  const lastUpdateTimeRef = useRef(Date.now());
  const ipsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Handle QSearch worker messages
  const handleQsearchMessage = (event: MessageEvent) => {
    if (event.data.action === "treeJSON") {
      try {
        const result = JSON.parse(event.data.result);
        result.nodes = result.nodes.map((node: QTreeNode) => ({
          ...node,
          label: labelManager.getDisplayLabel(node.label) || ""
        })) as QTreeResponse;
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

      // Clean up IPS interval
      if (ipsIntervalRef.current) {
        clearInterval(ipsIntervalRef.current);
      }
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
      const response: NCDMatrixResponse = result as NCDMatrixResponse;
      displayNcdMatrix(response);
      const { labels, ncdMatrix } = response;
      qSearchWorkerRef.current?.postMessage({
        action: "processNcdMatrix",
        labels: labels,
        ncdMatrix: ncdMatrix,
      });

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
    console.log('label from display matrix now: ' + JSON.stringify(responseLabels));
    setLabels(responseLabels);
    setNcdMatrix(matrix);
    setHasMatrix(true);

    // Create grid objects from the labels
    console.log('labelManager: ' + JSON.stringify(labelManager.getLabelMapping()));
    const objects: GridObject[] = responseLabels.map((label, index) => ({
      id: label,
      label: labelManager.getDisplayLabel(label) || 'Unknown',
      content: ncdMatrix[index]
    }));

    setGridObjects(objects);
  };

  // Reset display state
  const resetDisplay = () => {
    setErrorMsg("");
    setNcdMatrix([]);
    setLabels([]);
    setGridObjects([]);
    labelMapRef.current = new Map();
    setLabelMap(new Map());
    setHasMatrix(false);
    setQSearchTreeResult(undefined);
    setCompressionInfo(null);
    setCompressionStats({
      processedPairs: 0,
      totalPairs: 0,
      bytesProcessed: 0,
      startTime: 0,
      currentPair: null,
      lastNcdScore: null,
    });

    // Reset optimization state
    setOptimizationStartTime(null);
    setOptimizationEndTime(null);
    setTotalExecutionTime(null);
    setIterationsPerSecond(null);
    setIterations(0);

    // Clear any interval
    if (ipsIntervalRef.current) {
      clearInterval(ipsIntervalRef.current);
      ipsIntervalRef.current = null;
    }
  };

  // Optimization handlers for KGridVisualization
  const handleOptimizationStart = () => {
    const startTime = Date.now();
    setOptimizationStartTime(startTime);
    setOptimizationEndTime(null);
    iterationCountRef.current = 0;
    lastUpdateTimeRef.current = startTime;

    // Set up interval to calculate iterations per second
    ipsIntervalRef.current = setInterval(() => {
      const currentTime = Date.now();
      const elapsedSecs = (currentTime - lastUpdateTimeRef.current) / 1000;

      if (elapsedSecs > 0) {
        const ips = iterationCountRef.current / elapsedSecs;
        setIterationsPerSecond(ips);
        iterationCountRef.current = 0;
        lastUpdateTimeRef.current = currentTime;
      }
    }, 1000); // Update metrics every second
  };

  const handleIterationUpdate = (iteration: number) => {
    setIterations(iteration);
    iterationCountRef.current++;
  };

  const handleOptimizationEnd = () => {
    if (optimizationStartTime) {
      const endTime = Date.now();
      setOptimizationEndTime(endTime);
      setTotalExecutionTime(endTime - optimizationStartTime);

      // Clear the IPS update interval
      if (ipsIntervalRef.current) {
        clearInterval(ipsIntervalRef.current);
        ipsIntervalRef.current = null;
      }
    }
  };


  const getNcdMatrixResponse = (labels: string[], ncdMatrix: number[][]): NCDMatrixResponse => {
    return {
      labels,
      ncdMatrix
    }
  }

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
          {!isLoading && hasMatrix && labels.length > 0 && ncdMatrix.length > 0 && (
              <KGridVisualization
                  labelManager={labelManager}
                  objects={gridObjects}
                  maxIterations={50000}
                  onOptimizationStart={handleOptimizationStart}
                  onOptimizationEnd={handleOptimizationEnd}
                  onIterationUpdate={handleIterationUpdate}
                  qSearchTreeResult={qSearchTreeResult}
                  autoStart={true}
                  totalExecutionTime={totalExecutionTime || undefined}
                  iterationsPerSecond={iterationsPerSecond || undefined}
                  ncdMatrixResponse={getNcdMatrixResponse(labels, ncdMatrix)}
              />
          )}

          {/* Compression info */}
          {compressionInfo && !isLoading && (
              <div className="mt-2 mb-4 flex items-center justify-center gap-2 text-sm">
                <div
                    className={`px-3 py-1 rounded-full ${
                        compressionInfo.algorithm === "zstd"
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
