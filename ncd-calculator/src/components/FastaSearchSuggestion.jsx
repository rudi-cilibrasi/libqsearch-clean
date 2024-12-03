import {useEffect, useState} from "react";
import {ChevronRight, Info, PawPrint, Search, Tag} from "lucide-react";
import {parseAccessionAndRemoveVersion} from "../cache/cache.js";

export const FastaSearchSuggestion = ({
                                        searchTerm,
                                        addItem,
                                        type = "fasta",
                                        className = "",
                                        setError,
                                        genbankSearchService,
                                        getAllFastaSuggestionWithLastIndex,
                                        setFastaSuggestionStartIndex,
                                        getFastaSuggestionStartIndex
                                      }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [localPageCount, setLocalPageCount] = useState({});
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    setError(null);
    const fetchSuggestions = async () => {
      if (!searchTerm?.trim() || searchTerm.trim().length <= 2) {
        setSuggestions([]);
        setHasSearched(false);
        return;
      }

      const normalizedSearchTerm = searchTerm.trim().toLowerCase();
      setLoading(true);

      try {
        const count = getLastLocalPageCountObj(searchTerm) === null ? 0 : getLastLocalPageCountObj(searchTerm).count;
        const startIndex = getFastaSuggestionStartIndex(normalizedSearchTerm);
        const suggestions = await genbankSearchService.getSuggestions(normalizedSearchTerm, count + 1, startIndex);
        setSuggestions(suggestions.suggestions || []);
        setHasSearched(true);

        if (suggestions && suggestions.length !== 0) {
          setLastLocalPageCountObj(normalizedSearchTerm, count + 1);
          setFastaSuggestionStartIndex({
            ...getAllFastaSuggestionWithLastIndex(),
            [normalizedSearchTerm]: parseInt(startIndex) + suggestions.suggestions.length
          })
        }
      } catch (err) {
        console.error("Error fetching suggestions:", err);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const getLastLocalPageCountObj = (searchTerm) => {
    const obj = localPageCount[searchTerm]
    return obj || null;
  }

  const setLastLocalPageCountObj = (searchTerm, count) => {
    setLocalPageCount({
      ...localPageCount,
      [searchTerm]: {
        count: count,
        timestamp: Date.now()
      }
    });
  }

  const handleSuggestionSelect = (suggestion) => {
    const input = {
      type: type,
      content: "",
      label: suggestion.primaryCommonName,
      id: parseAccessionAndRemoveVersion(suggestion.id),
      searchTerm: suggestion.primaryCommonName.trim().toLowerCase(),
    };
    addItem(input);
    setSelectedIds(prev => new Set([...prev, suggestion.id]));
    setSuggestions(current =>
        current.filter(s => s.id !== suggestion.id)
    );
  };

  // If there's no search term, don't show anything
  if (!searchTerm?.trim()) return null;

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
              {loading ? (
                  <div className="p-4 text-center text-gray-600">
                    Loading suggestions...
                  </div>
              ) : suggestions.length > 0 ? (
                  suggestions.map((suggestion) => (
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
                            <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"/>
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
                                                Also known as:{" "}
                                {suggestion.additionalCommonNames.join(", ")}
                                            </span>
                            </div>
                        )}
                      </div>
                  ))
              ) : hasSearched && searchTerm.trim().length > 2 ? (
                  <div className="p-4 text-center text-gray-600">
                    No more suggestions available
                  </div>
              ) : searchTerm.trim().length <= 2 ? (
                  <div className="p-4 text-center text-gray-600">
                    Please enter at least 3 characters
                  </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
  );
};
