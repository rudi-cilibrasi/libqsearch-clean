import {filterValidAccessionAndParse} from "./cache.js";
import {getFastaAccessionNumbersFromIds, getFastaList} from "../functions/getPublicFasta.js";
import {getFastaSequences} from "../functions/getPublicGenbank.js";
import {parseFastaAndClean} from "../functions/fasta.js";

export const getSearchResult = async (fastaItem, apiKey) => {
    let searchTerm = fastaItem.searchTerm;
    const emptyResult = {
        searchTerm: searchTerm,
        contents: [],
        labels: [],
        accessions: [],
        commonNames: [],
        scientificNames: [],
        cacheHit: false
    }
    if (!fastaItem.id && (!searchTerm || searchTerm.trim() === '')) {
        return emptyResult;
    }
    return getResultFromFastaItem(fastaItem, emptyResult, apiKey)
};

export const getResultFromFastaItem = async (fastaItem, defaultRes, apiKey) => {
    const searchTerm = fastaItem.searchTerm;
    const id = fastaItem.id;
    try {
        const unfilteredAccessions = await getFastaAccessionNumbersFromIds([id], apiKey);
        const accessions = filterValidAccessionAndParse(unfilteredAccessions);
        const data = await getFastaSequences(accessions, accessions.length);
        if (!data.contents[0] || data.contents[0].trim() === '') {
            // fall back to get the fasta sequence when sequence from genbank data is empty
            const fasta = await getFastaList([id], apiKey);
            let parsedFasta = parseFastaAndClean(fasta);
            if (parsedFasta && parsedFasta.length !== 0) {
                data.contents[0] = parsedFasta[0].sequence;
            }
        }
        data.cacheHit = false;
        data.searchTerm = searchTerm;
        return hasAnyValidSequence(data.contents) ? data : defaultRes;
    } catch (error) {
        console.error(error);
        return {
            searchTerm: fastaItem.searchTerm,
            contents: [],
            labels: [],
            accessions: [],
            commonNames: [],
            scientificNames: [],
            cacheHit: false
        }
    }
}


export const hasAnyValidSequence = (sequences) => {
    if (!sequences || sequences.length === 0) return false;
    return !(!sequences[0] || sequences[0].trim() === '');

}
export const cacheHit = (checkedResult) => {
    return !(!checkedResult || checkedResult.length === 0);

}