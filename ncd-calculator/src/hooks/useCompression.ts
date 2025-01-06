import { useState, useEffect, useCallback, useRef } from 'react';
import { useNCDCache } from '../hooks/useNCDCache';
import { CompressionStats, WorkerMessage, WorkerResultMessage } from "@/types/ncd";
import { CompressionAlgorithm, CompressionService } from "@/services/CompressionService";
import { CRC32Calculator } from "@/functions/crc32";

interface UseCompressionOptions {
    onProgress?: (stats: CompressionStats) => void;
}

export function useCompression({
                                   onProgress
                               }: UseCompressionOptions = {}) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<CompressionStats>({
        processedPairs: 0,
        totalPairs: 0,
        bytesProcessed: 0,
        startTime: 0,
        currentPair: null,
        lastNcdScore: null,
    });

    const serviceRef = useRef<CompressionService | null>(null);
    const ncdCache = useNCDCache();

    useEffect(() => {
        serviceRef.current = new CompressionService();
        return () => {
            if (serviceRef.current) {
                serviceRef.current.terminate();
            }
        };
    }, []);

    const handleProgress = useCallback((message: WorkerMessage) => {
        switch (message.type) {
            case 'start':
                setStats(prev => ({
                    ...prev,
                    totalPairs: message.totalPairs || 0,
                    startTime: performance.now(),
                    processedPairs: 0,
                    bytesProcessed: 0,
                }));
                break;
            case 'progress':
                if (message.i !== undefined && message.j !== undefined) {
                    setStats(prev => {
                        const newStats = {
                            ...prev,
                            processedPairs: prev.processedPairs + 1,
                            bytesProcessed: prev.bytesProcessed + (message.sizeXY || 0),
                            currentPair: [message.i, message.j] as [number, number],
                            lastNcdScore: message.value || null,
                        };
                        if (onProgress) {
                            onProgress(newStats);
                        }
                        return newStats;
                    });
                }
                break;
        }
    }, [onProgress]);

    const prepareCompression = useCallback((
        contents: string[],
        algorithm: CompressionAlgorithm
    ): Map<string, number> => {
        const cachedSizes = new Map<string, number>();
        const contentBuffers = contents.map(content =>
            new TextEncoder().encode(content)
        );

        // Calculate CRCs for all files
        const fileCRCs = contentBuffers.map(buffer =>
            CRC32Calculator.calculate(buffer)
        );

        // Check individual sizes
        fileCRCs.forEach((crc) => {
            const size = ncdCache.getCompressedSize(algorithm, [crc]);
            if (size !== null) {
                cachedSizes.set(`${algorithm}:${crc}`, size);
            }
        });

        // Check pair sizes
        for (let i = 0; i < fileCRCs.length; i++) {
            for (let j = i + 1; j < fileCRCs.length; j++) {
                const size1 = ncdCache.getCompressedSize(algorithm, [fileCRCs[i]]);
                const size2 = ncdCache.getCompressedSize(algorithm, [fileCRCs[j]]);

                if (size1 !== null && size2 !== null) {
                    const pairSize = ncdCache.getCompressedSize(algorithm,
                        [fileCRCs[i], fileCRCs[j]].sort()
                    );
                    if (pairSize !== null) {
                        const pairKey = `${algorithm}:${[fileCRCs[i], fileCRCs[j]].sort().join('-')}`;
                        cachedSizes.set(pairKey, pairSize);
                    }
                }
            }
        }

        return cachedSizes;
    }, [ncdCache]);

    const processContent = useCallback(async (input: {
        labels: string[];
        contents: string[];
    }) => {
        if (!serviceRef.current) return null;

        try {
            setIsLoading(true);
            setError(null);

            const contentSizes = input.contents.map(content =>
                new TextEncoder().encode(content).length
            );
            const sortedSizes = [...contentSizes].sort((a, b) => b - a);
            const { algorithm, reason } = CompressionService.determineAlgorithm(
                sortedSizes[0],
                sortedSizes[1]
            );

            const cachedSizes = prepareCompression(input.contents, algorithm);

            const result = await serviceRef.current.processContent({
                ...input,
                algorithm,
                cachedSizes: cachedSizes.size > 0 ? cachedSizes : undefined
            }, handleProgress) as WorkerResultMessage;

            // Store new compression data in cache
            if (result.newCompressionData) {
                result.newCompressionData.forEach(data => {
                    ncdCache.storeCompressedSize(algorithm, [data.key1], data.size1);
                    ncdCache.storeCompressedSize(algorithm, [data.key2], data.size2);
                    ncdCache.storeCompressedSize(algorithm,
                        [data.key1, data.key2].sort(),
                        data.combinedSize
                    );
                });
            }

            return {
                result,
                algorithm,
                reason
            };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(errorMessage);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [handleProgress, prepareCompression]);

    const getAvailableAlgorithms = useCallback(() => {
        return CompressionService.getAvailableAlgorithms();
    }, []);

    return {
        processContent,
        getAvailableAlgorithms,
        isLoading,
        error,
        stats
    };
}