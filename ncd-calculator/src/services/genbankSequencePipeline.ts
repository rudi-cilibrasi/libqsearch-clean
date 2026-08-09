export const GENBANK_SEQUENCE_PIPELINE_VERSION = "genbank-sequence-v3";
export const MAX_GENBANK_RECORDS_PER_REQUEST = 64;
export const MAX_GENBANK_SEQUENCE_LENGTH = 20_000_000;
export const MAX_GENBANK_TOTAL_BASES = 128_000_000;

const ACCESSION_PATTERN = /^(?:[A-Z]{1,6}_?)\d+(?:\.\d+)?$/i;
const NUCLEOTIDE_PATTERN = /^[ACGTURYSWKMBDHVN]+$/i;

export interface GenBankSequenceProvenance {
    readonly pipelineVersion: typeof GENBANK_SEQUENCE_PIPELINE_VERSION;
    readonly database: "nuccore";
    readonly requestedId: string;
    readonly uid: string;
    readonly accession: string;
    readonly accessionVersion: string;
    readonly title: string;
    readonly organism: string;
    readonly taxId: string;
    readonly expectedLength: number;
    readonly retrievedAt: string;
    readonly recordUrl: string;
    readonly sha256: string;
    readonly provenanceSha256: string;
}

export interface GenBankSequenceRecord {
    readonly sequence: string;
    readonly provenance: GenBankSequenceProvenance;
}

interface ParsedFastaRecord {
    readonly accessionVersion: string;
    readonly sequence: string;
}

interface NcbiSummaryRecord {
    readonly uid?: unknown;
    readonly accessionversion?: unknown;
    readonly title?: unknown;
    readonly organism?: unknown;
    readonly taxid?: unknown;
    readonly slen?: unknown;
}

interface NcbiSummaryResponse {
    readonly result?: Record<string, NcbiSummaryRecord | unknown>;
}

const normalizeIdentifier = (value: string): string => value.trim().toUpperCase();
const accessionWithoutVersion = (value: string): string => normalizeIdentifier(value).split(".")[0];

const requireRequestedIds = (requestedIds: readonly string[]): readonly string[] => {
    if (requestedIds.length === 0) throw new Error("No GenBank records were requested.");
    if (requestedIds.length > MAX_GENBANK_RECORDS_PER_REQUEST) {
        throw new Error(`A comparison can retrieve at most ${MAX_GENBANK_RECORDS_PER_REQUEST} GenBank records at once.`);
    }
    const normalized = requestedIds.map(identifier => identifier.trim());
    if (normalized.some(identifier => !identifier || (!/^\d+$/.test(identifier) && !ACCESSION_PATTERN.test(identifier)))) {
        throw new Error("The GenBank request contains an invalid accession or UID.");
    }
    if (new Set(normalized.map(normalizeIdentifier)).size !== normalized.length) {
        throw new Error("The GenBank request contains duplicate records.");
    }
    return normalized;
};

const getHeaderAccession = (header: string): string => {
    const firstToken = header.slice(1).trim().split(/\s+/u)[0] ?? "";
    const candidates = firstToken.split("|").filter(Boolean);
    const accession = candidates.find(candidate => ACCESSION_PATTERN.test(candidate));
    if (!accession) throw new Error(`NCBI returned an invalid FASTA header: ${header.slice(0, 120)}`);
    return normalizeIdentifier(accession);
};

export const validateGenBankNucleotideSequence = (sequence: string): string => {
    const normalized = sequence.replace(/\s+/gu, "").toUpperCase();
    if (!normalized) throw new Error("NCBI returned an empty nucleotide sequence.");
    if (!NUCLEOTIDE_PATTERN.test(normalized)) {
        throw new Error("NCBI returned characters outside the IUPAC nucleotide alphabet.");
    }
    if (normalized.length > MAX_GENBANK_SEQUENCE_LENGTH) {
        throw new Error(
            `A GenBank sequence exceeds the browser-safe limit of ${MAX_GENBANK_SEQUENCE_LENGTH.toLocaleString()} bases.`,
        );
    }
    return normalized;
};

export const parseStrictNcbiFasta = (text: string): readonly ParsedFastaRecord[] => {
    const normalizedText = text.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n").trim();
    if (!normalizedText) throw new Error("NCBI returned an empty FASTA response.");

    const records: ParsedFastaRecord[] = [];
    let accessionVersion: string | null = null;
    let sequenceLines: string[] = [];
    const finishRecord = (): void => {
        if (!accessionVersion) return;
        records.push({
            accessionVersion,
            sequence: validateGenBankNucleotideSequence(sequenceLines.join("")),
        });
    };

    for (const line of normalizedText.split("\n")) {
        if (line.startsWith(">")) {
            finishRecord();
            accessionVersion = getHeaderAccession(line);
            sequenceLines = [];
        } else {
            if (!accessionVersion) throw new Error("NCBI returned sequence data before the first FASTA header.");
            sequenceLines.push(line);
        }
    }
    finishRecord();

    const identifiers = records.map(record => record.accessionVersion);
    if (new Set(identifiers).size !== identifiers.length) {
        throw new Error("NCBI returned the same accession more than once.");
    }
    return records;
};

const parsePositiveInteger = (value: unknown, field: string, accessionVersion: string): number => {
    const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new Error(`NCBI summary for ${accessionVersion} has an invalid ${field}.`);
    }
    return parsed;
};

const sha256 = async (value: string): Promise<string> => {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
};

type UnsignedGenBankSequenceProvenance = Omit<GenBankSequenceProvenance, "provenanceSha256">;

const hashProvenance = async (provenance: UnsignedGenBankSequenceProvenance): Promise<string> => sha256(JSON.stringify([
    provenance.pipelineVersion,
    provenance.database,
    provenance.requestedId,
    provenance.uid,
    provenance.accession,
    provenance.accessionVersion,
    provenance.title,
    provenance.organism,
    provenance.taxId,
    provenance.expectedLength,
    provenance.retrievedAt,
    provenance.recordUrl,
    provenance.sha256,
]));

export const assembleValidatedGenBankRecords = async (
    requestedIds: readonly string[],
    fastaText: string,
    summaryResponse: NcbiSummaryResponse,
    retrievedAt = new Date().toISOString(),
): Promise<readonly GenBankSequenceRecord[]> => {
    const requested = requireRequestedIds(requestedIds);
    const fastaRecords = parseStrictNcbiFasta(fastaText);
    const rawSummaries = summaryResponse.result;
    if (!rawSummaries || typeof rawSummaries !== "object") {
        throw new Error("NCBI returned a malformed sequence summary.");
    }

    const summaries = Object.entries(rawSummaries)
        .filter(([key, value]) => key !== "uids" && value && typeof value === "object")
        .map(([, value]) => value as NcbiSummaryRecord)
        .map(summary => {
            const uid = String(summary.uid ?? "").trim();
            const accessionVersion = normalizeIdentifier(String(summary.accessionversion ?? ""));
            if (!uid || !ACCESSION_PATTERN.test(accessionVersion)) {
                throw new Error("NCBI returned a sequence summary without a stable UID and accession version.");
            }
            return {summary, uid, accessionVersion};
        });

    const byUid = new Map(summaries.map(summary => [summary.uid, summary]));
    const byAccession = new Map(summaries.map(summary => [summary.accessionVersion, summary]));
    const fastaByAccession = new Map(fastaRecords.map(record => [record.accessionVersion, record]));
    const results: GenBankSequenceRecord[] = [];
    let totalBases = 0;

    for (const requestedId of requested) {
        const normalizedRequest = normalizeIdentifier(requestedId);
        const summaryEntry = byUid.get(normalizedRequest)
            ?? byAccession.get(normalizedRequest)
            ?? summaries.find(candidate => accessionWithoutVersion(candidate.accessionVersion) === accessionWithoutVersion(normalizedRequest));
        if (!summaryEntry) throw new Error(`NCBI did not return metadata for ${requestedId}.`);
        if (
            !/^\d+$/u.test(normalizedRequest)
            && normalizedRequest.includes(".")
            && summaryEntry.accessionVersion !== normalizedRequest
        ) {
            throw new Error(`NCBI substituted ${summaryEntry.accessionVersion} for requested version ${normalizedRequest}.`);
        }

        const fasta = fastaByAccession.get(summaryEntry.accessionVersion)
            ?? fastaRecords.find(record => (
                accessionWithoutVersion(record.accessionVersion) === accessionWithoutVersion(summaryEntry.accessionVersion)
            ));
        if (!fasta) throw new Error(`NCBI did not return sequence data for ${summaryEntry.accessionVersion}.`);
        if (fasta.accessionVersion !== summaryEntry.accessionVersion) {
            throw new Error(`NCBI returned a different sequence version for ${summaryEntry.accessionVersion}.`);
        }

        const expectedLength = parsePositiveInteger(
            summaryEntry.summary.slen,
            "sequence length",
            summaryEntry.accessionVersion,
        );
        if (fasta.sequence.length !== expectedLength) {
            throw new Error(
                `NCBI length verification failed for ${summaryEntry.accessionVersion}: expected ${expectedLength}, received ${fasta.sequence.length}.`,
            );
        }
        totalBases += fasta.sequence.length;
        if (totalBases > MAX_GENBANK_TOTAL_BASES) {
            throw new Error(`The selected GenBank records exceed the ${MAX_GENBANK_TOTAL_BASES.toLocaleString()}-base comparison limit.`);
        }

        const title = String(summaryEntry.summary.title ?? "").trim();
        const organism = String(summaryEntry.summary.organism ?? "").trim();
        const taxId = String(summaryEntry.summary.taxid ?? "").trim();
        if (!title || !organism || !/^\d+$/u.test(taxId)) {
            throw new Error(`NCBI returned incomplete provenance metadata for ${summaryEntry.accessionVersion}.`);
        }

        const provenance: UnsignedGenBankSequenceProvenance = {
                pipelineVersion: GENBANK_SEQUENCE_PIPELINE_VERSION,
                database: "nuccore",
                requestedId,
                uid: summaryEntry.uid,
                accession: accessionWithoutVersion(summaryEntry.accessionVersion),
                accessionVersion: summaryEntry.accessionVersion,
                title,
                organism,
                taxId,
                expectedLength,
                retrievedAt,
                recordUrl: `https://www.ncbi.nlm.nih.gov/nuccore/${encodeURIComponent(summaryEntry.accessionVersion)}`,
                sha256: await sha256(fasta.sequence),
        };
        results.push({
            sequence: fasta.sequence,
            provenance: {...provenance, provenanceSha256: await hashProvenance(provenance)},
        });
    }

    if (new Set(results.map(record => record.provenance.accessionVersion)).size !== results.length) {
        throw new Error("Multiple requested identifiers resolved to the same GenBank sequence version.");
    }
    return results;
};

export const verifyCachedGenBankRecord = async (
    value: unknown,
    requestedId: string,
): Promise<GenBankSequenceRecord | null> => {
    if (!value || typeof value !== "object") return null;
    const candidate = value as Partial<GenBankSequenceRecord>;
    const provenance = candidate.provenance as Partial<GenBankSequenceProvenance> | undefined;
    if (
        provenance?.pipelineVersion !== GENBANK_SEQUENCE_PIPELINE_VERSION
        || provenance.requestedId !== requestedId
        || typeof candidate.sequence !== "string"
        || typeof provenance.sha256 !== "string"
        || typeof provenance.provenanceSha256 !== "string"
        || provenance.database !== "nuccore"
        || typeof provenance.uid !== "string"
        || !/^\d+$/u.test(provenance.uid)
        || typeof provenance.accession !== "string"
        || typeof provenance.accessionVersion !== "string"
        || !ACCESSION_PATTERN.test(provenance.accessionVersion)
        || accessionWithoutVersion(provenance.accessionVersion) !== normalizeIdentifier(provenance.accession)
        || typeof provenance.title !== "string"
        || !provenance.title.trim()
        || typeof provenance.organism !== "string"
        || !provenance.organism.trim()
        || typeof provenance.taxId !== "string"
        || !/^\d+$/u.test(provenance.taxId)
        || !Number.isSafeInteger(provenance.expectedLength)
        || (provenance.expectedLength ?? 0) <= 0
        || typeof provenance.retrievedAt !== "string"
        || !Number.isFinite(Date.parse(provenance.retrievedAt))
        || provenance.recordUrl !== `https://www.ncbi.nlm.nih.gov/nuccore/${encodeURIComponent(provenance.accessionVersion)}`
        || !/^[a-f0-9]{64}$/u.test(provenance.sha256)
        || !/^[a-f0-9]{64}$/u.test(provenance.provenanceSha256)
    ) return null;

    try {
        const sequence = validateGenBankNucleotideSequence(candidate.sequence);
        const validProvenance = provenance as GenBankSequenceProvenance;
        const {provenanceSha256: _storedProvenanceHash, ...unsigned} = validProvenance;
        if (
            sequence.length !== validProvenance.expectedLength
            || await sha256(sequence) !== validProvenance.sha256
            || await hashProvenance(unsigned) !== validProvenance.provenanceSha256
        ) return null;
        return {sequence, provenance: validProvenance};
    } catch {
        return null;
    }
};
