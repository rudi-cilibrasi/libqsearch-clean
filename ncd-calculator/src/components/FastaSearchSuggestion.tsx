import { useEffect, useState, useCallback, useRef } from "react";
import {
  ChevronRight,
  Database,
  FileText,
  Info,
  PawPrint,
  Search,
  Tag,
  AlertTriangle,
} from "lucide-react";
import { parseAccessionAndRemoveVersion } from "../cache/cache.ts";
import { PaginatedResults, Suggestion } from "@/services/genbank.ts";
import { SelectedItem } from "./InputHolder.tsx";
import { GenBankSearchService } from "@/services/GenBankSearchService.ts";

type DisplayMode = "common" | "scientific" | "accession";

interface FastaSearchSuggestionProps {
  searchTerm: string;
  addItem: (item: any) => void;
  type?: string;
  className?: string;
  setError: (error: any) => void;
  genbankSearchService: GenBankSearchService;
  getAllFastaSuggestionWithLastIndex: () => any;
  setFastaSuggestionStartIndex: (index: any) => void;
  getFastaSuggestionStartIndex: (term: string) => any;
  selectedItems: SelectedItem[];
  displayMode?: DisplayMode;
  autoLabelingEnabled?: boolean;
}

export const FastaSearchSuggestion = ({
                                        searchTerm,
                                        addItem,
                                        type = "fasta",
                                        className = "",
                                        setError,
                                        genbankSearchService,
                                        getAllFastaSuggestionWithLastIndex,
                                        setFastaSuggestionStartIndex,
                                        getFastaSuggestionStartIndex,
                                        selectedItems,
                                        displayMode = "scientific",
                                        autoLabelingEnabled = true,
                                      }: FastaSearchSuggestionProps) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [localPageCount, setLocalPageCount] = useState({});
  const [hasSearched, setHasSearched] = useState(false);
  const [currentLabels, setCurrentLabels] = useState<Record<string, string>>({});
  const [componentError, setComponentError] = useState<string | null>(null);
  
  // Reference to keep track of the latest search term and request
  const searchRequests = useRef<Map<string, { timestamp: number, abortController?: AbortController }>>(new Map());
  
  // Safe validation function for suggestions
  const isValidSuggestion = useCallback((suggestion: any): boolean => {
    return suggestion &&
      typeof suggestion === 'object' &&
      suggestion.id !== undefined &&
      suggestion.id !== null;
  }, []);
  
  // Safe access function for suggestion properties
  const getSuggestionProperty = useCallback((suggestion: any, property: string, fallback: any = ""): any => {
    if (!suggestion || typeof suggestion !== 'object') return fallback;
    return suggestion[property] !== undefined ? suggestion[property] : fallback;
  }, []);
  
  const generateLabel = useCallback((
    suggestion: Suggestion,
    displayMode: DisplayMode,
    autoLabelingEnabled: boolean,
    existingItems: SelectedItem[]
  ) => {
    // Validate suggestion first
    if (!isValidSuggestion(suggestion)) {
      return "Unknown Item";
    }
    
    try {
      const suggestionId = getSuggestionProperty(suggestion, 'id', 'unknown');
      let label =
        displayMode === "common"
          ? getSuggestionProperty(suggestion, 'primaryCommonName', 'Unknown Common Name')
          : displayMode === "scientific"
            ? getSuggestionProperty(suggestion, 'scientificName', 'Unknown Scientific Name')
            : suggestionId;
      
      if (!autoLabelingEnabled) {
        return label;
      }
      
      // Validate existingItems
      let validExistingItems: SelectedItem[] = [];
      if (existingItems) {
        validExistingItems = Array.isArray(existingItems)
          ? existingItems
          : Object.values(existingItems);
      }
      
      // Check for duplicates
      const isDuplicate = validExistingItems.some(
        (item) =>
          item?.label === label ||
          (item?.label && item.label.split(" (")[0] === label)
      );
      
      if (isDuplicate) {
        if (displayMode === "common") {
          const scientificName = getSuggestionProperty(suggestion, 'scientificName', 'Unknown Species');
          label = `${label} (${scientificName})`;
          
          const stillDuplicate = validExistingItems.some(
            (item) => item?.label === label
          );
          if (stillDuplicate) {
            label = `${label} [${suggestionId}]`;
          }
        } else if (displayMode === "scientific") {
          label = `${label} [${suggestionId}]`;
        }
      }
      
      return label;
    } catch (error) {
      console.error("Error generating label:", error);
      return "Unknown Item";
    }
  }, [isValidSuggestion, getSuggestionProperty]);
  
  // Clean up function to cancel all pending requests except for the most recent
  const cancelPreviousRequests = useCallback((currentSearchTerm: string) => {
    // Sort requests by timestamp to find the latest for each search term
    const currentTimestamp = Date.now();
    
    searchRequests.current.forEach((requestData, term) => {
      // Keep requests that are for the current search term and recent (within last 2 seconds)
      const isCurrentTerm = term === currentSearchTerm;
      const isRecent = currentTimestamp - requestData.timestamp < 2000;
      
      if (!isCurrentTerm || !isRecent) {
        // Cancel and remove old requests
        if (requestData.abortController) {
          try {
            requestData.abortController.abort();
          } catch (e) {
            console.error("Error aborting request:", e);
          }
        }
        searchRequests.current.delete(term);
      }
    });
  }, []);
  
  // Effect for fetching suggestions with error handling and request cancellation
  useEffect(() => {
    setError(null);
    setComponentError(null);
    
    const fetchSuggestions = async () => {
      if (!searchTerm?.trim() || searchTerm.trim().length <= 2) {
        setSuggestions([]);
        setHasSearched(false);
        return;
      }
      
      const normalizedSearchTerm = searchTerm.trim().toLowerCase();
      setLoading(true);
      
      // Cancel previous requests for other search terms
      cancelPreviousRequests(normalizedSearchTerm);
      
      // Create abort controller for this request
      const abortController = new AbortController();
      const requestTimestamp = Date.now();
      
      // Register this request
      searchRequests.current.set(normalizedSearchTerm, {
        timestamp: requestTimestamp,
        abortController
      });
      
      try {
        const count =
          getLastLocalPageCountObj(searchTerm) === null
            ? 0
            : getLastLocalPageCountObj(searchTerm).count;
        const startIndex = getFastaSuggestionStartIndex(normalizedSearchTerm);
        
        // Check if this request has been cancelled before proceeding
        if (searchRequests.current.get(normalizedSearchTerm)?.timestamp !== requestTimestamp) {
          return; // Request was superseded by a newer one
        }
        
        // Add a signal to abort the fetch if needed
        // Note: This implementation assumes you can modify the GenBankSearchService to accept an AbortSignal
        // If you can't modify the service, you'll need to implement a different cancellation strategy
        const paginatedSuggestions: PaginatedResults =
          await genbankSearchService.getSuggestions(
            normalizedSearchTerm,
            count + 1,
            startIndex,
            displayMode,
            abortController.signal // Add this parameter if your service supports it
          );
        
        // Check again if this request is still relevant
        if (searchRequests.current.get(normalizedSearchTerm)?.timestamp !== requestTimestamp) {
          return; // Request was superseded by a newer one
        }
        
        // Validate suggestions before setting state
        const validatedSuggestions = Array.isArray(paginatedSuggestions?.suggestions)
          ? paginatedSuggestions.suggestions.filter(isValidSuggestion)
          : [];
        
        setSuggestions(validatedSuggestions);
        setHasSearched(true);
        
        if (validatedSuggestions.length !== 0) {
          setLastLocalPageCountObj(normalizedSearchTerm, count + 1);
          setFastaSuggestionStartIndex({
            ...getAllFastaSuggestionWithLastIndex(),
            [normalizedSearchTerm]:
              parseInt(startIndex) + validatedSuggestions.length,
          });
        }
      } catch (err) {
        // Only set error state if this request is still the current one
        if (searchRequests.current.get(normalizedSearchTerm)?.timestamp === requestTimestamp) {
          // Ignore aborted request errors
          if (err.name !== 'AbortError') {
            console.error("Error fetching suggestions:", err);
            setSuggestions([]);
            setComponentError("Failed to fetch suggestions. Please try again.");
          }
        }
      } finally {
        // Only update loading state if this request is still the current one
        if (searchRequests.current.get(normalizedSearchTerm)?.timestamp === requestTimestamp) {
          setLoading(false);
        }
      }
    };
    
    const timer = setTimeout(fetchSuggestions, 300);
    return () => {
      clearTimeout(timer);
      // Clean up on unmount or search term change
      cancelPreviousRequests("");
    };
  }, [searchTerm, isValidSuggestion, cancelPreviousRequests]);
  
  // Rest of the component remains largely the same...
  // Effect for updating labels with error handling
  useEffect(() => {
    if (suggestions.length > 0) {
      try {
        const newLabels = suggestions.reduce((acc, suggestion) => {
          if (isValidSuggestion(suggestion)) {
            const suggestionId = getSuggestionProperty(suggestion, 'id', '');
            if (suggestionId) {
              acc[suggestionId] = generateLabel(
                suggestion,
                displayMode,
                autoLabelingEnabled,
                selectedItems
              );
            }
          }
          return acc;
        }, {} as Record<string, string>);
        
        setCurrentLabels(newLabels);
      } catch (error) {
        console.error("Error updating labels:", error);
        setComponentError("Error processing suggestion data");
      }
    }
  }, [autoLabelingEnabled, displayMode, suggestions, selectedItems, isValidSuggestion, getSuggestionProperty, generateLabel]);
  
  const getLastLocalPageCountObj = useCallback((searchTerm: string) => {
    const obj = localPageCount[searchTerm];
    return obj || null;
  }, [localPageCount]);
  
  const setLastLocalPageCountObj = useCallback((searchTerm: string, count: number) => {
    setLocalPageCount((prevState) => ({
      ...prevState,
      [searchTerm]: {
        count: count,
        timestamp: Date.now(),
      },
    }));
  }, []);
  
  const handleSuggestionSelect = useCallback((suggestion: Suggestion) => {
    try {
      if (!isValidSuggestion(suggestion)) {
        console.error("Invalid suggestion selected:", suggestion);
        return;
      }
      
      const suggestionId = getSuggestionProperty(suggestion, 'id', '');
      if (!suggestionId) {
        console.error("Suggestion has no valid ID:", suggestion);
        return;
      }
      
      const label =
        currentLabels[suggestionId] ||
        generateLabel(
          suggestion,
          displayMode,
          autoLabelingEnabled,
          selectedItems
        );
      
      const input = {
        type: type,
        content: "",
        label: label,
        id: parseAccessionAndRemoveVersion(suggestionId),
        searchTerm: getSuggestionProperty(
          suggestion,
          getPrimaryField(displayMode),
          ''
        ).trim().toLowerCase(),
      };
      
      addItem(input);
      setSelectedIds((prev) => new Set([...prev, suggestionId]));
      setSuggestions((current) => current.filter((s) => s && s.id !== suggestionId));
    } catch (error) {
      console.error("Error selecting suggestion:", error);
      setComponentError("Failed to select item. Please try again.");
    }
  }, [currentLabels, generateLabel, displayMode, autoLabelingEnabled, selectedItems, type, isValidSuggestion, getSuggestionProperty]);
  
  const getPrimaryField = useCallback((mode: DisplayMode): string => {
    switch (mode) {
      case "common":
        return "primaryCommonName";
      case "scientific":
        return "scientificName";
      case "accession":
        return "id";
      default:
        return "scientificName";
    }
  }, []);
  
  const getIcon = useCallback((mode: DisplayMode) => {
    switch (mode) {
      case "common":
        return <PawPrint className="h-4 w-4 text-blue-500" />;
      case "scientific":
        return <FileText className="h-4 w-4 text-green-500" />;
      case "accession":
        return <Database className="h-4 w-4 text-purple-500" />;
      default:
        return <FileText className="h-4 w-4 text-green-500" />;
    }
  }, []);
  
  // Reset component function
  const resetComponent = useCallback(() => {
    setComponentError(null);
    setSuggestions([]);
    setHasSearched(false);
    cancelPreviousRequests("");
  }, [cancelPreviousRequests]);
  
  // Early return if no search term
  if (!searchTerm?.trim()) return null;
  
  // Render error state if there's a component error
  if (componentError) {
    return (
      <div className={`w-full ${className}`}>
        <div className="rounded-lg border shadow-md bg-white p-4">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            <span>{componentError}</span>
          </div>
          <button
            onClick={resetComponent}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`w-full ${className}`}>
      <div className="rounded-lg border shadow-md bg-white">
        <div>
          <div className="p-2 border-b">
            <div className="flex items-center gap-2 text-sm text-gray-700 px-2">
              <Search className="h-4 w-4" />
              <span>Suggestions</span>
              <span className="text-xs text-gray-500">
                (
                {displayMode === "common"
                  ? "Common Names"
                  : displayMode === "scientific"
                    ? "Scientific Names"
                    : "Accession Numbers"}
                )
              </span>
            </div>
          </div>
          <div>
            {loading ? (
              <div className="p-4 text-center text-gray-600">
                Loading suggestions...
              </div>
            ) : suggestions.length > 0 ? (
              suggestions.map((suggestion, index) => {
                // Safety check for valid suggestion
                if (!isValidSuggestion(suggestion)) {
                  return null;
                }
                
                const suggestionId = getSuggestionProperty(suggestion, 'id', '');
                const scientificName = getSuggestionProperty(suggestion, 'scientificName', 'Unknown Scientific Name');
                const primaryCommonName = getSuggestionProperty(suggestion, 'primaryCommonName', 'Unknown Common Name');
                const additionalCommonNames = getSuggestionProperty(suggestion, 'additionalCommonNames', []);
                const suggestionType = getSuggestionProperty(suggestion, 'type', 'Unknown');
                
                const currentLabel = currentLabels[suggestionId] ||
                  generateLabel(suggestion, displayMode, autoLabelingEnabled, selectedItems);
                
                return (
                  <div
                    key={`suggestion-${suggestionId || index}`}
                    onClick={() => handleSuggestionSelect(suggestion)}
                    className="p-3 hover:bg-gray-100 cursor-pointer transition-colors"
                  >
                    <div className="flex justify-between items-center group">
                      <div className="flex items-center gap-2">
                        {getIcon(displayMode)}
                        <span className="font-medium text-gray-900">
                          {currentLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-700">
                        <Tag className="h-4 w-4" />
                        <span className="text-xs">{suggestionType}</span>
                        <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-gray-600 italic ml-6 mt-1">
                      <Info className="h-3 w-3" />
                      <span>
                        {displayMode === "common"
                          ? scientificName
                          : displayMode === "scientific"
                            ? primaryCommonName
                            : `${primaryCommonName} (${scientificName})`}
                      </span>
                    </div>
                    
                    {Array.isArray(additionalCommonNames) &&
                      additionalCommonNames.length > 0 &&
                      displayMode !== "accession" && (
                        <div className="flex gap-2 text-xs text-gray-600 mt-1 ml-6">
                          <Tag className="h-3 w-3" />
                          <span>
                          Also known as:{" "}
                            {additionalCommonNames.join(", ")}
                        </span>
                        </div>
                      )}
                  </div>
                );
              })
            ) : hasSearched && searchTerm.trim().length > 2 ? (
              <div className="p-4 text-center text-gray-600" onClick={resetComponent}>
                <span className="cursor-pointer hover:text-blue-600">
                  No suggestions found. Click to try again.
                </span>
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
