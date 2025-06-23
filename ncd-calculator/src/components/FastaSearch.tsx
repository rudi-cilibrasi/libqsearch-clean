import React, {useState} from "react";
import {Database, FileText, PawPrint} from "lucide-react";
import {SearchInput} from "./SearchInput.jsx";
import {FASTA} from "../constants/modalConstants.js";
import {FastaSearchSuggestion} from "./FastaSearchSuggestion.jsx";
import {GenBankSearchService} from "@/services/GenBankSearchService.ts";
import {LocalStorageKeyManager} from "../cache/LocalStorageKeyManager.js";
import AutoLabelingToggle from "@/components/AutoLabelingToggle.tsx";
import {Suggestion} from "@/services/genbank.ts";
import {SelectedItem} from "@/components/InputHolder.tsx";

interface FastaSearchProps {
  addItem(item: SelectedItem | any): void;
  selectedItems: SelectedItem[];
  onSetApiKey(key: string): void;
  setSelectedItems(items: SelectedItem[] | any): void;
  getAllFastaSuggestionWithLastIndex(): void;
  getFastaSuggestionStartIndex(): number;
  setFastaSuggestionStartIndex(index: number): number;
}

interface ProjectionOption {
  name: string;
  label: string;
  selected: boolean;
  icon: any;
}
export const FastaSearch: React.FC<FastaSearchProps> = ({
                                                          addItem,
                                                          selectedItems,
                                                          setSelectedItems,
                                                          getAllFastaSuggestionWithLastIndex,
                                                          getFastaSuggestionStartIndex,
                                                          setFastaSuggestionStartIndex,
                                                        }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [projections, setProjections] = useState<ProjectionOption[]>([
    {
      name: 'common',
      label: 'Common Name',
      icon: PawPrint,  // Add icons for each option
      selected: true
    },
    {
      name: 'scientific',
      label: 'Scientific Name',
      icon: FileText,
      selected: false
    },
    {
      name: 'accession',
      label: 'Accession ID',
      icon: Database,
      selected: false
    },
  ]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const genbankSearchService = new GenBankSearchService();
  const localStorageKeyManager = LocalStorageKeyManager.getInstance();
  const [autoLabelingEnabled, setAutoLabelingEnabled] = useState(true);

  const handleSearchTerm = (searchTerm: string) => {
    setSearchTerm(searchTerm);
  };

  const toggleProjection = (selectedKey: string) => {
    setProjections(prev => {
      if (prev.find(p => p.name === selectedKey)?.selected) {
        return prev;
      }
      return prev.map(projection => ({
        ...projection,
        selected: projection.name === selectedKey
      }));
    });
  };


  const handleSuggestionSelect = (suggestion: Suggestion) => {
    handleSearchTerm(suggestion.primaryCommonName);
    addItem({
      id: suggestion.id,
      name: suggestion.primaryCommonName,
      scientificName: suggestion.scientificName,
      type: suggestion.type,
    });
  };

  const onSelectSearchTerm = (item: any) => {
    addItem({
      id: item.accessionId,
      type: FASTA,
      content: "",
      label: item.title,
    });
  };

  const getSelectedDisplayMode = (): "common" | "scientific" | "accession" => {
    const selected: ProjectionOption[] = projections.filter((p) => p.selected);
    if (selected.length === 0) return "accession";
    return selected[0].name as "common" | "scientific" | "accession";
  }

  return (
      <div className="p-4 h-full flex flex-col">
        {/* Fixed top section */}
        <div>
          <SearchInput
              searchTerm={searchTerm}
              label="Enter Animal Name"
              type="fasta"
              handleSearchTerm={handleSearchTerm}
              setSearchError={setSearchError}
              genbankSearchService={genbankSearchService}
          />
        </div>
        <div className="flex-1">
          {searchError && (
              <div className="text-red-500 text-sm mt-2 ml-2">{searchError}</div>
          )}
          <FastaSearchSuggestion
              autoLabelingEnabled={autoLabelingEnabled}
              setSelectedItems={setSelectedItems}
              selectedItems={selectedItems}
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
              displayMode={getSelectedDisplayMode()}
          />
        </div>
        <div className="mt-auto border-t border-gray-700 pt-4 bg-gray-950">


          <div className="mb-4 mx-6">
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-sm font-medium text-gray-200">
                Display Mode
              </label>
              <AutoLabelingToggle
                  enabled={autoLabelingEnabled}
                  onToggle={() => setAutoLabelingEnabled(!autoLabelingEnabled)}
              />
            </div>
            <div className="inline-flex bg-gray-800 rounded-lg p-1 gap-2 border border-gray-700">
              {projections.map((projection) => {
                const Icon = projection.icon;
                return (
                    <button
                        key={projection.name}
                        onClick={() => toggleProjection(projection.name)}
                        className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
            transition-all duration-150 ease-in-out min-w-[100px]
            ${projection.selected
                            ? "bg-blue-600 text-white shadow-sm border border-blue-400"
                            : "bg-gray-700 text-gray-300 hover:text-gray-100 hover:bg-gray-600"}
          `}
                    >
                      <Icon className={`w-3.5 h-3.5 ${projection.selected ? 'text-white' : 'text-gray-400'}`}/>
                      <span>{projection.label}</span>
                    </button>
                );
              })}
            </div>
          </div>


        </div>
      </div>
  );
};