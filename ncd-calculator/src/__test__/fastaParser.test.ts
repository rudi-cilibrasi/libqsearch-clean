import {expect, test} from "vitest";
import {
    getCleanSequence, getFastaInfoFromFile,
    hasMetadata,
    isValidFastaSequenceWithHeader,
    isValidFastaSequenceWithoutHeader,
    parseFastaAndClean,
    parseMetadata,
    parseMultipleMetadata,
    validSequence
} from "../functions/fasta.js";
import {FileInfo} from "@/functions/file.ts";

// Test cases for hasMetadata function
test("hasMetadata returns true for valid metadata", () => {
    const content = ">seq1 Homo sapiens (Human)";
    expect(hasMetadata(content)).toBe(true);
});

test("hasMetadata returns false for content without metadata", () => {
    const content = "ATCGTTAG";
    expect(hasMetadata(content)).toBe(false);
});

test("hasMetadata returns false for empty content", () => {
    const content = "";
    expect(hasMetadata(content)).toBe(false);
});

// Test cases for parseMetadata function
test("parseMetadata extracts metadata fields correctly", () => {
    const content = ">seq1 Homo sapiens (Human)";
    const metadata = parseMetadata(content);
    expect(metadata).toEqual({
        accession: "seq1",
        scientificName: "Homo sapiens",
        commonName: "Human"
    });
});

test("parseMetadata returns empty object if no metadata is found", () => {
    const content = "ATCGTTAG";
    const metadata = parseMetadata(content);
    expect(metadata).toEqual({});
});

// Test cases for getCleanSequence function
test("getCleanSequence returns lowercase sequence without header", () => {
    const content = ">seq1\nATCG\nTAGC";
    const sequence = getCleanSequence(content);
    expect(sequence).toBe("atcgtagc");
});

test("getCleanSequence returns lowercase sequence without header when no metadata is present", () => {
    const content = "ATCG\nTAGC";
    const sequence = getCleanSequence(content);
    expect(sequence).toBe("atcgtagc");
});

test("getCleanSequence returns undefined for invalid sequence", () => {
    const content = "XYZABC";
    expect(getCleanSequence(content)).toBeUndefined();
});

// Test cases for isValidFastaSequenceWithHeader function
test("isValidFastaSequenceWithHeader returns true for valid DNA sequence with header", () => {
    const content = ">seq1\nATCGTAGC";
    expect(isValidFastaSequenceWithHeader(content)).toBe(true);
});

test("isValidFastaSequenceWithHeader returns false for sequence without header", () => {
    const content = "ATCGTAGC";
    expect(isValidFastaSequenceWithHeader(content)).toBe(false);
});

// Test cases for isValidFastaSequenceWithoutHeader function
test("isValidFastaSequenceWithoutHeader returns true for valid DNA sequence without header", () => {
    const content = "ATCGTAGC";
    expect(isValidFastaSequenceWithoutHeader(content)).toBe(true);
});

test("isValidFastaSequenceWithoutHeader returns false for invalid sequence without header", () => {
    const content = "XYZABC";
    expect(isValidFastaSequenceWithoutHeader(content)).toBe(false);
});

// Test cases for validSequence function
test("validSequence returns true for valid DNA sequence", () => {
    const content = "ATCGTAGC";
    expect(validSequence(content)).toBe(true);
});

test("validSequence returns true for valid RNA sequence", () => {
    const content = "AUCGUAGC";
    expect(validSequence(content)).toBe(true);
});

test("validSequence returns true for valid protein sequence", () => {
    const content = "ACDEFGHIKLMNPQRSTVWY";
    expect(validSequence(content)).toBe(true);
});

test("validSequence returns false for invalid characters in sequence", () => {
    const content = "XYZ123";
    expect(validSequence(content)).toBe(false);
});

// Test cases for parseMultipleFasta function
test("parseMultipleFasta correctly parses multiple sequences", () => {
    const fastaData = ">seq1 Homo sapiens (Human)\nATCG\nTAGC\n>seq2 Mus musculus (Mouse)\nGCTA\nAGCT";
    const parsed = parseFastaAndClean(fastaData);
    expect(parsed).toEqual([
        {
            accession: "seq1",
            scientificName: "Homo sapiens",
            commonName: "Human",
            sequence: "atcgtagc"
        },
        {
            accession: "seq2",
            scientificName: "Mus musculus",
            commonName: "Mouse",
            sequence: "gctaagct"
        }
    ]);
});

test("parseMultipleFasta handles empty input gracefully", () => {
    const fastaData = "";
    const parsed = parseFastaAndClean(fastaData);
    expect(parsed).toEqual([]);
});

test("parseMultipleFasta handles invalid fasta input", () => {
    const fastaData = "\\n";
    const parsed = parseFastaAndClean(fastaData);
    expect(parsed).toEqual([]);
});


test("test parseFasta with multiple sequences with headers", () => {
    const fastaData = ">seq1 scientificName1 (commonName1)\nATGCATGGGGGCCGGA\n>seq2 scientificName2 (commonName2)\nAAGTAAGTTAG";
    const parsed = parseFastaAndClean(fastaData);
    expect(parsed.length).toBe(2);
    const expected = {
        data: [
            {
                accession: 'seq1',
                scientificName: 'scientificName1',
                commonName: 'commonName1',
                sequence: 'atgcatgggggccgga'
            },
            {
                accession: 'seq2',
                scientificName: 'scientificName2',
                commonName: 'commonName2',
                sequence: 'aagtaagttag'
            }
        ]
    }
    for (let i = 0; i < parsed.length; i++) {
        expect(parsed[i]).toStrictEqual(expected.data[i])
    }
    let parsedMetadata = parseMultipleMetadata(fastaData);
    for (let i = 0; i < parsedMetadata.length; i++) {
        expect(parsedMetadata[i]).toStrictEqual({
            accession: expected.data[i].accession,
            scientificName: expected.data[i].scientificName,
            commonName: expected.data[i].commonName
        })
    }
})

const FILE_UPLOAD = "file_upload";

test('should extract common name when present', () => {
    const fileInfo: FileInfo = {
        name: 'test.fasta',
        content: ">NC_001323.1 Gallus gallus (chicken) mitochondrion, complete genome\nACGTACGT",
        ext: "fasta"
    };

    const expected = {
        type: FILE_UPLOAD,
        content: 'acgtacgt',
        label: 'chicken',
        id: 'test.fasta'
    };

    expect(getFastaInfoFromFile(fileInfo)).toEqual(expected);
});

test('should use first two words of scientific name when no common name', () => {
    const fileInfo: FileInfo = {
        name: 'test.fasta',
        content: ">NC_005089.1 Mus musculus mitochondrion, complete genome\nACGTACGT",
        ext: "fasta"
    };

    const expected = {
        type: FILE_UPLOAD,
        content: 'acgtacgt',
        label: 'Mus musculus',
        id: 'test.fasta'
    };

    expect(getFastaInfoFromFile(fileInfo)).toEqual(expected);
});


test('should use filename when no metadata present', () => {
    const fileInfo: FileInfo = {
        name: 'test.fasta',
        content: "acgtacgt",
        ext: "fasta"
    };

    const expected = {
        type: FILE_UPLOAD,
        content: 'acgtacgt',
        label: 'test.fasta',
        id: 'test.fasta'
    };

    expect(getFastaInfoFromFile(fileInfo)).toEqual(expected);
});

test('should clean sequence by removing whitespace and newlines', () => {
    const fileInfo: FileInfo = {
        name: 'test.fasta',
        content: ">NC_001323.1 Gallus gallus (chicken)\nACGT\nACGT\n",
        ext: "fasta"
    };

    const expected = {
        type: FILE_UPLOAD,
        content: 'acgtacgt',
        label: 'chicken',
        id: 'test.fasta'
    };

    expect(getFastaInfoFromFile(fileInfo)).toEqual(expected);
});

test('should handle empty content', () => {
    const fileInfo: FileInfo = {
        name: 'test.fasta',
        content: '',
        ext: "fasta"
    };

    const expected = {
        type: FILE_UPLOAD,
        content: '',
        label: 'test.fasta',
        id: 'test.fasta'
    };

    expect(getFastaInfoFromFile(fileInfo)).toEqual(expected);
});


test('should handle multiple headers (should use first one)', () => {
    const fileInfo: FileInfo = {
        name: 'test.fasta',
        content: ">NC_001323.1 Gallus gallus (chicken)\nacgt\n>NC_0013234.1 Gallus gallus2 (chicken2)\nacgt",
        ext: "fasta"
    };

    const expected = {
        type: FILE_UPLOAD,
        content: 'acgt',
        label: 'chicken',
        id: 'test.fasta'
    };

    expect(getFastaInfoFromFile(fileInfo)).toEqual(expected);
});

test('should handle headers with special characters', () => {
    const fileInfo: FileInfo = {
        name: 'test.fasta',
        content: ">NC_001323.1 Gallus-gallus (domestic_chicken) genome\nacgtacgt",
        ext: "fasta"
    };

    const expected = {
        type: FILE_UPLOAD,
        content: 'acgtacgt',
        label: 'domestic_chicken',
        id: 'test.fasta'
    };

    expect(getFastaInfoFromFile(fileInfo)).toEqual(expected);
});

test('should handle case sensitivity in metadata', () => {
    const fileInfo: FileInfo = {
        name: 'test.fasta',
        content: ">nc_001323.1 GALLUS GALLUS (Chicken) genome\nacgtacgt",
        ext: "fasta"
    };

    const expected = {
        type: FILE_UPLOAD,
        content: 'acgtacgt',
        label: 'Chicken',
        id: 'test.fasta'
    };

    expect(getFastaInfoFromFile(fileInfo)).toEqual(expected);
});
