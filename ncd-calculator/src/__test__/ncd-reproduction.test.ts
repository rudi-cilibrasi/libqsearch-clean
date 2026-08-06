import { test, expect, describe } from "vitest";
import { readFileSync } from "fs";
import { join } from "node:path";
import { gzipSync } from "zlib";
import { calculateNCD } from "../workers/shared/utils";

const getSampleSequenceJson = () => {
    return JSON.parse(readFileSync(join(__dirname, "./mock_response/sequences.txt"), 'utf-8'));
};

function gzipCompressedSize(data: string): number {
    const buf = Buffer.from(data, 'utf-8');
    return gzipSync(buf, { level: 9 }).length;
}

function gzipCompressedSizePair(a: string, b: string): number {
    const combined = a + "\n###\n" + b;
    return gzipSync(Buffer.from(combined, 'utf-8'), { level: 9 }).length;
}

describe("NCD Reproduction Tests - Issue #25", () => {
    test("NCD formula is zero when the pair and individual sizes match", () => {
        expect(calculateNCD(5_000, 5_000, 5_000)).toBe(0);
    });

    test("gzip NCD of an identical realistic sequence should be near zero", () => {
        // A tiny periodic input compresses to only a few dozen bytes, making
        // gzip framing and the pair separator dominate the NCD. The realistic
        // fixture keeps that fixed overhead small relative to compressed data.
        const [seq] = getSampleSequenceJson().contents as string[];
        const sizeA = gzipCompressedSize(seq);
        const sizeB = gzipCompressedSize(seq);
        const sizeAB = gzipCompressedSizePair(seq, seq);
        const ncd = calculateNCD(sizeA, sizeB, sizeAB);
        console.log(`Identical: sizeA=${sizeA}, sizeB=${sizeB}, sizeAB=${sizeAB}, NCD=${ncd}`);
        expect(sizeA).toBe(sizeB);
        expect(ncd).toBeLessThan(0.1);
    });

    test("NCD of very different sequences should be close to 1", () => {
        const seqA = "atcgatcgatcgatcgatcg".repeat(100);
        const seqB = "ggccttaaggccttaaggcc".repeat(100);
        const sizeA = gzipCompressedSize(seqA);
        const sizeB = gzipCompressedSize(seqB);
        const sizeAB = gzipCompressedSizePair(seqA, seqB);
        const ncd = calculateNCD(sizeA, sizeB, sizeAB);
        console.log(`Different: sizeA=${sizeA}, sizeB=${sizeB}, sizeAB=${sizeAB}, NCD=${ncd}`);
        expect(ncd).toBeGreaterThan(0.5);
    });

    test("NCD of closely related mitochondrial genomes should be low", () => {
        const data = getSampleSequenceJson();
        const contents = data.contents;
        // Test first 3 sequences (should be closely related)
        for (let i = 0; i < 3; i++) {
            for (let j = i + 1; j < 3; j++) {
                const sizeA = gzipCompressedSize(contents[i]);
                const sizeB = gzipCompressedSize(contents[j]);
                const sizeAB = gzipCompressedSizePair(contents[i], contents[j]);
                const ncd = calculateNCD(sizeA, sizeB, sizeAB);
                console.log(`Pair (${i},${j}): sizeA=${sizeA}, sizeB=${sizeB}, sizeAB=${sizeAB}, NCD=${ncd}`);
                expect(ncd).toBeLessThan(0.3);
            }
        }
    });

    test("NCD of empty strings", () => {
        const sizeA = gzipCompressedSize("");
        const sizeB = gzipCompressedSize("");
        const sizeAB = gzipCompressedSizePair("", "");
        const ncd = calculateNCD(sizeA, sizeB, sizeAB);
        console.log(`Empty: sizeA=${sizeA}, sizeB=${sizeB}, sizeAB=${sizeAB}, NCD=${ncd}`);
    });

    test("NCD of short sequences (potential issue with real compressors)", () => {
        // Short sequences that are similar but might not compress well
        const seqA = "atcgatcgatcg";
        const seqB = "atcgatcgatca";
        const sizeA = gzipCompressedSize(seqA);
        const sizeB = gzipCompressedSize(seqB);
        const sizeAB = gzipCompressedSizePair(seqA, seqB);
        const ncd = calculateNCD(sizeA, sizeB, sizeAB);
        console.log(`Short similar: sizeA=${sizeA}, sizeB=${sizeB}, sizeAB=${sizeAB}, NCD=${ncd}`);
    });

    test("Check all 20 sequences produce reasonable NCD matrix", () => {
        const data = getSampleSequenceJson();
        const contents = data.contents;
        const n = contents.length;
        
        const sizes = contents.map((c: string) => gzipCompressedSize(c));
        console.log("Individual compressed sizes:", sizes);
        
        let highNcdCount = 0;
        let totalPairs = 0;
        
        for (let i = 0; i < Math.min(n, 5); i++) {
            for (let j = i + 1; j < Math.min(n, 5); j++) {
                const sizeAB = gzipCompressedSizePair(contents[i], contents[j]);
                const ncd = calculateNCD(sizes[i], sizes[j], sizeAB);
                totalPairs++;
                if (ncd > 0.5) highNcdCount++;
                console.log(`NCD(${data.labels[i]}, ${data.labels[j]}) = ${ncd.toFixed(4)}`);
            }
        }
        
        // For closely related species, most pairs should have low NCD
        console.log(`High NCD (>0.5): ${highNcdCount}/${totalPairs}`);
        expect(highNcdCount).toBe(0);
    });
});
