import React from "react";
import {Dna, FileType2, Globe2, X} from "lucide-react";
import {FASTA, FILE_UPLOAD, LANGUAGE} from "../constants/modalConstants";

export interface SelectedItem {
  id: string | undefined;
  label: string | undefined;
  content: string | undefined;
  type: typeof FASTA | typeof LANGUAGE | typeof FILE_UPLOAD;
  cacheKey?: string;
}

export interface InputAccumulatorProps {
  MIN_ITEMS?: number;
  selectedItems: SelectedItem[];
  onRemoveItem: (id: string | undefined) => void;
  authenticated?: boolean;
}

export const InputHolder: React.FC<InputAccumulatorProps> = ({
  MIN_ITEMS = 4,
  selectedItems,
  onRemoveItem,
  authenticated,
}) => {
  const renderItemWithIcon = (
    item: SelectedItem,
    type: typeof FASTA | typeof LANGUAGE | typeof FILE_UPLOAD
  ) => {
    switch (type) {
      case FASTA:
        return (
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Dna size={16} className="text-blue-400 flex-shrink-0 sm:w-[18px] sm:h-[18px]" />
            <span className="text-gray-200 text-sm sm:text-base truncate">{item.label}</span>
          </div>
        );
      case LANGUAGE:
        return (
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Globe2 size={16} className="text-blue-400 flex-shrink-0 sm:w-[18px] sm:h-[18px]" />
            <span className="text-gray-200 text-sm sm:text-base truncate">{item.label}</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <FileType2 size={16} className="text-blue-400 flex-shrink-0 sm:w-[18px] sm:h-[18px]" />
            <span className="text-gray-200 text-sm sm:text-base truncate">{item.label}</span>
          </div>
        );
    }
  };
    const items = Array.isArray(selectedItems) ? selectedItems : [];
    return (
        <div className="w-full lg:w-1/2 h-[400px] sm:h-[500px] lg:h-[600px] border border-gray-600 rounded-xl bg-gray-800 overflow-hidden flex flex-col shadow-lg">
            <div className="p-4 sm:p-6 border-b border-gray-600 flex-shrink-0">
                {!authenticated && items.length > 16 && (
                    <div className="mb-3 p-2 bg-red-900/50 border border-red-700 rounded-md">
                        <p className="text-xs sm:text-sm text-red-300">
                            Please log in to increase your item selection limit (maximum 16).
                        </p>
                    </div>
                )}
                <h3 className="text-base sm:text-lg font-bold text-gray-100">
                    Selected Items ({items.length}/{MIN_ITEMS} minimum)
                </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <div className="text-center space-y-2">
                            <p className="text-sm sm:text-base">No items selected yet</p>
                            <p className="text-xs sm:text-sm text-gray-500">
                                Add items from the panel on the left to get started
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2 sm:gap-3">
                        {items.map((item, index) => (
                            <div
                                key={item.id || index}
                                className="flex justify-between items-center p-3 sm:p-4 rounded-lg bg-gray-700 border border-gray-600 hover:bg-gray-650 hover:border-gray-500 transition-colors"
                            >
                                <div className="flex-1 min-w-0">
                                    {renderItemWithIcon(item, item.type)}
                                </div>
                                <button
                                    onClick={() => onRemoveItem(item.id)}
                                    className="ml-3 p-1 rounded-full hover:bg-gray-600 transition-colors flex-shrink-0"
                                    aria-label="Remove item"
                                >
                                    <X size={16} className="text-gray-400 hover:text-gray-200" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
