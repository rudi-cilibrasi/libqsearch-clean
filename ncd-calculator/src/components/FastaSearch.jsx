import {useCallback, useState} from "react";
import {getCleanSequence, isFasta} from "../functions/fasta.js";
import {getFile} from "../functions/file.js";
import {Eye, EyeOff} from "lucide-react";
import {SearchInput} from "./SearchInput.jsx";
import {FASTA} from "../constants/modalConstants.js";
import {FastaSearchSuggestion} from "./FastaSearchSuggestion.jsx";
import {GenBankSearchService} from "../clients/GenBankSearchService.js";
import {LocalStorageKeyManager} from "../cache/LocalStorageKeyManager.js";


export const FastaSearch = ({addItem, selectedItems, onSetApiKey, setSelectedItems, getAllFastaSuggestionWithLastIndex, getFastaSuggestionStartIndex, setFastaSuggestionStartIndex}) => {
    const [apiKey, setApiKey] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [projections, setProjections] = useState({
        Accession: true,
        ScientificName: false,
        FileName: false,
        CommonName: true,
    });
    const [searchError, setSearchError] = useState(null);
    const genbankSearchService = new GenBankSearchService();
    const localStorageKeyManager = new LocalStorageKeyManager();

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


    const handleSuggestionSelect = (suggestion) => {
        handleSearchTerm(suggestion.primaryCommonName);
        addItem({
            id: suggestion.id,
            name: suggestion.primaryCommonName,
            scientificName: suggestion.scientificName,
            type: suggestion.type
        });
    };


    const onSelectSearchTerm = (item) => {
        addItem({
            id: item.accessionId,
            type: FASTA,
            content: '',
            label: item.title
        })
    }


    return (
        <div className="p-4 h-full flex flex-col">
            {/* Fixed top section */}
            <div>
                <SearchInput
                    searchTerm={searchTerm}
                    addItem={addItem}
                    label="Enter Animal Name"
                    type="fasta"
                    handleSearchTerm={handleSearchTerm}
                    setSearchError={setSearchError}
                    genbankSearchService={genbankSearchService}
                />
            </div>
            <div className="flex-1">
                {searchError && (
                    <div className="text-red-500 text-sm mt-2 ml-2">
                        {searchError}
                    </div>
                )}
                <FastaSearchSuggestion
                    onSelectSearchTerm={onSelectSearchTerm}
                    searchTerm={searchTerm}
                    onSuggestionSelect={handleSuggestionSelect}
                    className="mt-2"
                    addItem={addItem}
                    genbankSearchService={genbankSearchService}
                    setError={setSearchError}
                    localStorageKeyManager={localStorageKeyManager}
                    getAllFastaSuggestionWithLastIndex={getAllFastaSuggestionWithLastIndex}
                    setFastaSuggestionStartIndex={setFastaSuggestionStartIndex}
                    getFastaSuggestionStartIndex={getFastaSuggestionStartIndex}
                />
            </div>
            <div className="mt-auto border-t border-gray-200 pt-4">
                <div className="mb-4 mx-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        API Key
                    </label>
                    <input
                        type="text"
                        placeholder="Enter your API key"
                        value={apiKey}
                        onChange={(e) => handleApiKey(e.target.value)}
                        className="w-full py-3 px-4 border-2 border-gray-200 rounded-lg text-base
                bg-black text-white placeholder-gray-400"
                    />
                </div>

                <div className="mb-4 mx-6">
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
                                {value ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}
                                <span>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}