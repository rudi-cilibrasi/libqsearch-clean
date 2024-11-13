import React, {useState} from 'react';
import {Search, ChevronRight, X} from 'lucide-react';

const ListEditor = ({performSearch}) => {

    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]);
    const [projections, setProjections] = useState({
        Accession: true,
        ScientificName: false,
        CommonName: true,
        FileName: false,
    });
    const [apiKey, setApiKey] = useState('');

    const onInputChange = (term) => {
        setSearchTerm(term);
        setSearchResults([]);
    }

    const onPerformSearch = () => {
        performSearch(selectedItems, projections, apiKey);
    }


    const handleKeyDown = async (e) => {
        if (e.key === "Enter") {
            if (searchTerm && searchTerm.trim() !== '')
                setSearchResults([...searchResults, searchTerm]);
        }
    };

    const isDisabledByApiKey = apiKey === null || apiKey.trim() === '';

    return (
        <>
            {/* Main Content - Side by Side Layout */}
            <div style={{display: 'flex', gap: '24px', flex: 1, pointerEvents: isDisabledByApiKey ? 'none' : 'auto'}}>
                <div className="w-1/2 h-[500px] overflow-y-auto border border-gray-300 p-6 box-border rounded-lg bg-white">
                    <h3 className="text-xl font-bold mb-5 text-[#1a365d]">Search
                        Results</h3>
                    <div className="relative mb-5">
                        <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                            <Search size={20} color="#4a5568"/>
                        </div>
                        <input
                            type="text"
                            value={searchTerm}
                            onKeyDown={handleKeyDown}
                            onChange={(e) => onInputChange(e.target.value)}
                            placeholder="Search animals..."
                            className={`${isDisabledByApiKey ? 'bg-gray-300 text-gray-800' : '#3182ce'} w-full py-3 px-3 pl-12 border-2 border-gray-200 rounded-lg text-base outline-none transition-colors duration-200`}
                            onFocus={(e) => e.target.classList.add('border-[#3182ce]')}
                            onBlur={(e) => e.target.classList.remove('border-[#3182ce]')}
                        />
                    </div>

                    <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto p-1">
                        {searchResults.map((item, index) => (
                            <div
                                key={index}
                                onClick={() => setSelectedItems(prev => [...prev, item])}
                                className="flex justify-between items-center p-4 bg-gray-50 border border-gray-200
                                    rounded-lg cursor-pointer transition-all duration-200">
                                <div>
                                    {<div style={{color: '#2d3748'}}>{searchTerm}</div>}
                                </div>
                                <ChevronRight size={20} color="#a0aec0"/>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Selected Items Box */}


                <div className="w-1/2 h-[500px] overflow-y-auto border border-gray-300 p-6 box-border rounded-lg bg-white">
                    <h3 className="text-xl font-bold mb-5 text-[#1a365d]">Selected Items</h3>
                    <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto p-1">
                        {selectedItems.map((item, index) => (
                            <div key={index}
                                className="flex justify-between items-center p-4 bg-gray-50 border border-gray-200 rounded-lg">
                                <div>
                                    <div style={{color: '#718096', fontSize: '0.9rem'}}>{selectedItems[index]}</div>
                                </div>
                                <X size={20} color="#a0aec0" style={{cursor: 'pointer'}} onClick={() =>
                                    setSelectedItems(prev => prev.filter((_, i) => i !== index))
                                }/>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <label htmlFor="large-input" className="block mb-2 mt-6 text-lg font-medium text-gray-900 dark:text-white">
                Enter API Key
            </label>

            <input type="text" id="large-input"
                   className="block w-full p-4 text-black bg-white border border-gray-300 rounded-lg text-base"
                   value={apiKey}
                   onChange={(event) => setApiKey(event.target.value)}/>

            <div className={`flex items-center justify-between mt-6 mb-6 ${isDisabledByApiKey ? 'pointer-events-none' : 'pointer-events-auto'}`}>
                <div style={{display: 'flex', gap: '12px', flexWrap: 'wrap'}}>
                    {Object.entries(projections).map(([key, value]) => (
                        <label
                            className={`${isDisabledByApiKey ? 'bg-gray-300' : (value ? 'bg-blue-200' : 'bg-white')}
                                flex items-center gap-2 py-2 px-4 rounded cursor-pointer border border-gray-200`}
                            key={key}>
                            <input
                                type="checkbox"
                                checked={value}
                                onChange={() => setProjections(prev => ({
                                    ...prev,
                                    [key]: key !== "Accession" ? !prev[key] : prev[key]
                                }))}
                            />
                            <span style={{color: '#2d3748'}}>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        </label>
                    ))}
                </div>

                <button
                    onClick={onPerformSearch}
                    className={`${isDisabledByApiKey || selectedItems.length < 4 ? 'bg-gray-300 text-gray-800' : 'bg-blue-600 text-white hover:bg-blue-900'}
                        "py-3 px-6 text-base rounded-lg cursor-pointer border-none shadow-md transition-colors duration-200"`}>
                    Search
                </button>
            </div>
        </>
    );
};

export default ListEditor;