import {test, expect} from "vitest";
import {readFileSync} from "fs";
import {join} from "node:path";

const getSampleBuffaloes = () => {
    return readFileSync(join(__dirname, "buffaloes_fasta.json"), 'utf-8');
}

const getSampleSequenceJson = () => {
    return JSON.parse(readFileSync(join(__dirname, "sequences.txt"), 'utf-8'));
}


const SAMPLE_JSON = getSampleSequenceJson();

async function compressedSize(blob) {
    const stream = blob.stream();
    const compressionStream = new CompressionStream("gzip");
    const compressedStream = stream.pipeThrough(compressionStream);
    const response = new Response(compressedStream);
    const compressedBlob = await response.blob();
    return compressedBlob.size;
}

async function compressedSizePair(str1, str2) {
    const blob = new Blob([str1, str2]);
    return await compressedSize(blob);
}

async function compressedSizeSingle(str) {
    const blob = new Blob([str]);
    return await compressedSize(blob);
}

function calculateNCD(sizeX, sizeY, sizeXY) {
    return (sizeXY - Math.min(sizeX, sizeY)) / Math.max(sizeX, sizeY);
}

const calculateMatrixScore = async (e) => {
    const { contents } = e;
    const n = contents.length;
    const singleCompressedSizes = new Array(n);
    const ncdMatrix = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        singleCompressedSizes[i] = await compressedSizeSingle(contents[i]);
    }
    for (let i = 0; i < n; i++) {
        for (let j = i; j < n; j++) {
            let ncd = 0;
            if (i !== j) {
                const sizeXY = await compressedSizePair(contents[i], contents[j]);
                ncd = await calculateNCD(singleCompressedSizes[i], singleCompressedSizes[j], sizeXY);
            }
            ncdMatrix[i][j] = ncd;
            ncdMatrix[j][i] = ncd;
        }
    }
    return ncdMatrix;
}

test('test labels unique', () => {
    let len = SAMPLE_JSON.labels.length;
    let setLen = new Set([...SAMPLE_JSON.labels]).size;
    expect(len === setLen);
})

test('test sequences unique', () => {
    let len = SAMPLE_JSON.contents.length;
    let setLen = new Set([...SAMPLE_JSON.contents]).size;
    return len === setLen;
})

test('calculate single pair NCD', async () => {
   const labelA = SAMPLE_JSON.labels[0];
   const labelB = SAMPLE_JSON.labels[1];
   const a = SAMPLE_JSON.contents[0];
   const b = SAMPLE_JSON.contents[1];
   let sizeA = await compressedSizeSingle(a);
   let sizeB = await compressedSizeSingle(b);
   let sizeAB = await compressedSizePair(a, b);
   console.log('NCD: (' + labelA + ", " + labelB + "): " + calculateNCD(sizeA, sizeB, sizeAB));
});


test('calculate NCD matrix score', async () => {
    let matrix = await calculateMatrixScore(SAMPLE_JSON);
    console.log(matrix);
});