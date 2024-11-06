import React, { useCallback } from "react";
import { isCleanFastaSequence } from "../functions/getPublicFasta.js";

export const FileDrop = ({ onFastaData }) => {
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

    const handleDrop = useCallback(
        async (event) => {
            event.preventDefault();
            const files = Array.from(event.dataTransfer.files);
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

    const handleDragOver = (event) => {
        event.preventDefault();
    };

    return (
        <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed p-4 text-center cursor-pointer"
        >
            Drag and drop FASTA files here or click to upload.
        </div>
    );
};