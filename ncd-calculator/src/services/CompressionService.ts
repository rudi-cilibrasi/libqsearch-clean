// src/services/CompressionService.ts
import type { WorkerMessage } from '../types/ncd';

export type CompressionAlgorithm = 'zstd' | 'gzip' | 'lzma';

interface CompressionResponse {
  algorithm: CompressionAlgorithm;
  reason: string;
}

export class CompressionService {
  private static instance: CompressionService;
  private worker: Worker;
  private currentAlgorithm: CompressionAlgorithm | null = null;

  // Size thresholds for different compression algorithms
  private static readonly MAX_SIZES = {
    gzip: 32 * 1024,         // 32KB
    zstd: 128 * 1024 * 1024, // 128MB
    lzma: 64 * 1024 * 1024   // 64MB
  };

  // Algorithm descriptions
  private static readonly ALGORITHM_DESCRIPTIONS = {
    gzip: "Fast compression, best for files ≤32KB",
    lzma: "High compression, best for files ≤64MB",
    zstd: "Balanced compression, best for files ≤128MB"
  };

  private constructor() {

  }

  static getInstance(): CompressionService {
    if (!CompressionService.instance) {
      CompressionService.instance = new CompressionService();
    }
    return CompressionService.instance;
  }

  async initialize(algorithm: CompressionAlgorithm = 'zstd') {
    // If the worker is already initialized with the correct algorithm, do nothing
    if (this.worker && this.currentAlgorithm === algorithm) {
      return;
    }

    // Clean up existing worker if any
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    try {
      // Initialize the appropriate worker based on algorithm
      switch (algorithm) {
        case 'zstd': {
          const ZSTDWorker = await import('../../src/workers/zstdWorker?worker');
          this.worker = new ZSTDWorker.default();
          break;
        }
        case 'gzip': {
          const GZIPWorker = await import('../../src/workers/gzipWorker.ts?worker');
          this.worker = new GZIPWorker.default();
          break;
        }
        case 'lzma': {
          const LZMAWorker = await import('../../src/workers/lzmaWorker.ts.ts?worker');
          this.worker = new LZMAWorker.default();
          break;
        }
        default:
          throw new Error(`Unsupported compression algorithm: ${algorithm}`);
      }

      this.currentAlgorithm = algorithm;

      // Wait for worker to be ready
      await this.waitForWorkerReady();
    } catch (error) {
      console.error(`Failed to initialize ${algorithm} worker:`, error);
      throw error;
    }
  }

  private async waitForWorkerReady(): Promise<void> {
    if (!this.worker) throw new Error('No worker initialized');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worker initialization timed out'));
      }, 5000);

      const handleMessage = (e: MessageEvent<WorkerMessage>) => {
        if (e.data.type === 'ready') {
          this.worker?.removeEventListener('message', handleMessage);
          clearTimeout(timeout);
          resolve();
        }
      };
      this.worker.addEventListener('message', handleMessage);
    });
  }

  async processContent(input: {
    labels: string[];
    contents: string[];
    cachedSizes?: Map<string, number>;
  }, onProgress?: (message: WorkerMessage) => void): Promise<WorkerMessage> {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    return new Promise((resolve, reject) => {
      const handleMessage = (e: MessageEvent<WorkerMessage>) => {
        const message = e.data;

        switch (message.type) {
          case 'result':
            this.worker?.removeEventListener('message', handleMessage);
            resolve(message);
            break;
          case 'error':
            this.worker?.removeEventListener('message', handleMessage);
            reject(new Error(message.message));
            break;
          case 'progress':
          case 'start':
            if (onProgress) {
              onProgress(message);
            }
            break;
        }
      };
      this.worker.addEventListener('message', handleMessage);
      this.worker.postMessage(input);
    });
  }

  getCurrentAlgorithm(): CompressionAlgorithm | null {
    return this.currentAlgorithm;
  }

  static needsAdvancedCompression(size1: number, size2: number): CompressionResponse {
    const maxSize = Math.max(size1, size2);

    if (maxSize <= this.MAX_SIZES.gzip) {
      return {
        algorithm: 'gzip',
        reason: this.ALGORITHM_DESCRIPTIONS.gzip
      };
    } else if (maxSize <= this.MAX_SIZES.zstd) {
      return {
        algorithm: 'zstd',
        reason: this.ALGORITHM_DESCRIPTIONS.zstd
      };
    } else if (maxSize <= this.MAX_SIZES.lzma) {
      return {
        algorithm: 'lzma',
        reason: this.ALGORITHM_DESCRIPTIONS.lzma
      };
    } else {
      // If size exceeds all thresholds, use ZSTD as a balanced fallback
      return {
        algorithm: 'zstd',
        reason: 'File size exceeds optimal ranges, using ZSTD as fallback'
      };
    }
  }

  static getAvailableAlgorithms(): CompressionAlgorithm[] {
    // Currently only ZSTD is implemented
    return ['zstd'];
  }

  static getAlgorithmInfo(algorithm: CompressionAlgorithm) {
    return {
      maxSize: this.MAX_SIZES[algorithm],
      description: this.ALGORITHM_DESCRIPTIONS[algorithm]
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