import React, {useCallback, useState} from "react";
import {isCleanFastaSequence} from "../functions/getPublicFasta.js";
import {useDropzone} from 'react-dropzone'
import {X} from "lucide-react";

export const FileDrop = ({onFastaData}) => {
    const isFastaFormat = (content) => {
        const lines = content.split("\n").filter((line) => line.trim());
        if (lines.length === 0) return false;

        if (!lines[0].startsWith(">")) return false;

        let hasSequenceData = false;
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith(">")) {
                if (!hasSequenceData) return false;
            } else {
                if (!/^[A-Za-z*\-\.]+$/.test(line)) return false;
                hasSequenceData = true;
            }
        }
        return hasSequenceData;
    };

    const readFile = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                if (isFastaFormat(content) || isCleanFastaSequence(content)) {
                    resolve({
                        filename: file.name,
                        content: content,
                        isValid: true,
                    });
                } else {
                    console.warn(`File ${file.name} is not in valid FASTA format`);
                    resolve({
                        filename: file.name,
                        content: content,
                        isValid: false,
                        error: "Invalid FASTA format",
                    });
                }
            };
            reader.onerror = () => {
                resolve({
                    filename: file.name,
                    isValid: false,
                    error: "Error reading file",
                });
            };
            reader.readAsText(file);
        });
    };

    const searchByUploadedFiles = useCallback(
        async (files) => {
            const fileContents = [];

            // Read files sequentially to maintain order
            for (const file of files) {
                const result = await readFile(file);
                fileContents.push(result);
            }

            const validFastaData = fileContents
                .filter((file) => file.isValid)
                .map((file) => file.content);

            if (validFastaData.length > 0) {
                if (!isCleanFastaSequence(validFastaData[0])) {
                    onFastaData(validFastaData.join("\n"), files.map(file => file.name));
                } else {
                    onFastaData(validFastaData, files.map(file => file.name));
                }
            }

            const invalidFiles = fileContents.filter((file) => !file.isValid);
            if (invalidFiles.length > 0) {
                console.warn("Invalid files:", invalidFiles);
            }
        },
        [onFastaData]
    );

    const [fileList, setFileList] = useState([]);

    const handleIncrementalDrop = (acceptedFiles) => {
        setFileList((prevFiles) => {
            const newFiles = acceptedFiles.filter(
                (newFile) => !prevFiles.some((prevFile) => prevFile.name === newFile.name)
            );
            return [...prevFiles, ...newFiles];
        });
    };

    const {getRootProps, getInputProps} = useDropzone({
        onDrop: handleIncrementalDrop,
        multiple: true, // multiple files upload
    });

    return (
        <div style={{padding: '20px', width: '100%'}}>
            <div className="flex items-center justify-between gap-x-4">
                <div
                    {...getRootProps({
                        className: 'text-lg border-2 border-dashed p-4 text-center cursor-pointer flex-1',
                    })}>
                    <input {...getInputProps()} />
                    <p>Drag and drop FASTA files here or click to upload.</p>
                </div>

                <button
                    type="button"
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    onClick={() => searchByUploadedFiles(fileList)}>
                    Show
                </button>
            </div>

            <div className="mt-4">
                {fileList.map((file, index) => (
                    <div key={index} className="text-lg flex justify-between">
                        <span>
                          {file.name} - {file.size} bytes
                        </span>
                        <X size={20}
                            color="#a0aec0"
                            style={{cursor: 'pointer'}}
                            onClick={() =>
                                setFileList((prev) => prev.filter((_, i) => i !== index))
                            }
                        />
                    </div>
                ))}
            </div>
        </div>
    )
};