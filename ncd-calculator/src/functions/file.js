import {isValidFasta} from "./fasta.js";
import {Either} from "./type.js";

const SUPPORTED_FILE_FORMATS = [
    {
        format: "fasta",
        ext: "fasta",
        isSupportedFormat: (content) => {
            return isValidFasta(content);
        }
    },
    {
        format: "text",
        ext: "txt",
        isSupportedFormat: (content) => {
            try {
                // Convert the content to a Uint8Array
                const buffer = typeof content === 'string' ? new TextEncoder().encode(content) : new Uint8Array(content);
                const decoded = new TextDecoder().decode(buffer);
                const reEncoded = new TextEncoder().encode(decoded);
                return buffer.every((value, index) => value === reEncoded[index]);
            } catch (error) {
                return false;
            }
        }
    }
]


const getSupportedFileExtensions = () => {
   return SUPPORTED_FILE_FORMATS.map(format => format.ext);
}

export const isSupported = (extension, content) => {
   if (isSupportedExtension(extension)) {
       return true;
   }
   if (!isSupportedExtension(extension) && !content) {
       return false;
   }
   return isSupportedFileFormat(content);
}

export const isSupportedFile = async (file) => {
    const fileInfo = await getFile(file);
    return isSupported(fileInfo.ext, fileInfo.content);
}

export const isSupported0 = fileInfo => {
    if (!fileInfo) return false;
    return isSupported(fileInfo.ext, fileInfo.content);
}

const isSupportedExtension = extension => {
   return SUPPORTED_FILE_FORMATS.map(format => format.ext).includes(extension);
}

const isSupportedFileFormat = (content) => {
    for(let i = 0; i < SUPPORTED_FILE_FORMATS.length; i++) {
        if (SUPPORTED_FILE_FORMATS[i].isSupportedFormat(content)) return true;
    }
    return false;
}


export const getFileExtension = (fileName) => {
    const parts = fileName.split(".");
    return parts.length > 1 ? parts.pop() : null;
}


export const getFile = async (file) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            resolve({
                name: getFileNameWithoutExtension(file.name),
                ext: getFileExtension(file.name),
                content: content,
                isValid: true,
            });
        };
        reader.onerror = () => {
            resolve({
                name: file.name,
                isValid: false,
                error: "Error reading file",
                ext: getFileExtension(file.name)
            });
        };
        reader.readAsText(file);
    });
};


export const getFileNameWithoutExtension = fileName => {
    const lastDotIndex = fileName.lastIndexOf(".");
    if (lastDotIndex === -1) {
        return fileName;
    }
    return fileName.substring(0, lastDotIndex);
}

export const allFilesWithFormat = async (files, format) => {
    if (!files || files.length === 0) return false;
    const fileInfos =  [];
    for(let i = 0; i < files.length; i++) {
        const fileInfo = files[i];
        if (!isSupported(fileInfo.ext, fileInfo.content)) {
            return false;
        }
        if (format === "fasta" && (fileInfo.ext !== "fasta" && !isValidFasta(fileInfo.content))) {
            return false;
        }
        fileInfos.push(fileInfo) ;
    }
    return fileInfos.length === files.length;
}

export const allFilesWithSupportedFormat = async (files) => {
    for(let i = 0; i < SUPPORTED_FILE_FORMATS.length; i++) {
        const format = SUPPORTED_FILE_FORMATS[i];
        const ext = format.ext;
        const supported = await allFilesWithFormat(files, ext);
        if (supported) {
            return true;
        }
    }
    return false;

}


const hasAnyFasta = files => {
    return files.filter(file => file.ext === "fasta" || isValidFasta(file.content)).length > 0;
}




const getFileEither = (file) => {
    if (!isSupported0(file)) {
        return Either.left("The chosen files contain unsupported file format. Supported formats: " + getSupportedFileExtensions().join(", "));
    } else {
       return Either.right(file);
    }
}




export const getAllValidFilesOrError = async (files) => {
    const result = Array.from(files).map(getFileEither);
    const errors = result.filter(rs => rs.isLeft()).map(rs => rs.left);
    if (errors.length > 0) {
        return Either.left(errors[0]);
    }
    const allTheSameSupportedFormat = await allFilesWithSupportedFormat(result.map(result => result.right));
    if (!allTheSameSupportedFormat) {
        return Either.left("All files must be in the same format. Supported formats: " + getSupportedFileExtensions().join(", "));
    }
    return Either.right(
        result.map(rs => rs.right)
    );
}



