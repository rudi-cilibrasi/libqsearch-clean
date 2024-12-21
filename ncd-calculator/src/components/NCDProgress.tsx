import { Loader } from 'lucide-react';
import {CompressionStats} from "@/types/ncd.ts";

export const NCDProgress = ({ stats }: { stats: CompressionStats }) => {
    const getPercentComplete = () => {
        if (stats.totalPairs === 0) return 0;
        const percent = (stats.processedPairs / stats.totalPairs) * 100;
        return Math.min(Number(percent.toFixed(1)), 100);
    };

    const formatProcessingRate = () => {
        if (!stats.startTime || !stats.bytesProcessed ) return '0 B/s';
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
        <div className="flex items-center gap-3 text-sm">
            <Loader className="animate-spin text-blue-500" size={20} />
            <span className="font-medium text-gray-700">
        {getPercentComplete()}% Complete
      </span>
            <span className="text-gray-500">
        ({stats.processedPairs}/{stats.totalPairs} pairs)
      </span>
            <span className="font-mono text-blue-600">
        {formatProcessingRate()}
      </span>
            {stats.currentPair && stats.lastNcdScore !== null && (
                <span className="font-mono text-gray-500">
          Current: ({stats.currentPair[0]},{stats.currentPair[1]}) = {stats.lastNcdScore.toFixed(4)}
        </span>
            )}
        </div>
    );
};
