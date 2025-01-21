import React, { useCallback, useState, useRef } from "react";
import { getFastaInfoFromFile, isFasta } from "../functions/fasta";
import { FILE_UPLOAD } from "../constants/modalConstants";
import {
  Upload,
  FileSearch,
  AlertCircle,
  Files,
  FileText,
  FileCode,
  FileDigit,
  FileAudio,
  Info
} from "lucide-react";
import { FileInfo, getFile } from "../functions/file";
import { SelectedItem } from "./InputHolder.tsx";
import {
  CompressionService,
  type CompressionAlgorithm,
  type CompressionResponse,
} from "@/services/CompressionService";

interface FileUploadProps {
  selectedItems: SelectedItem[];
  setSelectedItems: React.Dispatch<React.SetStateAction<SelectedItem[]>>;
}

// Maximum size for NCD computation with ZSTD compression level 22
const MAX_COMBINED_SIZE = 128 * 1024 * 1024; // 128MB

export const FileUpload: React.FC<FileUploadProps> = ({
                                                        selectedItems,
                                                        setSelectedItems,
                                                      }) => {
  // Component state management
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [selectedCompression, setSelectedCompression] = useState<CompressionAlgorithm | "auto">("auto");
  const [effectiveAlgorithm, setEffectiveAlgorithm] = useState<CompressionResponse | null>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const compressionServiceRef = useRef(CompressionService.getInstance());

  // Define available compression algorithms
  const availableAlgorithms = [
    {
      value: "auto",
      label: "Auto-select",
      description: "Automatically choose best algorithm based on file size",
    },
    ...CompressionService.getAvailableAlgorithms().map((algo) => {
      const info = CompressionService.getAlgorithmInfo(algo);
      return {
        value: algo,
        label: algo.toUpperCase(),
        description: info.description,
      };
    }),
  ];

  // Drag and drop event handlers
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  // Utility function to get file size in bytes
  const getFileSize = (content: string): number => {
    return new TextEncoder().encode(content).length;
  };

  // Validate file size combinations for NCD computation
  const validateFileSizeCombinations = (newFiles: FileInfo[]): boolean => {
    const newFileSizes = newFiles.map(file =>
        getFileSize(typeof file.content === "string" ? file.content : "")
    );

    // Check combinations with existing files
    for (const newSize of newFileSizes) {
      for (const existingItem of selectedItems) {
        const existingSize = getFileSize(existingItem.content);
        const combinedSize = newSize + existingSize;

        if (combinedSize > MAX_COMBINED_SIZE) {
          setSizeError(
              `Cannot add file: Combined size with existing file "${existingItem.label}" ` +
              `would be ${(combinedSize / (1024 * 1024)).toFixed(2)}MB, exceeding the 128MB limit`
          );
          return false;
        }
      }

      // Check combinations with other new files
      for (const otherNewSize of newFileSizes) {
        if (newSize !== otherNewSize) {
          const combinedSize = newSize + otherNewSize;
          if (combinedSize > MAX_COMBINED_SIZE) {
            setSizeError(
                `Cannot add files: Combined size of ${(combinedSize / (1024 * 1024)).toFixed(2)}MB ` +
                `exceeds the 128MB limit`
            );
            return false;
          }
        }
      }
    }

    setSizeError(null);
    return true;
  };

  // Process file content
  const processFileContent = async (fileInfo: FileInfo): Promise<{ content: string }> => {
    const content = typeof fileInfo.content === "string" ? fileInfo.content : "";
    return { content };
  };

  // Get file item with appropriate processing
  const getFileItem = async (fileInfo: FileInfo): Promise<SelectedItem> => {
    const content = typeof fileInfo.content === "string" ? fileInfo.content : "";
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

  // Determine appropriate compression algorithm
  const determineEffectiveAlgorithm = useCallback(
      (fileInfos: FileInfo[]): CompressionResponse => {
        if (selectedCompression !== "auto") {
          return {
            algorithm: selectedCompression,
            reason: CompressionService.getAlgorithmInfo(selectedCompression).description,
          };
        }

        const sizes = fileInfos.map((file) => {
          const content = typeof file.content === "string" ? file.content : "";
          return new TextEncoder().encode(content).length;
        });
        const sortedSizes = [...sizes].sort((a, b) => b - a);
        return CompressionService.needsAdvancedCompression(sortedSizes[0], sortedSizes[1]);
      },
      [selectedCompression]
  );

  // Handle file selection and processing
  const handleFiles = useCallback(
      async (files: File[]) => {
        try {
          const fileInfos = await Promise.all(files.map((file) => getFile(file)));

          if (!validateFileSizeCombinations(fileInfos)) {
            return;
          }

          const compressionDecision = determineEffectiveAlgorithm(fileInfos);
          setEffectiveAlgorithm(compressionDecision);

          await compressionServiceRef.current.initialize(compressionDecision.algorithm);

          const newItems = await Promise.all(
              fileInfos.map(async (file) => getFileItem(file))
          );

          const uniqueNewItems = newItems.filter(
              (item) => !selectedItems.find((selected) => selected.id === item.id)
          );

          setSelectedItems((prev) => [...prev, ...uniqueNewItems]);
        } catch (error) {
          console.error("Error processing files:", error);
          setSizeError(error instanceof Error ? error.message : "Unknown error processing files");
        }
      },
      [selectedItems, determineEffectiveAlgorithm]
  );

  // Handle file drop event
  const handleDrop = useCallback(
      async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        await handleFiles(files);
      },
      [handleFiles]
  );

  // Handle file input change
  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    await handleFiles(files);
  };

  // Get status badge for compression algorithm
  const getStatusBadge = () => {
    if (!effectiveAlgorithm) return null;

    if (selectedCompression === "auto") {
      return (
          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">
          Auto-selected
        </span>
      );
    }

    if (selectedCompression !== effectiveAlgorithm.algorithm) {
      return (
          <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-xs">
          Switched to {effectiveAlgorithm.algorithm.toUpperCase()}
        </span>
      );
    }

    return null;
  };

  return (
      <div className="min-h-0 flex flex-col p-4 gap-4">
        {/* Compression Settings Section */}
        <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Files className="h-5 w-5 text-gray-600" />
            <label className="font-medium text-gray-700 text-sm">
              NCD Compression Settings
            </label>
          </div>
          <select
              value={selectedCompression}
              onChange={(e) =>
                  setSelectedCompression(e.target.value as CompressionAlgorithm | "auto")
              }
              className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700"
          >
            {availableAlgorithms.map((algo) => (
                <option key={algo.value} value={algo.value}>
                  {algo.label} - {algo.description}
                </option>
            ))}
          </select>
        </div>

        {/* Error Message Section */}
        {sizeError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{sizeError}</p>
            </div>
        )}

        {/* File Upload Area */}
        <div className="flex-1 min-h-0">
          <div
              className={`border-2 border-dashed rounded-xl transition-all flex flex-col items-center justify-center p-6 min-h-[400px]
            ${isDragging
                  ? "border-blue-400 bg-blue-50"
                  : "border-gray-300 hover:border-blue-300 hover:bg-gray-50"
              }
            ${sizeError ? "border-red-300" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
          >
            {/* Information Box */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4 max-w-lg">
              <div className="flex items-start gap-2">
                <FileSearch className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <div>
                    <h3 className="text-blue-800 font-medium text-sm">
                      Discover File Similarities! ✨
                    </h3>
                    <p className="text-blue-700 text-xs mt-1 leading-relaxed">
                      Upload any files and watch as we reveal their hidden connections.
                      Perfect for:
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-blue-700">
                      <FileText className="h-3.5 w-3.5" />
                      Text & Documents - Compare versions or find patterns
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-blue-700">
                      <FileCode className="h-3.5 w-3.5" />
                      Source Code - Detect similar implementations
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-blue-700">
                      <FileDigit className="h-3.5 w-3.5" />
                      Research Data - Analyze relationships
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-blue-700">
                      <FileAudio className="h-3.5 w-3.5" />
                      Media Files - Find similar content
                    </div>
                  </div>

                  {effectiveAlgorithm && (
                      <div className="flex items-center gap-2 pt-1 text-xs font-medium text-blue-700">
                        <Info className="h-3.5 w-3.5" />
                        Using: {effectiveAlgorithm.algorithm.toUpperCase()}
                        {getStatusBadge()}
                      </div>
                  )}
                </div>
              </div>
            </div>

            {/* Upload Controls */}
            <Upload
                className={`h-10 w-10 mb-3 ${
                    isDragging ? "text-blue-500" : "text-gray-400"
                }`}
            />
            <p className="text-center mb-3 text-gray-600 text-sm">
              Drag and drop your files here
            </p>

            <label className="cursor-pointer">
              <div className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-200 transition-colors inline-flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Browse Files
              </div>
              <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileInput}
              />
            </label>

            {/* Size Limit Information */}
            <div className="mt-3 text-center space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-xs text-gray-600">
                <Info className="h-3.5 w-3.5" />
                <span>Max combined size: 128MB</span>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
};

export default FileUpload;