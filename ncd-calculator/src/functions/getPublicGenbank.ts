import {sendRequestToProxy} from "./fetchProxy";
import {encodeURIWithApiKey} from "./api";
import {parseFastaAndClean} from "./fasta";

const parseGenbankList = (text: string): {
    labels: string[],
    scientificNames: string[],
    accessions: string[],
    commonNames: string[],
    contents: string[]
} => {
    if (!text) {
        return {
            labels: [],
            scientificNames: [],
            accessions: [],
            commonNames: [],
            contents: []
        };
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
    };
};


const getGenbankListUri = (ids: string[], apiKey: string): string => {
    const IDS = ids.join(",");
    return encodeURIWithApiKey(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=${IDS}&rettype=fasta&retmode=text`, apiKey
    );
};

export const getFastaSequences = async (ids: string[], apiKey: string): Promise<{
    labels: string[],
    scientificNames: string[],
    accessions: string[],
    commonNames: string[],
    contents: string[]
}> => {
    const uri = getGenbankListUri(ids, apiKey);
    const textResponse = await sendRequestToProxy({
        externalUrl: uri
    });
    return parseGenbankList(textResponse);
};