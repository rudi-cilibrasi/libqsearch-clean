import {lzmaWorkerCode} from "@/workers/lzmaWorker.ts";
import {workerCode} from "@/workers/ncdWorker.ts";

export class CompressionService {
    private static readonly GZIP_MAX_WINDOW: number = 35 * 1024;


    static needsAdvancedCompression = (file1Size: number, file2Size: number) => {
        // const combinedSize = file1Size + file2Size;
        // if (combinedSize <= this.GZIP_MAX_WINDOW) {
            return {
                needsAdvanced: false,
                recommendedAlgo: "gzip",
                reason: "Files fit within GZIP window"
            }
        // }
        // return {
        //     needsAdvanced: true,
        //     recommendedAlgo: "lzma",
        //     reason: "LZMA is best for large files"
        // }
    }

    static createWorker(fileContents: string[]) {
        const sizes = fileContents.map(content => new TextEncoder().encode(content).length);
        const sortedSizes = [...sizes].sort((a, b) => b - a);
        const largestPairSize = sortedSizes[0] + sortedSizes[1];

        if (largestPairSize <= this.GZIP_MAX_WINDOW) {
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            return new Worker(URL.createObjectURL(blob));
        } else {
            const blob = new Blob([lzmaWorkerCode], { type: 'application/javascript' });
            return new Worker(URL.createObjectURL(blob));
        }
    }

    static async processFiles(
        contents: string[],
        labels: string[],
        onProgress?: (i: number, j: number, value: number) => void
    ): Promise<number[][]> {
        return new Promise((resolve, reject) => {
            const worker = this.createWorker(contents);

            worker.onmessage = (e) => {
                if (e.data.type === 'error') {
                    reject(new Error(e.data.message));
                    worker.terminate();
                } else if (e.data.type === 'progress' && onProgress) {
                    onProgress(e.data.i, e.data.j, e.data.value);
                } else if (e.data.type === 'result') {
                    resolve(e.data.ncdMatrix);
                    worker.terminate();
                }
            };

            worker.onerror = (error) => {
                reject(error);
                worker.terminate();
            };

            worker.postMessage({ labels, contents });
        });
    }
}