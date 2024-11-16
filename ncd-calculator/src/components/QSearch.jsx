import React, {useEffect, useRef, useState} from "react";
import {workerCode} from "../workers/ncdWorker.js";
import {
    getFastaAccessionNumbersFromIds,
    getFastaList,
    getFastaListAndParse,
    getSequenceIdsBySearchTerm,
} from "../functions/getPublicFasta.js";
import {
    cacheAccession,
    cacheSearchTermAccessions,
    filterValidAccessionAndParse,
    getCachedAccessionBySearchTerm,
    getCachedSequenceByAccession,
    initCache,
} from "../functions/cache.js";

import QSearchWorker from "../workers/qsearchWorker.js?worker";
import {getGenbankSequences} from "../functions/getPublicGenbank.js";
import {LanguageTree} from "./LanguageTree.jsx";
import {MatrixTree} from "./MatrixTree.jsx";
import {FastaSearch} from "./FastaSearch.jsx";
import {parseFastaAndClean} from "../functions/fasta.js";
import {Loader} from "lucide-react";


export const QSearch = () => {
        const [ncdMatrix, setNcdMatrix] = useState([]);
        const [labels, setLabels] = useState([]);
        const [hasMatrix, setHasMatrix] = useState(false);
        const [ncdWorker, setNcdWorker] = useState(null);
        const [errorMsg, setErrorMsg] = useState("");
        const [confirmedSearchTerm, setConfirmedSearchTerm] = useState("");
        const [executionTime, setExecutionTime] = useState(performance.now());
        const qSearchWorkerRef = useRef(null);
        const [qSearchTreeResult, setQSearchTreeResult] = useState(null);
        const [labelMap, setLabelMap] = useState(new Map());
        const labelMapRef = useRef(labelMap);
        const [activeTab, setActiveTab] = useState('fastaSearch');
        const [isLoading, setIsLoading] = useState(false);
        const [isSearchDisabled, setIsSearchDisabled] = useState(true);


        useEffect(() => {
            initCache();
            runNCDWorker();
            qSearchWorkerRef.current = new QSearchWorker();
            qSearchWorkerRef.current.onmessage = handleQsearchMessage;
        }, []);

        const handleParsedFileContent = (parsedData) => {
           if (parsedData.valid) {
               handleValidFileContent(parsedData);
           } else {
               handleInvalidFileContent();
           }
        }

        const handleValidFileContent = (parsedData) => {
            setIsLoading(true);
            const map = {
                displayLabels: [],
                accessions: [],
            }
            for (let i = 0; i < parsedData.data.length; i++) {
                map.displayLabels.push(parsedData.data[i].accession);
                map.accessions.push(parsedData.data[i].accession);
            }
            const labelMap = getLabelMap(map);
            setLabelMap(labelMap);
            labelMapRef.current = labelMap;
            const ncdInput = getNcdInput(parsedData);
            ncdWorker.postMessage(ncdInput);
        }

        const handleInvalidFileContent = () => {
            resetSearchResult("");
        }


        const getNcdInput = (parsedFasta) => {
            const input = {
                contents: [],
                labels: []
            };
            for (let i = 0; i < parsedFasta.data.length; i++) {
                const fasta = parsedFasta.data[i];
                input.labels.push(fasta.accession);
                input.contents.push(fasta.sequence);
            }
            return input;
        }

        const displayNcdMatrix = (response) => {
            const {labels, ncdMatrix} = response;
            let displayNames = [];
            for (let i = 0; i < labels.length; i++) {
                displayNames.push(labelMapRef.current.get(labels[i]));
            }
            displayNames = displayNames.filter(d => d != null).length === 0 ? labels : displayNames;
            setLabels(displayNames);
            setNcdMatrix(ncdMatrix);
            setHasMatrix(true);
            setErrorMsg("");
            qSearchWorkerRef.current.postMessage({
                action: "processNcdMatrix",
                labels,
                ncdMatrix,
            });
        };

        const runNCDWorker = () => {
            const blob = new Blob([workerCode], {type: "application/javascript"});
            const workerURL = URL.createObjectURL(blob);
            const worker = new Worker(workerURL);
            worker.onmessage = function (e) {
                const message = e.data;
                console.log('receive worker message: ' + JSON.stringify(message));
                if (message.type === "progress") {
                } else if (message.type === "result") {
                    if (
                        !message ||
                        message.labels.length === 0 ||
                        message.ncdMatrix.length === 0
                    ) {
                        setErrorMsg("no result");
                        resetDisplay();
                    } else {
                        displayNcdMatrix(message);
                    }
                    setExecutionTime((prev) => {
                        return performance.now() - prev;
                    });
                }
            };
            setNcdWorker(worker);
        };

        const getLabelMap = (projectedInput) => {
            let map = new Map();
            const accessions = projectedInput.accessions;
            const labels = projectedInput.displayLabels;
            for (let i = 0; i < accessions.length; i++) {
                map.set(accessions[i], labels[i]);
            }
            return map;
        };

        const emptySearchTerms = (searchTerms) => {
            return !searchTerms || searchTerms.length === 0;
        }


        const performSearch = async (searchTerms, projectionOptions, apiKey) => {
            if (emptySearchTerms(searchTerms)) {
                return;
            }
            setIsLoading(true);
            setIsSearchDisabled(true);
            searchTerms = searchTerms.map(term => term.toLowerCase().trim());
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
                resetSearchResult("no result");
                return;
            }

            try {
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
                                    accession: rs.accessions[j]
                                })
                            }
                            accessions.push(accession);
                        }
                    } else {
                        for (let j = 0; j < results[i].accessions.length; j++) {
                            missAccessions.add(results[i].accessions[j]);
                            accessions.push(results[i].accessions[j]);
                        }
                    }
                }
                if (missAccessions.size !== 0) {
                    const missedSequences = await getFastaSequence(Array.from(missAccessions), apiKey);
                    const accessionSeqToCache = {
                        accessions: [],
                        contents: []
                    }
                    for (let i = 0; i < missedSequences.accessions.length; i++) {
                        accessionToSequence.set(missedSequences.accessions[i], {
                            content: missedSequences.contents[i],
                            label: missedSequences.labels[i],
                            commonName: missedSequences.commonNames[i],
                            scientificName: missedSequences.scientificNames[i],
                            accession: missedSequences.accessions[i]
                        });
                        const searchTerm = accessionToSearchTerm.get(missedSequences.accessions[i]);
                        cacheSearchTermAccessions(searchTerm, {
                            accessions: [missedSequences.accessions[i]],
                            labels: [missedSequences.labels[i]],
                            commonNames: [missedSequences.commonNames[i]],
                            scientificNames: [missedSequences.scientificNames[i]]
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
                    scientificNames: []
                }
                for (let i = 0; i < accessions.length; i++) {
                    const seqRes = accessionToSequence.get(accessions[i]);
                    putNonProjectedItem(nonProjectedInput, seqRes);
                }
                const map = new Map();
                for (let i = 0; i < nonProjectedInput.accessions.length; i++) {
                    map.set(nonProjectedInput.accessions[i], {
                        label: nonProjectedInput.labels[i],
                        scientificName: nonProjectedInput.scientificNames[i],
                        commonName: nonProjectedInput.commonNames[i],
                        content: nonProjectedInput.contents[i]
                    });
                }
                const projectedInput = {
                    contents: [],
                    labels: [],
                    scientificNames: [],
                    commonNames: [],
                    accessions: []
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
                }
                const ncdInput = {
                    contents: projectedInput.contents,
                    labels: projectedInput.accessions
                }
                projectedInput.displayLabels = determineDisplayLabels(projectedInput, projectionOptions);
                let labelMap = getLabelMap(projectedInput);
                labelMapRef.current = labelMap;
                setLabelMap(labelMap);
                ncdWorker.postMessage(ncdInput);
            } finally {
                setIsLoading(false);
                setIsSearchDisabled(false);
            }
        }

        const resetSearchResult = (message) => {
            setErrorMsg(message);
            setNcdMatrix([]);
            setLabels([]);
            labelMapRef.current = new Map();
            setLabelMap(new Map());
            setHasMatrix(false);
            setQSearchTreeResult([]);
        }

// the projected input is guaranteed to have unique values in some project option field
        const determineDisplayLabels = (projectedInput, projectionOptions) => {
            let displayLabels = [];
            if (allNonEmpty(projectedInput.accessions) && shouldUseOption(projectedInput.accessions)) {
                displayLabels = projectedInput.accessions;
            }
            if (allNonEmpty(projectedInput.labels) && shouldUseOption(projectedInput.labels)) {
                displayLabels = projectedInput.labels;
            }
            if (allNonEmpty(projectedInput.scientificNames) && shouldUseOption(projectedInput.scientificNames)) {
                displayLabels = projectedInput.labels;
            }
            if (allNonEmpty(projectedInput.commonNames) && shouldUseOption(projectedInput.commonNames)) {
                displayLabels = projectedInput.labels;
            }
            return displayLabels;
        };


        const shouldUseOption = (optionValues) => {
            const len = optionValues.length;
            const set = new Set([...optionValues]);
            return len === set.size;
        }

        const allNonEmpty = (arr) => {
            const len = arr.length;
            return arr.filter(e => e && e.trim() !== '').length === len;
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
                for (let i = 0; i < fastaContent.data.length; i++) {
                    const sequence = fastaContent.data[i].sequence;
                    const accession = fastaContent.data[i].accession.toLowerCase().trim();
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


        const putNonProjectedItem = (obj, item) => {
            obj.contents.push(item.content);
            obj.labels.push(item.label);
            obj.accessions.push(item.accession);
            obj.commonNames.push(item.commonName);
            obj.scientificNames.push(item.scientificName);
        }


        const getSearchResult = async (searchTerm, apiKey) => {
            const emptyResult = {
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
                        data.contents[0] = parsedFasta.data[0].sequence;
                    }
                    data.cacheHit = false;
                    return data;
                } else {
                    return emptyResult;
                }
            }
        }


        const cacheHit = (checkedResult) => {
            if (!checkedResult || checkedResult.length === 0) {
                return false;
            }
            return true;
        }


        const resetDisplay = () => {
            setErrorMsg("");
            setNcdMatrix([]);
            setLabels([]);
            labelMapRef.current = new Map();
            setLabelMap(new Map());
            setHasMatrix(false);
            setQSearchTreeResult(null);
        };


        const handleQsearchMessage = (event) => {
            let newMessage = "";
            if (event.data.action === "qsearchComplete") {
                newMessage = "Qsearch complete";
            } else if (event.data.action === "qsearchError") {
                newMessage = "Qsearch error: " + event.data.message;
            } else if (event.data.action === "consoleLog") {
                newMessage = event.data.message;
            } else if (event.data.action === "consoleError") {
                console.error(event.data.message);
                newMessage = "Error: " + event.data.message;
            } else if (event.data.action === "treeJSON") {
                const result = JSON.parse(event.data.result);
                for (let i = 0; i < result.nodes.length; i++) {
                    result.nodes[i].label = labelMapRef.current.get(result.nodes[i].label);
                }
                setQSearchTreeResult(result);
            }
            setIsLoading(false);
        };

        const resetAndSetActiveTab = (tab) => {
            resetDisplay();
            setActiveTab(tab);
        }

        return (
            <div style={{margin: "20px", textAlign: "center"}}>
                <h1 style={{marginBottom: "20px"}}>NCD Calculator</h1>
                {/* Tab Buttons */}
                <div style={{display: "flex", justifyContent: "center", marginBottom: "20px"}}>
                    <button
                        onClick={() => resetAndSetActiveTab("fastaSearch")}
                        style={{
                            padding: "10px 20px",
                            backgroundColor: activeTab === "fastaSearch" ? "#3182ce" : "#e0e0e0",
                            color: activeTab === "fastaSearch" ? "white" : "black",
                            border: "none",
                            borderRadius: "5px",
                            cursor: "pointer",
                            marginRight: "10px"
                        }}
                    >
                        Fasta Search
                    </button>
                    <button
                        onClick={() => resetAndSetActiveTab("languageTree")}
                        style={{
                            padding: "10px 20px",
                            backgroundColor: activeTab === "languageTree" ? "#3182ce" : "#e0e0e0",
                            color: activeTab === "languageTree" ? "white" : "black",
                            border: "none",
                            borderRadius: "5px",
                            cursor: "pointer"
                        }}
                    >
                        Language Tree
                    </button>
                </div>
                {activeTab === 'fastaSearch' &&
                    <FastaSearch onParsedFileContent={handleParsedFileContent} performSearch={performSearch}/>}
                {activeTab === 'languageTree' && <LanguageTree
                    ncdWorker={ncdWorker}
                    setConfirmedSearchTerm={setConfirmedSearchTerm} setErrorMsg={setErrorMsg}
                    setExecutionTime={setExecutionTime} labelMapRef={labelMapRef} setLabelMap={setLabelMap}
                />}
                {(isLoading) && (
                    <div className="flex items-center gap-2 text-slate-600" style={{
                        paddingLeft: "20px",
                        color: "#bfdbfe"
                    }}>
                        <Loader className="animate-spin" size={20}/>
                        <span>{isLoading ? 'Computing result...' : 'Processing results...'}</span>
                    </div>
                )}
                {(!isLoading) && (
                    <MatrixTree hasMatrix={hasMatrix} ncdMatrix={ncdMatrix} labels={labels}
                                confirmedSearchTerm={confirmedSearchTerm} errorMsg={errorMsg}
                                qSearchTreeResult={qSearchTreeResult} executionTime={executionTime}/>
                )
                }

            </div>
        );
    }
;