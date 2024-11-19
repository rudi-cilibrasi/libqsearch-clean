import React, {useCallback, useState} from "react";
import {getCleanSequence, isFasta} from "../functions/fasta.js";
import {getFile} from "../functions/file.js";
import {Eye, EyeOff, Upload} from "lucide-react";
import {SearchInput} from "./SearchInput.jsx";


export const FastaSearch = ({MIN_ITEMS, addItem, selectedItems, onSetApiKey, setSelectedItems}) => {
    const [apiKey, setApiKey] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [projections, setProjections] = useState({
        Accession: true,
        ScientificName: false,
        CommonName: true,
        FileName: false,
    });


    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);


    const handleSearchTerm = (searchTerm) => {
        setSearchTerm(searchTerm);
    }

    const FASTA = "fasta";


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
            const sequenceClean = getCleanSequence(fileInfo.content);
            const item = {
                type: FASTA,
                content: sequenceClean,
                label: fileInfo.name,
                id: fileInfo.name
            }
            return item;
        } else {
            const item = {
                type: FASTA,
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


    const handleKeydown = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            const item = {
                type: 'fasta',
                id: searchTerm,
                label: searchTerm,
                content: ''
            }
            addItem(item);
        }
    }


    const handleApiKey = (key) => {
        setApiKey(key);
        onSetApiKey(key);
    }


    const toggleProjection = (key) => {
        // Prevent toggling for locked fields (e.g., Accession)
        if (key === 'Accession') return;

        setProjections(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };


    return (
        <div className="flex flex-col">
            <SearchInput searchTerm={searchTerm} addItem={addItem} label="Search FASTA" type="fasta"
                         handleSearchTerm={handleSearchTerm}/>
            <div
                className={`flex-1 mb-6 border-2 border-dashed rounded-xl transition-all flex flex-col items-center justify-center p-8
                    ${isDragging
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <Upload
                    size={40}
                    className={`mb-4 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`}
                />
                <p className="text-center mb-4 text-gray-600">
                    Drag and drop your FASTA files here
                    <br/>or
                </p>
                <label className="cursor-pointer">
                    <span
                        className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-200 transition-colors">
                      Browse Files
                    </span>
                    <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileInput}
                        onKeyDown={(event) => handleKeydown(event)}
                    />
                </label>
            </div>

            {/* FASTA Options */
            }
            <div className="mt-auto border-t border-gray-200 pt-4">
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        API Key
                    </label>
                    <input
                        type="text"
                        placeholder="Enter your API key"
                        value={apiKey}
                        onChange={(e) => handleApiKey(e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-lg text-sm"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Search Options
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(projections).map(([key, value]) => (
                            <button
                                key={key}
                                onClick={() => toggleProjection(key)}
                                disabled={key === 'Accession'}
                                className={`
            flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm 
            transition-all duration-200 ease-in-out
            ${value
                                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                                    : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}
            ${key === 'Accession' ? 'cursor-not-allowed' : 'hover:bg-opacity-75'}
          `}
                            >
                                {value ? (
                                    <Eye className="w-4 h-4"/>
                                ) : (
                                    <EyeOff className="w-4 h-4"/>
                                )}
                                <span>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}