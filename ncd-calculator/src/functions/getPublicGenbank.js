import {parseAccessionNumber} from "./cache";
import {getApiResponseText} from "./fetch";
import {encodeURIWithApiKey} from "./api.js";

const parseGenbankEntry = (entry) => {
    const sourceMatch = entry.match(/SOURCE\s+([^\n]+)/);
    let commonName = "";
    let scientificName = "";
    let source = "";

    if (sourceMatch) {
        source = sourceMatch[1];
        const commonNameMatch = source.match(/\((.*?)\)/);
        if (commonNameMatch) {
            commonName = commonNameMatch[1].trim();
        }
        const scientificNameMatch = source.match(/\s*([\w\s]+?)(?:\s*\(|$)/);
        if (scientificNameMatch) {
            scientificName = scientificNameMatch[1].trim();
        }
    }

    const accessionMatch = entry.match(/ACCESSION\s+(\w+)/);
    const accessionNumber = accessionMatch ? accessionMatch[1].trim().toLowerCase() : "";

    const originMatch = entry.match(/ORIGIN\s+([^/]+)/);
    let sequence = "";
    if (originMatch) {
        sequence = originMatch[1].replace(/\d+/g, "").replace(/\s+/g, "").trim();
    }
    return {
        commonName,
        scientificName,
        accessionNumber,
        sequence,
        displayName: "",
        isUnique: true
    };
};

const parseGenbankList = (text, maxResults, options = {
    skipDuplicates: false,
    showAccession: false,
    showScientific: false
}) => {
    if (!text) {
        return {};
    }
    const list = text
        .split("//")
        .map((entry) => entry.trim())
        .filter((entry) => entry !== "");

    let parsedSequences = list
        .map(parseGenbankEntry)
        .filter(seq => seq.accessionNumber && seq.accessionNumber.trim() !== "");

    const seenNames = new Set();
    parsedSequences.forEach(seq => {
        const baseName = seq.commonName || seq.scientificName;
        if (!baseName) return;

        if (seenNames.has(baseName)) {
            seq.isUnique = false;
        } else {
            seq.isUnique = true;
            seenNames.add(baseName);
        }
    });

    parsedSequences = parsedSequences.slice(0, maxResults);
    const labels = generateDisplayNames(parsedSequences, options);
    return formatResponse(parsedSequences, labels);
};

const generateDisplayNames = (sequences, options) => {
    const nameCounts = new Map();

    return sequences.map(seq => {
        let displayParts = [];

        let baseName;
        if (options.showScientific && seq.scientificName) {
            baseName = seq.scientificName;
        } else if (seq.commonName) {
            baseName = seq.commonName;
        } else if (seq.scientificName) {
            baseName = seq.scientificName;
        } else {
            baseName = seq.accessionNumber;
        }
        displayParts.push(baseName);

        if (!seq.isUnique) {
            const count = (nameCounts.get(baseName) || 0) + 1;
            nameCounts.set(baseName, count);
            displayParts[0] = `${baseName} ${count + 1}`;
        }

        if (options.showAccession) {
            displayParts.push(`(${seq.accessionNumber})`);
        }

        return displayParts.join(" ");
    });
};

const formatResponse = (sequences, labels) => {
    return {
        labels,
        scientificNames: sequences.map(seq => seq.scientificName),
        commonNames: sequences.map(seq => seq.commonName),
        contents: sequences.map(seq => seq.sequence),
        accessions: sequences.map(seq => parseAccessionNumber(seq.accessionNumber)),
        metadata: sequences.map(seq => ({
            commonName: seq.commonName,
            scientificName: seq.scientificName,
            accessionNumber: seq.accessionNumber,
            isUnique: seq.isUnique
        }))
    };
};

const getGenbankListUri = (ids, apiKey) => {
    const IDS = ids.join(",");
    return encodeURIWithApiKey(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=${IDS}&rettype=genbank&retmode=text`, apiKey
    );
};

export const getGenbankSequences = async (ids, maxResults, options = {}) => {
    const uri = getGenbankListUri(ids);
    const textResponse = await getApiResponseText(uri);
    return parseGenbankList(textResponse, maxResults, {
        skipDuplicates: options.skipDuplicates || false,
        showAccession: options.showAccession || false,
        showScientific: options.showScientific || false
    });
};