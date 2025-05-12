import '@vitest/web-worker'
import {test} from "vitest";
import {CompressionService} from "@/services/CompressionService.ts";
import {NCDInput} from "@/types/ncd.d.ts";
import {CRCCache} from "@/cache/CRCCache.ts";
import fs from 'fs';
import path from 'path';

test('Test compression decision lzma', async () => {
    const input: NCDInput = {
        labels: [
            "bubalis12.fasta",
            "bubalis13.fasta",
            "bubalis14.fasta",
            "bubalis15.fasta",
            "bubalis16.fasta"
        ],
        contents: []
    };

    input.contents = await Promise.all(
        input.labels.map(async (label) => {
            const filePath = path.join(__dirname + "/compression_data", `${label}`);
            const fileContent = await fs.promises.readFile(filePath, 'utf-8');
            return fileContent.replace(/\n/g, '').toLowerCase();
        })
    );

    const compressionService = CompressionService.getInstance();

    const [compressionDecision, cachedSizes] = CompressionService.preprocessNcdInput(input, new CRCCache());

    const result: any = await compressionService.processContent({
            ...input,
            cachedSizes: cachedSizes.size > 0 ? cachedSizes : undefined,
            algorithm: compressionDecision.algorithm,
        },
        (message) => {
            console.log(`Receiving new message from ${compressionDecision.algorithm} compression worker: ${JSON.stringify(message)}`)
        })

    console.log(result)

    const expectedResult: any = {
        type: "result",
        labels: ["bubalis12.fasta", "bubalis13.fasta", "bubalis14.fasta", "bubalis15.fasta", "bubalis16.fasta"],
        ncdMatrix: [
            [0, 0.05227655986509275, 0.018565400843881856, 0.018776371308016876, 0.016877637130801686],
            [0.05227655986509275, 0, 0.05354131534569983, 0.05354131534569983, 0.05396290050590219],
            [0.018565400843881856, 0.05354131534569983, 0, 0.014578491443059371, 0.01583614864864865],
            [0.018776371308016876, 0.05354131534569983, 0.014578491443059371, 0, 0.015625],
            [0.016877637130801686, 0.05396290050590219, 0.01583614864864865, 0.015625, 0]
        ],
        newCompressionData: [
            {key1: "9b4810a9", key2: "155fb682", size1: 4740, size2: 4744, combinedSize: 4988},
            {key1: "9b4810a9", key2: "a14480a3", size1: 4740, size2: 4733, combinedSize: 4821},
            {key1: "9b4810a9", key2: "3e4bac49", size1: 4740, size2: 4733, combinedSize: 4822},
            {key1: "9b4810a9", key2: "c6dbcd85", size1: 4740, size2: 4736, combinedSize: 4816},
            {key1: "155fb682", key2: "a14480a3", size1: 4744, size2: 4733, combinedSize: 4987},
            {key1: "155fb682", key2: "3e4bac49", size1: 4744, size2: 4733, combinedSize: 4987},
            {key1: "155fb682", key2: "c6dbcd85", size1: 4744, size2: 4736, combinedSize: 4992},
            {key1: "a14480a3", key2: "3e4bac49", size1: 4733, size2: 4733, combinedSize: 4802},
            {key1: "a14480a3", key2: "c6dbcd85", size1: 4733, size2: 4736, combinedSize: 4808},
            {key1: "3e4bac49", key2: "c6dbcd85", size1: 4733, size2: 4736, combinedSize: 4807}
        ]
    };

    // Validate the `type` field
    expect(result.type).toBe(expectedResult.type);

    // Validate the `labels` array
    expect(result.labels).toHaveLength(5);

    // Validate the `ncdMatrix`
    expect(result.ncdMatrix).toHaveLength(5);

    for (let r = 0; r < result.ncdMatrix.length; r++) {
        for (let c = 0; c < result.ncdMatrix[r].length; c++) {
            expect(Math.abs(result.ncdMatrix[r][c] - expectedResult.ncdMatrix[r][c]) <= 1e-10);
        }
    }
}, 360000);

test('Test compression decision zstd', async () => {
    const input: NCDInput = {
        labels: [
            "ngaonghe.gif",
            "ngaonghe1.gif",
            "ngaonghe2.gif",
            "ngaonghe3.gif",
        ],
        contents: []
    };

    input.contents = await Promise.all(
        input.labels.map(async (label) => {
            const filePath = path.join(__dirname + "/compression_data", `${label}`);
            return await fs.promises.readFile(filePath, 'utf-8');
        })
    );

    const compressionService = CompressionService.getInstance();

    const [compressionDecision, cachedSizes] = CompressionService.preprocessNcdInput(input, new CRCCache());

    const result: any = await compressionService.processContent({
            ...input,
            cachedSizes: cachedSizes.size > 0 ? cachedSizes : undefined,
            algorithm: compressionDecision.algorithm,
        },
        (message) => {
            console.log(`Receiving new message from ${compressionDecision.algorithm} compression worker: ${JSON.stringify(message)}`)
        })

    console.log(result)


    const expectedResult: any = {
        "type": "result",
        "labels": ["ngaonghe.gif", "ngaonghe1.gif", "ngaonghe2.gif", "ngaonghe3.gif"],
        "ncdMatrix": [
            [0, 0.00026165178453141147, 0.00026165178453141147, 0.00026165178453141147],
            [0.00026165178453141147, 0, 0.00026165178453141147, 0.00026165178453141147],
            [0.00026165178453141147, 0.00026165178453141147, 0, 0.00026165178453141147],
            [0.00026165178453141147, 0.00026165178453141147, 0.00026165178453141147, 0]
        ],
        "newCompressionData": [
            {},
            {
                "key1": "60e024ce",
                "key2": "60e024ce",
                "size1": 301928,
                "size2": 301928,
                "combinedSize": 302007
            },
            {
                "key1": "60e024ce",
                "key2": "60e024ce",
                "size1": 301928,
                "size2": 301928,
                "combinedSize": 302007
            },
            {
                "key1": "60e024ce",
                "key2": "60e024ce",
                "size1": 301928,
                "size2": 301928,
                "combinedSize": 302007
            },
            {},
            {
                "key1": "60e024ce",
                "key2": "60e024ce",
                "size1": 301928,
                "size2": 301928,
                "combinedSize": 302007
            },
            {
                "key1": "60e024ce",
                "key2": "60e024ce",
                "size1": 301928,
                "size2": 301928,
                "combinedSize": 302007
            },
            {},
            {
                "key1": "60e024ce",
                "key2": "60e024ce",
                "size1": 301928,
                "size2": 301928,
                "combinedSize": 302007
            },
            {}
        ]
    };

    // Validate the `type` field
    expect(result.type).toBe(expectedResult.type);

    // Validate the `labels` array
    expect(result.labels).toHaveLength(4);

    // Validate the `ncdMatrix`
    expect(result.ncdMatrix).toHaveLength(4);

    for (let r = 0; r < result.ncdMatrix.length; r++) {
        for (let c = 0; c < result.ncdMatrix[r].length; c++) {
            expect(Math.abs(result.ncdMatrix[r][c] - expectedResult.ncdMatrix[r][c]) <= 1e-10);
        }
    }

}, 360000);





