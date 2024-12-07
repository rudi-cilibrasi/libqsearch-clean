import { isValidFasta } from "./fasta.js";
import { Either } from "./either.js";

export interface SupportedFileFormat {
  format: string;
  ext: string;
  isSupportedFormat: (content: string | ArrayBuffer) => boolean;
}

const SUPPORTED_FILE_FORMATS: SupportedFileFormat[] = [
  {
    format: "fasta",
    ext: "fasta",
    isSupportedFormat: (content: string | ArrayBuffer): boolean => {
      const text =
        typeof content === "string"
          ? content
          : new TextDecoder().decode(content);
      return isValidFasta(text);
    },
  },
  {
    format: "text",
    ext: "txt",
    isSupportedFormat: (content: string | ArrayBuffer): boolean => {
      try {
        // Convert the content to a Uint8Array
        const buffer =
          typeof content === "string"
            ? new TextEncoder().encode(content)
            : new Uint8Array(content);
        const decoded = new TextDecoder().decode(buffer);
        const reEncoded = new TextEncoder().encode(decoded);
        return buffer.every((value, index) => value === reEncoded[index]);
      } catch (error) {
        return false;
      }
    },
  },
];

const getSupportedFileExtensions = () => {
  return SUPPORTED_FILE_FORMATS.map((format) => format.ext);
};

export const isSupported = (
  extension: string,
  content: ArrayBuffer | string
): boolean => {
  if (isSupportedExtension(extension)) {
    return true;
  }
  if (!isSupportedExtension(extension) && !content) {
    return false;
  }
  return isSupportedFileFormat(content);
};

export interface FileInfo {
  ext: string;
  content: string | ArrayBuffer;
  name?: string;
  isValid?: boolean;
  error?: string;
}

export const isSupportedFile = async (file: File) => {
  const fileInfo = (await getFile(file)) as FileInfo;
  return isSupported(fileInfo.ext, fileInfo.content);
};

export const isSupported0 = (fileInfo: unknown): boolean => {
  if (!fileInfo || typeof fileInfo !== "object") return false;
  const info = fileInfo as FileInfo;
  if (!("ext" in info && "content" in info)) return false;
  return isSupported(info.ext, info.content);
};

const isSupportedExtension = (extension: string): boolean => {
  return SUPPORTED_FILE_FORMATS.map((format) => format.ext).includes(extension);
};

const isSupportedFileFormat = (content: string | ArrayBuffer): boolean => {
  for (let i = 0; i < SUPPORTED_FILE_FORMATS.length; i++) {
    if (SUPPORTED_FILE_FORMATS[i].isSupportedFormat(content)) return true;
  }
  return false;
};

export const getFileExtension = (fileName: string): string => {
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex === -1) {
    return "";
  }
  return fileName.substring(lastDotIndex + 1);
};

export const getFile = async (file: File): Promise<FileInfo> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (!content) {
        resolve({
          name: file.name,
          isValid: false,
          error: "Empty file content",
          ext: getFileExtension(file.name),
          content: "",
        });
        return;
      }
      resolve({
        name: getFileNameWithoutExtension(file.name),
        ext: getFileExtension(file.name),
        content: content,
        isValid: true,
      });
      reader.onerror = () => {
        resolve({
          name: file.name,
          isValid: false,
          error: "Error reading file",
          ext: getFileExtension(file.name),
          content: "",
        });
      };
    };
    reader.readAsText(file);
  });
};

export const getFileNameWithoutExtension = (fileName: string): string => {
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex === -1) {
    return fileName;
  }
  return fileName.substring(0, lastDotIndex);
};

export const allFilesWithFormat = (
  files: string | any[],
  format: string
): boolean => {
  if (!files || files.length === 0) return false;
  const fileInfos: FileInfo[] = [];
  for (let i = 0; i < files.length; i++) {
    const fileInfo = files[i];
    if (!isSupported(fileInfo.ext, fileInfo.content)) {
      return false;
    }
    if (
      format === "fasta" &&
      fileInfo.ext !== "fasta" &&
      !isValidFasta(fileInfo.content)
    ) {
      return false;
    }
    fileInfos.push(fileInfo);
  }
  return fileInfos.length === files.length;
};

export const allFilesWithSupportedFormat = (files: FileInfo[]): boolean => {
  for (let i = 0; i < SUPPORTED_FILE_FORMATS.length; i++) {
    const format = SUPPORTED_FILE_FORMATS[i];
    const ext = format.ext;
    const supported = allFilesWithFormat(files, ext);
    if (supported) {
      return true;
    }
  }
  return false;
};

const hasAnyFasta = (files: FileInfo[]): boolean => {
  return (
    files.filter(
      (file: FileInfo) =>
        file.ext === "fasta" ||
        (typeof file.content === "string" && isValidFasta(file.content))
    ).length > 0
  );
};

const getFileEither = (file: FileInfo): Either<string, FileInfo> => {
  if (!isSupported0(file)) {
    return Either.left(
      "The chosen files contain unsupported file format. Supported formats: " +
        getSupportedFileExtensions().join(", ")
    );
  } else {
    return Either.right(file);
  }
};

export const getAllValidFilesOrError = (
  files: unknown[]
): Either<string, FileInfo[]> => {
  const result = Array.from(files).map((file) =>
    getFileEither(file as FileInfo)
  );
  const errors = result.filter((rs) => rs.isLeft()).map((rs) => rs.getLeft());
  if (errors.length > 0 && errors[0]) {
    return Either.left(errors[0]);
  }
  const validFiles = result
    .map((rs) => rs.getRightOrNull())
    .filter((f): f is FileInfo => f !== null);
  const allTheSameSupportedFormat = allFilesWithSupportedFormat(validFiles);
  if (!allTheSameSupportedFormat) {
    return Either.left(
      "All files must be in the same format. Supported formats: " +
        getSupportedFileExtensions().join(", ")
    );
  }
  return Either.right(validFiles);
};
