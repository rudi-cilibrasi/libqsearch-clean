import React, {useState} from "react";
import {SearchInput} from "./SearchInput.jsx";
import {FastaSearchSuggestion} from "./FastaSearchSuggestion.jsx";
import {GenBankSearchService} from "@/services/GenBankSearchService.ts";
import type {SelectedItem} from "./workbenchTypes";

interface FastaSearchProps {
  addItem(item: SelectedItem): void;
  selectedItems: SelectedItem[];
  getAllFastaSuggestionWithLastIndex(): Record<string, number>;
  getFastaSuggestionStartIndex(searchTerm: string): number;
  setFastaSuggestionStartIndex: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}

export const FastaSearch: React.FC<FastaSearchProps> = ({
                                                          addItem,
                                                          selectedItems,
                                                          getAllFastaSuggestionWithLastIndex,
                                                          getFastaSuggestionStartIndex,
                                                          setFastaSuggestionStartIndex,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const genbankSearchService = React.useMemo(() => new GenBankSearchService(), []);

  const handleSearchTerm = (searchTerm: string) => {
    setSearchTerm(searchTerm);
  };

  return (
      <div className="source-browser fasta-browser">
        <div className="source-browser__search">
          <SearchInput
              searchTerm={searchTerm}
              label="GenBank query"
              type="fasta"
              handleSearchTerm={handleSearchTerm}
              setSearchError={setSearchError}
              genbankSearchService={genbankSearchService}
          />
        </div>
        <div className="source-browser__results">
          {searchError && (
              <div className="workbench-inline-error" role="alert">{searchError}</div>
          )}
          <FastaSearchSuggestion
              autoLabelingEnabled={true}
              selectedItems={selectedItems}
              searchTerm={searchTerm}
              className="mt-2"
              addItem={addItem}
              genbankSearchService={genbankSearchService}
              setError={setSearchError}
              getAllFastaSuggestionWithLastIndex={getAllFastaSuggestionWithLastIndex}
              setFastaSuggestionStartIndex={setFastaSuggestionStartIndex}
              getFastaSuggestionStartIndex={getFastaSuggestionStartIndex}
              displayMode="common"
          />
        </div>
        <p className="source-browser__provenance">
          Records are retrieved from NCBI Nucleotide. NCBI does not endorse this application.
        </p>
      </div>
  );
};
