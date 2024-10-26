import {parseAccessionNumber} from "./cache.js";

export const getFastaList = async (idList) => {
    const FETCH_URI = await getFastaListUri(idList) ;
    return await getApiResponse(FETCH_URI);
}


export const getFastaListUri = async (idList) => {
    const copy = [...idList];
    const ids = copy.join(",");
    return encodeURI(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=${ids}&rettype=fasta&retmode=text`);
}

export const getFastaAccessionNumbersFromIdsUri = (idList) => {
    if (typeof idList !== 'string') {
        idList = idList.join(",");
    }
    return encodeURI(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nucleotide&id=${idList}&rettype=acc`);
}

export const getFastaAccessionNumbersFromIds = async (idList) => {
    const FETCH_URI = getFastaAccessionNumbersFromIdsUri(idList) ;
    let accessions = await getApiResponse(FETCH_URI);
    if (accessions && accessions !== '') {
        return accessions.split("\n").filter(accession => accession != null);
    }
    return [];
}

export const getApiResponse = async (uri) => {
    const response = await fetch(uri);
    if (!response.ok) {
        throw new Error("Network response was not ok");
    }
    return await response.text();
}

export const getFastaIdsBySearchTermUri  = async (searchTerm, numItems) => {
    searchTerm = searchTerm.trim() + " AND mitochondrion[title] AND genome[title]";
    return encodeURI(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=nuccore&term=${searchTerm}&retmode=text&rettype=fasta&retmax=${numItems}`);
}

export const getFastaIdsBySearchTerm = async (searchTerm, numItems) => {
    const ID_LIST_URI = await getFastaIdsBySearchTermUri(searchTerm, numItems)
    let idList = [];
    const searchResult = await getApiResponse(ID_LIST_URI);
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


export const parseFasta = (fastaData) => {
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
    return { labels, contents };
};