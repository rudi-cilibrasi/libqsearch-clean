// zstdWorker.ts
/// <reference lib="webworker" />

declare const self: DedicatedWorkerGlobalScope;
import {calculateCRC32, encodeText, getPairFileConcatenated, processChunk} from './shared/utils';
import {NCDInput, WorkerErrorMessage, WorkerReadyMessage, WorkerResultMessage, WorkerStartMessage} from "@/types/ncd";

// ZSTD Configuration Constants
const ZSTD_CONFIG = {
	COMPRESSION_LEVEL: 22, // Maximum compression level
	MAX_DICT_SIZE: 0 // Will be set during initialization
} as const;

let wasmModule: any = null;

function getMaxDictSizeForLevel(module: any, level: number): number {
	const getWindowSize = module.cwrap('ZSTD_getWindowSize', 'number', ['number', 'number']);
	const testSizes = [1024 * 1024, 16 * 1024 * 1024, 64 * 1024 * 1024, 256 * 1024 * 1024, 1024 * 1024 * 1024];
	
	let lastSize = 0;
	let maxDictSize = 0;
	
	for (const size of testSizes) {
		const dictSize = getWindowSize(level, size);
		if (dictSize === lastSize) break;
		maxDictSize = dictSize;
		lastSize = dictSize;
	}
	
	return maxDictSize;
}

function logCompressionConfig(module: any) {
	const maxDictSize = getMaxDictSizeForLevel(module, ZSTD_CONFIG.COMPRESSION_LEVEL);
	console.log('\nZSTD Maximum Compression Configuration:');
	console.log(`Compression level: ${ZSTD_CONFIG.COMPRESSION_LEVEL}`);
	console.log(`Maximum dictionary size: ${(maxDictSize / (1024 * 1024)).toFixed(2)} MB (${maxDictSize} bytes)`);
	ZSTD_CONFIG.MAX_DICT_SIZE = maxDictSize;
}

async function compressWithZSTD(data: Uint8Array): Promise<number> {
	if (!wasmModule) throw new Error('WASM module not initialized');
	
	const compressWithInfo = wasmModule.cwrap('ZSTD_compressWithInfo', 'number',
		['number', 'number', 'number', 'number', 'number', 'number', 'number']);
	
	const inSize = data.length;
	const maxSize = wasmModule._ZSTD_compressBound(inSize);
	
	const inPtr = wasmModule._malloc(inSize);
	const outPtr = wasmModule._malloc(maxSize);
	const windowSizePtr = wasmModule._malloc(8);
	const windowLogPtr = wasmModule._malloc(4);
	
	wasmModule.HEAPU8.set(data, inPtr);
	
	try {
		const compressedSize = compressWithInfo(
			outPtr, maxSize,
			inPtr, inSize,
			ZSTD_CONFIG.COMPRESSION_LEVEL,
			windowSizePtr,
			windowLogPtr
		);
		
		if (compressedSize < 0) {
			throw new Error(`ZSTD compression failed with code ${compressedSize}`);
		}
		
		// In development, we can still log but without relying on process.env
		// Using a simple constant or import.meta for feature detection
		const isDevelopment = import.meta.env?.MODE === 'development';
		if (isDevelopment) {
			const windowSize = wasmModule.HEAPU32[windowSizePtr / 4];
			console.log('\nCompression Results:');
			console.log(`Input size: ${inSize} bytes`);
			console.log(`Compressed size: ${compressedSize} bytes`);
			console.log(`Dictionary size: ${(windowSize / (1024 * 1024)).toFixed(2)} MB`);
		}
		
		return compressedSize;
	} finally {
		wasmModule._free(inPtr);
		wasmModule._free(outPtr);
		wasmModule._free(windowSizePtr);
		wasmModule._free(windowLogPtr);
	}
}

async function compressedSizeSingle(str: string): Promise<number> {
	const encoded = encodeText(str);
	return await compressWithZSTD(encoded);
}

async function getCompressedPairSize(str1: string, str2: string): Promise<number> {
	const arr: Uint8Array = await getPairFileConcatenated(str1, str2);
	return await compressWithZSTD(arr);
}

async function handleMessage(event: MessageEvent<NCDInput>) {
	try {
		const {labels, contents, cachedSizes} = event.data;
		
		if (!labels?.length || !contents?.length) {
			throw new Error('Invalid input data');
		}
		
		const n = contents.length;
		const totalPairs = (n * (n - 1)) / 2;
		
		self.postMessage({
			type: 'start',
			totalItems: n,
			totalPairs
		} as WorkerStartMessage);
		
		const singleCompressedSizes = new Array(n);
		const ncdMatrix = Array.from({length: n}, () => Array(n).fill(0));
		
		for (let i = 0; i < n; i++) {
			const encoded = encodeText(contents[i]);
			const crc = calculateCRC32(encoded);
			const key = `zstd:${crc}`;
			const cached = cachedSizes?.get(key);
			
			if (cached) {
				singleCompressedSizes[i] = cached;
			} else {
				singleCompressedSizes[i] = await compressedSizeSingle(contents[i]);
			}
		}
		
		const CHUNK_SIZE = 5;
		const allResults = [];
		
		for (let i = 0; i < n; i += CHUNK_SIZE) {
			const endI = Math.min(i + CHUNK_SIZE, n);
			const chunkResults = await processChunk(
				i, endI, n, contents,
				singleCompressedSizes,
				'zstd',
				cachedSizes,
				getCompressedPairSize,
				self
			);
			
			allResults.push(...chunkResults);
			
			for (const {i, j, ncd} of chunkResults) {
				ncdMatrix[i][j] = ncd;
				ncdMatrix[j][i] = ncd;
			}
		}
		
		self.postMessage({
			type: 'result',
			labels,
			ncdMatrix,
			newCompressionData: allResults.map(result => ({
				key1: result.key1,
				key2: result.key2,
				size1: result.size1,
				size2: result.size2,
				combinedSize: result.combinedSize
			}))
		} as WorkerResultMessage);
		
	} catch (error) {
		self.postMessage({
			type: 'error',
			message: `ZSTD Worker error: ${error instanceof Error ? error.message : 'Unknown error'}`
		} as WorkerErrorMessage);
	}
}

async function loadWasmBinary(): Promise<ArrayBuffer> {
	// Check if we're in a browser environment (window is defined) or Node.js
	const isBrowser = typeof window !== 'undefined' && typeof window.fetch === 'function';
	try {
		if (isBrowser) {
			// Browser environment - use fetch API
			const response = await fetch(new URL('../wasm/zstd.wasm', import.meta.url));
			if (!response.ok) {
				throw new Error(`Failed to fetch WASM: ${response.status} ${response.statusText}`);
			}
			return await response.arrayBuffer();
		} else {
			// Node.js environment - use fs module
			// We need to use dynamic import for fs promises to avoid issues in the browser
			const fs = await import('fs/promises');
			const path = await import('path');
			
			// Convert import.meta.url to a file path
			// In Node.js, import.meta.url is something like 'file:///path/to/current/file.js'
			const fileUrl = new URL(import.meta.url);
			const currentFilePath = fileUrl.pathname;
			const normalizedPath = process.platform === 'win32'
				? currentFilePath.substring(1)
				: currentFilePath;
			
			const wasmPath = path.resolve(
				path.dirname(normalizedPath),
				'../wasm/zstd.wasm'
			);
			
			const wasmBinary = await fs.readFile(wasmPath);
			
			return wasmBinary.buffer.slice(
				wasmBinary.byteOffset,
				wasmBinary.byteOffset + wasmBinary.byteLength
			);
		}
	} catch (error) {
		console.error('Failed to load WASM binary:', error);
		console.error('Current location:', import.meta.url);
		throw error;
	}
}

(async function initializeWorker() {
	try {
		const ZSTDModule = await import('../wasm/zstd.js');
		const wasmBinary = await loadWasmBinary();
		console.log('WASM binary loaded, size:', wasmBinary.byteLength);
		
		wasmModule = await ZSTDModule.default({
			wasmBinary,
			locateFile: (path: string) => {
				if (path.endsWith('.wasm')) {
					return new URL('../wasm/zstd.wasm', import.meta.url).href;
				}
				return path;
			}
		});
		
		logCompressionConfig(wasmModule);
		self.postMessage({
			type: 'ready',
			message: `ZSTD Worker initialized with level ${ZSTD_CONFIG.COMPRESSION_LEVEL}`
		} as WorkerReadyMessage);
		
		self.onmessage = handleMessage;
	} catch (error) {
		console.error('WASM initialization error:', error);
		if (error instanceof Error) {
			console.error('Error message:', error.message);
			console.error('Error stack:', error.stack);
		}
		self.postMessage({
			type: 'error',
			message: error instanceof Error
				? `Failed to initialize ZSTD module: ${error.message}`
				: 'Unknown initialization error'
		} as WorkerErrorMessage);
	}
})();

export type {};
