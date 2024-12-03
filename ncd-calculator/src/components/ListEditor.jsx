import {useState} from 'react';
import {Dna, FileType2, Globe2} from 'lucide-react';
import {getTranslationResponse} from '../functions/udhr.js';
import {InputAccumulator} from "./InputAccumulator.jsx";
import {Language} from "./Language.jsx";
import {
    cacheTranslation,
    getTranslationCache, useStorageState,
} from "../cache/cache.js";
import {FastaSearch} from "./FastaSearch.jsx";
import {FASTA, FILE_UPLOAD, LANGUAGE} from "./constants/modalConstants.js";
import {FileUpload} from "./FileUpload.jsx";
import {LocalStorageKeyManager, LocalStorageKeys} from "../cache/LocalStorageKeyManager.js";
import {getFastaSequences} from "../functions/getPublicGenbank.js";

const ListEditor = ({onComputedNcdInput, labelMapRef, setLabelMap, setIsLoading, resetDisplay, setOpenLogin, authenticated}) => {
    const [searchMode, setSearchMode] = useStorageState("searchMode", "language");
    const [searchTerm, setSearchTerm] = useState('');
    // prevent users have to reselect items when authentication callback happens
    const [selectedItems, setSelectedItems] = useStorageState('selectedItems', []);
    const [apiKey, setApiKey] = useState(import.meta.env.VITE_NCBI_API_KEY);
    const [isDragging, setIsDragging] = useState(false);
    const [projections, setProjections] = useState({
        Accession: true,
        ScientificName: false,
        CommonName: true,
        FileName: false,
    });

    /**
     * (search term, file, text, etc...) => selected items => ncd input
     * selectedItem: {
     *     type: "fasta" | "language",
     *     label: "",
     *     content: "",
     *     id: "",
     * }
     *
     * ncdInput: {
     *  labels: [],
     *  contents: [],
     * }
     *
     */

    const MIN_ITEMS = 4;
    const isSearchDisabled = selectedItems.length < MIN_ITEMS || (searchMode === 'fasta' && !apiKey && selectedItems.length < MIN_ITEMS);
    const isClearDisabled = selectedItems.length === 0;
    const localStorageManager = new LocalStorageKeyManager();



    const sendNcdInput = async () => {
        if (selectedItems && selectedItems.length > 8 && !authenticated) {
            setOpenLogin(true);
            return;
        }
        setIsLoading(true);
        const computedNcdInput = await computeNcdInput();
        const ncdSelectedItems = getNcdSelectedItems(computedNcdInput, selectedItems);
        updateDisplayLabelMap(ncdSelectedItems);
        const input = getConvertedNcdInput(ncdSelectedItems);
        onComputedNcdInput(input);
    }


    const getConvertedNcdInput = (ncdSelectedItems) => {
        const response = {
            labels: [],
            contents: []
        }
        for (let i = 0; i < ncdSelectedItems.length; i++) {
            response.labels[i] = ncdSelectedItems[i].id;
            response.contents[i] = ncdSelectedItems[i].content;
        }
        return response;
    }


    const getNcdSelectedItems = (ncdInputItems, selectedItems) => {
        const map = new Map();
        for (let i = 0; i < selectedItems.length; i++) {
            map.set(selectedItems[i].id, selectedItems[i]);
        }
        const ncdSelectedItems = [];
        for (let i = 0; i < ncdInputItems.length; i++) {
            const id = ncdInputItems[i].id;
            const item = map.get(id);
            item.content = ncdInputItems[i].content;
            ncdSelectedItems.push(item);
        }
        return ncdSelectedItems;
    }

    const updateDisplayLabelMap = (selectedItems) => {
        const map = new Map();
        for (let i = 0; i < selectedItems.length; i++) {
            const id = selectedItems[i].id;
            const label = selectedItems[i].label;
            map.set(id, label);
        }
        labelMapRef.current = map;
        setLabelMap(map);
    }


    const computeNcdInput = async () => {
        const langItems = selectedItems.filter(item => item.type === LANGUAGE);
        const fastaItems = selectedItems.filter(item => item.type === FASTA || item.type === FILE_UPLOAD);
        const orderMap = getOrderMap(selectedItems);
        /** the computed NCD input will have the format, the labels here will act as ids:
         * {
         *     labels: [],
         *     contents: []
         * }
         **/
        const langNcdInput = await computeLanguageNcdInput(langItems);
        const fastaNcdInput = getCachedFastaContent(fastaItems);
        const needComputeFastaList = await computeFastaNcdInput(fastaItems.filter(item => !item.content || item.content.trim() === ''), projections, apiKey);
        const mergedFastaInput = [...fastaNcdInput, ...needComputeFastaList];
        return mergeAndPreserveInitialOrder(langNcdInput, mergedFastaInput, orderMap);
    }


    const getCachedFastaContent = (items) => {
        const res = items.filter(item => item.content && item.content.trim() !== '');
        const withoutContent = items.filter(item => !item.content || item.content.trim() === '');
        for(let i = 0; i < withoutContent.length; i++) {
            const item = withoutContent[i];
            const sequence = localStorageManager.get(LocalStorageKeys.ACCESSION_SEQUENCE(), item.id);
            if (sequence && sequence.trim() !== '') {
                item.content = sequence;
                res.push(item);
            }
        }
        return res;
    }



    const getOrderMap = (selectedItems) => {
        const map = new Map();
        for (let i = 0; i < selectedItems.length; i++) {
            map.set(selectedItems[i].id, i);
        }
        return map;
    }


    const mergeAndPreserveInitialOrder = (result1, result2, order) => {
        const arr = [];
        for (let i = 0; i < result1.length; i++) {
            const index = order.get(result1[i].id);
            arr[index] = result1[i];
        }
        for (let i = 0; i < result2.length; i++) {
            const index = order.get(result2[i].id);
            arr[index] = result2[i];
        }
        const rs = shiftLeft(arr);
        const response = [];
        for (let i = 0; i < rs.length; i++) {
            if (!rs[i]) {
                break;
            } else {
                response.push(rs[i]);
            }
        }
        return response;
    }

    const shiftLeft = (arr) => {
        let result = [...arr];
        for (let i = 0; i < arr.length; i++) {
            if (!arr[i]) {
                result = shiftLeftAndGet(result, i);
            }
        }
        return result;
    }

    const shiftLeftAndGet = (arr, index) => {
        const result = [...arr];
        for (let i = index + 1; i < result.length; i++) {
            result[i - 1] = result[i];
        }
        return result;
    }

    const computeLanguageNcdInput = async (langItems) => {
        if (!langItems || langItems.length === 0) return [];
        const pendingRs = []
        for (let i = 0; i < langItems.length; i++) {
            const item = getCompleteLanguageItem(langItems[i]);
            pendingRs.push(item);
        }
        return await Promise.all(pendingRs);
    }


    const getCompleteLanguageItem = async (selectedItem) => {
        const lang = selectedItem.id;
        let translationCached = getTranslationCache(lang);
        if (!translationCached) {
            const text = await getTranslationResponse(lang);
            if (text && text.trim() !== '') {
                cacheTranslation(lang, text)
            }
            translationCached = text;
        }
        const response = Object.assign({}, selectedItem);
        response.content = translationCached;
        return response;
    }


    async function computeFastaNcdInput(fastaItems, projectionOptions, apiKey) {
        if (!isValidInput(fastaItems)) return [];
        try {
            const searchResults = await fetchFastaSequenceAndProcess(fastaItems, apiKey);
            if (searchResults.length === 0) return [];
            cacheAccessionSequence(searchResults);
            return searchResults;
        } catch (error) {
            console.error('Error in computeFastaNcdInput:', error);
            return [];
        }
    }


    const cacheAccessionSequence = (suggestions) => {
        suggestions.forEach(suggestion => {
            const id = suggestion.id;
            const content = suggestion.content;
            localStorageManager.set(LocalStorageKeys.ACCESSION_SEQUENCE(), id, content);
        })
    }



    function isValidInput(fastaItems) {
        if (!fastaItems?.length) return false;
        const searchTerms = fastaItems.map(item => item.label.toLowerCase().trim());
        return searchTerms.some(term => term.length > 0);
    }

    async function fetchFastaSequenceAndProcess(fastaItems) {
        const idsToFetch = fastaItems.map(item => item.id);
        const map = new Map();
        for(let i = 0; i < fastaItems.length; i++) {
            const obj = Object.assign({}, fastaItems[i]);
            map.set(obj.id, obj);
        }
        const response = await getFastaSequences(idsToFetch);
        const arr = toArr(response);
        for(let i = 0; i < arr.length; i++) {
            const accession = arr[i].accession;
            const fastItem = map.get(accession);
            fastItem.content = arr[i].sequence;
        }
        return Array.from(map.values());
    }

    const toArr = (response) => {
        const arr = [];
        for(let i = 0; i < response.accessions.length; i++) {
            const item = {
                sequence: response.contents[i],
                accession: response.accessions[i]
            }
            arr.push(item);
        }
        return arr;
    }



    const addItem = (item) => {
        if (!selectedItems.find(selected => selected.id === item.id)) {
            setSelectedItems([...selectedItems, item]);
        }
    };

    const removeItem = (itemId) => {
        setSelectedItems(selectedItems.filter(item => item.id !== itemId));
    };

    const clearAllSelectedItems = () => {
        setSelectedItems([]);
        resetDisplay();
    }

    const renderModal = (mode) => {
        switch (mode) {
            case FASTA:
                return (<FastaSearch addItem={addItem} searchTerm={searchTerm} MIN_ITEMS={MIN_ITEMS}
                                     selectedItems={selectedItems}
                                     onSetApiKey={setApiKey} setSelectedItems={setSelectedItems}/>)
            case LANGUAGE:
                return (<Language selectedItems={selectedItems} searchTerm={searchTerm} addItem={addItem}
                                  MIN_ITEMS={MIN_ITEMS}/>)
            default:
                return (
                    <FileUpload selectedItems={selectedItems} searchTerm={searchTerm} addItem={addItem} setSelectedItems={setSelectedItems}
                                MIN_ITEMS={MIN_ITEMS}/>
                )
        }
    }

    return (
        <div className="p-6 w-full max-w-6xl mx-auto">
            {/* Mode Selector */}
            <div className="flex gap-4 mb-6">
                <button
                    onClick={() => setSearchMode(LANGUAGE)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all
            ${searchMode === LANGUAGE
                        ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                        : 'bg-gray-100 text-gray-600 border-2 border-transparent'}`}
                >
                    <Globe2 size={20}/>
                    <span>Language Analysis</span>
                </button>
                <button
                    onClick={() => setSearchMode(FASTA)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all
            ${searchMode === FASTA
                        ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                        : 'bg-gray-100 text-gray-600 border-2 border-transparent'}`}
                >
                    <Dna size={20}/>
                    <span>FASTA Search</span>
                </button>
                <button
                    onClick={() => setSearchMode(FILE_UPLOAD)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all
            ${searchMode === FILE_UPLOAD
                        ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                        : 'bg-gray-100 text-gray-600 border-2 border-transparent'}`}
                >
                    <FileType2 size={20}/>
                    <span>File Upload</span>
                </button>
            </div>

            <div className="flex gap-6">
                {/* Left Panel */}
                <div
                    className="w-1/2 h-[600px] border border-gray-200 rounded-xl bg-white overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-y-auto p-3">
                        {
                            renderModal(searchMode)
                        }
                    </div>
                </div>
                <InputAccumulator
                    selectedItems={selectedItems}
                    onRemoveItem={removeItem}
                    MIN_ITEMS={MIN_ITEMS}
                    authenticated={authenticated}/>
            </div>

            <div className="flex justify-end mt-6">
                <button
                    onClick={clearAllSelectedItems}
                    disabled={isClearDisabled}
                    className={`px-6 py-3 rounded-lg transition-all
        ${isClearDisabled
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'}`}
                >
                    Clear All
                </button>
                <button
                    onClick={sendNcdInput}
                    disabled={isSearchDisabled}
                    className={`px-6 py-3 rounded-lg transition-all ml-5
            ${isSearchDisabled
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'}`}
                >
                    Calculate NCD Matrix
                </button>
            </div>
        </div>
    );
};

export default ListEditor;