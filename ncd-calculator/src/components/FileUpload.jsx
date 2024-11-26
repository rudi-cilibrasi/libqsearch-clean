import React, {useCallback, useState} from "react";
import {getCleanSequence, getFastaInfoFromFile, hasMetadata, isFasta, parseMetadata} from "../functions/fasta.js";
import {FILE_UPLOAD} from "./constants/modalConstants.js";
import {Info, Upload} from "lucide-react";
import {getFile} from "../functions/file.js";

export const FileUpload = ({addItem, selectedItems, onSetApiKey, setSelectedItems}) => {

    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);


    const handleDrop = useCallback(async (e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        const fileInfos = await Promise.all(files.map(async file => await getFile(file)));
        const newItems = fileInfos
            .map(file => getFileItem(file))
            .filter(item => !selectedItems.find(selected => selected.id === item.id));
        setSelectedItems(prev => [...prev, ...newItems]);
    }, []);


    const getFileItem = (fileInfo) => {
        if (isFasta(fileInfo)) {
            return getFastaInfoFromFile(fileInfo);
        } else {
            const item = {
                type: FILE_UPLOAD,
                content: fileInfo.content,
                label: fileInfo.name,
                id: fileInfo.name
            }
            return item;
        }
    }




    const handleFileInput = async (e) => {
        const files = Array.from(e.target.files);
        const readyFiles = await Promise.all(files.map(file => getFile(file)));
        const newItems = readyFiles
            .map(file => getFileItem(file))
            .filter(item => !selectedItems.find(selected => selected.id === item.id));
        setSelectedItems(prev => [...prev, ...newItems]);
    };


    return (
<div className="h-full flex flex-col justify-center p-4">
    <div
        className={`border-2 border-dashed rounded-xl transition-all flex flex-col items-center justify-center p-8
            ${isDragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
    >
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
            <Info className="text-blue-600 flex-shrink-0 mt-0.5" size={20}/>
            <p className="m-0 text-blue-800 text-sm leading-relaxed">
                Upload any file to reveal relationships and patterns through Normalized Compression Distance (NCD)
            </p>
        </div>

        <Upload
            size={40}
            className={`mb-4 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`}
        />
        <p className="text-center mb-4 text-gray-600">
            Drag and drop your files here.
            <br/>
        </p>
        <label className="cursor-pointer">
            <span className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-200 transition-colors">
                Browse Files
            </span>
            <input
                type="file"
                multiple
                className="hidden"
                onChange={handleFileInput}
            />
        </label>
    </div>
</div>

    )
}