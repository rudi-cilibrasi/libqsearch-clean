import React, { useCallback } from "react";

export const FileDrop = ({ onFastaData }) => {
  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      const files = Array.from(event.dataTransfer.files);
      const fastaFiles = files.filter((file) => file.name.endsWith(".fasta"));
      const fileContents = [];

      const readFiles = (file) => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            fileContents.push(e.target.result);
            resolve();
          };
          reader.readAsText(file);
        });
      };

      Promise.all(fastaFiles.map(readFiles)).then(() => {
        const data = fileContents.join("\n");
        onFastaData(data);
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