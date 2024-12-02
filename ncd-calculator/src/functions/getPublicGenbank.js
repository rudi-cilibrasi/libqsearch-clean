import {sendRequestToProxy} from "./fetchProxy.js";
import {encodeURIWithApiKey} from "./api.js";
import {parseFastaAndClean} from "./fasta.js";

const parseGenbankList = (text) => {
    if (!text) {
        return {};
    }
    const parsed = parseFastaAndClean(text);
    const scientificNames = parsed.map(item => item.scientificName);
    const commonNames = parsed.map(item => item.commonName);
    const accessions = parsed.map(item => item.accession);
    const contents = parsed.map(item => item.sequence);
    return {
        labels: commonNames,
        scientificNames: scientificNames,
        accessions: accessions,
        commonNames: commonNames,
        contents: contents
    }
};


const getGenbankListUri = (ids, apiKey) => {
    const IDS = ids.join(",");
    return encodeURIWithApiKey(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=${IDS}&rettype=fasta&retmode=text`, apiKey
    );
};

export const getFastaSequences = async (ids) => {
    const uri = getGenbankListUri(ids);
    const textResponse = await sendRequestToProxy({
        externalUrl: uri
    });
    return parseGenbankList(textResponse);
};