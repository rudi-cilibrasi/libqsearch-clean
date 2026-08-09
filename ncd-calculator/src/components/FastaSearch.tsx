import React, {useState} from "react";
import {SearchInput} from "./SearchInput.jsx";
import {FastaSearchSuggestion} from "./FastaSearchSuggestion.jsx";
import {GenBankSearchService} from "@/services/GenBankSearchService.ts";
import type {GenBankSearchScope} from "@/services/genbank";
import type {SelectedItem} from "./workbenchTypes";

interface FastaSearchProps {
  addItem(item: SelectedItem): void;
  selectedItems: SelectedItem[];
}

export const FastaSearch: React.FC<FastaSearchProps> = ({
                                                          addItem,
                                                          selectedItems,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [scope, setScope] = useState<GenBankSearchScope>("mitochondrial-genome");
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
          />
          <label className="genbank-scope-control">
            <span>Comparable sequence scope</span>
            <select value={scope} onChange={(event) => setScope(event.target.value as GenBankSearchScope)}>
              <option value="mitochondrial-genome">Complete mitochondrial genome</option>
              <option value="coi">COI / COX1 marker</option>
              <option value="cytb">Cytochrome b marker</option>
            </select>
          </label>
          <p className="source-browser__hint">
            Animal names search within one comparable scope. An accession retrieves that exact versioned record.
          </p>
        </div>
        <div className="source-browser__results">
          <FastaSearchSuggestion
              selectedItems={selectedItems}
              searchTerm={searchTerm}
              scope={scope}
              addItem={addItem}
              genbankSearchService={genbankSearchService}
          />
        </div>
        <p className="source-browser__provenance">
          Records are retrieved from NCBI Nucleotide. NCBI does not endorse this application.
        </p>
      </div>
  );
};
