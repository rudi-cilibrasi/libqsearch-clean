/* eslint-disable */
import {expect, test, vi} from "vitest";
import {
    getApiResponse,
    getFastaAccessionNumbersFromIds,
    getFastaAccessionNumbersFromIdsUri,
    getFastaList,
    getFastaListUri,
    getSequenceIdsBySearchTermUri,
} from "../functions/getPublicFasta.js";
import {Parser} from "xml2js"
import fs, {readFileSync} from "fs";

import {parseAccessionAndRemoveVersion} from "../functions/cache.js";
import {join} from "node:path";
import {parseFastaAndClean} from "../functions/fasta.js";
import path from "path";
import {fetchWithRetry} from "../functions/fetchProxy.js";

const parser = new Parser([]);
const searchTerm = "buffalo";
const listSize = 20;
const apiKey = "secretApiKey"

const getSampleFasta = () => {
    return readFileSync(join(__dirname, "buffaloes_fasta.json"), 'utf-8');
}

const SAMPLE_FASTA = JSON.parse(getSampleFasta());
const IDS = SAMPLE_FASTA.map(json => json.id);
const ACCESSIONS = SAMPLE_FASTA.map(json => json.accessionNumber);
const SEQUENCES = SAMPLE_FASTA.map(json => json.sequence);

test('test fetch fasta IDs for buffalo', async () => {
    const mockXmlResponse = fs.readFileSync(path.resolve(__dirname, './mock_response/fetch_fastaID_term_response.xml'), 'utf-8');
    global.fetch = vi.fn().mockResolvedValueOnce({
        status: 200,
        ok: true,
        text: vi.fn().mockResolvedValue(mockXmlResponse),
        headers: {get: vi.fn().mockReturnValue('application/xml')}
    });
    const idsUri = getSequenceIdsBySearchTermUri(searchTerm, listSize, apiKey);
    const response = await fetchWithRetry(getApiResponse, idsUri);
    const json = await parser.parseStringPromise(response);
    const ids = json["eSearchResult"]["IdList"][0]["Id"];
    expect(ids.length === 20);
    expect(arraysEqual(ids, IDS));
})

test('test fetch accessions numbers from fasta IDs', async () => {
    const mockResponse = fs.readFileSync(path.resolve(__dirname, './mock_response/fetch_accession_numbers_fasta_ids'), 'utf-8');
    global.fetch = vi.fn().mockResolvedValueOnce({
        status: 200,
        ok: true,
        text: vi.fn().mockResolvedValue(mockResponse),
    });
    let fastaAccessionNumbersFromIdsUri = getFastaAccessionNumbersFromIdsUri(IDS, apiKey);
    let textResponse = await fetchWithRetry(getApiResponse, fastaAccessionNumbersFromIdsUri)
    const accessionNumbers = textResponse.trim().split("\n").map(parseAccessionAndRemoveVersion);
    expect(arraysEqual(accessionNumbers, ACCESSIONS));
}, 30000);


test('test fetch sequence responses from fasta IDs', async () => {
    const mockResponse = fs.readFileSync(path.resolve(__dirname, "./mock_response/fetch_sequence_fasta_ids"), 'utf-8');
    global.fetch = vi.fn().mockResolvedValueOnce({
        status: 200,
        ok: true,
        text: vi.fn().mockResolvedValue(mockResponse),
    });
    const fastaListUri = getFastaListUri(IDS, apiKey);
    const sequenceResponse = await fetchWithRetry(getApiResponse, fastaListUri);
    let parsed = parseFastaAndClean(sequenceResponse);
    expect(arraysEqual(parsed.contents, SEQUENCES));
});

test('test fetch fasta list from search term', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
        status: 200,
        ok: true,
        text: vi.fn().mockResolvedValue(fs.readFileSync(path.resolve(__dirname, "./mock_response/fetch_sequence_id_search_term.xml"), 'utf-8')),
    });
    let uri = getSequenceIdsBySearchTermUri(searchTerm, listSize, apiKey);
    let ids = (await fetchWithRetry(getApiResponse, uri)).split(",");
    expect(arraysEqual(ids, IDS));

    global.fetch = vi.fn().mockResolvedValueOnce({
        status: 200,
        ok: true,
        text: vi.fn().mockResolvedValue(fs.readFileSync(path.resolve(__dirname, './mock_response/fetch_accession_numbers_fasta_ids'), 'utf-8')),
    });
    let accessionUris = await fetchWithRetry(getFastaAccessionNumbersFromIds, IDS);
    expect(arraysEqual(accessionUris, ACCESSIONS));

    global.fetch = vi.fn().mockResolvedValueOnce({
        status: 200,
        ok: true,
        text: vi.fn().mockResolvedValue(fs.readFileSync(path.resolve(__dirname, "./mock_response/fetch_sequence_fasta_ids"), 'utf-8')),
    });
    let fastaList = await fetchWithRetry(getFastaList, IDS);
    let parsed = parseFastaAndClean(fastaList);
    expect(arraysEqual(parsed.contents, SEQUENCES));
}, 30000)


const arraysEqual = (a, b) => {
    let setA = new Set(a);
    let setB = new Set(b);
    if (setA.size !== setB.size) {
        return false;
    }
    for (let item of setA) {
        if (!setB.has(item)) {
            return false;
        }
    }
    return true;
}






