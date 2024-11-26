import {useEffect, useState} from 'react';
import {ChevronRight, Info, PawPrint, Search, Tag} from 'lucide-react';
import {FastaSuggestionHandler} from "../functions/fastaSuggestions.js";
import {parseAccessionAndRemoveVersion} from "../functions/cache.js";

export const FastaSearchSuggestion = ({
                                          searchTerm,
                                          addItem,
                                          type = "fasta",
                                          className = "",
                                          setError
                                      }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [lastAddedTerm, setLastAddedTerm] = useState('');

    const ncbiService = new FastaSuggestionHandler(import.meta.env.VITE_NCBI_API_KEY);

    useEffect(() => {
        setError(null);
        const fetchSuggestions = async () => {
            if (!searchTerm?.trim()) {
                setSuggestions([]);
                return;
            }

            try {
                const results = await ncbiService.getSuggestions(searchTerm);
                setSuggestions(results);
            } catch (err) {
                console.error('Error fetching suggestions:', err);
                setSuggestions([]);
            } finally {
                setLoading(false);
            }
        };

        const timer = setTimeout(fetchSuggestions, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);


    const handleSuggestionSelect = (suggestion) => {
        const input = {
            type: type,
            content: '',
            label: suggestion.primaryCommonName,
            id: parseAccessionAndRemoveVersion(suggestion.id),
            searchTerm: suggestion.primaryCommonName.trim().toLowerCase()
        };
        addItem(input);
        setLastAddedTerm(searchTerm);
        setSuggestions([]);
    };

    if (!searchTerm?.trim() || searchTerm === lastAddedTerm) return null;
    if (!suggestions.length) return null;


    return (
        <div className={`w-full ${className}`}>
            <div className="rounded-lg border shadow-md bg-white">
                    <div>
                        <div className="p-2 border-b">
                            <div className="flex items-center gap-2 text-sm text-gray-700 px-2">
                                <Search className="h-4 w-4"/>
                                <span>Suggestions</span>
                            </div>
                        </div>
                        <div>
                            {suggestions.map((suggestion) => (
                                <div
                                    key={suggestion.id}
                                    onClick={() => handleSuggestionSelect(suggestion)}
                                    className="p-3 hover:bg-gray-100 cursor-pointer transition-colors"
                                >
                                    <div className="flex justify-between items-center group">
                                        <div className="flex items-center gap-2">
                                            <PawPrint className="h-4 w-4 text-blue-500"/>
                                            <span className="font-medium text-gray-900">
                                                {suggestion.primaryCommonName}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-700">
                                            <Tag className="h-4 w-4"/>
                                            <span className="text-xs">{suggestion.type}</span>
                                            <ChevronRight
                                                className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"/>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 text-sm text-gray-600 italic ml-6 mt-1">
                                        <Info className="h-3 w-3"/>
                                        <span>{suggestion.scientificName}</span>
                                    </div>

                                    {suggestion.additionalCommonNames?.length > 0 && (
                                        <div className="flex gap-2 text-xs text-gray-600 mt-1 ml-6">
                                            <Tag className="h-3 w-3"/>
                                            <span>
                                                Also known as: {suggestion.additionalCommonNames.join(', ')}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
            </div>
        </div>
    );
};
