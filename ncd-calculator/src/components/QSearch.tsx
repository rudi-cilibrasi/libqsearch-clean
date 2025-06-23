import React, {useEffect, useRef, useState} from "react";
// @ts-ignore
import QSearchWorker from "../workers/qsearchWorker.js?worker";
import ListEditor from "./ListEditor";
import Header from "./Header";
import {NCDProgress} from "./NCDProgress";
import type {CompressionStats, NCDInput, NCDMatrixResponse} from "@/types/ncd";
import {useNCDCache} from "@/hooks/useNCDCache";
import {CompressionResponse, CompressionService} from "@/services/CompressionService";
import KGridVisualization from "@/components/KGridVisualization.tsx";
import {GridObject} from "@/datastructures/kgrid.ts";
import {QTreeNode, QTreeResponse} from "@/components/QSearchTree3D.tsx";
import {LabelManager} from "@/functions/labelUtils.ts";

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
	const labelManager = LabelManager.getInstance();
	
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
				// Store the raw tree result - don't process labels here
				// Let the QSearchTree3D component handle label display using labelManager
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
			
			// Only clear mappings if we detect this is a new calculation with different labels
			// This preserves animal names from FASTA search selections
			const existingLabels = Array.from(labelManager.getAllMappings().keys());
			const hasNewLabels = input.labels.some(label => !existingLabels.includes(label));
			const hasFewerLabels = input.labels.length < existingLabels.length;
			
			if (hasNewLabels || hasFewerLabels) {
				console.log("Clearing label mappings for new calculation");
				labelManager.clear();
			} else {
				console.log("Preserving existing label mappings");
			}
			
			// Register all input labels with themselves as display labels
			input.labels.forEach((label) => {
				// Only register if no mapping exists yet (preserves enhanced labels from matrix import)
				const existingMapping = labelManager.getDisplayLabel(label);
				if (!existingMapping) {
					labelManager.registerLabel(label, label);
					console.log(`Registered label: ${label} → ${label}`);
				} else {
					console.log(`Preserved existing label mapping: ${label} → ${existingMapping}`);
				}
			});
			
			// Detect if this is imported matrix data by checking content format
			const isImportedMatrix = input.contents.some(content => {
				try {
					const parsed = JSON.parse(content);
					return Array.isArray(parsed) && parsed.length === input.labels.length;
				} catch {
					return false;
				}
			});
			
			if (isImportedMatrix) {
				console.log("Processing imported matrix data without compression");
				
				// For imported matrices, preserve existing enhanced labels and only add sanitized mappings if needed
				input.labels.forEach((label) => {
					const existingMapping = labelManager.getDisplayLabel(label);
					
					if (existingMapping && existingMapping !== label) {
						// Enhanced mapping already exists, preserve it
						console.log(`Preserved enhanced mapping: ${label} → ${existingMapping}`);
					} else {
						// No enhanced mapping, register with itself
						labelManager.registerLabel(label, label);
						console.log(`Registered original: ${label} → ${label}`);
					}
					
					// Also register sanitized version mapping back to the display label (or original)
					const sanitized = labelManager.sanitizeForQSearch(label);
					if (sanitized !== label) {
						const displayLabel = existingMapping || label;
						labelManager.registerLabel(sanitized, displayLabel);
						console.log(`Registered sanitized: ${sanitized} → ${displayLabel}`);
					}
				});
				
				// Create NCD matrix directly from imported data
				const ncdMatrix = input.contents.map(content => {
					try {
						return JSON.parse(content);
					} catch {
						// If parsing fails, create a dummy row with zeros
						return Array(input.labels.length).fill(0);
					}
				});
				
				// Create the response object
				const response: NCDMatrixResponse = {
					labels: input.labels,
					ncdMatrix: ncdMatrix
				};
				
				// Display the matrix
				displayNcdMatrix(response);
				
				// Send to worker for tree generation
				console.log("Sending imported matrix to worker for tree generation");
				qSearchWorkerRef.current?.postMessage({
					action: "processNcdMatrix",
					labels: input.labels,
					ncdMatrix: ncdMatrix,
				});
			} else {
				// Normal compression-based processing for non-imported data
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
				const {labels, ncdMatrix} = response;
				
				console.log("Sending matrix to QSearchWorker for processing", {
					labelCount: labels.length,
					matrixSize: ncdMatrix.length,
				});
				
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
			}
		} catch (error) {
			console.error("Error in onNcdInput:", error);
			setErrorMsg(error instanceof Error ? error.message : "Processing failed");
		} finally {
			setIsLoading(false);
		}
	};


// Updated displayNcdMatrix function with improved label handling and debugging
	/**
	 * Updated displayNcdMatrix function that properly maintains the mapping
	 * between accession IDs and their display labels
	 */
	const displayNcdMatrix = (response: NCDMatrixResponse) => {
		const {labels: responseLabels, ncdMatrix: matrix} = response;
		console.log('Display matrix called with labels: ' + JSON.stringify(responseLabels));
		
		// Debug labelManager state before processing
		console.log('Initial LabelManager state:');
		labelManager.logMappings();
		
		// Update state variables
		setLabels(responseLabels);
		setNcdMatrix(matrix);
		setHasMatrix(true);
		
		// Create grid objects from the labels
		const objects: GridObject[] = responseLabels.map((label, index) => {
			// Get the existing display label if it exists
			const displayLabel = labelManager.getDisplayLabel(label);
			
			console.log(`Creating grid object for ${label} with display label: ${displayLabel || 'none'}`);
			
			return {
				id: label,
				label: displayLabel || label,
				content: matrix[index]
			};
		});
		
		console.log('Created grid objects:', objects);
		setGridObjects(objects);
		
		// Update labelMap reference for components that need it
		const newMapping = new Map<string, string>();
		responseLabels.forEach(label => {
			const displayLabel = labelManager.getDisplayLabel(label) || label;
			newMapping.set(label, displayLabel);
		});
		
		console.log('New label mapping:', Array.from(newMapping.entries()));
		labelMapRef.current = newMapping;
		setLabelMap(newMapping);
		
		// Log the final state of the LabelManager
		console.log('Final LabelManager state:');
		labelManager.logMappings();
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
			<div className="w-full min-h-screen bg-gray-950">
				<div className="w-full max-w-none xl:max-w-[1600px] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
					<ListEditor
						qTreeResponse={qSearchTreeResult}
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
						<div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-slate-300 my-4 p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-sm">
							{compressionInfo && (
								<span className="text-sm sm:text-base text-gray-200">
	                Computing result using {compressionInfo.algorithm.toUpperCase()}
									...
	              </span>
							)}
							<NCDProgress stats={compressionStats}/>
						</div>
					)}
					
					{/* Error state */}
					{errorMsg && (
						<div className="text-red-300 my-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-sm sm:text-base">
							{errorMsg}
						</div>
					)}
					
					{/* Results */}
					{!isLoading && hasMatrix && labels.length > 0 && ncdMatrix.length > 0 && (
						<div className="mt-6">
							<KGridVisualization
								labelManager={labelManager}
								objects={gridObjects}
								maxIterations={100000}
								onOptimizationStart={handleOptimizationStart}
								onOptimizationEnd={handleOptimizationEnd}
								onIterationUpdate={handleIterationUpdate}
								qSearchTreeResult={qSearchTreeResult}
								autoStart={true}
								totalExecutionTime={totalExecutionTime || undefined}
								iterationsPerSecond={iterationsPerSecond || undefined}
								ncdMatrixResponse={getNcdMatrixResponse(labels, ncdMatrix)}
							/>
						</div>
					)}
					
					{/* Compression info */}
					{compressionInfo && !isLoading && (
						<div className="mt-2 mb-4 flex flex-col sm:flex-row items-center justify-center gap-2 text-sm p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-sm">
							<div
								className={`px-3 py-1 rounded-full text-xs sm:text-sm ${
									compressionInfo.algorithm === "zstd"
										? "bg-blue-900/50 text-blue-300 border border-blue-700"
										: compressionInfo.algorithm === "lzma"
											? "bg-purple-900/50 text-purple-300 border border-purple-700"
											: "bg-green-900/50 text-green-300 border border-green-700"
								}`}
							>
								{compressionInfo.algorithm.toUpperCase()}
							</div>
							<span className="text-gray-300 text-center sm:text-left text-xs sm:text-sm">
								{compressionInfo.reason}
							</span>
						</div>
					)}
				</div>
			</div>
		</>
	);
};

export default QSearch;
