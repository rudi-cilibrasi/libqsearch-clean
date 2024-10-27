import {useEffect, useRef, useState} from "react";
import {workerCode} from "../workers/ncdWorker.js";
import {FileDrop} from "./FileDrop.jsx";
import MatrixTable from "./MatrixTable.jsx";
import {
    getFastaAccessionNumbersFromIds,
    getFastaIdsBySearchTerm,
    getFastaList,
    parseFasta
} from "../functions/getPublicFasta.js";
import {
    cacheAccession, cacheSearchTermAccessions, getCachedDataByAccession, getCachedDataBySearchTerm, initCache
} from '../functions/cache.js'

import QSearchWorker from '../workers/qsearchWorker.js?worker';
import {TwoDTreeVisualizer} from "./2dTreeVisualizer.jsx";

export const FastaSearch = () => {
    const MAX_IDS_FETCH = 40;
    const [searchTerm, setSearchTerm] = useState("");
    const [numItems, setNumItems] = useState(5);
    const [ncdMatrix, setNcdMatrix] = useState([]);
    const [labels, setLabels] = useState([]);
    const [hasMatrix, setHasMatrix] = useState(false);
    const [ncdWorker, setNcdWorker] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [confirmedSearchTerm, setConfirmedSearchTerm] = useState('');
    const [executionTime, setExecutionTime] = useState(performance.now());
    const qSearchWorkerRef = useRef(null);
    const [qSearchTreeResult, setQSearchTreeResult] = useState(null);

    const setSearchTermRemoveErr = (searchTerm) => {
        setSearchTerm(searchTerm);
        setErrorMsg('')
    }

    useEffect(() => {
        initCache();
        runNCDWorker();
        qSearchWorkerRef.current = new QSearchWorker();
        qSearchWorkerRef.current.onmessage = handleQsearchMessage;
    }, []);

    const handleFastaData = (data) => {
        const parsed = parseFasta(data);
        ncdWorker.postMessage({
            labels: parsed.labels, contents: parsed.contents,
        });
    };

    const displayNcdMatrix = (response) => {
        const {labels, ncdMatrix} = response;
        setLabels(labels);
        setNcdMatrix(ncdMatrix);
        setHasMatrix(true);
        setErrorMsg('')
        qSearchWorkerRef.current.postMessage({action: 'processNcdMatrix', labels, ncdMatrix});
    };

    const runNCDWorker = () => {
        const blob = new Blob([workerCode], {type: "application/javascript"});
        const workerURL = URL.createObjectURL(blob);
        const worker = new Worker(workerURL);
        worker.onmessage = function (e) {
            const message = e.data;
            if (message.type === "progress") {
            } else if (message.type === "result") {
                if (!message || message.labels.length === 0 || message.ncdMatrix.length === 0) {
                    setErrorMsg("no result");
                    resetDisplay();
                } else {
                    displayNcdMatrix(message);
                }
                setExecutionTime((prev) => {
                    return performance.now() - prev;
                })
            }
        };
        setNcdWorker(worker);
    };


    const performSearch = async () => {
        if (!searchTerm) {
            setErrorMsg('The search input is empty');
            return;
        }
        setExecutionTime(performance.now());
        let searchTermCache = getCachedDataBySearchTerm(searchTerm);
        setQSearchTreeResult([]);
        if (!searchTermCache || searchTermCache.length === 0) {
            resetDisplay();
            console.log('Cache miss for search term: ' + searchTerm);
            let ids = await getFastaIdsBySearchTerm(searchTerm, MAX_IDS_FETCH);
            if (ids && ids.length !== 0) {
                let accessions = (await getFastaAccessionNumbersFromIds(ids)).filter(accession => accession != null);
                ids = ids.slice(0, numItems); // here we will only fetch the top `numItems` elements, the rest will be fetched on the next call
                if (accessions && accessions.length !== 0) {
                    cacheSearchTermAccessions(searchTerm, accessions);
                }
                let list = await getFastaList(ids);
                if (list && list !== '') {
                    let parsed = parseFasta(list);
                    ncdWorker.postMessage({
                        labels: parsed.labels, contents: parsed.contents,
                    });
                    await cacheAccession(parsed);
                }
            } else {
                setErrorMsg("no result");
                setNcdMatrix([]);
                setLabels([]);
                setHasMatrix(false);
                setQSearchTreeResult([]);
                return;
            }
        } else {
            const data = {labels: [], contents: []};
            for (let i = 0; i < searchTermCache.length; i++) {
                let accession = searchTermCache[i];
                let sequence = getCachedDataByAccession(accession);
                if (!sequence || sequence === '') {
                    let accessions = searchTermCache.slice(i);
                    let fastaList = await getFastaList(accessions);
                    let parsed = parseFasta(fastaList);
                    let all = {
                        contents: [...data.contents, ...parsed.contents],
                        labels: [...data.labels, ...parsed.labels]
                    }
                    let len = data.labels.length;
                    for (let j = 0; j < numItems - len; j++) {
                        data.labels.push(parsed.labels[j]);
                        data.contents.push(parsed.contents[j]);
                    }
                    await cacheAccession(all);
                    break;
                } else {
                    if (data.contents.length < numItems) {
                        data.labels = [...data.labels, accession];
                        data.contents = [...data.contents, sequence]
                    }
                }
            }
            console.log('Cache hit for term: ' + searchTerm + ', existing accessions: ' + searchTermCache);
            ncdWorker.postMessage(data);
        }
        setConfirmedSearchTerm(searchTerm);
    }


    const resetDisplay = () => {
        setErrorMsg('');
        setNcdMatrix([]);
        setLabels([]);
        setHasMatrix(false);
    }

    const handleKeyDown = async (e) => {
        if (e.key === "Enter") {
            await performSearch();
        }
    };


    const handleQsearchMessage = (event) => {
        let newMessage = '';
        console.log('Received message from QSearchWorker: ', JSON.stringify(event.data));
        if (event.data.action === 'qsearchComplete') {
            newMessage = 'Qsearch complete';
        } else if (event.data.action === 'qsearchError') {
            newMessage = 'Qsearch error: ' + event.data.message;
        } else if (event.data.action === 'consoleLog') {
            console.log(event.data.message);
            newMessage = event.data.message;
        } else if (event.data.action === 'consoleError') {
            console.error(event.data.message);
            newMessage = 'Error: ' + event.data.message;
        } else if (event.data.action === 'treeJSON') {
            console.log('Received tree JSON: ', JSON.stringify(event.data.result));
            setQSearchTreeResult(JSON.parse(event.data.result));
        }
    };

    return (<div style={{margin: "20px", textAlign: "center"}}>
        <h1 style={{marginBottom: "20px"}}>NCD Calculator</h1>
        <div>
            <input
                type="text"
                placeholder="Enter search terms, e.g. buffalo"
                value={searchTerm}
                onChange={(e) => setSearchTermRemoveErr(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                    padding: "10px",
                    width: "300px",
                    fontSize: "18px",
                    border: "2px solid #4CAF50",
                    borderRadius: "5px",
                    outline: "none",
                    transition: "border-color 0.3s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#66bb6a")}
                onBlur={(e) => (e.target.style.borderColor = "#4CAF50")}
            />
            <select
                value={numItems}
                onChange={(e) => setNumItems(parseInt(e.target.value))}
                style={{
                    padding: "10px",
                    marginLeft: "10px",
                    fontSize: "18px",
                    border: "2px solid #4CAF50",
                    borderRadius: "5px",
                }}
            >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="20">20</option>
                <option value="25">25</option>
                <option value="30">30</option>
                <option value="35">35</option>
                <option value="40">40</option>
            </select>
            <button
                onClick={() => performSearch()}
                style={{
                    padding: "10px 20px",
                    fontSize: "18px",
                    marginLeft: "10px",
                    backgroundColor: "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                    transition: "background-color 0.3s",
                }}
                onMouseEnter={(e) => (e.target.style.backgroundColor = "#45a049")}
                onMouseLeave={(e) => (e.target.style.backgroundColor = "#4CAF50")}
            >
                Search
            </button>
        </div>
        <div>
            <FileDrop onFastaData={handleFastaData}/>
        </div>

        <div style={{marginTop: "10px", textAlign: "left"}}>
            {hasMatrix && (
                <div style={{ overflowX: "auto", maxWidth: "100%" }}>
                    <MatrixTable ncdMatrix={ncdMatrix} labels={labels} searchTerm={confirmedSearchTerm} executionTime={executionTime}/>
                </div>
            )}

            <div style={{display: "flex", justifyContent: "center", alignItems: "center"}}>
                {errorMsg && errorMsg.includes("no result") && (<p style={{fontSize: "18px"}}>
                    There is no result for <b><i>{searchTerm}</i></b>
                </p>)}
            </div>
            <div>
                {qSearchTreeResult &&
                    <TwoDTreeVisualizer data={qSearchTreeResult}></TwoDTreeVisualizer>
                }
            </div>
        </div>
    </div>);
};
