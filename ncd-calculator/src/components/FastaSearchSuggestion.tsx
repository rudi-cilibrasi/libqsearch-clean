import { useEffect, useState } from "react";
import {
  ChevronRight,
  Database,
  FileText,
  Info,
  PawPrint,
  Search,
  Tag,
} from "lucide-react";
import { parseAccessionAndRemoveVersion } from "../cache/cache.ts";
import { PaginatedResults, Suggestion } from "@/clients/genbank.ts";
import { SelectedItem } from "./InputAccumulator";
import { GenBankSearchService } from "@/clients/GenBankSearchService.ts";

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
  const [currentLabels, setCurrentLabels] = useState<Record<string, string>>(
    {}
  );

  const generateLabel = (
    suggestion: Suggestion,
    displayMode: DisplayMode,
    autoLabelingEnabled: boolean,
    existingItems: SelectedItem[]
  ) => {
    let label =
      displayMode === "common"
        ? suggestion.primaryCommonName
        : displayMode === "scientific"
        ? suggestion.scientificName
        : suggestion.id;

    if (!autoLabelingEnabled) {
      return label;
    }

    const isDuplicate = existingItems.some(
      (item) =>
        item.label === label ||
        (item.label && item.label.split(" (")[0] === label)
    );

    if (isDuplicate) {
      if (displayMode === "common") {
        label = `${label} (${suggestion.scientificName})`;

        const stillDuplicate = existingItems.some(
          (item) => item.label === label
        );
        if (stillDuplicate) {
          label = `${label} [${suggestion.id}]`;
        }
      } else if (displayMode === "scientific") {
        label = `${label} [${suggestion.id}]`;
      }
    }

    return label;
  };

  // Effect for fetching suggestions
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
        const count =
          getLastLocalPageCountObj(searchTerm) === null
            ? 0
            : getLastLocalPageCountObj(searchTerm).count;
        const startIndex = getFastaSuggestionStartIndex(normalizedSearchTerm);
        const paginatedSuggestions: PaginatedResults =
          await genbankSearchService.getSuggestions(
            normalizedSearchTerm,
            count + 1,
            startIndex,
            displayMode
          );
        setSuggestions(paginatedSuggestions.suggestions || []);
        setHasSearched(true);
        if (
          paginatedSuggestions &&
          paginatedSuggestions.suggestions.length !== 0
        ) {
          setLastLocalPageCountObj(normalizedSearchTerm, count + 1);
          setFastaSuggestionStartIndex({
            ...getAllFastaSuggestionWithLastIndex(),
            [normalizedSearchTerm]:
              parseInt(startIndex) + paginatedSuggestions.suggestions.length,
          });
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

  // Effect for updating labels when autoLabelingEnabled or displayMode changes
  useEffect(() => {
    if (suggestions.length > 0) {
      const newLabels = suggestions.reduce((acc, suggestion) => {
        acc[suggestion.id] = generateLabel(
          suggestion,
          displayMode,
          autoLabelingEnabled,
          selectedItems
        );
        return acc;
      }, {} as Record<string, string>);
      setCurrentLabels(newLabels);
    }
  }, [autoLabelingEnabled, displayMode, suggestions, selectedItems]);

  const getLastLocalPageCountObj = (searchTerm: string) => {
    const obj = localPageCount[searchTerm];
    return obj || null;
  };

  const setLastLocalPageCountObj = (searchTerm: string, count: number) => {
    setLocalPageCount({
      ...localPageCount,
      [searchTerm]: {
        count: count,
        timestamp: Date.now(),
      },
    });
  };

  const handleSuggestionSelect = (suggestion: Suggestion) => {
    const label =
      currentLabels[suggestion.id] ||
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
      id: parseAccessionAndRemoveVersion(suggestion.id),
      searchTerm: suggestion[getPrimaryField(displayMode)].trim().toLowerCase(),
    };
    addItem(input);
    setSelectedIds((prev) => new Set([...prev, suggestion.id]));
    setSuggestions((current) => current.filter((s) => s.id !== suggestion.id));
  };

  const getPrimaryField = (mode: DisplayMode) => {
    switch (mode) {
      case "common":
        return "primaryCommonName";
      case "scientific":
        return "scientificName";
      case "accession":
        return "id";
    }
  };

  const getIcon = (mode: DisplayMode) => {
    switch (mode) {
      case "common":
        return <PawPrint className="h-4 w-4 text-blue-500" />;
      case "scientific":
        return <FileText className="h-4 w-4 text-green-500" />;
      case "accession":
        return <Database className="h-4 w-4 text-purple-500" />;
    }
  };

  if (!searchTerm?.trim()) return null;

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
              suggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  onClick={() => handleSuggestionSelect(suggestion)}
                  className="p-3 hover:bg-gray-100 cursor-pointer transition-colors"
                >
                  <div className="flex justify-between items-center group">
                    <div className="flex items-center gap-2">
                      {getIcon(displayMode)}
                      <span className="font-medium text-gray-900">
                        {currentLabels[suggestion.id] ||
                          generateLabel(
                            suggestion,
                            displayMode,
                            autoLabelingEnabled,
                            selectedItems
                          )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <Tag className="h-4 w-4" />
                      <span className="text-xs">{suggestion.type}</span>
                      <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600 italic ml-6 mt-1">
                    <Info className="h-3 w-3" />
                    <span>
                      {displayMode === "common"
                        ? suggestion.scientificName
                        : displayMode === "scientific"
                        ? suggestion.primaryCommonName
                        : `${suggestion.primaryCommonName} (${suggestion.scientificName})`}
                    </span>
                  </div>

                  {suggestion.additionalCommonNames?.length > 0 &&
                    displayMode !== "accession" && (
                      <div className="flex gap-2 text-xs text-gray-600 mt-1 ml-6">
                        <Tag className="h-3 w-3" />
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
