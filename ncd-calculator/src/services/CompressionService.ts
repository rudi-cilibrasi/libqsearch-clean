import type {NCDInput, WorkerMessage} from "../types/ncd";
import {calculateCRC32} from "@/workers/shared/utils.ts";
import {CRCCache, CRCCacheEntry} from "@/cache/CRCCache.ts";

export type CompressionAlgorithm = "lzma" | "zstd";

export interface CompressionResponse {
	algorithm: CompressionAlgorithm;
	reason: string;
}

export class CompressionService {
	private static instance: CompressionService;
	private static readonly MAX_SIZES = {
		lzma: 2 * 1024 * 1024, // 2MB maximum for LZMA
		zstd: 128 * 1024 * 1024, // 128MB maximum for ZSTD
	} as const;
	private static readonly ABSOLUTE_MAX_SIZE = 128 * 1024 * 1024; // 128MB
	private static readonly ALGORITHM_DESCRIPTIONS = {
		lzma: "High compression ratio, optimal for files ≤1MB (source code, text).",
		zstd: "Fast compression for files up to 128MB.",
	} as const;
	private worker: Worker | null = null;
	private currentAlgorithm: CompressionAlgorithm | null = null;
	
	private constructor() {
		this.initializeWorker("zstd").catch(console.error);
	}
	
	static getInstance(): CompressionService {
		if (!CompressionService.instance) {
			CompressionService.instance = new CompressionService();
		}
		return CompressionService.instance;
	}
	
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
	
	static preprocessNcdInput = (input: NCDInput, crcCache: CRCCache): [CompressionResponse, Map<string, number>] => {
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
	
	async initialize(algorithm: CompressionAlgorithm = "zstd"): Promise<void> {
		if (this.currentAlgorithm === algorithm && this.worker) {
			return;
		}
		await this.initializeWorker(algorithm);
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
	
	terminate() {
		if (this.worker) {
			this.worker.terminate();
			this.worker = null;
			this.currentAlgorithm = null;
		}
	}
	
	private async initializeWorker(algorithm: CompressionAlgorithm): Promise<void> {
		if (this.worker) {
			this.terminate();
		}
		
		const WorkerModule = await this.loadWorkerModule(algorithm);
		this.worker = new WorkerModule.default();
		this.currentAlgorithm = algorithm;
		
		try {
			await this.waitForWorkerReady();
			console.log(`Worker for algorithm: ${this.currentAlgorithm} is ready`);
		} catch (error) {
			console.error(`Failed to initialize ${algorithm} worker:`, error);
			this.worker = null;
			this.currentAlgorithm = null;
			throw error;
		}
	}
	
	private async loadWorkerModule(algorithm: CompressionAlgorithm) {
		switch (algorithm) {
			case "lzma":
				// @ts-ignore
				return import("../workers/lzmaWorker?worker");
			case "zstd":
				// @ts-ignore
				return import("../workers/zstdWorker?worker");
			default:
				throw new Error(`Unsupported compression algorithm: ${algorithm}`);
		}
	}
	
	private async waitForWorkerReady(): Promise<void> {
		if (!this.worker) {
			throw new Error("No worker initialized");
		}
		
		const abortController = new AbortController();
		const timeoutId = setTimeout(() => abortController.abort(), 10000);
		
		try {
			await this.listenForWorkerReady(abortController.signal);
		} catch (error) {
			console.log(error);
			if (error instanceof DOMException && error.name === 'AbortError') {
				throw new Error("Worker initialization timed out");
			}
			throw error;
		} finally {
			clearTimeout(timeoutId);
		}
	}
	
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
}
