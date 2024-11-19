import React, {useState} from 'react';
import {Globe2, X} from 'lucide-react';
import {getTranslationResponse} from '../functions/udhr.js';
import {InputAccumulator} from "./InputAccumulator.jsx";
import {parseFastaAndClean} from "../functions/fasta.js";
import {Language} from "./Language.jsx";
import {
    cacheAccession,
    cacheSearchTermAccessions,
    cacheTranslation,
    filterValidAccessionAndParse,
    getCachedAccessionBySearchTerm,
    getCachedSequenceByAccession,
    getTranslationCache
} from "../functions/cache.js";
import {
    getFastaAccessionNumbersFromIds,
    getFastaList,
    getFastaListAndParse,
    getSequenceIdsBySearchTerm
} from "../functions/getPublicFasta.js";
import {getGenbankSequences} from "../functions/getPublicGenbank.js";
import {FastaSearch} from "./FastaSearch.jsx";

const ListEditor = ({onComputedNcdInput, labelMapRef, setLabelMap, setIsLoading, resetDisplay}) => {
    const [searchMode, setSearchMode] = useState('language');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItems, setSelectedItems] = useState([]);
    const [apiKey, setApiKey] = useState('');
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

    const emptySearchTerms = (searchTerms) => {
        return !searchTerms || searchTerms.length === 0;
    }


    const getUniqueAccessions = (projectedInput, uniqueField) => {
        const uniqueNames = new Set();
        const uniqueAccessions = new Set();
        if ("commonName" === uniqueField) {
            projectedInput.commonNames.forEach(((name, index) => {
                if (!uniqueNames.has(name)) {
                    uniqueNames.add(name);
                    uniqueAccessions.add(projectedInput.accessions[index]);
                }
            }));
        } else if ("scientificName" === uniqueField) {
            projectedInput.scientificNames.forEach(((name, index) => {
                if (!uniqueNames.has(name)) {
                    uniqueNames.add(name);
                    uniqueAccessions.add(projectedInput.accessions[index]);
                }
            }));
        } else {
            console.log("Unsupported unique field: " + uniqueField);
        }
        return uniqueAccessions;
    }

    const intersect = (a, b) => {
        const arrA = Array.from(a);
        const arrB = Array.from(b);
        return new Set([...arrA.filter(elem => arrB.includes(elem))]);
    }


    const getFastaSequence = async (ids) => {
        const data = await getGenbankSequences(ids, ids.length);
        const emptySeqAccessions = [];
        for (let i = 0; i < data.contents.length; i++) {
            if (!data.contents[i] || data.contents[i].trim() === '') {
                emptySeqAccessions.push(data.accessions[i]);
            }
        }
        const moreSeq = {};
        if (emptySeqAccessions.length > 0) {
            const fastaContent = await getFastaListAndParse(emptySeqAccessions);
            for (let i = 0; i < fastaContent.length; i++) {
                const sequence = fastaContent[i].sequence;
                const accession = fastaContent[i].accession.toLowerCase().trim();
                for (let j = 0; j < data.accessions.length; j++) {
                    if (data.accessions[j] === accession) {
                        data.contents[j] = sequence;
                        break;
                    }
                }
            }
        }
        return {
            ...data,
            ...moreSeq
        }
    }


    // const determineDisplayLabels = (projectedInput, projectionOptions) => {
    //     let displayLabels = [];
    //     if (allNonEmpty(projectedInput.accessions) && shouldUseOption(projectedInput.accessions)) {
    //         displayLabels = projectedInput.accessions;
    //     }
    //     if (allNonEmpty(projectedInput.labels) && shouldUseOption(projectedInput.labels)) {
    //         displayLabels = projectedInput.labels;
    //     }
    //     if (allNonEmpty(projectedInput.scientificNames) && shouldUseOption(projectedInput.scientificNames)) {
    //         displayLabels = projectedInput.labels;
    //     }
    //     if (allNonEmpty(projectedInput.commonNames) && shouldUseOption(projectedInput.commonNames)) {
    //         displayLabels = projectedInput.labels;
    //     }
    //     return displayLabels;
    // };


    // const shouldUseOption = (optionValues) => {
    //     const len = optionValues.length;
    //     const set = new Set([...optionValues]);
    //     return len === set.size;
    // }
    //
    // const allNonEmpty = (arr) => {
    //     const len = arr.length;
    //     return arr.filter(e => e && e.trim() !== '').length === len;
    // }


    const putNonProjectedItem = (obj, item) => {
        obj.contents.push(item.content);
        obj.labels.push(item.label);
        obj.accessions.push(item.accession);
        obj.commonNames.push(item.commonName);
        obj.scientificNames.push(item.scientificName);
        obj.searchTerms.push(item.searchTerm);
    }


    const sendNcdInput = async () => {
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


    // projected input are valid NCD items after applying filter conditions
    const getProjectedInput = (nonProjectedInput, projectionOptions) => {
        const map = new Map();
        for (let i = 0; i < nonProjectedInput.accessions.length; i++) {
            map.set(nonProjectedInput.accessions[i], {
                label: nonProjectedInput.labels[i],
                scientificName: nonProjectedInput.scientificNames[i],
                commonName: nonProjectedInput.commonNames[i],
                content: nonProjectedInput.contents[i],
                searchTerm: nonProjectedInput.searchTerms[i]
            });
        }
        const projectedInput = {
            contents: [],
            labels: [],
            scientificNames: [],
            commonNames: [],
            accessions: [],
            searchTerms: [],
        }
        const resultSet = new Set([...nonProjectedInput.accessions]);
        if (projectionOptions.commonName) {
            const itemsUniqueNames = getUniqueAccessions(nonProjectedInput, "commonName");
            Object.assign(resultSet, intersect(resultSet, itemsUniqueNames));
        }
        if (projectionOptions.scientificName) {
            const itemUniqueScientificNames = getUniqueAccessions(nonProjectedInput, "scientificName");
            Object.assign(resultSet, intersect(resultSet, itemUniqueScientificNames));
        }
        const resultSetArr = Array.from(resultSet);
        for (let i = 0; i < resultSetArr.length; i++) {
            const data = map.get(resultSetArr[i]);
            projectedInput.accessions.push(resultSetArr[i]);
            projectedInput.labels.push(data.label);
            projectedInput.contents.push(data.content);
            projectedInput.scientificNames.push(data.scientificName);
            projectedInput.commonNames.push(data.commonName);
            projectedInput.searchTerms.push(data.searchTerm);
        }
        return projectedInput;
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
        const langItems = selectedItems.filter(item => item.type === 'language');
        const fastaItems = selectedItems.filter(item => item.type === 'fasta');
        const orderMap = getOrderMap(selectedItems);
        /** the computed NCD input will have the format, the labels here will act as ids:
         * {
         *     labels: [],
         *     contents: []
         * }
         **/
        const langNcdInput = await computeLanguageNcdInput(langItems);
        let fastaNcdInput = getNcdInputFromFastaContent(fastaItems);
        fastaNcdInput = [...fastaNcdInput, ...await computeFastaNcdInput(fastaItems.filter(item => !item.content || item.content.trim() === ''), projections, apiKey)];
        return mergeAndPreserveInitialOrder(langNcdInput, fastaNcdInput, orderMap);
    }


    const getNcdInputFromFastaContent = fastaItems => {
        const items = [];
        for (let i = 0; i < fastaItems.length; i++) {
            const item = Object.assign({}, fastaItems[i]);
            items.push(item);
        }
        return items;
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


    const getFilteredItems = (selectedItems, projectedItems) => {
        return selectedItems.filter(item => projectedItems.searchTerms.includes(item.id));
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

    const computeFastaNcdInput = async (fastaItems, projectionOptions, apiKey) => {
        if (!fastaItems || fastaItems.length === 0) return [];
        const searchTerms = fastaItems.map(item => item.label.toLowerCase().trim());
        if (emptySearchTerms(searchTerms)) {
            return;
        }
        const accessionToSearchTerm = new Map();
        const results = [];
        for (let i = 0; i < searchTerms.length; i++) {
            const rs = await getSearchResult(searchTerms[i], apiKey);
            if (rs.contents.length !== 0) {
                results.push(rs);
                for (let j = 0; j < rs.accessions.length; j++) {
                    accessionToSearchTerm.set(rs.accessions[j], searchTerms[i]);
                }
            }
        }
        if (results.length === 0) {
            return;
        }

        const hitAccessions = new Set();
        const missAccessions = new Set();
        const accessionToSequence = new Map();
        const accessions = [];
        for (let i = 0; i < results.length; i++) {
            if (results[i].cacheHit) {
                for (let j = 0; j < results[i].accessions.length; j++) {
                    const rs = results[i];
                    const accession = rs.accessions[j];
                    if (!rs.contents[j] || rs.contents[j].trim() === '') {
                        missAccessions.add(rs.accessions[j]);
                    } else {
                        hitAccessions.add(rs.accessions[j]);
                        accessionToSequence.set(rs.accessions[j], {
                            content: rs.contents[j],
                            label: rs.labels[j],
                            commonName: rs.commonNames[j],
                            scientificName: rs.scientificNames[j],
                            accession: rs.accessions[j],
                            searchTerm: rs.searchTerm
                        })
                    }
                    accessions.push(accession);
                }
            } else {
                for (let j = 0; j < results[i].accessions.length; j++) {
                    missAccessions.add({
                        searchTerm: results[i].searchTerm,
                        accession: results[i].accessions[j]
                    });
                    accessions.push(results[i].accessions[j]);
                }
            }
        }
        if (missAccessions.size !== 0) {
            const missedSequences = await getFastaSequence(Array.from(missAccessions).map(e => e.accession), apiKey);
            const accessionSeqToCache = {
                accessions: [],
                contents: []
            }
            const arr = Array.from(missAccessions);
            for (let i = 0; i < missedSequences.accessions.length; i++) {
                accessionToSequence.set(missedSequences.accessions[i], {
                    content: missedSequences.contents[i],
                    label: missedSequences.labels[i],
                    commonName: missedSequences.commonNames[i],
                    scientificName: missedSequences.scientificNames[i],
                    accession: missedSequences.accessions[i],
                    searchTerm: arr[i].searchTerm
                });
                const searchTerm = accessionToSearchTerm.get(missedSequences.accessions[i]);
                cacheSearchTermAccessions(searchTerm, {
                    accessions: [missedSequences.accessions[i]],
                    labels: [missedSequences.labels[i]],
                    commonNames: [missedSequences.commonNames[i]],
                    scientificNames: [missedSequences.scientificNames[i]],
                    searchTerm: searchTerm
                });
                // {contents: [], accessions: []}
                accessionSeqToCache.accessions.push(missedSequences.accessions[i]);
                accessionSeqToCache.contents.push(missedSequences.contents[i]);
            }
            cacheAccession(accessionSeqToCache);
        }
        const nonProjectedInput = {
            contents: [],
            labels: [],
            accessions: [],
            commonNames: [],
            scientificNames: [],
            searchTerms: [],
        }
        for (let i = 0; i < accessions.length; i++) {
            const seqRes = accessionToSequence.get(accessions[i]);
            putNonProjectedItem(nonProjectedInput, seqRes);
        }
        const projectedInput = getProjectedInput(nonProjectedInput, projectionOptions);
        const filteredItems = getFilteredItems(selectedItems, projectedInput);
        const items = [];
        for (let i = 0; i < filteredItems.length; i++) {
            const item = Object.assign({}, filteredItems[i]);
            item.content = projectedInput.contents[i];
            items.push(item);
        }
        return items;
    }


    const cacheHit = (checkedResult) => {
        if (!checkedResult || checkedResult.length === 0) {
            return false;
        }
        return true;
    }


    const getSearchResult = async (searchTerm, apiKey) => {
        const emptyResult = {
            searchTerm: searchTerm,
            contents: [],
            labels: [],
            accessions: [],
            commonNames: [],
            scientificNames: [],
            cacheHit: false
        }
        if (!searchTerm || searchTerm.trim() === '') {
            return emptyResult;
        }
        searchTerm = searchTerm.toLowerCase().trim();
        const cachedAccessions = getCachedAccessionBySearchTerm(searchTerm);
        if (cacheHit(cachedAccessions)) {
            // labels, contents, accessions
            const firstAccession = cachedAccessions[0];
            const accession = firstAccession.accession;
            const label = firstAccession.label;
            const scientificName = firstAccession.scientificName;
            const commonName = firstAccession.commonName;
            const sequence = getCachedSequenceByAccession(accession);
            return {
                searchTerm: searchTerm,
                contents: [sequence],
                labels: [label],
                accessions: [accession],
                scientificNames: [scientificName],
                commonNames: [commonName],
                cacheHit: true
            }
        } else {
            const ids = await getSequenceIdsBySearchTerm(searchTerm, 1, apiKey);
            if (ids && ids.length !== 0) {
                const unfilteredAccessions = await getFastaAccessionNumbersFromIds(ids);
                const accessions = filterValidAccessionAndParse(unfilteredAccessions);
                const data = await getGenbankSequences(accessions, accessions.length);
                if (!data.contents[0] || data.contents[0].trim() === '') {
                    // fall back to get the fasta sequence when sequence from genbank data is empty
                    const fasta = await getFastaList(ids);
                    let parsedFasta = parseFastaAndClean(fasta);
                    data.contents[0] = parsedFasta[0].sequence;
                }
                data.cacheHit = false;
                data.searchTerm = searchTerm;
                return data;
            } else {
                return emptyResult;
            }
        }
    }

    const addItem = (item) => {
        if (!selectedItems.find(selected => selected.id === item.id)) {
            setSelectedItems([...selectedItems, item]);
        }
    };

    const removeItem = (itemId) => {
        setSelectedItems(selectedItems.filter(item => item.id !== itemId));
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && searchTerm.trim() !== '' && searchMode === 'fasta') {
            addItem({
                id: `fasta-${Date.now()}`,
                type: 'fasta',
                display: searchTerm
            });
            setSearchTerm('');
        }
    };
    const clearAllSelectedItems = () => {
        setSelectedItems([]);
        resetDisplay();
    }

    return (
        <div className="p-6 w-full max-w-6xl mx-auto">
            {/* Mode Selector */}
            <div className="flex gap-4 mb-6">
                <button
                    onClick={() => setSearchMode('language')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all
            ${searchMode === 'language'
                        ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                        : 'bg-gray-100 text-gray-600 border-2 border-transparent'}`}
                >
                    <Globe2 size={20}/>
                    <span>Language Analysis</span>
                </button>
                <button
                    onClick={() => setSearchMode('fasta')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all
            ${searchMode === 'fasta'
                        ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                        : 'bg-gray-100 text-gray-600 border-2 border-transparent'}`}
                >
                    {/*<DNA size={20} />*/}
                    <span>FASTA Search</span>
                </button>
            </div>

            <div className="flex gap-6">
                {/* Left Panel */}
                <div
                    className="w-1/2 h-[600px] border border-gray-200 rounded-xl bg-white overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-y-auto p-3">
                        {searchMode === 'language' ? (
                            <Language selectedItems={selectedItems} searchTerm={searchTerm} addItem={addItem}
                                      MIN_ITEMS={MIN_ITEMS}/>
                        ) : (
                            <FastaSearch addItem={addItem} searchTerm={searchTerm} MIN_ITEMS={MIN_ITEMS}
                                         selectedItems={selectedItems}
                                         onSetApiKey={setApiKey} setSelectedItems={setSelectedItems}

                            />)
                        }
                    </div>
                </div>
                <InputAccumulator
                    selectedItems={selectedItems}
                    onRemoveItem={removeItem}
                    MIN_ITEMS={MIN_ITEMS}/>
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