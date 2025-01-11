import type { WorkerMessage } from "../types/ncd";

export type CompressionAlgorithm = "zstd" | "gzip" | "lzma";

interface CompressionResponse {
  algorithm: CompressionAlgorithm;
  reason: string;
}

export class CompressionService {
  private static instance: CompressionService;
  private worker: Worker | null = null;
  private currentAlgorithm: CompressionAlgorithm | null = null;
  private initializing: Promise<void>;

  // Size thresholds for different compression algorithms
  private static readonly MAX_SIZES = {
    gzip: 32 * 1024, // 32KB
    lzma: 1024 * 1024, // 1MB
    zstd: 128 * 1024 * 1024, // 128MB
  };

  // Algorithm descriptions
  private static readonly ALGORITHM_DESCRIPTIONS = {
    gzip: "Fast compression, best for files ≤32KB",
    lzma: "High compression ratio (relatively slow), best for files ≤1MB",
    zstd: "Balanced and fast compression, best for files ≤128MB",
  };

  private constructor() {
    this.initializing = this.initializeWorker("zstd");
  }

  async initialize(algorithm: CompressionAlgorithm = "gzip"): Promise<void> {
    await this.initializing;
    if (this.currentAlgorithm === algorithm && this.worker) {
      return;
    }
    await this.initializeWorker(algorithm);
  }

  private async initializeWorker(
    algorithm: CompressionAlgorithm
  ): Promise<void> {
    try {
      if (this.worker) {
        this.terminate();
      }
      switch (algorithm) {
        case "gzip": {
          const gzipWorker = await import(
            "../../src/workers/gzipWorker?worker"
          );
          this.worker = new gzipWorker.default();
          break;
        }
        case "lzma": {
          const lzmaWorker = await import(
            "../../src/workers/lzmaWorker?worker"
          );
          this.worker = new lzmaWorker.default();
          break;
        }
        case "zstd": {
          const zstdWorker = await import(
            "../../src/workers/zstdWorker?worker"
          );
          this.worker = new zstdWorker.default();
          break;
        }
        default:
          throw new Error(`Unsupported compression algorithm: ${algorithm}`);
      }
      this.currentAlgorithm = algorithm;
      await this.waitForWorkerReady();
      console.log(
        `Worker for algorithm: ${this.currentAlgorithm} is up and ready`
      );
    } catch (error) {
      console.error(`Fail to initialize ${algorithm} worker: `, error);
    }
  }

  static getInstance(): CompressionService {
    if (!CompressionService.instance) {
      CompressionService.instance = new CompressionService();
    }
    return CompressionService.instance;
  }

  private async waitForWorkerReady(): Promise<void> {
    if (!this.worker) throw new Error("No worker initialized");

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Worker initialization timed out"));
      }, 5000);

      const handleMessage = (e: MessageEvent<WorkerMessage>) => {
        if (e.data.type === "ready") {
          this.worker?.removeEventListener("message", handleMessage);
          clearTimeout(timeout);
          resolve();
        }
      };
      this.worker.addEventListener("message", handleMessage);
    });
  }

  async processContent(
    input: {
      labels: string[];
      contents: string[];
      cachedSizes: Map<string, number> | undefined;
      algorithm: CompressionAlgorithm;
    },
    onProgress?: (message: WorkerMessage) => void
  ): Promise<WorkerMessage> {
    await this.initializing;
    if (input.algorithm && this.currentAlgorithm !== input.algorithm) {
      await this.initialize(input.algorithm);
    }
    if (!this.worker) {
      throw new Error(
        `Failed to initialize worker with algorithm: ${input.algorithm}`
      );
    }
    return new Promise((resolve, reject) => {
      // message sending back to the QSearch component from the compressor workers
      const handleMessage = (e: MessageEvent<WorkerMessage>) => {
        const message = e.data;
        const type = message.type;
        switch (type) {
          case "result": {
            this.worker.removeEventListener("message", handleMessage);
            resolve(message);
            break;
          }
          case "error": {
            this.worker.removeEventListener("message", handleMessage);
            reject(new Error(message.message));
            break;
          }
          case "progress":
          case "start":
            if (onProgress) {
              onProgress(message);
            }
            break;
        }
      };
      if (this.worker) {
        this.worker.addEventListener("message", handleMessage);
        this.worker.postMessage(input);
      }
    });
  }

  static needsAdvancedCompression(
    size1: number,
    size2: number
  ): CompressionResponse {
    const maxSize = size1 + size2;

    if (maxSize <= this.MAX_SIZES.gzip) {
      return {
        algorithm: "gzip",
        reason: this.ALGORITHM_DESCRIPTIONS.gzip,
      };
    } else if (maxSize <= this.MAX_SIZES.lzma) {
      return {
        algorithm: "lzma",
        reason: this.ALGORITHM_DESCRIPTIONS.lzma,
      };
    } else {
      return {
        algorithm: "zstd",
        reason: this.ALGORITHM_DESCRIPTIONS.zstd,
      };
    }
  }

  static getAvailableAlgorithms(): CompressionAlgorithm[] {
    return ["gzip", "lzma", "zstd"];
  }

  static getAlgorithmInfo(algorithm: CompressionAlgorithm) {
    return {
      maxSize: this.MAX_SIZES[algorithm],
      description: this.ALGORITHM_DESCRIPTIONS[algorithm],
    };
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.currentAlgorithm = null;
    }
  }
}
