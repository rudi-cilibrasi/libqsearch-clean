import React from "react";
import { Dna, FileType2, Globe2, X } from "lucide-react";
import { FASTA, LANGUAGE, FILE_UPLOAD } from "../constants/modalConstants";

export interface SelectedItem {
  id: string;
  label: string;
  content: string | undefined;
  type: typeof FASTA | typeof LANGUAGE | typeof FILE_UPLOAD;
}

export interface InputAccumulatorProps {
  MIN_ITEMS?: number;
  selectedItems: SelectedItem[];
  onRemoveItem: (id: string) => void;
  authenticated?: boolean;
}

export const InputAccumulator: React.FC<InputAccumulatorProps> = ({
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
          <div className="flex items-center gap-3">
            <Dna size={18} className="text-blue-500" />
            <span className="text-gray-600">{item.label}</span>
          </div>
        );
      case LANGUAGE:
        return (
          <div className="flex items-center gap-3">
            <Globe2 size={18} className="text-blue-500" />
            <span className="text-gray-600">{item.label}</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-3">
            <FileType2 size={18} className="text-blue-500" />
            <span className="text-gray-600">{item.label}</span>
          </div>
        );
    }
  };

  return (
    <div className="w-1/2 h-[600px] border border-gray-200 rounded-xl bg-white overflow-hidden flex flex-col">
      <div className="p-6 border-b border-gray-200">
        {!authenticated && selectedItems.length > 8 && (
          <p className="text-sm text-red-500">
            Please log in to increase your item selection limit (maximum 8).
          </p>
        )}
        <h3 className="text-lg font-bold text-gray-900">
          Selected Items ({selectedItems.length}/{MIN_ITEMS} minimum)
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-2">
          {selectedItems.map((item) => (
            <div
              key={item.id}
              className="flex justify-between items-center p-4 rounded-lg bg-gray-50 border border-gray-200"
            >
              {renderItemWithIcon(item, item.type)}
              <X
                size={18}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
                onClick={() => onRemoveItem(item.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};