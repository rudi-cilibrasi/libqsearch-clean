import React, { useCallback, useState } from "react";
import {
  getFastaInfoFromFile,
  isFasta,

} from "../functions/fasta";
import { FILE_UPLOAD } from "../constants/modalConstants";
import {Info, Settings2, Upload} from "lucide-react";
import { FileInfo, getFile } from "../functions/file";
import { SelectedItem } from "./InputAccumulator";


interface FileUploadProps {
  addItem: (item: SelectedItem) => void;
  selectedItems: SelectedItem[];
  setSelectedItems: React.Dispatch<React.SetStateAction<SelectedItem[]>>;
}

interface CompressionAlgorithm {
  name: string;
  label: string;
  description: string;
  maxFileSize: number
}

export const FileUpload: React.FC<FileUploadProps> = ({
  selectedItems,
  setSelectedItems,
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showAdvancedCompression, setShowAdvancedCompression] = useState(false);
  const [selectedCompression, setSelectedCompression] = useState<string>("auto");

  const compressionAlgorithms: CompressionAlgorithm[] = [
    {
      name: "auto",
      label: "Auto-select",
      description: "Automatically choose best algorithm based on file size",
      maxFileSize: Infinity
    },
    {
      name: "gzip",
      label: "GZIP",
      description: "Fast compression, best for files ≤16KB",
      maxFileSize: 16 * 1024
    },
    {
      name: "lzma",
      label: "LZMA",
      description: "Better compression ratio, handles larger files",
      maxFileSize: 100 * 1024 * 1024
    },
    {
      name: "ppmd",
      label: "PPMD",
      description: "Optimal for text files, best for sequences",
      maxFileSize: 100 * 1024 * 1024
    }
  ];


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
      <div className="h-full flex flex-col p-4">
        {/* Compression settings section */}
        <div className="mb-4">
          <div className="p-4 bg-white rounded-xl border border-gray-200">
            <label className="block font-medium text-gray-700 mb-2">
              NCD Compression Settings
            </label>
            <select
                value={selectedCompression}
                onChange={(e) => setSelectedCompression(e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-lg text-sm
              bg-white text-gray-700"
            >
              {compressionAlgorithms.map(algo => (
                  <option key={algo.name} value={algo.name}>
                    {algo.label} - {algo.description}
                  </option>
              ))}
            </select>
          </div>
        </div>

        {/* File upload area */}
        <div className="flex-1">
          <div
              className={`border-2 border-dashed rounded-xl transition-all flex flex-col items-center justify-center p-8 h-full
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
              <div className="space-y-2">
                <p className="m-0 text-blue-800 text-sm leading-relaxed">
                  Upload any file to reveal relationships and patterns through
                  Normalized Compression Distance (NCD)
                </p>
                <p className="m-0 text-blue-600 text-sm">
                  Using: {compressionAlgorithms.find(a => a.name === selectedCompression)?.label}
                </p>
              </div>
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
      </div>
  );
};
