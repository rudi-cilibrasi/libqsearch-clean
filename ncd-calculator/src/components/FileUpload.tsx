import React, { useCallback, useState } from "react";
import { getFastaInfoFromFile, isFasta } from "../functions/fasta";
import { FILE_UPLOAD } from "../constants/modalConstants";
import { FileSearch, Upload } from "lucide-react";
import { FileInfo, getFile } from "../functions/file";
import { SelectedItem } from "./InputAccumulator";
import {
  CompressionAlgorithm,
  CompressionService,
  GZIP_MAX_WINDOW,
  LZMA_MAX_WINDOW,
  ZSTD_MAX_WINDOW,
} from "@/services/CompressionService";

interface FileUploadProps {
  selectedItems: SelectedItem[];
  setSelectedItems: React.Dispatch<React.SetStateAction<SelectedItem[]>>;
}

interface CompressionAlgorithmInfo {
  name: string;
  label: string;
  description: string;
  maxFileSize: number;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  selectedItems,
  setSelectedItems,
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [selectedCompression, setSelectedCompression] =
    useState<CompressionAlgorithm>("gzip");
  const [effectiveAlgorithm, setEffectiveAlgorithm] =
    useState<CompressionAlgorithm>("gzip");

  const compressionAlgorithms: CompressionAlgorithmInfo[] = [
    {
      name: "auto",
      label: "Auto-select",
      description: "Automatically choose best algorithm based on file size",
      maxFileSize: Infinity,
    },
    {
      name: "gzip",
      label: "GZIP",
      description: "Fast compression, best for files ≤16KB",
      maxFileSize: GZIP_MAX_WINDOW,
    },
    {
      name: "lzma",
      label: "LZMA",
      description: "Better compression ratio, handles larger files",
      maxFileSize: LZMA_MAX_WINDOW,
    },
    {
      name: "zstd",
      label: "ZSTD",
      description: "Balanced compression, best for files ≤100MB",
      maxFileSize: ZSTD_MAX_WINDOW,
    },
  ];
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFileContent = async (
    fileInfo: FileInfo
  ): Promise<{
    content: string;
  }> => {
    const content =
      typeof fileInfo.content === "string" ? fileInfo.content : "";
    return { content };
  };

  const getFileItem = async (fileInfo: FileInfo): Promise<SelectedItem> => {
    const content =
      typeof fileInfo.content === "string" ? fileInfo.content : "";
    const name = fileInfo.name || "unnamed";

    if (isFasta({ ...fileInfo, content, name })) {
      return getFastaInfoFromFile({ ...fileInfo, content, name });
    } else {
      const processed = await processFileContent(fileInfo);
      return {
        type: FILE_UPLOAD,
        content: processed.content,
        label: name,
        id: name,
      };
    }
  };

  const determineEffectiveAlgorithm = useCallback(
    (fileInfos: FileInfo[]): CompressionAlgorithm => {
      const sizes = fileInfos.map((file) => {
        let content = "";
        if (typeof file.content === "string") {
          content = file.content;
        }
        return new TextEncoder().encode(content).length;
      });
      const sortedSizes = [...sizes].sort((a, b) => b - a);
      const size1 = sortedSizes[0];
      const size2 = sortedSizes[1];
      const decision = CompressionService.needsAdvancedCompression(
        size1,
        size2
      );
      return decision.recommendedAlgo;
    },
    [selectedCompression]
  );

  const handleFiles = useCallback(
    async (files: File[]) => {
      const fileInfos = await Promise.all(files.map((file) => getFile(file)));
      const algorithm = determineEffectiveAlgorithm(fileInfos);
      setEffectiveAlgorithm(algorithm);

      const newItems = await Promise.all(
        fileInfos.map(async (file) => getFileItem(file))
      );

      const uniqueNewItems = newItems.filter(
        (item) => !selectedItems.find((selected) => selected.id === item.id)
      );

      setSelectedItems((prev) => [...prev, ...uniqueNewItems]);
    },
    [selectedItems, determineEffectiveAlgorithm]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      await handleFiles(files);
    },
    [handleFiles]
  );

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    await handleFiles(files);
  };

  const getStatusBadge = () => {
    if (selectedCompression === "auto") {
      return (
        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
          Auto-selected
        </span>
      );
    }
    if (selectedCompression === "gzip" && effectiveAlgorithm === "lzma") {
      return (
        <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">
          Switched to LZMA due to file size
        </span>
      );
    }
    return null;
  };

  return (
    <div className="h-full flex flex-col p-4">
      <div className="mb-2">
        <div className="p-3 bg-white rounded-xl border border-gray-200">
          <label className="block font-medium text-gray-700 mb-1 text-sm">
            NCD Compression Settings
          </label>
          <select
            value={selectedCompression}
            onChange={(e) => setSelectedCompression(e.target.value)}
            className="w-full p-2 border border-gray-200 rounded-lg text-sm
              bg-white text-gray-700"
          >
            {compressionAlgorithms.map((algo) => (
              <option key={algo.name} value={algo.name}>
                {algo.label} - {algo.description}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1">
        <div
          className={`border-2 border-dashed rounded-xl transition-all flex flex-col items-center justify-center p-4 h-full
            ${
              isDragging
                ? "border-blue-400 bg-blue-50"
                : "border-gray-300 hover:border-blue-300 hover:bg-gray-50"
            }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2 max-w-lg mb-4">
            <FileSearch
              className="text-blue-600 flex-shrink-0 mt-1"
              size={20}
            />
            <div className="space-y-2">
              <div>
                <h3 className="text-blue-800 font-medium text-sm mb-1">
                  Discover File Similarities! ✨
                </h3>
                <p className="text-blue-800 text-xs leading-relaxed">
                  Upload any files and watch as we reveal their hidden
                  connections. Perfect for:
                </p>
              </div>

              <ul className="text-xs text-blue-700 space-y-0.5">
                <li className="flex items-center gap-1">
                  📝 Text & Documents - Compare versions or find patterns
                </li>
                <li className="flex items-center gap-1">
                  💻 Source Code - Detect similar implementations
                </li>
                <li className="flex items-center gap-1">
                  🧬 Research Data - Analyze relationships
                </li>
                <li className="flex items-center gap-1">
                  🎵 Media Files - Find similar content
                </li>
              </ul>

              <div className="pt-1">
                <p className="text-blue-600 text-xs font-medium flex items-center gap-2">
                  Using: {effectiveAlgorithm.toUpperCase()} {getStatusBadge()}
                </p>
              </div>
            </div>
          </div>

          <Upload
            size={32}
            className={`mb-2 ${isDragging ? "text-blue-500" : "text-gray-400"}`}
          />
          <p className="text-center mb-2 text-gray-600 text-sm">
            Drag and drop your files here
          </p>
          <label className="cursor-pointer">
            <span className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-200 transition-colors inline-flex items-center gap-2">
              <Upload size={16} />
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

export default FileUpload;
