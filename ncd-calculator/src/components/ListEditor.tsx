import React, { useRef, useState } from "react";
import { Dna, FileType2, Globe2 } from "lucide-react";
import { getTranslationResponse } from "../functions/udhr";
import { InputAccumulator } from "./InputAccumulator";
import { Language } from "./Language";
import {
  cacheTranslation,
  getTranslationCache,
  useStorageState,
} from "../cache/cache.ts";
import { FastaSearch } from "./FastaSearch";
import { FileUpload } from "./FileUpload";
import {
  LocalStorageKeyManager,
  LocalStorageKeys,
} from "../cache/LocalStorageKeyManager";
import { getFastaSequences } from "../functions/getPublicGenbank";
import { FASTA, FILE_UPLOAD, LANGUAGE } from "../constants/modalConstants";

interface ProjectionsType {
  Accession: boolean;
  ScientificName: boolean;
  CommonName: boolean;
  FileName: boolean;
}

interface SelectedItem {
  type: typeof FASTA | typeof LANGUAGE | typeof FILE_UPLOAD;
  label: string;
  content?: string;
  id: string;
}

interface FastaSequenceResponse {
  accessions: string[];
  contents: string[];
}

interface ProcessedFastaItem {
  sequence: string;
  accession: string;
}

interface NcdInput {
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
}

const ListEditor: React.FC<ListEditorProps> = ({
  onComputedNcdInput,
  labelMapRef,
  setLabelMap,
  setIsLoading,
  resetDisplay,
  setOpenLogin,
  authenticated,
}) => {
  const [searchMode, setSearchMode] = useStorageState<
    typeof FASTA | typeof LANGUAGE | typeof FILE_UPLOAD
  >("searchMode", FASTA);
  const [searchTerm, setSearchTerm] = React.useState<string>("");
  const [selectedItems, setSelectedItems] = useStorageState<SelectedItem[]>(
    "selectedItems",
    []
  );
  const [apiKey, setApiKey] = React.useState<string>(
    import.meta.env.VITE_NCBI_API_KEY
  );
  const [isDragging, setIsDragging] = React.useState<boolean>(false);
  const [fastaSuggestionStartIndex, setFastaSuggestionStartIndex] =
    React.useState<Record<string, number>>({});
  const [projections, setProjections] = React.useState<ProjectionsType>({
    accession: true,
    scientific: false,
    common: true,
    FileName: false,
  });

  const MIN_ITEMS = 4;
  const isSearchDisabled =
    selectedItems.length < MIN_ITEMS ||
    (searchMode === "fasta" && !apiKey && selectedItems.length < MIN_ITEMS);
  const isClearDisabled = selectedItems.length === 0;
  const localStorageManager = new LocalStorageKeyManager();

  const sendNcdInput = async (): Promise<void> => {
    if (selectedItems && selectedItems.length > 8 && !authenticated) {
      setOpenLogin(true);
      return;
    }
    setIsLoading(true);
    const computedNcdInput = await computeNcdInput();
    const ncdSelectedItems = getNcdSelectedItems(
      computedNcdInput,
      selectedItems
    );
    updateDisplayLabelMap(ncdSelectedItems);
    const input = getConvertedNcdInput(ncdSelectedItems);
    onComputedNcdInput(input);
  };

  const getConvertedNcdInput = (ncdSelectedItems: SelectedItem[]): NcdInput => {
    const response: NcdInput = {
      labels: [],
      contents: [],
    };
    for (let i = 0; i < ncdSelectedItems.length; i++) {
      response.labels[i] = ncdSelectedItems[i].id;
      response.contents[i] = ncdSelectedItems[i].content || "";
    }
    return response;
  };

  const getNcdSelectedItems = (
    ncdInputItems: SelectedItem[],
    selectedItems: SelectedItem[]
  ): SelectedItem[] => {
    const map = new Map<string, SelectedItem>();
    for (let i = 0; i < selectedItems.length; i++) {
      map.set(selectedItems[i].id, selectedItems[i]);
    }
    const ncdSelectedItems: SelectedItem[] = [];
    for (let i = 0; i < ncdInputItems.length; i++) {
      const id = ncdInputItems[i].id;
      const item = map.get(id);
      if (item) {
        item.content = ncdInputItems[i].content;
        ncdSelectedItems.push(item);
      }
    }
    return ncdSelectedItems;
  };

  const updateDisplayLabelMap = (selectedItems: SelectedItem[]): void => {
    const map = new Map<string, string>();
    for (let i = 0; i < selectedItems.length; i++) {
      const id = selectedItems[i].id;
      const label = selectedItems[i].label;
      map.set(id, label);
    }
    labelMapRef.current = map;
    setLabelMap(map);
  };

  const computeNcdInput = async (): Promise<SelectedItem[]> => {
    const langItems = selectedItems.filter((item) => item.type === LANGUAGE);
    const fastaItems = selectedItems.filter(
      (item) => item.type === FASTA || item.type === FILE_UPLOAD
    );
    const orderMap = getOrderMap(selectedItems);
    const langNcdInput = await computeLanguageNcdInput(langItems);
    const fastaNcdInput = getCachedFastaContent(fastaItems);
    const needComputeFastaList = await computeFastaNcdInput(
      fastaItems.filter((item) => !item.content || item.content.trim() === ""),
      projections,
      apiKey
    );
    const mergedFastaInput = [
      ...fastaNcdInput,
      ...(needComputeFastaList || []),
    ];
    return mergeAndPreserveInitialOrder(
      langNcdInput,
      mergedFastaInput,
      orderMap
    );
  };

  const getCachedFastaContent = (items: SelectedItem[]): SelectedItem[] => {
    const res = items.filter(
      (item) => item.content && item.content.trim() !== ""
    );
    const withoutContent = items.filter(
      (item) => !item.content || item.content.trim() === ""
    );
    for (let i = 0; i < withoutContent.length; i++) {
      const item = withoutContent[i];
      const sequence: string =
        localStorageManager.get(LocalStorageKeys.ACCESSION_SEQUENCE, item.id) ||
        "";
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

  const shiftLeft = (
    arr: (SelectedItem | undefined)[]
  ): (SelectedItem | undefined)[] => {
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

  const computeLanguageNcdInput = async (
    langItems: SelectedItem[]
  ): Promise<SelectedItem[]> => {
    if (!langItems || langItems.length === 0) return [];
    const pendingRs = langItems.map((item) => getCompleteLanguageItem(item));
    return await Promise.all(pendingRs);
  };

  const getCompleteLanguageItem = async (
    selectedItem: SelectedItem
  ): Promise<SelectedItem> => {
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
    projectionOptions: ProjectionsType,
    apiKey: string
  ): Promise<SelectedItem[]> => {
    if (!isValidInput(fastaItems)) return [];
    try {
      const searchResults = await fetchFastaSequenceAndProcess(
        fastaItems,
        apiKey
      );
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
        localStorageManager.set(
          LocalStorageKeys.ACCESSION_SEQUENCE,
          id,
          content
        );
      }
    });
  };

  const isValidInput = (fastaItems: SelectedItem[]): boolean => {
    if (!fastaItems?.length) return false;
    const searchTerms = fastaItems.map((item) =>
      item.label.toLowerCase().trim()
    );
    return searchTerms.some((term) => term.length > 0);
  };

  const getFastaSuggestionStartIndex = (searchTerm: string): number => {
    if (!fastaSuggestionStartIndex || !fastaSuggestionStartIndex[searchTerm]) {
      return 0;
    }
    return fastaSuggestionStartIndex[searchTerm] || 0;
  };

  const fetchFastaSequenceAndProcess = async (
    fastaItems: SelectedItem[],
    apiKey: string
  ): Promise<SelectedItem[]> => {
    const idsToFetch = fastaItems.map((item) => item.id);
    const map = new Map<string, SelectedItem>();
    fastaItems.forEach((item) => {
      map.set(item.id, { ...item });
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
      setSelectedItems([...selectedItems, item]);
    }
  };

  const removeItem = (itemId: string): void => {
    setSelectedItems(selectedItems.filter((item) => item.id !== itemId));
  };

  const clearAllSelectedItems = (): void => {
    setSelectedItems([]);
    resetDisplay();
  };

  const getAllFastaSuggestionWithLastIndex = (): Record<string, number> => {
    return fastaSuggestionStartIndex;
  };

  const renderModal = (
    mode: typeof FASTA | typeof LANGUAGE | typeof FILE_UPLOAD
  ) => {
    switch (mode) {
      case FASTA:
        return (
          <FastaSearch
            addItem={addItem}
            MIN_ITEMS={MIN_ITEMS}
            selectedItems={selectedItems}
            onSetApiKey={setApiKey}
            setSelectedItems={setSelectedItems}
            getAllFastaSuggestionWithLastIndex={
              getAllFastaSuggestionWithLastIndex
            }
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
            addItem={addItem}
            setSelectedItems={setSelectedItems}
          />
        );
    }
  };

  return (
    <div className="p-6 w-full max-w-6xl mx-auto">
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setSearchMode(FASTA)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all
                        ${
                          searchMode === FASTA
                            ? "bg-blue-100 text-blue-700 border-2 border-blue-300"
                            : "bg-gray-100 text-gray-600 border-2 border-transparent"
                        }`}
        >
          <Dna size={20} />
          <span>FASTA Search</span>
        </button>
        <button
          onClick={() => setSearchMode(LANGUAGE)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all
                        ${
                          searchMode === LANGUAGE
                            ? "bg-blue-100 text-blue-700 border-2 border-blue-300"
                            : "bg-gray-100 text-gray-600 border-2 border-transparent"
                        }`}
        >
          <Globe2 size={20} />
          <span>Language Analysis</span>
        </button>
        <button
          onClick={() => setSearchMode(FILE_UPLOAD)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all
                        ${
                          searchMode === FILE_UPLOAD
                            ? "bg-blue-100 text-blue-700 border-2 border-blue-300"
                            : "bg-gray-100 text-gray-600 border-2 border-transparent"
                        }`}
        >
          <FileType2 size={20} />
          <span>File Upload</span>
        </button>
      </div>

      <div className="flex gap-6">
        <div className="w-1/2 h-[600px] border border-gray-200 rounded-xl bg-white overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-3">
            {renderModal(searchMode)}
          </div>
        </div>
        <InputAccumulator
          selectedItems={selectedItems}
          onRemoveItem={removeItem}
          MIN_ITEMS={MIN_ITEMS}
        />
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={clearAllSelectedItems}
          disabled={isClearDisabled}
          className={`px-6 py-3 rounded-lg transition-all
                        ${
                          isClearDisabled
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                        }`}
        >
          Clear All
        </button>
        <button
          onClick={sendNcdInput}
          disabled={isSearchDisabled}
          className={`px-6 py-3 rounded-lg transition-all ml-5
                        ${
                          isSearchDisabled
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                        }`}
        >
          Calculate NCD Matrix
        </button>
      </div>
    </div>
  );
};

export default ListEditor;
