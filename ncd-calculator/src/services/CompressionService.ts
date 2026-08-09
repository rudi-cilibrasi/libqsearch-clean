import type {NCDInput, WorkerMessage, WorkerResultMessage} from "../types/ncd";
import {CompressionCache} from "@/cache/CompressionCache.ts";
import {fingerprintContent, getCompressionProvenance} from "@/services/CompressionProtocol.ts";
import {
	COMPRESSOR_PROFILES,
	type CompressorProfile,
	validateWindowForNCD,
} from "@/services/CompressorCapabilities.ts";
import type {
	CompressionAlgorithm,
	CompressionPreference,
	PreparedCompressionInput,
} from "@/types/compression";
import {COMPRESSION_ALGORITHMS, isCompressionPreference} from "@/types/compression";

export type {CompressionAlgorithm} from "@/types/compression";

export interface CompressionResponse {
	algorithm: CompressionAlgorithm;
	reason: string;
	warning?: string;
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
	private static readonly DEFAULT_INITIALIZATION_TIMEOUT_MS = 30_000;
	
	private static readonly ABSOLUTE_MAX_SIZE = 128 * 1024 * 1024; // 128MB
	
	// Worker instance and current algorithm state
	private worker: Worker | null = null;
	private currentAlgorithm: CompressionAlgorithm | null = null;
	private initializationPromise: Promise<void> | null = null;
	private readonly preferredAlgorithm: CompressionAlgorithm;
	
	// Worker factory function for creating worker instances
	private workerFactory: WorkerFactory;
	
	// Timeout for worker initialization in milliseconds
	private initializationTimeout: number = CompressionService.DEFAULT_INITIALIZATION_TIMEOUT_MS;
	
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
		timeout: number = CompressionService.DEFAULT_INITIALIZATION_TIMEOUT_MS
	) {
		this.workerFactory = workerFactory || this.defaultWorkerFactory.bind(this);
		this.initializationTimeout = timeout;
		this.preferredAlgorithm = defaultAlgorithm;
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
		const zstdValidation = validateWindowForNCD("zstd", size1, size2);
		const maxSize = zstdValidation.combinedSize;
		
		if (!zstdValidation.valid || maxSize > this.ABSOLUTE_MAX_SIZE) {
			throw new Error(
				`Combined file size (${(maxSize / (1024 * 1024)).toFixed(2)}MB) ` +
				`exceeds maximum allowed size (128MB)`
			);
		}
		
		if (maxSize <= COMPRESSOR_PROFILES.lzma.maxInputSize) {
			return {
				algorithm: "lzma",
				reason: COMPRESSOR_PROFILES.lzma.description,
			};
		}
		
		return {
			algorithm: "zstd",
			reason: COMPRESSOR_PROFILES.zstd.description,
			warning: zstdValidation.warning,
		};
	}

	/** Resolve an explicit or automatic compressor and fail before worker startup when unsafe. */
	static selectCompression(
		preference: CompressionPreference,
		size1: number,
		size2: number,
	): CompressionResponse {
		if (!isCompressionPreference(preference)) {
			throw new Error(`Unsupported compression preference: ${String(preference)}`);
		}
		if (preference === "auto") return this.needsAdvancedCompression(size1, size2);

		const validation = validateWindowForNCD(preference, size1, size2);
		if (!validation.valid) {
			throw new Error(validation.warning ?? `The ${preference} compressor cannot process this input`);
		}

		return {
			algorithm: preference,
			reason: COMPRESSOR_PROFILES[preference].description,
			warning: validation.warning,
		};
	}
	
	/**
	 * Returns the list of available compression algorithms
	 *
	 * @returns Array of available compression algorithms
	 */
	static getAvailableAlgorithms(): CompressionAlgorithm[] {
		return [...COMPRESSION_ALGORITHMS];
	}
	
	/**
	 * Returns information about a specific compression algorithm
	 *
	 * @param algorithm The compression algorithm to get info for
	 * @returns Object with algorithm size limits and description
	 */
	static getAlgorithmInfo(algorithm: CompressionAlgorithm): CompressorProfile {
		return COMPRESSOR_PROFILES[algorithm];
	}
	
	/**
	 * Preprocesses the input data for NCD calculation
	 * Determines the best compression algorithm and prepares cached sizes
	 *
	 * @param input The NCD input data containing labels and contents
	 * @param cache Versioned cache for storing compression results
	 * @returns Prepared, content-addressed input for the selected worker
	 */
	static preprocessNcdInput = async (
		input: NCDInput,
		cache: CompressionCache,
	): Promise<PreparedCompressionInput> => {
		if (input.contents.length < 2) {
			throw new Error("At least two objects are required for an NCD comparison");
		}

		// Determine the best compression algorithm based on content sizes
		const contentSizes = input.contents.map(
			(content) => new TextEncoder().encode(content).length
		);
		const sortedSizes = [...contentSizes].sort((a, b) => b - a);
		const compressionDecision = CompressionService.selectCompression(
			input.compression ?? "auto",
			sortedSizes[0],
			sortedSizes[1]
		);
		
		const contentKeys = await Promise.all(input.contents.map(fingerprintContent));
		const algorithm = compressionDecision.algorithm;

		return {
			algorithm,
			reason: compressionDecision.reason,
			warning: compressionDecision.warning,
			contentKeys,
			cachedSizes: cache.prepareWorkerCache(algorithm, contentKeys),
			provenance: getCompressionProvenance(algorithm),
		};
	}
	
	/**
	 * Initialize or switch to the specified compression algorithm
	 *
	 * @param algorithm The compression algorithm to initialize
	 * @returns Promise that resolves when the worker is ready
	 */
	async initialize(algorithm: CompressionAlgorithm = this.preferredAlgorithm): Promise<void> {
		if (this.initializationPromise) {
			await this.initializationPromise;
		}
		if (this.currentAlgorithm === algorithm && this.worker) {
			return;
		}

		const pending = this.initializeWorker(algorithm);
		this.initializationPromise = pending;
		try {
			await pending;
		} finally {
			if (this.initializationPromise === pending) this.initializationPromise = null;
		}
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
			contentKeys: string[];
			cachedSizes: Map<string, number> | undefined;
			algorithm: CompressionAlgorithm;
		},
		onProgress?: (message: WorkerMessage) => void
	): Promise<WorkerResultMessage> {
		if (input.contents.length < 2) {
			throw new Error("At least two objects are required for an NCD comparison");
		}
		const contentSizes = input.contents.map((content) => new TextEncoder().encode(content).length);
		const sortedSizes = [...contentSizes].sort((a, b) => b - a);
		CompressionService.selectCompression(input.algorithm, sortedSizes[0], sortedSizes[1]);
		const totalSize = contentSizes.reduce((sum, size) => sum + size, 0);
		
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
				return new Worker(
					new URL("../workers/lzmaWorker.ts", import.meta.url),
					{type: "module", name: "lzma-compression"},
				);
			case "zstd":
				return new Worker(
					new URL("../workers/zstdWorker.ts", import.meta.url),
					{type: "module", name: "zstd-compression"},
				);
			case "gzip":
				return new Worker(
					new URL("../workers/gzipWorker.ts", import.meta.url),
					{type: "module", name: "gzip-compression"},
				);
			case "brotli":
				return new Worker(
					new URL("../workers/brotliWorker.ts", import.meta.url),
					{type: "module", name: "brotli-compression"},
				);
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
			this.worker?.terminate();
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
			if (error instanceof DOMException && error.name === 'AbortError') {
				throw new Error(
					`Compression worker did not become ready within ${Math.ceil(this.initializationTimeout / 1000)} seconds.`
				);
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
			const worker = this.worker;
			if (!worker) {
				reject(new Error("Compression worker is unavailable."));
				return;
			}
			const handleMessage = (e: MessageEvent<WorkerMessage>) => {
				if (e.data.type === "ready") {
					cleanup();
					resolve();
				} else if (e.data.type === "error") {
					cleanup();
					reject(new Error(e.data.message));
				}
			};

			const handleError = (event: ErrorEvent) => {
				event.preventDefault();
				cleanup();
				const detail = event.message?.trim() || "the worker script could not be loaded";
				reject(new Error(`Compression worker failed to start: ${detail}.`));
			};

			const handleMessageError = () => {
				cleanup();
				reject(new Error("Compression worker failed to start because its response could not be decoded."));
			};
			
			const cleanup = () => {
				worker.removeEventListener("message", handleMessage);
				worker.removeEventListener("error", handleError);
				worker.removeEventListener("messageerror", handleMessageError);
				signal.removeEventListener("abort", handleAbort);
			};
			
			const handleAbort = () => {
				cleanup();
				reject(new DOMException("Aborted", "AbortError"));
			};
			
			worker.addEventListener("message", handleMessage);
			worker.addEventListener("error", handleError);
			worker.addEventListener("messageerror", handleMessageError);
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
		input: NCDInput & {algorithm: CompressionAlgorithm},
		onProgress?: (message: WorkerMessage) => void
	): Promise<WorkerResultMessage> {
		return new Promise((resolve, reject) => {
			const worker = this.worker;
			if (!worker) {
				reject(new Error("Compression worker is unavailable."));
				return;
			}
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

			const handleError = (event: ErrorEvent) => {
				event.preventDefault();
				cleanup();
				if (this.worker === worker) this.terminate();
				else worker.terminate();
				const detail = event.message?.trim() || "the worker stopped unexpectedly";
				reject(new Error(`Compression worker failed during computation: ${detail}.`));
			};

			const handleMessageError = () => {
				cleanup();
				if (this.worker === worker) this.terminate();
				else worker.terminate();
				reject(new Error("Compression worker returned a response that could not be decoded."));
			};
			
			const cleanup = () => {
				worker.removeEventListener("message", handleMessage);
				worker.removeEventListener("error", handleError);
				worker.removeEventListener("messageerror", handleMessageError);
			};
			
			worker.addEventListener("message", handleMessage);
			worker.addEventListener("error", handleError);
			worker.addEventListener("messageerror", handleMessageError);
			worker.postMessage(input);
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
