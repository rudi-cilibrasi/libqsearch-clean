import React, {useEffect, useRef, useState} from "react";
import {AlertCircle, Dna, Download, FileType2, Globe2, Upload} from "lucide-react";
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

export interface SearchMode {
	searchMode: string;
}

export interface SelectedItem {
	type: typeof FASTA | typeof LANGUAGE | typeof FILE_UPLOAD;
	label: string;
	content?: string;
	id: string;
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
			
			console.log('Attempting to fetch animal names for accession IDs...');
			
			// Try to fetch animal names for what appear to be accession IDs
			let enhancedLabels: { [key: string]: string } = {};
			const potentialAccessionIds = data.labels.filter(label => 
				// Check if label looks like an accession ID (contains letters and numbers, not spaces)
				/^[a-zA-Z0-9._-]+$/.test(label) && label.length >= 6
			);
			
			if (potentialAccessionIds.length > 0) {
				try {
					console.log(`Found ${potentialAccessionIds.length} potential accession IDs, fetching animal names...`);
					const fastaResponse = await getFastaSequences(potentialAccessionIds);
					
					// Create mapping from accession to animal name
					fastaResponse.accessions.forEach((accession, index) => {
						const commonName = fastaResponse.commonNames[index];
						const scientificName = fastaResponse.scientificNames[index];
						
						// Use common name if available, otherwise scientific name, otherwise accession
						let displayName = accession;
						if (commonName && commonName.trim() !== '') {
							displayName = commonName;
						} else if (scientificName && scientificName.trim() !== '') {
							// Use first two words of scientific name for brevity
							const parts = scientificName.split(' ');
							displayName = parts.slice(0, 2).join(' ');
						}
						
						enhancedLabels[accession] = displayName;
						console.log(`Enhanced label: ${accession} → ${displayName}`);
					});
				} catch (error) {
					console.warn('Failed to fetch animal names for accession IDs:', error);
					// Continue with original labels if fetching fails
				}
			}
			
			// Create items for each label in the matrix
			const importedItems: SelectedItem[] = data.labels.map((label, index) => {
				// Use enhanced label if available, otherwise original label
				const displayLabel = enhancedLabels[label] || label;
				
				// Register both the original label and the display label
				labelManager.registerLabel(label, displayLabel);
				console.log(`Registered label: ${label} → ${displayLabel}`);
				
				return {
					id: label,
					label: displayLabel,
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
		if (!qTreeResponse) return;
		
		const dotFormat = createGraph(qTreeResponse, false);
		
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
	
	const [apiKey, setApiKey] = React.useState<string>(
		import.meta.env.VITE_NCBI_API_KEY
	);
	
	const [fastaSuggestionStartIndex, setFastaSuggestionStartIndex] =
		React.useState<Record<string, number>>({});
	
	// Constants and Refs
	const MIN_ITEMS = 4;
	const localStorageManager = LocalStorageKeyManager.getInstance();
	const compressionServiceRef = useRef(CompressionService.getInstance());
	const [searchParams, setSearchParams] = useSearchParams();
	
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
			const sequence = localStorageManager.get(LocalStorageKeys.ACCESSION_SEQUENCE, item.id) || "";
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
		apiKey: string
	): Promise<SelectedItem[]> => {
		if (!isValidInput(fastaItems)) return [];
		try {
			const searchResults = await fetchFastaSequenceAndProcess(fastaItems, apiKey);
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
		fastaItems: SelectedItem[],
		apiKey: string
	): Promise<SelectedItem[]> => {
		const idsToFetch = fastaItems.map((item) => item.id);
		const map = new Map<string, SelectedItem>();
		fastaItems.forEach((item) => {
			map.set(item.id, {...item});
		});
		
		const response = await getFastaSequences(idsToFetch, apiKey);
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
		setImportError(false);
		if (currentMode) {
			setSearchParams({searchMode: currentMode});
			setSearchMode({
				searchMode: currentMode
			});
		}
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
						MIN_ITEMS={MIN_ITEMS}
						selectedItems={selectedItems}
						onSetApiKey={setApiKey}
						setSelectedItems={setSelectedItems}
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
						MIN_ITEMS={MIN_ITEMS}
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
		<div className="w-full max-w-none xl:max-w-[1600px] 2xl:max-w-[1800px] mx-auto p-4 sm:p-6">
			{/* Mode selection tabs - scrollable on mobile */}
			<div className="flex gap-2 sm:gap-4 mb-4 sm:mb-6 overflow-x-auto pb-2 scrollbar-hide">
				<button
					onClick={() => setMode(FASTA)}
					className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-all whitespace-nowrap text-sm sm:text-base
                    ${
						searchMode.searchMode === FASTA
							? "bg-blue-600 text-white border-2 border-blue-500"
							: "bg-gray-700 text-gray-300 border-2 border-transparent hover:bg-gray-600"
					}`}
				>
					<Dna size={18} className="sm:w-5 sm:h-5"/>
					<span className="hidden xs:inline">Animal Grouping</span>
					<span className="xs:hidden">Animals</span>
				</button>
				<button
					onClick={() => setMode(LANGUAGE)}
					className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-all whitespace-nowrap text-sm sm:text-base
                    ${
						searchMode.searchMode === LANGUAGE
							? "bg-blue-600 text-white border-2 border-blue-500"
							: "bg-gray-700 text-gray-300 border-2 border-transparent hover:bg-gray-600"
					}`}
				>
					<Globe2 size={18} className="sm:w-5 sm:h-5"/>
					<span className="hidden xs:inline">Language Analysis</span>
					<span className="xs:hidden">Languages</span>
				</button>
				<button
					onClick={() => setMode(FILE_UPLOAD)}
					className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-all whitespace-nowrap text-sm sm:text-base
                    ${
						searchMode.searchMode === FILE_UPLOAD
							? "bg-blue-600 text-white border-2 border-blue-500"
							: "bg-gray-700 text-gray-300 border-2 border-transparent hover:bg-gray-600"
					}`}
				>
					<FileType2 size={18} className="sm:w-5 sm:h-5"/>
					<span className="hidden xs:inline">File Upload</span>
					<span className="xs:hidden">Files</span>
				</button>
			</div>
			
			{/* Main content area - stacked on mobile, side-by-side on desktop */}
			<div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
				{/* Input/Search Panel */}
				<div className="w-full lg:w-1/2 h-[400px] sm:h-[500px] lg:h-[600px] border border-gray-600 rounded-xl bg-gray-800 overflow-hidden flex flex-col shadow-lg">
					<div className="flex-1 overflow-y-auto p-3">
						{renderModal(searchMode)}
					</div>
				</div>
				
				{/* Selected Items Panel */}
				<InputHolder
					selectedItems={selectedItems}
					onRemoveItem={removeItem}
					MIN_ITEMS={MIN_ITEMS}
				/>
			</div>
			
			{/* Bottom section with all the buttons */}
			<div className="mt-4 sm:mt-6 flex flex-col space-y-4">
				{/* Import/Export and action buttons - responsive layout */}
				<div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
					{/* Import/Export buttons */}
					<div className="flex flex-col xs:flex-row gap-2 xs:gap-3">
						<button
							onClick={triggerFileInput}
							className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-all border border-indigo-500 text-sm sm:text-base"
						>
							<Upload size={16} className="sm:w-[18px] sm:h-[18px]"/>
							<span>Import Matrix</span>
						</button>
						
						<button
							onClick={handleExportMatrix}
							className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-all text-sm sm:text-base
								${
								selectedItems.length === 0
									? "bg-gray-700 text-gray-500 cursor-not-allowed border border-gray-600"
									: "bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-500"
							}`}
							disabled={selectedItems.length === 0}
						>
							<Download size={16} className="sm:w-[18px] sm:h-[18px]"/>
							<span>Export Matrix</span>
						</button>
					</div>
					
					{/* Action buttons */}
					<div className="flex flex-col xs:flex-row gap-2 xs:gap-3">
						<button
							onClick={clearAllSelectedItems}
							disabled={isClearDisabled}
							className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg transition-all text-sm sm:text-base
		                      ${
								isClearDisabled
									? "bg-gray-700 text-gray-500 cursor-not-allowed"
									: "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
							}`}
						>
							Clear All
						</button>
						<button
							onClick={sendNcdInput}
							disabled={isSearchDisabled}
							className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg transition-all text-sm sm:text-base
		                      ${
								isSearchDisabled
									? "bg-gray-700 text-gray-500 cursor-not-allowed"
									: "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
							}`}
						>
							Calculate
						</button>
					</div>
				</div>
				
				{/* Error message */}
				{importError && (
					<div className="p-3 bg-red-900/50 border border-red-700 text-red-300 rounded-md text-sm flex items-start">
						<AlertCircle size={16} className="mr-2 mt-0.5 flex-shrink-0"/>
						<span>{importError}</span>
					</div>
				)}
			</div>
			
			{/* Hidden file input */}
			<input
				type="file"
				ref={fileInputRef}
				onChange={handleMatrixImport}
				accept=".json"
				className="hidden"
			/>
			
			{/* Auto-processing indicator */}
			{isAutoProcessing && (
				<div className="mt-2 p-3 bg-blue-900/50 border border-blue-700 text-blue-300 rounded-md text-sm flex items-start">
					<svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-400 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none"
					     viewBox="0 0 24 24">
						<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
						<path className="opacity-75" fill="currentColor"
						      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
					<span>Automatically processing imported matrix data...</span>
				</div>
			)}
		</div>
	);
};

export default ListEditor;
