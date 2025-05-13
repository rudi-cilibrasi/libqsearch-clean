import type {NCDInput, WorkerMessage} from "../types/ncd";
import {calculateCRC32} from "@/workers/shared/utils.ts";
import {CRCCache, CRCCacheEntry} from "@/cache/CRCCache.ts";

export type CompressionAlgorithm = "lzma" | "zstd";

export interface CompressionResponse {
	algorithm: CompressionAlgorithm;
	reason: string;
}

/**
 * Factory function type for creating worker instances
 * This allows dependency injection for testing
 */
export type WorkerFactory = (algorithm: CompressionAlgorithm) => Promise<Worker>;

/**
 * CompressionService manages compression workers for NCD calculations
 * It handles worker initialization, message processing, and resource cleanup
 */
export class CompressionService {
	private static instance: CompressionService;
	
	// Configuration constants for compression algorithms
	private static readonly MAX_SIZES = {
		lzma: 2 * 1024 * 1024, // 2MB maximum for LZMA
		zstd: 128 * 1024 * 1024, // 128MB maximum for ZSTD
	} as const;
	
	private static readonly ABSOLUTE_MAX_SIZE = 128 * 1024 * 1024; // 128MB
	
	private static readonly ALGORITHM_DESCRIPTIONS = {
		lzma: "High compression ratio, optimal for files ≤1MB (source code, text).",
		zstd: "Fast compression for files up to 128MB.",
	} as const;
	
	// Worker instance and current algorithm state
	private worker: Worker | null = null;
	private currentAlgorithm: CompressionAlgorithm | null = null;
	
	// Worker factory function for creating worker instances
	private workerFactory: WorkerFactory;
	
	// Timeout for worker initialization in milliseconds
	private initializationTimeout: number = 10000;
	
	/**
	 * Private constructor that accepts optional worker factory and default algorithm
	 *
	 * @param workerFactory Optional custom worker factory function
	 * @param defaultAlgorithm Algorithm to initialize with
	 * @param timeout Timeout for worker initialization in milliseconds
	 */
	private constructor(
		workerFactory?: WorkerFactory,
		defaultAlgorithm: CompressionAlgorithm = "zstd",
		timeout: number = 10000
	) {
		this.workerFactory = workerFactory || this.defaultWorkerFactory.bind(this);
		this.initializationTimeout = timeout;
		this.initializeWorker(defaultAlgorithm).catch(console.error);
	}
	
	/**
	 * Gets or creates the singleton instance of CompressionService
	 *
	 * @param workerFactory Optional custom worker factory for testing
	 * @param defaultAlgorithm Algorithm to initialize with
	 * @param timeout Timeout for worker initialization in milliseconds
	 * @returns CompressionService instance
	 */
	static getInstance(
		workerFactory?: WorkerFactory,
		defaultAlgorithm?: CompressionAlgorithm,
		timeout?: number
	): CompressionService {
		// If an instance exists and no custom factory is provided, return existing instance
		if (CompressionService.instance && !workerFactory) {
			return CompressionService.instance;
		}
		
		// Create a new instance if none exists or if a custom factory is provided
		if (!CompressionService.instance || workerFactory) {
			const instance = new CompressionService(workerFactory, defaultAlgorithm, timeout);
			
			// Only set as singleton if no custom factory was provided
			if (!workerFactory) {
				CompressionService.instance = instance;
			}
			
			return instance;
		}
		
		return CompressionService.instance;
	}
	
	/**
	 * Determines the appropriate compression algorithm based on file sizes
	 *
	 * @param size1 Size of first file in bytes
	 * @param size2 Size of second file in bytes
	 * @returns CompressionResponse with selected algorithm and reason
	 */
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
	
	/**
	 * Returns the list of available compression algorithms
	 *
	 * @returns Array of available compression algorithms
	 */
	static getAvailableAlgorithms(): CompressionAlgorithm[] {
		return ["lzma", "zstd"];
	}
	
	/**
	 * Returns information about a specific compression algorithm
	 *
	 * @param algorithm The compression algorithm to get info for
	 * @returns Object with algorithm size limits and description
	 */
	static getAlgorithmInfo(algorithm: CompressionAlgorithm) {
		return {
			maxSize: this.MAX_SIZES[algorithm],
			description: this.ALGORITHM_DESCRIPTIONS[algorithm],
		};
	}
	
	/**
	 * Preprocesses the input data for NCD calculation
	 * Determines the best compression algorithm and prepares cached sizes
	 *
	 * @param input The NCD input data containing labels and contents
	 * @param crcCache Cache for storing compression results
	 * @returns Tuple of compression decision and cached sizes map
	 */
	static preprocessNcdInput = <T extends CRCCache>(input: NCDInput, crcCache: T): [CompressionResponse, Map<string, number>] => {
		// Determine the best compression algorithm based on content sizes
		const contentSizes = input.contents.map(
			(content) => new TextEncoder().encode(content).length
		);
		const sortedSizes = [...contentSizes].sort((a, b) => b - a);
		const compressionDecision = CompressionService.needsAdvancedCompression(
			sortedSizes[0],
			sortedSizes[1]
		);
		
		const compressionAlgo = compressionDecision.algorithm;
		
		// Prepare cached sizes
		const contentBuffers = input.contents.map((content) =>
			new TextEncoder().encode(content)
		);
		
		const fileCRCs = contentBuffers.map((buffer) => calculateCRC32(buffer));
		const cachedSizes: Map<string, number> = new Map();
		
		for (const crc of fileCRCs) {
			const size = crcCache.getCompressedSize(compressionAlgo, [crc]);
			if (size) {
				cachedSizes.set(`${compressionAlgo}:${crc}`, size);
			}
		}
		
		for (let i = 0; i < fileCRCs.length; i++) {
			for (let j = i + 1; j < fileCRCs.length; j++) {
				if (i == j) continue;
				const entry: CRCCacheEntry | null = crcCache.getCachedEntry(compressionAlgo, [fileCRCs[i], fileCRCs[j]]);
				if (entry) {
					cachedSizes.set(entry.key, entry.value);
				}
			}
		}
		
		return [compressionDecision, cachedSizes];
	}
	
	/**
	 * Initialize or switch to the specified compression algorithm
	 *
	 * @param algorithm The compression algorithm to initialize
	 * @returns Promise that resolves when the worker is ready
	 */
	async initialize(algorithm: CompressionAlgorithm = "zstd"): Promise<void> {
		if (this.currentAlgorithm === algorithm && this.worker) {
			return;
		}
		await this.initializeWorker(algorithm);
	}
	
	/**
	 * Process content for NCD calculation using the specified algorithm
	 *
	 * @param input Input data containing labels, contents, and algorithm
	 * @param onProgress Optional callback for progress updates
	 * @returns Promise that resolves with the worker result
	 */
	async processContent(
		input: {
			labels: string[];
			contents: string[];
			cachedSizes: Map<string, number> | undefined;
			algorithm: CompressionAlgorithm;
		},
		onProgress?: (message: WorkerMessage) => void
	): Promise<WorkerMessage> {
		const totalSize = input.contents.reduce((sum, content) => {
			return sum + new TextEncoder().encode(content).length;
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
		
		return await this.processWorkerMessages(input, onProgress);
	}
	
	/**
	 * Terminates the current worker and releases resources
	 */
	terminate() {
		if (this.worker) {
			this.worker.terminate();
			this.worker = null;
			this.currentAlgorithm = null;
		}
	}
	
	/**
	 * Default factory function for creating workers
	 * This can be overridden for testing
	 *
	 * @param algorithm The compression algorithm to create a worker for
	 * @returns Promise that resolves with the created worker
	 */
	private async defaultWorkerFactory(algorithm: CompressionAlgorithm): Promise<Worker> {
		switch (algorithm) {
			case "lzma":
				// @ts-ignore
				const LzmaWorkerModule = await import("../workers/lzmaWorker?worker");
				return new LzmaWorkerModule.default();
			case "zstd":
				// @ts-ignore
				const ZstdWorkerModule = await import("../workers/zstdWorker?worker");
				return new ZstdWorkerModule.default();
			default:
				throw new Error(`Unsupported compression algorithm: ${algorithm}`);
		}
	}
	
	/**
	 * Initialize or switch to a new worker for the specified algorithm
	 *
	 * @param algorithm The compression algorithm to initialize
	 * @returns Promise that resolves when the worker is ready
	 */
	private async initializeWorker(algorithm: CompressionAlgorithm): Promise<void> {
		if (this.worker) {
			this.terminate();
		}
		
		try {
			// Use the factory to create the worker
			this.worker = await this.workerFactory(algorithm);
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
	
	/**
	 * Wait for the worker to send a ready message
	 *
	 * @returns Promise that resolves when the worker is ready
	 */
	private async waitForWorkerReady(): Promise<void> {
		if (!this.worker) {
			throw new Error("No worker initialized");
		}
		
		const abortController = new AbortController();
		const timeoutId = setTimeout(() => abortController.abort(), this.initializationTimeout);
		
		try {
			await this.listenForWorkerReady(abortController.signal);
		} catch (error) {
			console.log(error);
			if (error instanceof DOMException && error.name === 'AbortError') {
				throw new Error(`Worker initialization timed out after ${this.initializationTimeout}ms`);
			}
			throw error;
		} finally {
			clearTimeout(timeoutId);
		}
	}
	
	/**
	 * Listen for the worker to send a ready message
	 *
	 * @param signal AbortSignal for timing out the operation
	 * @returns Promise that resolves when the worker is ready
	 */
	private async listenForWorkerReady(signal: AbortSignal): Promise<void> {
		return new Promise((resolve, reject) => {
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
				this.worker?.removeEventListener("message", handleMessage);
				signal.removeEventListener("abort", handleAbort);
			};
			
			const handleAbort = () => {
				cleanup();
				reject(new DOMException("Aborted", "AbortError"));
			};
			
			this.worker?.addEventListener("message", handleMessage);
			signal.addEventListener("abort", handleAbort);
		});
	}
	
	/**
	 * Process messages from the worker and handle the result
	 *
	 * @param input Input data to send to the worker
	 * @param onProgress Optional callback for progress updates
	 * @returns Promise that resolves with the worker result
	 */
	private async processWorkerMessages(
		input: any,
		onProgress?: (message: WorkerMessage) => void
	): Promise<WorkerMessage> {
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
			
			this.worker?.addEventListener("message", handleMessage);
			this.worker?.postMessage(input);
		});
	}
	
	/**
	 * Gets the current algorithm being used
	 * Useful for testing and debugging
	 *
	 * @returns The current compression algorithm or null if none
	 */
	getCurrentAlgorithm(): CompressionAlgorithm | null {
		return this.currentAlgorithm;
	}
	
	/**
	 * Checks if a worker is currently active
	 * Useful for testing and debugging
	 *
	 * @returns Boolean indicating if a worker is active
	 */
	hasActiveWorker(): boolean {
		return this.worker !== null;
	}
}
