import React from "react";
import { Search } from "lucide-react";


interface SearchInputProps {
  type: "fasta" | "language" | "file";
  label: string;
  searchTerm: string;
  handleSearchTerm: (term: string) => void;
  describedBy?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  type,
  label,
  searchTerm,
  handleSearchTerm,
  describedBy,
}) => {
  return (
    <div className="source-search">
      <label htmlFor={`source-search-${type}`}>{label}</label>
      <div className="source-search__control">
        <Search size={18} aria-hidden="true" />
        <input
          id={`source-search-${type}`}
          type="text"
          value={searchTerm}
          aria-describedby={describedBy}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            handleSearchTerm(e.target.value)
          }
          placeholder={type === "fasta" ? "Species, scientific name, or accession" : "Filter the reference corpus"}
        />
      </div>
    </div>
  );
};
