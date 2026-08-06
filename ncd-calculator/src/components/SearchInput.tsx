import React from "react";
import { Search } from "lucide-react";
import {GenBankSearchService} from "@/services/GenBankSearchService.ts";


interface SearchInputProps {
  type: "fasta" | "language" | "file";
  label: string;
  searchTerm: string;
  handleSearchTerm: (term: string) => void;
  setSearchError?: (error: string) => void;
  genbankSearchService?: GenBankSearchService;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  type,
  label,
  searchTerm,
  handleSearchTerm,
  setSearchError,
  genbankSearchService,
}) => {
  const handlePress = async (
    event: React.KeyboardEvent<HTMLInputElement>
  ): Promise<void> => {
    if (event.key === "Enter" || event.key === "Return") {
      event.preventDefault();
      if (type === "fasta" && genbankSearchService && setSearchError) {
        const valid = await genbankSearchService.hasGenbankRecordForSearchTerm(
          searchTerm
        );
        if (!valid) {
          setSearchError(
            "There was no Genbank record found for the search term"
          );
        }
      }
    }
  };

  return (
    <div className="source-search">
      <label htmlFor={`source-search-${type}`}>{label}</label>
      <div className="source-search__control">
        <Search size={18} aria-hidden="true" />
        <input
          id={`source-search-${type}`}
          type="text"
          value={searchTerm}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            handleSearchTerm(e.target.value)
          }
          onKeyDown={handlePress}
          placeholder={type === "fasta" ? "Species, scientific name, or accession" : "Filter the reference corpus"}
        />
      </div>
    </div>
  );
};
