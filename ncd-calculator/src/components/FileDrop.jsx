import React, { useCallback, useState } from "react";
import { useDropzone } from 'react-dropzone';
import { X } from "lucide-react";
import { getAllValidFilesOrError, getFile } from "../functions/file.js";
import {parseFasta, parseFastaAndClean} from "../functions/fasta.js";

export const FileDrop = ({ onParsedFileContent }) => {
    const [error, setError] = useState("");
    const [fileList, setFileList] = useState([]);

    const handleIncrementalDrop = (acceptedFiles) => {
        const list = updateFileListAndGet(fileList, acceptedFiles);
        setFileList(list);
    };


    const updateFileListAndGet = (prevFiles, newFiles) => {
        const filtered = newFiles.filter((newFile) => !prevFiles.some((prevFile) => prevFile.name === newFile.name));
        return [...prevFiles, ...filtered];
    }



    const show = async (newFiles) => {
        setError("");
        const list = updateFileListAndGet(fileList, newFiles);
        await searchByUploadedFiles(list);
    }

    const searchByUploadedFiles = useCallback(
        async (files) => {
            try {
                const fileInfos = await Promise.all(files.map(async (file) => await getFile(file)));
                const response = (await getAllValidFilesOrError(fileInfos)).fold(
                    (error) => {
                        setError(error);
                        return { valid: false };
                    },
                    (fileInfos) => {
                        let result = [];
                        for(let i = 0; i < fileInfos.length; i++) {
                            const fileInfo = fileInfos[i];
                            const ext = fileInfo.ext;
                            if (ext === "fasta") {
                                const parsedFasta = parseFastaAndClean(fileInfo.content);
                                for(let i = 0; i < parsedFasta.length; i++) {
                                    if (!parsedFasta[i].accession ||  parsedFasta[i].accession.trim() === '') {
                                        parsedFasta[i].accession = fileInfo.name;
                                    }
                                }
                                result = [...result, ...parsedFasta];
                            } else {
                                const content = fileInfo.content;
                                const accession = fileInfo.name;
                                result.push({
                                    accession: accession,
                                    sequence: content
                                })
                            }
                        }
                        return {
                            valid: true,
                            clean: true,
                            data: result
                        }
                    }
                );
                onParsedFileContent(response);
            } catch (err) {
                console.error(err);
                setError('Error processing files. Please try again.');
            }
        },
        [onParsedFileContent]
    );

    const { getRootProps, getInputProps } = useDropzone({
        onDrop: handleIncrementalDrop,
        multiple: true,
    });

    return (
        <>
            <label htmlFor="large-input" className="block mb-2 mt-6 text-lg font-medium text-gray-900 dark:text-white">
                Search By FASTA Files
            </label>
            <div className="flex justify-between gap-x-4">
                <div
                    {...getRootProps({
                        className: 'text-lg border-2 border-dashed p-4 text-center cursor-pointer flex-1',
                    })}
                >
                    <input {...getInputProps()} />
                    <p>Drag and drop FASTA files here or click to upload.</p>
                </div>

                <button
                    type="button"
                    className={`${fileList.length < 4 ? 'bg-gray-300 text-gray-800' : 'bg-blue-600 text-white hover:bg-blue-900'} 
            "py-3 px-6 text-base rounded-lg cursor-pointer border-none shadow-md transition-colors duration-200"`}
                    disabled={fileList.length < 4}
                    onClick={() => show(fileList)}
                >
                    Show
                </button>
            </div>

            {error && (
                <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                    <strong className="font-bold">Error: </strong>
                    <span className="block sm:inline">{error}</span>
                </div>
            )}

            <div className="mt-4">
                {fileList.map((file, index) => (
                    <div key={index} className="text-lg flex justify-between">
                        <span>{file.name} - {file.size} bytes</span>
                        <X
                            size={20}
                            style={{ cursor: 'pointer', color: '#a0aec0' }}
                            onClick={() => setFileList((prev) => prev.filter((_, i) => i !== index))}
                        />
                    </div>
                ))}
            </div>
        </>
    );
};