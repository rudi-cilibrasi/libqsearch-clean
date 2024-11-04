import React, { useCallback } from "react";

export const FileDrop = ({ onFastaData }) => {
  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      const files = Array.from(event.dataTransfer.files);
      const fileContents = [];

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

      const readFiles = (file) => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const content = e.target.result;
            if (isFastaFormat(content)) {
              fileContents.push({
                filename: file.name,
                content: content,
                isValid: true,
              });
            } else {
              console.warn(`File ${file.name} is not in valid FASTA format`);
              fileContents.push({
                filename: file.name,
                content: content,
                isValid: false,
                error: "Invalid FASTA format",
              });
            }
            resolve();
          };
          reader.onerror = () => {
            fileContents.push({
              filename: file.name,
              isValid: false,
              error: "Error reading file",
            });
            resolve();
          };
          reader.readAsText(file);
        });
      };

      Promise.all(files.map(readFiles)).then(() => {
        const validFastaData = fileContents
          .filter((file) => file.isValid)
          .map((file) => file.content)
          .join("\n");
        if (validFastaData) {
          onFastaData(validFastaData, files.map(file => file.name));
        }

        const invalidFiles = fileContents.filter((file) => !file.isValid);
        if (invalidFiles.length > 0) {
          console.warn("Invalid files:", invalidFiles);
        }
      });
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
      style={{
        border: "2px dashed #4CAF50",
        borderRadius: "10px",
        padding: "20px",
        margin: "20px auto",
        width: "80%",
        maxWidth: "400px", // Set a maximum width for the drag area
        backgroundColor: "#f0f0f0", // Change this to match your Vite React background color
        textAlign: "center",
        position: "relative",
      }}
    >
      <p style={{ margin: 0, fontSize: "16px", color: "#333" }}>
        Drag and drop FASTA files here or click to upload.
      </p>
    </div>
  );
};
