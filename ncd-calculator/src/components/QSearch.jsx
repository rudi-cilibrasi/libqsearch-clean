import {useEffect, useRef, useState} from "react";
import {workerCode} from "../workers/ncdWorker.js";
import {initCache,} from "../functions/cache.js";

import QSearchWorker from "../workers/qsearchWorker.js?worker";
import {MatrixTree} from "./MatrixTree.jsx";
import {Loader} from "lucide-react";
import ListEditor from "./ListEditor.jsx";


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


    /**
     * ncdInput: {
     *     contents: [],
     *     labels: [],
     * }
     *
     *
     */
    const onNcdInput = async (ncdInput) => {
        if (!ncdInput || ncdInput.labels.length === 0) {
            setIsLoading(false);
            setIsSearchDisabled(false);
            return;
        }
        ncdWorker.postMessage(ncdInput);
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

    return (
        <div style={{margin: "20px", textAlign: "center"}}>
            <h1 style={{marginBottom: "20px"}}>NCD Calculator</h1>
            <ListEditor onComputedNcdInput={onNcdInput} labelMapRef={labelMapRef} setLabelMap={setLabelMap}
                        setIsLoading={setIsLoading} resetDisplay={resetDisplay}/>
            {
                (isLoading) && (
                    <div className="flex items-center gap-2 text-slate-600" style={{
                        paddingLeft: "20px",
                        color: "#bfdbfe"
                    }}>
                        <Loader className="animate-spin" size={20}/>
                        <span>{isLoading ? 'Computing result...' : 'Processing results...'}</span>
                    </div>
                )
            }
            {
                (!isLoading) && (
                    <MatrixTree hasMatrix={hasMatrix} ncdMatrix={ncdMatrix} labels={labels}
                                confirmedSearchTerm={confirmedSearchTerm} errorMsg={errorMsg}
                                qSearchTreeResult={qSearchTreeResult} executionTime={executionTime}/>
                )
            }

        </div>
    );
};