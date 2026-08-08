import {describe, expect, test} from "vitest";
import {
    assembleValidatedGenBankRecords,
    GENBANK_SEQUENCE_PIPELINE_VERSION,
    parseStrictNcbiFasta,
    validateGenBankNucleotideSequence,
    verifyCachedGenBankRecord,
} from "../services/genbankSequencePipeline";

const summary = (overrides: Record<string, unknown> = {}) => ({
    result: {
        uids: ["42"],
        "42": {
            uid: "42",
            accessionversion: "NC_000001.2",
            title: "Example mitochondrion, complete genome",
            organism: "Example species",
            taxid: 123,
            slen: 15,
            ...overrides,
        },
    },
});

describe("GenBank sequence pipeline", () => {
    test("accepts the complete IUPAC nucleotide alphabet and preserves accession versions", async () => {
        const records = await assembleValidatedGenBankRecords(
            ["NC_000001.2"],
            ">NC_000001.2 Example species\r\nACGTURYSWKMBDHV\r\n",
            summary(),
            "2026-08-07T00:00:00.000Z",
        );

        expect(records).toHaveLength(1);
        expect(records[0].sequence).toBe("ACGTURYSWKMBDHV");
        expect(records[0].provenance).toMatchObject({
            pipelineVersion: GENBANK_SEQUENCE_PIPELINE_VERSION,
            requestedId: "NC_000001.2",
            accession: "NC_000001",
            accessionVersion: "NC_000001.2",
            uid: "42",
            expectedLength: 15,
        });
        expect(records[0].provenance.sha256).toMatch(/^[a-f0-9]{64}$/u);
    });

    test("maps a numeric UID through ESummary instead of relying on FASTA order", async () => {
        const [record] = await assembleValidatedGenBankRecords(
            ["42"],
            ">NC_000001.2 Example species\nACGTURYSWKMBDHV\n",
            summary(),
        );
        expect(record.provenance.requestedId).toBe("42");
        expect(record.provenance.accessionVersion).toBe("NC_000001.2");
    });

    test("fails fast when FASTA content and NCBI summary lengths disagree", async () => {
        await expect(assembleValidatedGenBankRecords(
            ["NC_000001.2"],
            ">NC_000001.2 Example species\nACGT\n",
            summary(),
        )).rejects.toThrow("length verification failed");
    });

    test("rejects invalid characters, duplicate records, and version substitution", async () => {
        expect(() => validateGenBankNucleotideSequence("ACGTZ")).toThrow("IUPAC");
        expect(() => parseStrictNcbiFasta(
            ">NC_000001.2 first\nACGT\n>NC_000001.2 duplicate\nACGT\n",
        )).toThrow("same accession");
        await expect(assembleValidatedGenBankRecords(
            ["NC_000001.2"],
            ">NC_000001.1 stale version\nACGTURYSWKMBDHV\n",
            summary(),
        )).rejects.toThrow("different sequence version");
    });

    test("accepts only intact, pipeline-versioned cached records", async () => {
        const [record] = await assembleValidatedGenBankRecords(
            ["NC_000001.2"],
            ">NC_000001.2 Example species\nACGTURYSWKMBDHV\n",
            summary(),
        );
        await expect(verifyCachedGenBankRecord(record, "NC_000001.2")).resolves.toEqual(record);
        await expect(verifyCachedGenBankRecord({...record, sequence: `${record.sequence}A`}, "NC_000001.2"))
            .resolves.toBeNull();
        await expect(verifyCachedGenBankRecord(record, "NC_999999.1")).resolves.toBeNull();
    });
});
