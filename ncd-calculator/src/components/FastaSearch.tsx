import React, {useCallback, useState} from "react";
import {getCleanSequence, isFasta} from "../functions/fasta.js";
import {FileInfo, getFile} from "../functions/file.js";
import {Database, FileText, PawPrint} from "lucide-react";
import {SearchInput} from "./SearchInput.jsx";
import {FASTA} from "../constants/modalConstants.js";
import {FastaSearchSuggestion} from "./FastaSearchSuggestion.jsx";
import {GenBankSearchService} from "@/services/GenBankSearchService.ts";
import {LocalStorageKeyManager} from "../cache/LocalStorageKeyManager.js";
import {SelectedItem} from "./InputAccumulator";
import AutoLabelingToggle from "@/components/AutoLabelingToggle.tsx";

interface FastaSearchProps {
  addItem(item: SelectedItem | any): void;
  selectedItems: SelectedItem[];
  onSetApiKey(key: string): void;
  setSelectedItems(items: SelectedItem[] | any): void;
  getAllFastaSuggestionWithLastIndex(): void;
  getFastaSuggestionStartIndex(): void;
  setFastaSuggestionStartIndex(index: number): void;
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
  onSetApiKey,
  setSelectedItems,
  getAllFastaSuggestionWithLastIndex,
  getFastaSuggestionStartIndex,
  setFastaSuggestionStartIndex,
}) => {
  const [apiKey, setApiKey] = useState("");
  const [isDragging, setIsDragging] = useState(false);
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
  const [searchError, setSearchError] = useState(null);
  const genbankSearchService = new GenBankSearchService();
  const localStorageKeyManager = LocalStorageKeyManager.getInstance();

  const [autoLabelingEnabled, setAutoLabelingEnabled] = useState(true);



  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleSearchTerm = (searchTerm: string) => {
    setSearchTerm(searchTerm);
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      const fileInfos: FileInfo[] = await Promise.all(
        files.map(async (file) => await getFile(file))
      );
      const newItems: SelectedItem[] = fileInfos
        .map((file) => getFileItem(file))
        .filter(
          (item) => !selectedItems.find((selected) => selected.id === item.id)
        );
      setSelectedItems((prev: SelectedItem[]) => [...prev, ...newItems]);
    },
    [selectedItems, setSelectedItems]
  );

  const getFileItem = (fileInfo: FileInfo) => {
    if (isFasta(fileInfo)) {
      const sequenceClean = getCleanSequence(fileInfo.content as string);
      return {
        type: FASTA,
        content: sequenceClean,
        label: fileInfo.name,
        id: fileInfo.name,
      };
    } else {
      return {
        type: FASTA,
        content: fileInfo.content,
        label: fileInfo.name,
        id: fileInfo.name,
      };
    }
  };

const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files as FileList);
  const readyFiles = await Promise.all(files.map((file: File) => getFile(file)));
  const newItems: SelectedItem[] = readyFiles
    .map((file) => getFileItem(file))
    .filter(
      (item) => !selectedItems.find((selected) => selected.id === item.id)
    );
  setSelectedItems((prev: SelectedItem[]) => [...prev, ...newItems]);
};

  const handleKeydown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const item = {
        type: "fasta",
        id: searchTerm,
        label: searchTerm,
        content: "",
      };
      addItem(item);
    }
  };

  const handleApiKey = (key) => {
    setApiKey(key);
    onSetApiKey(key);
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


  const handleSuggestionSelect = (suggestion) => {
    handleSearchTerm(suggestion.primaryCommonName);
    addItem({
      id: suggestion.id,
      name: suggestion.primaryCommonName,
      scientificName: suggestion.scientificName,
      type: suggestion.type,
    });
  };

  const onSelectSearchTerm = (item) => {
    addItem({
      id: item.accessionId,
      type: FASTA,
      content: "",
      label: item.title,
    });
  };

  const getSelectedDisplayMode = (): string => {
    const selected: ProjectionOption[] = projections.filter((p) => p.selected);
    if (selected.length === 0) return "accession";
    return selected[0].name;
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
      <div className="mt-auto border-t border-gray-200 pt-4">


        <div className="mb-4 mx-6">
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-sm font-medium text-gray-700">
              Display Mode
            </label>
            <AutoLabelingToggle
                enabled={autoLabelingEnabled}
                onToggle={() => setAutoLabelingEnabled(!autoLabelingEnabled)}
            />
          </div>
          <div className="inline-flex bg-white rounded-lg p-1 gap-2 border border-gray-200">
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
                          ? "bg-blue-100 text-blue-600 shadow-sm border border-blue-200"
                          : "bg-gray-50 text-gray-600 hover:text-gray-800 hover:bg-gray-100"}
          `}
                  >
                    <Icon className={`w-3.5 h-3.5 ${projection.selected ? 'text-blue-600' : 'text-gray-500'}`}/>
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
