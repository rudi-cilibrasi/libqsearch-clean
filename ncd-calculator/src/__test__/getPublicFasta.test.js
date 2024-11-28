/* eslint-disable */
import {expect, test, vi} from "vitest";
import {
    getFastaAccessionNumbersFromIds,
    getFastaAccessionNumbersFromIdsUri,
    getFastaList,
    getFastaListUri,
    getSequenceIdsBySearchTermUri,
} from "../functions/getPublicFasta.js";
import {Parser} from "xml2js"
import fs, {readFileSync} from "fs";

import {parseAccessionAndRemoveVersion} from "../cache/cache.js";
import {join} from "node:path";
import {parseFastaAndClean} from "../functions/fasta.js";
import path from "path";
import {getApiResponse} from "../functions/fetchProxy.js";
import axios from "axios";
import { XMLParser } from 'fast-xml-parser';

const parser = new Parser([]);
const searchTerm = "buffalo";
const listSize = 20;
const apiKey = "secretApiKey"

const getSampleFasta = () => {
    return readFileSync(join(__dirname, "./mock_response/buffaloes_fasta.json"), 'utf-8');
}

const SAMPLE_FASTA = JSON.parse(getSampleFasta());
const IDS = SAMPLE_FASTA.map(json => json.id);
const ACCESSIONS = SAMPLE_FASTA.map(json => json.accessionNumber);
const SEQUENCES = SAMPLE_FASTA.map(json => json.sequence);

vi.mock('axios');

test('test fetch fasta IDs for buffalo', async () => {
    const mockXmlResponse = fs.readFileSync(path.resolve(__dirname, './mock_response/fetch_fastaID_term_response.xml'), 'utf-8');
    axios.get.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        data: mockXmlResponse,
        headers: {
            'content-type': 'application/xml',
        },
    });
    const idsUri = getSequenceIdsBySearchTermUri(searchTerm, listSize, apiKey);
    const response = await getApiResponse(idsUri);
    const json = await parser.parseStringPromise(response);
    const ids = json["eSearchResult"]["IdList"][0]["Id"];
    expect(ids.length === 20);
    expect(arraysEqual(ids, IDS));
})

test('test fetch accessions numbers from fasta IDs', async () => {
    const mockResponse = fs.readFileSync(path.resolve(__dirname, './mock_response/fetch_accession_numbers_fasta_ids'), 'utf-8');
    axios.get.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        data: mockResponse,
    });

    let fastaAccessionNumbersFromIdsUri = getFastaAccessionNumbersFromIdsUri(IDS, apiKey);
    let textResponse = await getApiResponse(fastaAccessionNumbersFromIdsUri)
    const accessionNumbers = textResponse.trim().split("\n").map(parseAccessionAndRemoveVersion);
    expect(arraysEqual(accessionNumbers, ACCESSIONS));
}, 30000);


test('test fetch sequence responses from fasta IDs', async () => {
    const mockResponse = fs.readFileSync(path.resolve(__dirname, "./mock_response/fetch_sequence_fasta_ids"), 'utf-8');
    axios.get.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        data: mockResponse,
    });
    const fastaListUri = getFastaListUri(IDS, apiKey);
    const sequenceResponse = await getApiResponse(fastaListUri);
    let parsed = parseFastaAndClean(sequenceResponse);
    expect(arraysEqual(parsed.contents, SEQUENCES));
});

test('test fetch fasta list from search term', async () => {
    axios.get.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        data: fs.readFileSync(path.resolve(__dirname, "./mock_response/fetch_sequence_id_search_term.xml"), 'utf-8'),
    });
    let uri = getSequenceIdsBySearchTermUri(searchTerm, listSize, apiKey);
    let ids = await getApiResponse(uri);
    const parser = new XMLParser();
    const parsedData = parser.parse(ids);
    const idList = parsedData.eSearchResult.IdList.Id;
    expect(arraysEqual(idList, IDS));

    axios.post.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        data: fs.readFileSync(path.resolve(__dirname, './mock_response/fetch_accession_numbers_fasta_ids'), 'utf-8'),
    });
    let accessionUris = await getFastaAccessionNumbersFromIds(IDS);
    expect(arraysEqual(accessionUris, ACCESSIONS));

    axios.post.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        data: fs.readFileSync(path.resolve(__dirname, "./mock_response/fetch_sequence_fasta_ids"), 'utf-8'),
    });
    let fastaList = await getFastaList(IDS);
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






