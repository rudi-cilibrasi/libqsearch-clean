/**
 * @module components/QSearch
 *
 * Main NCD calculator page component. Orchestrates the full pipeline:
 * 1. Receives user input (labels + contents) from ListEditor
 * 2. Dispatches compression to CompressionService (which manages web workers)
 * 3. Collects the NCD matrix and tracks compression progress
 * 4. Sends the matrix to the QSearch WASM worker for quartet tree construction
 * 5. Feeds results to tree visualization (3D/DOT) and KGrid visualization
 *
 * This is the central coordination point — it does not compute NCD itself,
 * but wires together all the services and workers.
 */

import React, {useEffect, useRef, useState} from "react";
// @ts-ignore
import QSearchWorker from "../workers/qsearchWorker.js?worker";
import ListEditor from "./ListEditor";
import Header from "./Header";
import {NCDProgress} from "./NCDProgress";
import type {CompressionStats, NCDInput, NCDMatrixResponse} from "@/types/ncd";
import {useNCDCache} from "@/hooks/useNCDCache";
import {CompressionService} from "@/services/CompressionService";
import type {CompressionResponse} from "@/services/CompressionService";
import KGridVisualization from "@/components/KGridVisualization.tsx";
import {GridObject} from "@/datastructures/kgrid.ts";
import type {QTreeNode, QTreeResponse} from "@/types/qsearch";
import {validateMatrix} from "@/functions/matrix.ts";
import {IMPORTED_MATRIX_PROVENANCE} from "@/services/CompressionProtocol";
import type {CompressionProvenance} from "@/types/compression";
import {getQSearchRunCount} from "@/services/QSearchProtocol";
import {createDisplayLabelMap, getDisplayLabel} from "@/services/DisplayLabelProtocol";
import "./Workbench.css";

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
	const [directedNcdMatrix, setDirectedNcdMatrix] = useState<number[][] | undefined>();
	const [labels, setLabels] = useState<string[]>([]);
	const [hasMatrix, setHasMatrix] = useState(false);
	const [errorMsg, setErrorMsg] = useState("");
	const [qSearchTreeResult, setQSearchTreeResult] = useState<QTreeResponse | undefined>();
	const [qSearchProgress, setQSearchProgress] = useState<{completed: number; total: number} | null>(null);
	const [matrixProvenance, setMatrixProvenance] = useState<CompressionProvenance>(IMPORTED_MATRIX_PROVENANCE);
	const [labelMap, setLabelMap] = useState<Map<string, string>>(new Map());
	const labelMapRef = useRef(labelMap);
	const [isLoading, setIsLoading] = useState(false);
	
	// Add gridObjects state for KGridVisualization
	const [gridObjects, setGridObjects] = useState<GridObject[]>([]);
	
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
	
	// Handle QSearch worker messages
	const handleQsearchMessage = (event: MessageEvent) => {
		if (event.data.action === "treeJSON") {
			try {
				const parsed = JSON.parse(event.data.result) as QTreeResponse;
				const result: QTreeResponse = {
					...parsed,
					nodes: parsed.nodes.map((node: QTreeNode) => ({
						...node,
						label: getDisplayLabel(labelMapRef.current, node.label),
					})),
				};
				setQSearchTreeResult(result);
				setQSearchProgress(null);
				setIsLoading(false);
			} catch (error) {
				console.error("Error processing QSearch result:", error);
				setErrorMsg("QSearch returned an invalid tree result");
				setIsLoading(false);
			}
		} else if (event.data.action === "qsearchProgress") {
			setQSearchProgress({
				completed: event.data.completedRuns,
				total: event.data.totalRuns,
			});
		} else if (event.data.action === "qsearchError") {
			setErrorMsg(`Tree search failed: ${event.data.message}`);
			setQSearchProgress(null);
			setIsLoading(false);
		}
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
		if (input.contents.length !== input.labels.length) {
			setErrorMsg("Object labels and contents must have the same length");
			setIsLoading(false);
			return;
		}
		const normalizedLabels = input.labels.map((label) => typeof label === "string" ? label.trim() : "");
		if (normalizedLabels.some((label) => !label) || new Set(normalizedLabels).size !== normalizedLabels.length) {
			setErrorMsg("Object labels must be non-empty and unique");
			setIsLoading(false);
			return;
		}
		
		// Check authentication for large computations
		if (input.contents.length > 16 && !authenticated) {
			setOpenLogin(true);
			return;
		}
		
		try {
			const computationInput: NCDInput = {...input, labels: normalizedLabels};
			const nextLabelMap = createDisplayLabelMap(normalizedLabels, input.displayLabels);
			labelMapRef.current = nextLabelMap;
			setLabelMap(nextLabelMap);

			setIsLoading(true);
			setErrorMsg("");
			setQSearchTreeResult(undefined);
			setQSearchProgress(null);
			setCompressionInfo(null);
			setCompressionStats({
				processedPairs: 0,
				totalPairs: 0,
				bytesProcessed: 0,
				startTime: 0,
				currentPair: null,
				lastNcdScore: null,
			});
			const isImportedMatrix = computationInput.kind === "distance-matrix";
			
			if (isImportedMatrix) {
				console.log("Processing imported matrix data without compression");
				
				// Create NCD matrix directly from imported data
				const ncdMatrix: number[][] = computationInput.contents.map((content, rowIndex) => {
					try {
						const row: unknown = JSON.parse(content);
						if (!Array.isArray(row)) throw new Error("row is not an array");
						return row as number[];
					} catch (error) {
						const reason = error instanceof Error ? error.message : "invalid JSON";
						throw new Error(`Invalid distance-matrix row ${rowIndex + 1}: ${reason}`);
					}
				});
				const validationError = validateMatrix(computationInput.labels, ncdMatrix);
				if (validationError) {
					throw new Error(`Invalid distance matrix: ${validationError}`);
				}
				
				// Create the response object
				const response: NCDMatrixResponse = {
					labels: computationInput.labels,
					ncdMatrix: ncdMatrix,
					provenance: IMPORTED_MATRIX_PROVENANCE,
				};
				
				// Display the matrix
				displayNcdMatrix(response);
				
				// Send to worker for tree generation
				console.log("Sending imported matrix to worker for tree generation");
				if (!qSearchWorkerRef.current) throw new Error("QSearch worker is not ready");
				setQSearchProgress({completed: 0, total: getQSearchRunCount(computationInput.labels.length)});
				qSearchWorkerRef.current.postMessage({
					action: "processNcdMatrix",
					labels: computationInput.labels,
					ncdMatrix: ncdMatrix,
				});
				setCompressionInfo(null);
			} else {
				const emptyObjectIndex = computationInput.contents.findIndex(
					(content) => typeof content !== "string" || content.trim().length === 0,
				);
				if (emptyObjectIndex >= 0) {
					throw new Error(`Object "${getDisplayLabel(nextLabelMap, computationInput.labels[emptyObjectIndex])}" has no content`);
				}
				// Normal compression-based processing for non-imported data
				const prepared = await CompressionService.preprocessNcdInput(computationInput, ncdCache);
				const compressionDecision: CompressionResponse = prepared;
				
				setCompressionInfo(compressionDecision);
				
				const result = await compressionServiceRef.current.processContent(
					{
						...computationInput,
						contentKeys: prepared.contentKeys,
						cachedSizes: prepared.cachedSizes.size > 0 ? prepared.cachedSizes : undefined,
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
				const response: NCDMatrixResponse = result;
				displayNcdMatrix(response);
				const {labels, ncdMatrix} = response;
				
				console.log("Sending matrix to QSearchWorker for processing", {
					labelCount: labels.length,
					matrixSize: ncdMatrix.length,
				});
				setCompressionInfo(null);
				if (!qSearchWorkerRef.current) throw new Error("QSearch worker is not ready");
				setQSearchProgress({completed: 0, total: getQSearchRunCount(labels.length)});
				qSearchWorkerRef.current.postMessage({
					action: "processNcdMatrix",
					labels: labels,
					ncdMatrix: ncdMatrix,
				});
				
				// Update cache with new compression data
				ncdCache.storeCompressionRecords(
					compressionDecision.algorithm,
					result.singleCompressionData,
					result.pairCompressionData,
				);
			}
		} catch (error) {
			console.error("Error in onNcdInput:", error);
			setErrorMsg(error instanceof Error ? error.message : "Processing failed");
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
		
		// Update state variables
		setLabels(responseLabels);
		setNcdMatrix(matrix);
		setDirectedNcdMatrix(response.directedNcdMatrix);
		setMatrixProvenance(response.provenance);
		setHasMatrix(true);
		
		// Create grid objects from the labels
		const objects: GridObject[] = responseLabels.map((label, index) => {
			return {
				id: label,
				label: getDisplayLabel(labelMapRef.current, label),
				content: matrix[index]
			};
		});
		setGridObjects(objects);
		
		// Update labelMap reference for components that need it
		const newMapping = new Map<string, string>();
		responseLabels.forEach(label => {
			newMapping.set(label, getDisplayLabel(labelMapRef.current, label));
		});
		labelMapRef.current = newMapping;
		setLabelMap(newMapping);
	};
	
	// Reset display state
	const resetDisplay = () => {
		setErrorMsg("");
		setNcdMatrix([]);
		setDirectedNcdMatrix(undefined);
		setLabels([]);
		setGridObjects([]);
		labelMapRef.current = new Map();
		setLabelMap(new Map());
		setHasMatrix(false);
		setQSearchTreeResult(undefined);
		setQSearchProgress(null);
		setMatrixProvenance(IMPORTED_MATRIX_PROVENANCE);
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
		<div className="ncd-workbench">
			<Header
				openLogin={openLogin}
				setOpenLogin={setOpenLogin}
				setAuthenticated={setAuthenticated}
			/>
			<main className="workbench-page">
				<ListEditor
					qTreeResponse={qSearchTreeResult}
					onComputedNcdInput={onNcdInput}
					setIsLoading={setIsLoading}
					resetDisplay={resetDisplay}
					setOpenLogin={setOpenLogin}
					authenticated={authenticated}
				/>
				
				{isLoading && (
					<section className="workbench-computation" aria-live="polite" aria-label="NCD computation progress">
						{compressionInfo && (
							<p>Computing pairwise distances with {compressionInfo.algorithm.toUpperCase()}.</p>
						)}
						{qSearchProgress && (
							<p>Building the quartet tree…</p>
						)}
						{!qSearchProgress && <NCDProgress stats={compressionStats}/>}
					</section>
				)}
				
				{errorMsg && <div className="workbench-message workbench-message--error" role="alert">{errorMsg}</div>}
				
				{!isLoading && hasMatrix && labels.length > 0 && ncdMatrix.length > 0 && (
					<section className="workbench-results" aria-labelledby="results-title">
						<header className="workbench-results__header">
							<h2 id="results-title">Similarity</h2>
							<span>{labels.length} objects · {labels.length * (labels.length - 1) / 2} pairs</span>
						</header>
						<KGridVisualization
							labelMap={labelMap}
							objects={gridObjects}
							maxIterations={100000}
							qSearchTreeResult={qSearchTreeResult}
							autoStart={true}
							ncdMatrixResponse={{labels, directedNcdMatrix, ncdMatrix, provenance: matrixProvenance}}
						/>
					</section>
				)}
				
			</main>
		</div>
	);
};

export default QSearch;
