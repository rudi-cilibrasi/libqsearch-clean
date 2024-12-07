import React, { useCallback, useState } from "react";
import {
  getCleanSequence,
  getFastaInfoFromFile,
  hasMetadata,
  isFasta,
  parseMetadata,
} from "../functions/fasta";
import { FILE_UPLOAD } from "../constants/modalConstants";
import { Info, Upload } from "lucide-react";
import { FileInfo, getFile } from "../functions/file";
import { SelectedItem } from "./InputAccumulator";


interface FileUploadProps {
  addItem: (item: SelectedItem) => void;
  selectedItems: SelectedItem[];
  setSelectedItems: React.Dispatch<React.SetStateAction<SelectedItem[]>>;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  selectedItems,
  setSelectedItems,
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      const fileInfos = await Promise.all(
        files.map(async (file) => await getFile(file))
      );
      const newItems = fileInfos
        .map((file) => getFileItem(file))
        .filter(
          (item) => !selectedItems.find((selected) => selected.id === item.id)
        );
      setSelectedItems((prev) => [...prev, ...newItems]);
    },
    [selectedItems]
  );

  const getFileItem = (fileInfo: FileInfo): SelectedItem => {
    const content = typeof fileInfo.content === 'string' ? fileInfo.content : '';
    const name = fileInfo.name || 'unnamed';
    
    if (isFasta({ ...fileInfo, content, name: fileInfo.name || 'unnamed' })) {
      return getFastaInfoFromFile({ ...fileInfo, content, name: fileInfo.name || 'unnamed' });
    } else {
      return {
        type: FILE_UPLOAD,
        content,
        label: name,
        id: name,
      };
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const files = Array.from(e.target.files);
    const readyFiles = await Promise.all(files.map((file) => getFile(file)));
    const newItems = readyFiles
      .map((file) => getFileItem(file))
      .filter(
        (item) => !selectedItems.find((selected) => selected.id === item.id)
      );
    setSelectedItems((prev) => [...prev, ...newItems]);
  };

  return (
    <div className="h-full flex flex-col justify-center p-4">
      <div
        className={`border-2 border-dashed rounded-xl transition-all flex flex-col items-center justify-center p-8
                    ${
                      isDragging
                        ? "border-blue-400 bg-blue-50"
                        : "border-gray-300 hover:border-blue-300 hover:bg-gray-50"
                    }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
          <Info className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
          <p className="m-0 text-blue-800 text-sm leading-relaxed">
            Upload any file to reveal relationships and patterns through
            Normalized Compression Distance (NCD)
          </p>
        </div>
        <Upload
          size={40}
          className={`mb-4 ${isDragging ? "text-blue-500" : "text-gray-400"}`}
        />
        <p className="text-center mb-4 text-gray-600">
          Drag and drop your files here.
          <br />
        </p>
        <label className="cursor-pointer">
          <span className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-200 transition-colors">
            Browse Files
          </span>
          <input
            type="file"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
        </label>
      </div>
    </div>
  );
};
