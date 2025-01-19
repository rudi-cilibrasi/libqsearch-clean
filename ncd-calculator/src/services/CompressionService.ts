import type { WorkerMessage } from "../types/ncd";

// Support only LZMA (for small files) and ZSTD (for larger files)
export type CompressionAlgorithm = "lzma" | "zstd";

export interface CompressionResponse {
  algorithm: CompressionAlgorithm;
  reason: string;
}

export class CompressionService {
  private static instance: CompressionService;
  private worker: Worker | null = null;
  private currentAlgorithm: CompressionAlgorithm | null = null;
  private readonly initializing: Promise<void>;

  private static readonly MAX_SIZES = {
    lzma: 1024 * 1024, // 1MB maximum for LZMA
    zstd: 128 * 1024 * 1024, // 128MB maximum for ZSTD
  } as const;

  private static readonly ABSOLUTE_MAX_SIZE = 128 * 1024 * 1024; // 128MB

  private static readonly ALGORITHM_DESCRIPTIONS = {
    lzma: "High compression ratio, optimal for files ≤1MB (source code, text).",
    zstd: "Fast compression for files up to 128MB.",
  } as const;

  private constructor() {
    this.initializing = this.initializeWorker("zstd");
  }

  static getInstance(): CompressionService {
    if (!CompressionService.instance) {
      CompressionService.instance = new CompressionService();
    }
    return CompressionService.instance;
  }

  async initialize(algorithm: CompressionAlgorithm = "zstd"): Promise<void> {
    try {
      await this.initializing;
      if (this.currentAlgorithm === algorithm && this.worker) {
        return;
      }
      await this.initializeWorker(algorithm);
    } catch (error) {
      console.error(`Failed to initialize ${algorithm} algorithm:`, error);
      throw error;
    }
  }

  private async initializeWorker(algorithm: CompressionAlgorithm): Promise<void> {
    try {
      if (this.worker) {
        this.terminate();
      }

      let WorkerModule;
      switch (algorithm) {
        case "lzma":
          WorkerModule = await import("../workers/lzmaWorker?worker");
          break;
        case "zstd":
          WorkerModule = await import("../workers/zstdWorker?worker");
          break;
        default:
          throw new Error(`Unsupported compression algorithm: ${algorithm}`);
      }

      this.worker = new WorkerModule.default();
      this.currentAlgorithm = algorithm;
      await this.waitForWorkerReady();
      console.log(`Worker for algorithm: ${this.currentAlgorithm} is ready`);
    } catch (error) {
      console.error(`Failed to initialize ${algorithm} worker:`, error);
      this.worker = null;
      this.currentAlgorithm = null;
      throw error;
    }
  }

  // Wait for worker to signal ready state
  private async waitForWorkerReady(): Promise<void> {
    if (!this.worker) {
      throw new Error("No worker initialized");
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Worker initialization timed out"));
      }, 10000);

      const handleMessage = (e: MessageEvent<WorkerMessage>) => {
        if (e.data.type === "ready") {
          cleanup();
          resolve();
        } else if (e.data.type === "error") {
          cleanup();
          reject(new Error(e.data.message));
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.worker?.removeEventListener("message", handleMessage);
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
    try {
      const totalSize = input.contents.reduce((sum, content) => {
        return sum + (new TextEncoder().encode(content)).length;
      }, 0);

      if (totalSize > CompressionService.ABSOLUTE_MAX_SIZE) {
        throw new Error(
            `Total file size (${(totalSize / (1024 * 1024)).toFixed(2)}MB) ` +
            `exceeds maximum allowed size (128MB)`
        );
      }

      if (input.algorithm !== this.currentAlgorithm) {
        await this.initialize(input.algorithm);
      }

      if (!this.worker) {
        throw new Error(`Worker not initialized for algorithm: ${input.algorithm}`);
      }

      return new Promise((resolve, reject) => {
        const handleMessage = (e: MessageEvent<WorkerMessage>) => {
          const message = e.data;
          switch (message.type) {
            case "result":
              cleanup();
              resolve(message);
              break;
            case "error":
              cleanup();
              reject(new Error(message.message));
              break;
            case "progress":
            case "start":
              onProgress?.(message);
              break;
          }
        };

        const cleanup = () => {
          this.worker?.removeEventListener("message", handleMessage);
        };

        this.worker.addEventListener("message", handleMessage);
        this.worker.postMessage(input);
      });
    } catch (error) {
      console.error('Error processing content:', error);
      throw error;
    }
  }

  // Determine which compression algorithm to use based on file sizes
  static needsAdvancedCompression(size1: number, size2: number): CompressionResponse {
    const maxSize = size1 + size2;

    if (maxSize > this.ABSOLUTE_MAX_SIZE) {
      throw new Error(
          `Combined file size (${(maxSize / (1024 * 1024)).toFixed(2)}MB) ` +
          `exceeds maximum allowed size (128MB)`
      );
    }

    if (maxSize <= this.MAX_SIZES.lzma) {
      return {
        algorithm: "lzma",
        reason: this.ALGORITHM_DESCRIPTIONS.lzma,
      };
    }

    return {
      algorithm: "zstd",
      reason: this.ALGORITHM_DESCRIPTIONS.zstd,
    };
  }

  static getAvailableAlgorithms(): CompressionAlgorithm[] {
    return ["lzma", "zstd"];
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
      this.worker = null;
      this.currentAlgorithm = null;
    }
  }
}