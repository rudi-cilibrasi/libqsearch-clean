import {sendRequestToProxy} from "./fetchProxy";
import {
    assembleValidatedGenBankRecords,
    MAX_GENBANK_RECORDS_PER_REQUEST,
    type GenBankSequenceRecord,
} from "../services/genbankSequencePipeline";

const EUTILS_BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

const createEutilsUri = (
    endpoint: "efetch.fcgi" | "esummary.fcgi",
    params: Record<string, string>,
): string => {
    const url = new URL(`${EUTILS_BASE_URL}/${endpoint}`);
    url.search = new URLSearchParams({
        db: "nuccore",
        tool: "complearn-ncd",
        ...params,
    }).toString();
    return url.toString();
};

/**
 * Retrieve a bounded batch of versioned nucleotide records and verify every
 * FASTA payload against its NCBI ESummary accession and sequence length.
 */
export const getFastaSequences = async (
    ids: readonly string[],
): Promise<readonly GenBankSequenceRecord[]> => {
    if (ids.length > MAX_GENBANK_RECORDS_PER_REQUEST) {
        throw new Error(`Select no more than ${MAX_GENBANK_RECORDS_PER_REQUEST} GenBank records per comparison.`);
    }
    const joinedIds = ids.join(",");
    const summaryUri = createEutilsUri("esummary.fcgi", {
        id: joinedIds,
        retmode: "json",
        version: "2.0",
    });
    const fastaUri = createEutilsUri("efetch.fcgi", {
        id: joinedIds,
        rettype: "fasta",
        retmode: "text",
    });

    // Keep the requests sequential. This respects NCBI's shared rate budget and
    // lets us fail on malformed metadata before transferring sequence payloads.
    const summaryResponse = await sendRequestToProxy({externalUrl: summaryUri});
    const fastaResponse = await sendRequestToProxy({externalUrl: fastaUri});
    if (typeof fastaResponse !== "string") {
        throw new Error("NCBI returned an unexpected FASTA response type.");
    }
    return assembleValidatedGenBankRecords(ids, fastaResponse, summaryResponse);
};
