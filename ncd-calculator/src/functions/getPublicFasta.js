import {parseAccessionNumber} from "./cache.js";
import {getApiResponseText} from "./fetch.js";
import {encodeURIWithApiKey} from "./api.js";


export const getApiResponse = async (uri) => {
    const response = await fetch(uri);
    if (!response.ok) {
        throw new Error("Network response was not ok");
    }
    return await response.text();
}

export const getFastaList = async (idList, apiKey) => {
    const FETCH_URI = getFastaListUri(idList, apiKey) ;
    return await getApiResponseText(FETCH_URI);
}



export const getFastaListAndParse = async (idList, apiKey) => {
    const FETCH_URI = getFastaListUri(idList, apiKey) ;
    const data = await getApiResponseText(FETCH_URI);
    return parseFasta(data);
}



export const getFastaListUri = (idList, apiKey) => {
    const copy = [...idList];
    const ids = copy.join(",");
    return encodeURIWithApiKey(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=${ids}&rettype=fasta&retmode=text`, apiKey);
}

export const getFastaAccessionNumbersFromIdsUri = (idList, apiKey) => {
    if (typeof idList !== 'string') {
        idList = idList.join(",");
    }
    return encodeURIWithApiKey(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nucleotide&id=${idList}&rettype=acc`, apiKey);
}

export const getFastaAccessionNumbersFromIds = async (idList, apiKey) => {
    const FETCH_URI = getFastaAccessionNumbersFromIdsUri(idList, apiKey) ;
    let accessions = await getApiResponseText(FETCH_URI);
    if (accessions && accessions !== '') {
        return accessions.split("\n").filter(accession => accession != null);
    }
    return [];
}



export const getSequenceIdsBySearchTermUri = (searchTerm, numItems, apiKey) => {
    searchTerm = searchTerm.trim() + " AND mitochondrion[title] AND genome[title]";
    return encodeURIWithApiKey(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=nuccore&term=${searchTerm}&retmode=text&rettype=fasta&retmax=${numItems}`, apiKey);
}

export const getSequenceIdsBySearchTerm = async (searchTerm, numItems, apiKey) => {
    const ID_LIST_URI = getSequenceIdsBySearchTermUri(searchTerm, numItems, apiKey)
    let idList = [];
    const searchResult = await getApiResponseText(ID_LIST_URI);
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(searchResult, "text/xml");
    idList = Array.from(xmlDoc.getElementsByTagName("Id")).map(
        (idNode) => idNode.textContent
    );
    if (idList.length === 0) {
        console.log("No IDs found for the search term.");
        return [];
    }
    return idList;
}


export const parseFasta = (fastaData, fileNames) => {
    if (fastaData && isCleanFastaSequence(fastaData[0]) && fileNames) {
        const sequences = {
            contents: [],
            labels: []
        }
        for(let i = 0; i < fastaData.length; i++) {
            sequences.contents[i] = fastaData[i];
            sequences.labels[i] = fileNames[i];
        }
        return sequences;
    } else {
        const labels = [];
        const contents = [];
        const lines = fastaData.split("\n").map(line => line.toLowerCase());
        let currentLabel = null;
        let currentSequence = "";

        lines.forEach((line) => {
            if (line.startsWith(">")) {
                if (currentLabel && currentSequence) {
                    labels.push(currentLabel);
                    contents.push(currentSequence);
                }
                currentSequence = "";
                const header = line.substring(1);
                const labelMatch = header.match(/^(\S+)/);
                currentLabel = labelMatch ? parseAccessionNumber(labelMatch[1]) : "unknown";
            } else {
                currentSequence += line.trim();
            }
        });
        if (currentLabel && currentSequence) {
            labels.push(currentLabel);
            contents.push(currentSequence);
        }
        return {labels, contents};
    }
};


export const isCleanFastaSequence = (content) => {
    const cleanContent = content.replace(/\s/g, '');
    const isDna = /^[ATCGNatcgn\s]*$/.test(cleanContent);  // DNA
    if (isDna) return true;
    const isRna = /^[AUCGNaucgn\s]*$/.test(cleanContent);  // RNA
    if (isRna) {
        return true;
    }
    return /^[ACDEFGHIKLMNPQRSTVWY\s]*$/.test(cleanContent); // protein
};