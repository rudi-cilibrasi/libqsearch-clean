import React, { useCallback, useState } from "react";
import { useDropzone } from 'react-dropzone';
import { X } from "lucide-react";
import { getAllValidFilesOrError, getFile } from "../functions/file.js";
import { parseFastaAndClean } from "../functions/fasta.js";

export const FileDrop = ({ onParsedFileContent }) => {
    const [error, setError] = useState("");
    const [fileList, setFileList] = useState([]);

    const handleIncrementalDrop = (acceptedFiles) => {
        setFileList((prevFiles) => {
            const newFiles = acceptedFiles.filter((newFile) => !prevFiles.some((prevFile) => prevFile.name === newFile.name));
            return [...prevFiles, ...newFiles];
        });
    };


    const show = async (fileList) => {
        setError("");
        await searchByUploadedFiles(fileList);
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
                        if (fileInfos[0].ext === "fasta") {
                            const fastaList = fileInfos.reduce((acc, info) => {
                                const parsedFasta = parseFastaAndClean(info.content);
                                parsedFasta.forEach((entry) => {
                                    if (!entry.accession || entry.accession.trim() === "") {
                                        entry.accession = info.name;
                                    }
                                });
                                return [...acc, ...parsedFasta];
                            }, []);
                            return { valid: true, clean: true, isFasta: true, data: fastaList };
                        } else {
                            const data = fileInfos.map((file) => ({
                                accession: file.name,
                                sequence: file.content,
                            }));
                            return { valid: true, clean: true, isFasta: false, data: data };
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