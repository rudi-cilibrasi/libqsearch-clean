import { FC } from 'react';

const NCDMatrixInfo: FC = () => {
    return (
        <div className="flex items-center gap-6 bg-slate-50 rounded-lg p-3 mb-4 text-sm">
            <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                <span className="text-gray-700">0 = identical</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                <span className="text-gray-700">1 = different</span>
            </div>
            <div className="text-gray-500 text-xs border-l border-gray-200 pl-4">
                Diagonal shows self-comparison (0)
            </div>
        </div>
    );
};

export default NCDMatrixInfo;