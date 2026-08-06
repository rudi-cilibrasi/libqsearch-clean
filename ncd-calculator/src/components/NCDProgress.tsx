import {Loader} from 'lucide-react';
import type {CompressionStats} from "@/types/ncd";

export const NCDProgress = ({stats}: { stats: CompressionStats }) => {
    const getPercentComplete = () => {
        if (stats.totalPairs === 0) return 0;
        const percent = (stats.processedPairs / stats.totalPairs) * 100;
        return Math.min(Number(percent.toFixed(1)), 100);
    };

    const formatProcessingRate = () => {
        if (!stats.startTime || !stats.bytesProcessed) return '0 B/s';
        const elapsedSeconds = (performance.now() - stats.startTime) / 1000;
        const bytesPerSecond = stats.bytesProcessed / elapsedSeconds;

        if (bytesPerSecond >= 1024 * 1024) {
            return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
        } else if (bytesPerSecond >= 1024) {
            return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
        }
        return `${Math.round(bytesPerSecond)} B/s`;
    };

    return (
        <div className="ncd-progress">
            <Loader className="ncd-progress__spinner" size={19} aria-hidden="true"/>
            <strong>{getPercentComplete()}% complete</strong>
            <span>{stats.processedPairs}/{stats.totalPairs} pairs</span>
            <code>{formatProcessingRate()}</code>
            {stats.currentPair && stats.lastNcdScore !== null && (
                <code>Current: ({stats.currentPair[0]},{stats.currentPair[1]}) = {stats.lastNcdScore.toFixed(4)}</code>
            )}
        </div>
    );
};
