import React, { useCallback, useState } from "react";
import { getFastaInfoFromFile, isFasta } from "../functions/fasta";
import { FILE_UPLOAD } from "../constants/modalConstants";
import {
  Upload,
  AlertCircle,
  Info
} from "lucide-react";
import { FileInfo, getFile } from "../functions/file";
import type {SelectedItem} from "./workbenchTypes";

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
  const [sizeError, setSizeError] = useState<string | null>(null);

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
        const existingSize = getFileSize(existingItem.content || "");
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

  // Handle file selection and processing
  const handleFiles = useCallback(
      async (files: File[]) => {
        try {
          const fileInfos = await Promise.all(files.map((file) => getFile(file)));

          if (!validateFileSizeCombinations(fileInfos)) {
            return;
          }

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
      [selectedItems, setSelectedItems]
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

  return (
      <div className="source-browser file-browser">
        {sizeError && (
            <div className="workbench-inline-error" role="alert">
              <AlertCircle size={17} aria-hidden="true"/>
              <p>{sizeError}</p>
            </div>
        )}

        <div
              className={`file-dropzone ${isDragging ? "file-dropzone--active" : ""} ${sizeError ? "file-dropzone--error" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
          >
            <Upload size={30} aria-hidden="true"/>
            <strong>Drop files</strong>

            <label className="file-picker">
              <span><Upload size={16} aria-hidden="true"/>Choose files</span>
              <input
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={handleFileInput}
              />
            </label>

            <div className="file-dropzone__meta">
              <span><Info size={13} aria-hidden="true"/>128 MB maximum pair size</span>
            </div>
        </div>
      </div>
  );
};

export default FileUpload;
