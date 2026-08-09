/**
 * @module components/ListEditor
 *
 * Input management component for the NCD calculator. Provides three input modes:
 * - **FASTA Search** — Search NCBI Nucleotide for versioned nucleotide sequences
 * - **File Upload** — Drag-and-drop or browse for local files (any format)
 * - **Languages** — Select UDHR (Universal Declaration of Human Rights) translations
 *
 * Manages the list of selected items, handles content resolution (e.g., fetching
 * FASTA sequences from GenBank), and triggers NCD computation by passing
 * { labels[], contents[] } up to the parent QSearch component.
 */

import React, {useEffect, useRef, useState} from "react";
import {Activity, AlertCircle, Dna, FileType2, FlaskConical, Globe2, Telescope, Upload} from "lucide-react";
import {
	getTranslationResponse,
	getUdhrLanguage,
	getUdhrRecordDisplayLabel,
	UDHR_CORPUS,
} from "../functions/udhr";
import {InputHolder} from "./InputHolder.tsx";
import {Language} from "./Language";
import {useStorageState} from "../cache/cache";
import {FastaSearch} from "./FastaSearch";
import {FileUpload} from "./FileUpload";
import {LocalStorageKeyManager} from "../cache/LocalStorageKeyManager";
import {getFastaSequences} from "../functions/getPublicGenbank";
import {EEG, FASTA, FILE_UPLOAD, LANGUAGE} from "../constants/modalConstants";
import {useSearchParams} from "react-router-dom";
import type {NCDImportFormat, NCDInput} from "@/types/ncd";
import type {ExperimentInputObjectMetadata, ExperimentObjectSource} from "@/types/experiment";
import {getWorkbenchExampleItems} from "./workbenchExamples";
import type {SelectedItem} from "./workbenchTypes";
import {
	type GenBankSequenceRecord,
	validateGenBankNucleotideSequence,
	verifyCachedGenBankRecord,
} from "../services/genbankSequencePipeline";
import {getAstronomyExampleItems, verifyAstronomyExampleItem} from "../services/astronomyExample";
import {GenBankSequenceCache} from "../services/GenBankSequenceCache";
import {analyzeGenBankExperiment} from "../services/genbankExperimentPreflight";
import {GenBankExperimentPreflight} from "./GenBankExperimentPreflight";
import {getGenBankAnimalExampleItems} from "../services/genbankAnimalExample";
import {CompressorSelector} from "./CompressorSelector";
import {isCompressionPreference, type CompressionPreference} from "@/types/compression";
import {EegSourceBrowser} from "@/components/EegSourceBrowser";
import {getEegExampleItems, getEegExperimentContext, importEegPortablePackage, MAX_EEG_PACKAGE_BYTES, verifyEegExampleItem} from "@/services/eegExample";
export type {SelectedItem} from "./workbenchTypes";
export interface SearchMode {
	searchMode: string;
}

const SOURCE_MODES = [FASTA, LANGUAGE, FILE_UPLOAD, EEG] as const;
type SourceMode = typeof SOURCE_MODES[number];

const sourceTabId = (mode: SourceMode): string => `source-tab-${mode}`;

const getItemDisplayLabel = (item: SelectedItem): string => {
	if (item.type === LANGUAGE) {
		return getUdhrRecordDisplayLabel(item.id) ?? item.label ?? item.id;
	}
	return item.label?.trim() || item.id;
};

const getExperimentObjectSource = (
	item: SelectedItem,
	kind: "objects" | "distance-matrix",
	importedMatrixFileName?: string,
): ExperimentObjectSource => {
	if (kind === "distance-matrix") {
		return {
			kind: "imported-distance-matrix",
			fileName: importedMatrixFileName?.trim() || "imported-matrix.json",
		};
	}
	if (item.type === LANGUAGE) {
		const record = getUdhrLanguage(item.id);
		if (!record) throw new Error(`Missing UDHR provenance for ${item.id}`);
		return {
			kind: "udhr",
			corpus: {
				schemaVersion: UDHR_CORPUS.schemaVersion,
				corpusVersion: UDHR_CORPUS.corpusVersion,
				assetBasePath: UDHR_CORPUS.assetBasePath,
				source: {...UDHR_CORPUS.source},
				summary: {...UDHR_CORPUS.summary},
			},
			record: {
				...record,
				articleNumbers: [...record.articleNumbers],
				comparisonExclusionReasons: [...record.comparisonExclusionReasons],
			},
		};
	}
	if (item.type === FASTA) {
		if (!item.genBankProvenance) {
			throw new Error(`Missing verified GenBank provenance for ${item.id}`);
		}
		return {kind: "genbank", provenance: {...item.genBankProvenance}};
	}
	if (item.astronomyProvenance) {
		return {kind: "astronomy", provenance: {...item.astronomyProvenance}};
	}
	if (item.eegProvenance) {
		return {kind: "eeg", provenance: item.eegProvenance};
	}
	if (item.id.startsWith("example-")) {
		return {kind: "built-in-example", exampleId: item.id};
	}
	return {kind: "local-file", fileName: item.id};
};

const getExperimentObjectMetadata = (
	items: readonly SelectedItem[],
	kind: "objects" | "distance-matrix",
	importedMatrixFileName?: string,
): ExperimentInputObjectMetadata[] => items.map((item) => ({
	id: item.id,
	displayLabel: getItemDisplayLabel(item),
	source: getExperimentObjectSource(item, kind, importedMatrixFileName),
}));

interface ListEditorProps {
	onComputedNcdInput: (input: NCDInput) => void;
	setIsLoading: (loading: boolean) => void;
	resetDisplay: () => void;
	setOpenLogin: (open: boolean) => void;
	authenticated: boolean;
	initialSearchMode?: SearchMode | null;
}

const ListEditor: React.FC<ListEditorProps> = ({
	                                               onComputedNcdInput,
	                                               setIsLoading,
	                                               resetDisplay,
	                                               initialSearchMode,
                                               }) => {
	
	const [importError, setImportError] = React.useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [hasImportedMatrix, setHasImportedMatrix] = useState<boolean>(false);
	const [isAutoProcessing, setIsAutoProcessing] = useState<boolean>(false);
	const [isLoadingAstronomy, setIsLoadingAstronomy] = useState<boolean>(false);
	const [isLoadingAnimalExample, setIsLoadingAnimalExample] = useState<boolean>(false);
	const [isLoadingEeg, setIsLoadingEeg] = useState<boolean>(false);
	const [importedMatrixFileName, setImportedMatrixFileName] = useState<string | null>(null);
	
	
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
			
			// Create items for each label in the matrix
			const importedItems: SelectedItem[] = data.labels.map((label, index) => {
				const displayLabel = getUdhrLanguage(label)?.name ?? label;

				return {
					id: label,
					label: displayLabel,
					type: FILE_UPLOAD,
					content: JSON.stringify(data.distances[index]),
				};
			});
			
			// Update selected items
			setSelectedItems(importedItems);
			setImportedMatrixFileName(file.name);
			
			// Set flag that we've imported a matrix
			setHasImportedMatrix(true);
			
			console.log('Successfully imported matrix data with', importedItems.length, 'items');
			
			// Reset the file input
			if (fileInputRef.current) {
				fileInputRef.current.value = '';
			}
			
			await processImportedMatrix(importedItems, file.name);
			
		} catch (err) {
			console.error('Error importing file:', err);
			setImportError(err instanceof Error ? err.message : 'Unknown error importing file');
			
			// Reset the file input
			if (fileInputRef.current) {
				fileInputRef.current.value = '';
			}
		}
	};
	
	
	const processImportedMatrix = async (
		importedItems: SelectedItem[],
		sourceFileName: string,
	): Promise<void> => {
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
			
			await onComputedNcdInput({
				labels,
				displayLabels: importedItems.map(getItemDisplayLabel),
				contents,
				kind: "distance-matrix",
				objectMetadata: getExperimentObjectMetadata(importedItems, "distance-matrix", sourceFileName),
				sourceFileName,
			});
			console.log("Automatic processing of imported matrix complete");
		} catch (error) {
			console.error("Error in automatic processing:", error);
			setImportError(error instanceof Error ? error.message : "Failed to process imported matrix");
		} finally {
			setIsAutoProcessing(false);
		}
	};
	
	
	const defaultSearchMode = {
		searchMode: initialSearchMode?.searchMode || FASTA
	};
	
	const [searchMode, setSearchMode] = useStorageState<SearchMode>(
		"searchMode",
		defaultSearchMode
	);
	const [compressionPreference, setCompressionPreference] = useStorageState<CompressionPreference>(
		"compressionPreference",
		"auto",
	);
	useEffect(() => {
		if (!isCompressionPreference(compressionPreference)) setCompressionPreference("auto");
	}, [compressionPreference, setCompressionPreference]);
	
	const [selectedItems, setSelectedItems] = useStorageState<SelectedItem[]>(
		"selectedItems",
		[]
	);
	
	// Constants and Refs
	const MIN_ITEMS = 4;
	const localStorageManager = LocalStorageKeyManager.getInstance();
	const genBankSequenceCache = GenBankSequenceCache.getInstance();
	const [, setSearchParams] = useSearchParams();

	// Computed values
	const genBankPreflight = analyzeGenBankExperiment(selectedItems);
	const isSearchDisabled =
		selectedItems.length < MIN_ITEMS || !genBankPreflight.canRun;
	const isClearDisabled = selectedItems.length === 0;
	
	// Rehydrate canonical names for selections restored from older localStorage
	// entries that kept only the ISO identifier in the presentation field.
	useEffect(() => {
		let changed = false;
		const hydratedItems = selectedItems.map((item) => {
			const record = item.type === LANGUAGE ? getUdhrLanguage(item.id) : undefined;
			const canonicalId = record?.id ?? item.id;
			const displayLabel = record === undefined
				? getItemDisplayLabel(item)
				: (getUdhrRecordDisplayLabel(record.id) ?? record.name);
			if (displayLabel === item.label && canonicalId === item.id) return item;
			changed = true;
			return {...item, id: canonicalId, label: displayLabel};
		});
		if (changed) setSelectedItems(hydratedItems);
	}, [selectedItems, setSelectedItems]);
	
	// Initialize local storage and check version
	useEffect(() => {
		localStorageManager.initialize();
		if (localStorageManager.getStoredVersion() !== localStorageManager.getCurrentVersion()) {
			setSelectedItems([]);
		}
		
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

	const handleSourceTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, currentMode: SourceMode): void => {
		const currentIndex = SOURCE_MODES.indexOf(currentMode);
		let nextIndex: number | null = null;
		if (["ArrowRight", "ArrowDown"].includes(event.key)) nextIndex = (currentIndex + 1) % SOURCE_MODES.length;
		if (["ArrowLeft", "ArrowUp"].includes(event.key)) nextIndex = (currentIndex - 1 + SOURCE_MODES.length) % SOURCE_MODES.length;
		if (event.key === "Home") nextIndex = 0;
		if (event.key === "End") nextIndex = SOURCE_MODES.length - 1;
		if (nextIndex === null) return;
		event.preventDefault();
		const nextMode = SOURCE_MODES[nextIndex];
		setMode(nextMode);
		requestAnimationFrame(() => document.getElementById(sourceTabId(nextMode))?.focus());
	};
	
	const sendNcdInput = async (): Promise<void> => {
		// if (selectedItems && selectedItems.length > 16 && !authenticated) {
		// 	setOpenLogin(true);
		// 	return;
		// }
		setImportError(null);
		setIsLoading(true);
		try {
			if (!genBankPreflight.canRun) {
				throw new Error(genBankPreflight.errors.map(issue => issue.message).join(" "));
			}
			if (hasImportedMatrix) {
				const labels: string[] = [];
				const contents: string[] = [];
				selectedItems.forEach(item => {
					labels.push(item.id);
					contents.push(item.content || "");
				});
				// process the input directly
				await onComputedNcdInput({
					labels,
					displayLabels: selectedItems.map(getItemDisplayLabel),
					contents,
					kind: "distance-matrix",
					objectMetadata: getExperimentObjectMetadata(
						selectedItems,
						"distance-matrix",
						importedMatrixFileName ?? undefined,
					),
					sourceFileName: importedMatrixFileName ?? "imported-matrix.json",
				});
			} else {
				const computedNcdInput = await computeNcdInput(selectedItems);
				await assertCompleteComparisonSet(selectedItems, computedNcdInput);
				// update the items with their computed content
				const ncdSelectedItems = updateLabelsWithComputedContent(computedNcdInput, selectedItems);
				
				// covert to the format expected by the NCD processor
				const input = {
					labels: ncdSelectedItems.map((item) => item.id),
					displayLabels: ncdSelectedItems.map(getItemDisplayLabel),
					contents: ncdSelectedItems.map((item) => item.content || ""),
					kind: "objects",
					compression: compressionPreference,
					objectMetadata: getExperimentObjectMetadata(ncdSelectedItems, "objects"),
					eeg: getEegExperimentContext(ncdSelectedItems),
				} satisfies NCDInput;
				await onComputedNcdInput(input);
			}
		} catch (error) {
			console.error("Error processing NCD input:", error);
			setImportError(error instanceof Error ? error.message : "Unable to prepare the comparison set");
		} finally {
			setIsLoading(false);
		}
	};
	
	const computeNcdInput = async (selectedItems: SelectedItem[]): Promise<SelectedItem[]> => {
		const langItems = selectedItems.filter((item) => item.type === LANGUAGE);
		const fastaItems = selectedItems.filter((item) => item.type === FASTA);
		const fileItems = selectedItems.filter((item) => item.type === FILE_UPLOAD);
		const eegItems = selectedItems.filter((item) => item.type === EEG);
		
		const orderMap = getOrderMap(selectedItems);
		const langNcdInput = await computeLanguageNcdInput(langItems);
		const fastaNcdInput = await getCachedFastaContent(fastaItems);
		const resolvedFastaIds = new Set(fastaNcdInput.map(item => item.id));
		
		const needComputeFastaList = await computeFastaNcdInput(
			fastaItems.filter(item => !resolvedFastaIds.has(item.id)),
		);
		
		const mergedObjectInput = [
			...fileItems,
			...eegItems,
			...fastaNcdInput,
			...needComputeFastaList,
		];
		
		return mergeAndPreserveInitialOrder(langNcdInput, mergedObjectInput, orderMap);
	};

	const assertCompleteComparisonSet = async (
		requestedItems: readonly SelectedItem[],
		resolvedItems: readonly SelectedItem[],
	): Promise<void> => {
		const resolvedById = new Map(resolvedItems.map(item => [item.id, item]));
		const missing = requestedItems.filter(item => !resolvedById.get(item.id)?.content?.trim());
		if (missing.length > 0) {
			throw new Error(`Unable to retrieve valid content for: ${missing.map(item => item.label || item.id).join(", ")}.`);
		}
		for (const item of resolvedItems) {
			if (item.type === FASTA) validateGenBankNucleotideSequence(item.content ?? "");
			await verifyAstronomyExampleItem(item);
			await verifyEegExampleItem(item);
		}
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
				if (computed.genBankProvenance) {
					item.genBankProvenance = computed.genBankProvenance;
				}
			}
		})
		
		return Array.from(itemMap.values());
	}
	
	
	const getCachedFastaContent = async (items: SelectedItem[]): Promise<SelectedItem[]> => {
		const res: SelectedItem[] = [];
		for (const item of items) {
			const inlineRecord: GenBankSequenceRecord | null = item.content && item.genBankProvenance
					? {sequence: item.content, provenance: item.genBankProvenance}
					: null;
			const cachedRecord = inlineRecord
					?? await genBankSequenceCache.get(item.id);
			const verified = await verifyCachedGenBankRecord(cachedRecord, item.id);
			if (!verified) {
				await genBankSequenceCache.remove(item.id);
				continue;
			}
			res.push({...item, content: verified.sequence, genBankProvenance: verified.provenance});
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
		const text = await getTranslationResponse(lang);
		return {
			...selectedItem,
			content: text,
		};
	};
	
	const computeFastaNcdInput = async (
		fastaItems: SelectedItem[],
	): Promise<SelectedItem[]> => {
		if (!isValidInput(fastaItems)) return [];
		const searchResults = await fetchFastaSequenceAndProcess(fastaItems);
		await cacheAccessionSequence(searchResults);
		return searchResults;
	};

	const cacheAccessionSequence = async (suggestions: SelectedItem[]): Promise<void> => {
		await Promise.all(suggestions.map(async (suggestion) => {
			if (suggestion.content && suggestion.genBankProvenance) {
				await genBankSequenceCache.set({
					sequence: suggestion.content,
					provenance: suggestion.genBankProvenance,
				});
			}
		}));
	};
	
	const isValidInput = (fastaItems: SelectedItem[]): boolean => {
		if (!fastaItems?.length) return false;
		const searchTerms = fastaItems.map((item) => item.label.toLowerCase().trim());
		return searchTerms.some((term) => term.length > 0);
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
		response.forEach((record) => {
			const fastItem = map.get(record.provenance.requestedId);
			if (!fastItem) throw new Error(`Unexpected GenBank response for ${record.provenance.requestedId}.`);
			fastItem.content = record.sequence;
			fastItem.genBankProvenance = record.provenance;
		});
		const resolved = Array.from(map.values());
		const missing = resolved.filter(item => !item.content || !item.genBankProvenance);
		if (missing.length > 0) {
			throw new Error(`NCBI did not resolve: ${missing.map(item => item.id).join(", ")}.`);
		}
		return resolved;
	};
	
	const addItem = (item: SelectedItem): void => {
		if (!selectedItems.find((selected) => selected.id === item.id)) {
			setSelectedItems([...selectedItems, {...item, label: getItemDisplayLabel(item)}]);
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
		setImportedMatrixFileName(null);
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

		resetDisplay();
		setMode(FILE_UPLOAD);
		setSelectedItems(examples);
		setHasImportedMatrix(false);
		setImportedMatrixFileName(null);
		setImportError(null);
	};

	const loadAstronomyExample = async (): Promise<void> => {
		setImportError(null);
		setIsLoadingAstronomy(true);
		try {
			const examples = await getAstronomyExampleItems();
			resetDisplay();
			setMode(FILE_UPLOAD);
			setSelectedItems(examples);
			setHasImportedMatrix(false);
			setImportedMatrixFileName(null);
		} catch (error) {
			setImportError(error instanceof Error ? error.message : "Unable to load the astronomy example");
		} finally {
			setIsLoadingAstronomy(false);
		}
	};

	const loadAnimalExample = async (): Promise<void> => {
		setImportError(null);
		setIsLoadingAnimalExample(true);
		try {
			const examples = await getGenBankAnimalExampleItems();
			resetDisplay();
			setMode(FASTA);
			setSelectedItems(examples);
			setHasImportedMatrix(false);
			setImportedMatrixFileName(null);
		} catch (error) {
			setImportError(error instanceof Error ? error.message : "Unable to load the guided animal example");
		} finally {
			setIsLoadingAnimalExample(false);
		}
	};

	const installEegItems = (items: SelectedItem[]): void => {
		resetDisplay();
		setMode(EEG);
		setSelectedItems(items);
		setHasImportedMatrix(false);
		setImportedMatrixFileName(null);
	};

	const loadEegExample = async (mode: "condition" | "electrode"): Promise<void> => {
		setImportError(null);
		setIsLoadingEeg(true);
		try {
			installEegItems(await getEegExampleItems(mode));
		} catch (error) {
			setImportError(error instanceof Error ? error.message : "Unable to load the EEG example");
		} finally {
			setIsLoadingEeg(false);
		}
	};

	const importEegPackage = async (file: File, mode: "condition" | "electrode"): Promise<void> => {
		setImportError(null);
		setIsLoadingEeg(true);
		try {
			if (file.size > MAX_EEG_PACKAGE_BYTES) throw new Error("EEG package exceeds the 2 MiB limit.");
			installEegItems(await importEegPortablePackage(await file.text(), mode));
		} catch (error) {
			setImportError(error instanceof Error ? error.message : "Unable to import the EEG package");
		} finally {
			setIsLoadingEeg(false);
		}
	};
	
	const renderModal = (mode: SearchMode) => {
		switch (mode.searchMode) {
			case FASTA:
				return (
						<FastaSearch
							addItem={addItem}
							selectedItems={selectedItems}
						/>
				);
			case LANGUAGE:
				return (
						<Language
							selectedItems={selectedItems}
							addItem={addItem}
						/>
				);
			case EEG:
				return (
					<EegSourceBrowser
						isLoading={isLoadingEeg}
						onLoadExample={loadEegExample}
						onImportPackage={importEegPackage}
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
					<button id={sourceTabId(FASTA)} type="button" role="tab" aria-controls="source-panel" aria-selected={searchMode.searchMode === FASTA} tabIndex={searchMode.searchMode === FASTA ? 0 : -1} onKeyDown={(event) => handleSourceTabKeyDown(event, FASTA)} onClick={() => setMode(FASTA)}>
						<Dna size={17} aria-hidden="true"/>
						<span>GenBank sequences</span>
					</button>
					<button id={sourceTabId(LANGUAGE)} type="button" role="tab" aria-controls="source-panel" aria-selected={searchMode.searchMode === LANGUAGE} tabIndex={searchMode.searchMode === LANGUAGE ? 0 : -1} onKeyDown={(event) => handleSourceTabKeyDown(event, LANGUAGE)} onClick={() => setMode(LANGUAGE)}>
						<Globe2 size={17} aria-hidden="true"/>
						<span>UDHR languages</span>
					</button>
					<button id={sourceTabId(FILE_UPLOAD)} type="button" role="tab" aria-controls="source-panel" aria-selected={searchMode.searchMode === FILE_UPLOAD} tabIndex={searchMode.searchMode === FILE_UPLOAD ? 0 : -1} onKeyDown={(event) => handleSourceTabKeyDown(event, FILE_UPLOAD)} onClick={() => setMode(FILE_UPLOAD)}>
						<FileType2 size={17} aria-hidden="true"/>
						<span>Local files</span>
					</button>
					<button id={sourceTabId(EEG)} type="button" role="tab" aria-controls="source-panel" aria-selected={searchMode.searchMode === EEG} tabIndex={searchMode.searchMode === EEG ? 0 : -1} onKeyDown={(event) => handleSourceTabKeyDown(event, EEG)} onClick={() => setMode(EEG)}>
						<Activity size={17} aria-hidden="true"/>
						<span>P300 EEG</span>
					</button>
				</div>
					<div className="workbench-sourcebar__actions">
						<button
							type="button"
							onClick={() => void loadAnimalExample()}
							className="workbench-button workbench-button--example"
							disabled={isLoadingAnimalExample}
						>
							<Dna size={17} aria-hidden="true"/>
							{isLoadingAnimalExample ? "Loading…" : "Animal example"}
						</button>
						<button type="button" onClick={loadExampleSet} className="workbench-button workbench-button--example">
						<FlaskConical size={17} aria-hidden="true"/>
						Sequence example
					</button>
					<button
						type="button"
						onClick={loadAstronomyExample}
						className="workbench-button workbench-button--example"
						disabled={isLoadingAstronomy}
					>
						<Telescope size={17} aria-hidden="true"/>
						{isLoadingAstronomy ? "Loading…" : "Astronomy example"}
					</button>
				</div>
			</div>

				<div className="workbench-input-grid">
				<section id="source-panel" role="tabpanel" aria-labelledby={sourceTabId((SOURCE_MODES.includes(searchMode.searchMode as SourceMode) ? searchMode.searchMode : FILE_UPLOAD) as SourceMode)} className="workbench-panel workbench-panel--source">
					{renderModal(searchMode)}
				</section>
					<InputHolder selectedItems={selectedItems} onRemoveItem={removeItem} MIN_ITEMS={MIN_ITEMS}/>
				</div>
				<GenBankExperimentPreflight selectedItems={selectedItems}/>
				<CompressorSelector value={compressionPreference} onChange={setCompressionPreference}/>

				<footer className="workbench-actions">
				<div className="workbench-actions__secondary">
					<button type="button" onClick={triggerFileInput} className="workbench-button">
						<Upload size={17} aria-hidden="true"/>
						Import matrix
					</button>
				</div>
				<div className="workbench-actions__primary">
					<button type="button" onClick={clearAllSelectedItems} disabled={isClearDisabled} className="workbench-button">
						Clear set
					</button>
					<button type="button" onClick={sendNcdInput} disabled={isSearchDisabled} className="workbench-button workbench-button--primary">
						Show Similarity
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
