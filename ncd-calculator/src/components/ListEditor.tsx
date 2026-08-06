/**
 * @module components/ListEditor
 *
 * Input management component for the NCD calculator. Provides three input modes:
 * - **FASTA Search** — Search NCBI GenBank for DNA/protein sequences by accession or name
 * - **File Upload** — Drag-and-drop or browse for local files (any format)
 * - **Languages** — Select UDHR (Universal Declaration of Human Rights) translations
 *
 * Manages the list of selected items, handles content resolution (e.g., fetching
 * FASTA sequences from GenBank), and triggers NCD computation by passing
 * { labels[], contents[] } up to the parent QSearch component.
 */

import React, {useEffect, useRef, useState} from "react";
import {AlertCircle, Dna, Download, FileType2, FlaskConical, Globe2, Upload} from "lucide-react";
import {getTranslationResponse} from "../functions/udhr";
import {InputHolder} from "./InputHolder.tsx";
import {Language} from "./Language";
import {cacheTranslation, getTranslationCache, useStorageState} from "../cache/cache";
import {FastaSearch} from "./FastaSearch";
import {FileUpload} from "./FileUpload";
import {LocalStorageKeyManager, LocalStorageKeys} from "../cache/LocalStorageKeyManager";
import {getFastaSequences} from "../functions/getPublicGenbank";
import {FASTA, FILE_UPLOAD, LANGUAGE} from "../constants/modalConstants";
import {useSearchParams} from "react-router-dom";
import {CompressionService} from "@/services/CompressionService";
import {NCDImportFormat} from "@/types/ncd";
import {LabelManager} from "@/functions/labelUtils.ts";
import createGraph from "@/functions/graphExport.ts";
import {saveAs} from "file-saver";
import {QTreeResponse} from "@/components/tree";
import {getWorkbenchExampleItems} from "./workbenchExamples";
import type {SelectedItem} from "./workbenchTypes";
export type {SelectedItem} from "./workbenchTypes";
export interface SearchMode {
	searchMode: string;
}

export interface FastaSequenceResponse {
	accessions: string[];
	contents: string[];
}

export interface ProcessedFastaItem {
	sequence: string;
	accession: string;
}

export interface NcdInput {
	labels: string[];
	contents: string[];
}

interface ListEditorProps {
	onComputedNcdInput: (input: NcdInput) => void;
	labelMapRef: React.MutableRefObject<Map<string, string>>;
	setLabelMap: (map: Map<string, string>) => void;
	setIsLoading: (loading: boolean) => void;
	resetDisplay: () => void;
	setOpenLogin: (open: boolean) => void;
	authenticated: boolean;
	initialSearchMode?: SearchMode | null;
	qTreeResponse?: QTreeResponse | null;
}

const ListEditor: React.FC<ListEditorProps> = ({
	                                               onComputedNcdInput,
	                                               setIsLoading,
	                                               resetDisplay,
	                                               initialSearchMode,
	                                               qTreeResponse
                                               }) => {
	
	const [importError, setImportError] = React.useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [hasImportedMatrix, setHasImportedMatrix] = useState<boolean>(false);
	const [isAutoProcessing, setIsAutoProcessing] = useState<boolean>(false);
	
	
	const triggerFileInput = () => {
		if (fileInputRef.current) {
			fileInputRef.current.click();
		}
	}
	
	
	// Updated handleMatrixImport function with improved label handling
	const handleMatrixImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		
		try {
			setImportError(null);
			const content = await file.text();
			const data = JSON.parse(content) as NCDImportFormat;
			
			// Validate the imported data
			if (!data.labels || !Array.isArray(data.labels) || !data.distances || !Array.isArray(data.distances)) {
				throw new Error('Invalid format: missing labels or distances arrays');
			}
			
			if (data.labels.length !== data.distances.length) {
				throw new Error('Invalid format: number of labels must match number of rows in distance matrix');
			}
			
			// Check if all distance rows have the correct length
			for (const row of data.distances) {
				if (!Array.isArray(row) || row.length !== data.labels.length) {
					throw new Error('Invalid format: each row in distance matrix must have the same length as labels array');
				}
			}
			
			// Clear existing selected items and reset display
			resetDisplay();
			setSelectedItems([]);
			
			// Get LabelManager instance
			const labelManager = LabelManager.getInstance();
			
			// Create items for each label in the matrix
			const importedItems: SelectedItem[] = data.labels.map((label, index) => {
				// Register for display and sanitization
				labelManager.registerLabel(label, label);
				
				return {
					id: label,
					label: label,
					type: FILE_UPLOAD,
					content: JSON.stringify(data.distances[index]),
				};
			});
			
			// Update selected items
			setSelectedItems(importedItems);
			
			// Set flag that we've imported a matrix
			setHasImportedMatrix(true);
			
			console.log('Successfully imported matrix data with', importedItems.length, 'items');
			
			// Reset the file input
			if (fileInputRef.current) {
				fileInputRef.current.value = '';
			}
			
			await processImportedMatrix(importedItems);
			
		} catch (err) {
			console.error('Error importing file:', err);
			setImportError(err instanceof Error ? err.message : 'Unknown error importing file');
			
			// Reset the file input
			if (fileInputRef.current) {
				fileInputRef.current.value = '';
			}
		}
	};
	
	
	const processImportedMatrix = async (importedItems: SelectedItem[]): Promise<void> => {
		try {
			console.log("Automatically processing imported matrix data...");
			setIsLoading(true);
			setIsAutoProcessing(true);
			setImportError(null);
			const labels: string[] = [];
			const contents: string[] = [];
			
			importedItems.forEach(item => {
				labels.push(item.id);
				contents.push(item.content || "");
			});
			
			await onComputedNcdInput({labels, contents});
			setIsAutoProcessing(false);
			
			console.log("Automatic processing of imported matrix complete");
		} catch (error) {
			console.error("Error in automatic processing:", error);
			setImportError(error instanceof Error ? error.message : "Failed to process imported matrix");
		}
	};
	
	
	const handleExportMatrix = (): void => {
		
		const dotFormat = createGraph(qTreeResponse as Parameters<typeof createGraph>[0], false);
		
		const blob = new Blob([dotFormat], {type: "text/plain;charset=utf-8"});
		saveAs(blob, "matrix_structure.dot");
	};
	
	const defaultSearchMode = {
		searchMode: initialSearchMode?.searchMode || FASTA
	};
	
	const [searchMode, setSearchMode] = useStorageState<SearchMode>(
		"searchMode",
		defaultSearchMode
	);
	
	const [selectedItems, setSelectedItems] = useStorageState<SelectedItem[]>(
		"selectedItems",
		[]
	);
	
	const apiKey = import.meta.env.VITE_NCBI_API_KEY ?? "";
	
	const [fastaSuggestionStartIndex, setFastaSuggestionStartIndex] =
		React.useState<Record<string, number>>({});
	
	// Constants and Refs
	const MIN_ITEMS = 4;
	const localStorageManager = LocalStorageKeyManager.getInstance();
	const compressionServiceRef = useRef(CompressionService.getInstance());
	const [, setSearchParams] = useSearchParams();
	
	// Computed values
	const isSearchDisabled =
		selectedItems.length < MIN_ITEMS ||
		(searchMode.searchMode === "fasta" && !apiKey && selectedItems.length < MIN_ITEMS);
	const isClearDisabled = selectedItems.length === 0;
	
	const labelManager = LabelManager.getInstance();
	
	// Initialize local storage and check version
	useEffect(() => {
		localStorageManager.initialize();
		if (localStorageManager.getStoredVersion() !== localStorageManager.getCurrentVersion()) {
			setSelectedItems([]);
		}
		
		// Initialize compression service
		compressionServiceRef.current.initialize();
		
		return () => {
			compressionServiceRef.current.terminate();
		};
	}, []);
	
	// Update search mode when initialSearchMode changes
	useEffect(() => {
		if (initialSearchMode) {
			setSearchMode(initialSearchMode);
		}
	}, [initialSearchMode]);
	
	const setMode = (mode: string) => {
		setSearchMode({
			searchMode: mode
		});
		setSearchParams({searchMode: mode});
	};
	
	const sendNcdInput = async (): Promise<void> => {
		// if (selectedItems && selectedItems.length > 16 && !authenticated) {
		// 	setOpenLogin(true);
		// 	return;
		// }
		setIsLoading(true);
		try {
			const labelManager = LabelManager.getInstance();
			// pre-register all labels regardless processing part
			selectedItems.forEach((item) => {
				labelManager.registerLabel(item.id, item.label);
			})
			
			if (hasImportedMatrix) {
				const labels: string[] = [];
				const contents: string[] = [];
				selectedItems.forEach(item => {
					labels.push(item.id);
					contents.push(item.content || "");
					
					if (!labelManager.getDisplayLabel(item.id)) {
						labelManager.registerLabel(item.id, item.id);
					}
				});
				// process the input directly
				await onComputedNcdInput({labels, contents} as NcdInput);
			} else {
				const computedNcdInput = await computeNcdInput(selectedItems);
				// update the items with their computed content
				const ncdSelectedItems = updateLabelsWithComputedContent(computedNcdInput, selectedItems);
				
				// covert to the format expected by the NCD processor
				const input = {
					labels: ncdSelectedItems.map((item) => item.id),
					contents: ncdSelectedItems.map((item) => item.content || "")
				} as NcdInput;
				await onComputedNcdInput(input);
			}
		} catch (error) {
			console.error("Error processing NCD input:", error);
		} finally {
			setIsLoading(false);
		}
	};
	
	const computeNcdInput = async (selectedItems: SelectedItem[]): Promise<SelectedItem[]> => {
		const langItems = selectedItems.filter((item) => item.type === LANGUAGE);
		const fastaItems = selectedItems.filter(
			(item) => item.type === FASTA || item.type === FILE_UPLOAD
		);
		
		const orderMap = getOrderMap(selectedItems);
		const langNcdInput = await computeLanguageNcdInput(langItems);
		const fastaNcdInput = getCachedFastaContent(fastaItems);
		
		const needComputeFastaList = await computeFastaNcdInput(
			fastaItems.filter((item) => !item.content || item.content.trim() === ""),
			apiKey
		);
		
		const mergedFastaInput = [
			...fastaNcdInput,
			...(needComputeFastaList || []),
		];
		
		return mergeAndPreserveInitialOrder(langNcdInput, mergedFastaInput, orderMap);
	};
	
	
	const updateLabelsWithComputedContent = (
		computedItems: SelectedItem[],
		selectedItems: SelectedItem[]
	) => {
		const itemMap = new Map<string, SelectedItem>();
		selectedItems.forEach(item => {
			itemMap.set(item.id, {...item});
		});
		computedItems.forEach((computed) => {
			const item = itemMap.get(computed.id);
			if (item && computed.content) {
				item.content = computed.content;
			}
		})
		
		return Array.from(itemMap.values());
	}
	
	
	const getCachedFastaContent = (items: SelectedItem[]): SelectedItem[] => {
		const res = items.filter(
			(item) => item.content && item.content.trim() !== ""
		);
		
		const withoutContent = items.filter(
			(item) => !item.content || item.content.trim() === ""
		);
		
		for (let i = 0; i < withoutContent.length; i++) {
			const item = withoutContent[i];
			const sequence = localStorageManager.get<string>(LocalStorageKeys.ACCESSION_SEQUENCE, item.id) || "";
			if (sequence && sequence.trim() !== "") {
				item.content = sequence;
				res.push(item);
			}
		}
		
		return res;
	};
	
	const getOrderMap = (selectedItems: SelectedItem[]): Map<string, number> => {
		const map = new Map<string, number>();
		for (let i = 0; i < selectedItems.length; i++) {
			map.set(selectedItems[i].id, i);
		}
		return map;
	};
	
	const mergeAndPreserveInitialOrder = (
		result1: SelectedItem[],
		result2: SelectedItem[],
		order: Map<string, number>
	): SelectedItem[] => {
		const arr: (SelectedItem | undefined)[] = [];
		
		for (let i = 0; i < result1.length; i++) {
			const index = order.get(result1[i].id);
			if (index !== undefined) arr[index] = result1[i];
		}
		
		for (let i = 0; i < result2.length; i++) {
			const index = order.get(result2[i].id);
			if (index !== undefined) arr[index] = result2[i];
		}
		
		const rs = shiftLeft(arr);
		return rs.filter((item): item is SelectedItem => item !== undefined);
	};
	
	const shiftLeft = (arr: (SelectedItem | undefined)[]): (SelectedItem | undefined)[] => {
		let result = [...arr];
		for (let i = 0; i < arr.length; i++) {
			if (!arr[i]) {
				result = shiftLeftAndGet(result, i);
			}
		}
		return result;
	};
	
	const shiftLeftAndGet = (
		arr: (SelectedItem | undefined)[],
		index: number
	): (SelectedItem | undefined)[] => {
		const result = [...arr];
		for (let i = index + 1; i < result.length; i++) {
			result[i - 1] = result[i];
		}
		return result;
	};
	
	const computeLanguageNcdInput = async (langItems: SelectedItem[]): Promise<SelectedItem[]> => {
		if (!langItems || langItems.length === 0) return [];
		const pendingRs = langItems.map((item) => getCompleteLanguageItem(item));
		return await Promise.all(pendingRs);
	};
	
	const getCompleteLanguageItem = async (selectedItem: SelectedItem): Promise<SelectedItem> => {
		const lang = selectedItem.id;
		let translationCached = getTranslationCache(lang);
		if (!translationCached) {
			const text = await getTranslationResponse(lang);
			if (text && text.trim() !== "") {
				cacheTranslation(lang, text);
			}
			translationCached = text;
		}
		return {
			...selectedItem,
			content: translationCached,
		};
	};
	
	const computeFastaNcdInput = async (
		fastaItems: SelectedItem[],
		_apiKey: string
	): Promise<SelectedItem[]> => {
		if (!isValidInput(fastaItems)) return [];
		try {
			const searchResults = await fetchFastaSequenceAndProcess(fastaItems);
			if (searchResults.length === 0) return [];
			cacheAccessionSequence(searchResults);
			return searchResults;
		} catch (error) {
			console.error("Error in computeFastaNcdInput:", error);
			return [];
		}
	};
	
	const cacheAccessionSequence = (suggestions: SelectedItem[]): void => {
		suggestions.forEach((suggestion) => {
			const id = suggestion.id;
			const content = suggestion.content;
			if (content) {
				localStorageManager.set(LocalStorageKeys.ACCESSION_SEQUENCE, id, content);
			}
		});
	};
	
	const isValidInput = (fastaItems: SelectedItem[]): boolean => {
		if (!fastaItems?.length) return false;
		const searchTerms = fastaItems.map((item) => item.label.toLowerCase().trim());
		return searchTerms.some((term) => term.length > 0);
	};
	
	const getFastaSuggestionStartIndex = (searchTerm: string): number => {
		return fastaSuggestionStartIndex[searchTerm] || 0;
	};
	
	const fetchFastaSequenceAndProcess = async (
		fastaItems: SelectedItem[]
	): Promise<SelectedItem[]> => {
		const idsToFetch = fastaItems.map((item) => item.id);
		const map = new Map<string, SelectedItem>();
		fastaItems.forEach((item) => {
			map.set(item.id, {...item});
		});
		
		const response = await getFastaSequences(idsToFetch);
		const arr = toArr(response);
		arr.forEach((item) => {
			const fastItem = map.get(item.accession);
			if (fastItem) {
				fastItem.content = item.sequence;
			}
		});
		return Array.from(map.values());
	};
	
	const toArr = (response: FastaSequenceResponse): ProcessedFastaItem[] => {
		return response.accessions.map((accession, i) => ({
			sequence: response.contents[i],
			accession,
		}));
	};
	
	const addItem = (item: SelectedItem): void => {
		if (!selectedItems.find((selected) => selected.id === item.id)) {
			const labelManager = LabelManager.getInstance();
			labelManager.registerLabel(item.id, item.label);
			setSelectedItems([...selectedItems, item]);
		}
	};
	
	const removeItem = (itemId: string): void => {
		setSelectedItems([...selectedItems.filter((item) => item.id !== itemId)]);
	};
	
	const clearAllSelectedItems = (): void => {
		const currentMode = searchMode.searchMode;
		setSelectedItems([]);
		resetDisplay();
		setHasImportedMatrix(false);
		setImportError(null);
		if (currentMode) {
			setSearchParams({searchMode: currentMode});
			setSearchMode({
				searchMode: currentMode
			});
		}
	};

	const loadExampleSet = (): void => {
		const examples = getWorkbenchExampleItems();

		examples.forEach((item) => {
			labelManager.registerLabel(item.id, item.label);
		});

		resetDisplay();
		setMode(FILE_UPLOAD);
		setSelectedItems(examples);
		setHasImportedMatrix(false);
		setImportError(null);
	};
	
	const getAllFastaSuggestionWithLastIndex = (): Record<string, number> => {
		return fastaSuggestionStartIndex;
	};
	
	const renderModal = (mode: SearchMode) => {
		switch (mode.searchMode) {
			case FASTA:
				return (
					<FastaSearch
						addItem={addItem}
						selectedItems={selectedItems}
						getAllFastaSuggestionWithLastIndex={getAllFastaSuggestionWithLastIndex}
						getFastaSuggestionStartIndex={getFastaSuggestionStartIndex}
						setFastaSuggestionStartIndex={setFastaSuggestionStartIndex}
					/>
				);
			case LANGUAGE:
				return (
						<Language
							selectedItems={selectedItems}
							addItem={addItem}
						/>
				);
			default:
				return (
					<FileUpload
						selectedItems={selectedItems}
						setSelectedItems={setSelectedItems}
					/>
				);
		}
	};
	
	
	return (
		<section className="workbench-editor" aria-label="NCD workbench">
			<div className="workbench-sourcebar">
				<div className="source-tabs" role="tablist" aria-label="Input source">
					<button type="button" role="tab" aria-selected={searchMode.searchMode === FASTA} onClick={() => setMode(FASTA)}>
						<Dna size={17} aria-hidden="true"/>
						<span>GenBank sequences</span>
					</button>
					<button type="button" role="tab" aria-selected={searchMode.searchMode === LANGUAGE} onClick={() => setMode(LANGUAGE)}>
						<Globe2 size={17} aria-hidden="true"/>
						<span>UDHR languages</span>
					</button>
					<button type="button" role="tab" aria-selected={searchMode.searchMode === FILE_UPLOAD} onClick={() => setMode(FILE_UPLOAD)}>
						<FileType2 size={17} aria-hidden="true"/>
						<span>Local files</span>
					</button>
				</div>
				<div className="workbench-sourcebar__actions">
					<button type="button" onClick={loadExampleSet} className="workbench-button workbench-button--example">
						<FlaskConical size={17} aria-hidden="true"/>
						Try example data
					</button>
					<button type="button" onClick={sendNcdInput} disabled={isSearchDisabled} className="workbench-button workbench-button--primary">
						Show Similarity
					</button>
				</div>
			</div>

			<div className="workbench-input-grid">
				<section className="workbench-panel workbench-panel--source" aria-label="Object source">
					{renderModal(searchMode)}
				</section>
				<InputHolder selectedItems={selectedItems} onRemoveItem={removeItem} MIN_ITEMS={MIN_ITEMS}/>
			</div>

			<footer className="workbench-actions">
				<div className="workbench-actions__secondary">
					<button type="button" onClick={triggerFileInput} className="workbench-button">
						<Upload size={17} aria-hidden="true"/>
						Import matrix
					</button>
					<button type="button" onClick={handleExportMatrix} className="workbench-button" disabled={selectedItems.length === 0}>
						<Download size={17} aria-hidden="true"/>
						Export tree
					</button>
				</div>
				<div className="workbench-actions__primary">
					<button type="button" onClick={clearAllSelectedItems} disabled={isClearDisabled} className="workbench-button">
						Clear set
					</button>
				</div>
			</footer>

			{importError && (
				<div className="workbench-message workbench-message--error" role="alert">
					<AlertCircle size={16} aria-hidden="true"/>
					<span>{importError}</span>
				</div>
			)}

			<input type="file" ref={fileInputRef} onChange={handleMatrixImport} accept=".json" className="sr-only" aria-label="Import NCD matrix"/>

			{isAutoProcessing && (
				<div className="workbench-message" role="status">
					<span className="workbench-spinner" aria-hidden="true"/>
					<span>Processing imported matrix data.</span>
				</div>
			)}
		</section>
	);
};

export default ListEditor;
