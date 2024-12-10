import React from "react";
import { Search } from "lucide-react";
import {GenBankSearchService} from "@/clients/GenBankSearchService.ts";


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
    <div className="p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">{label}</h3>
      <div className="relative">
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
          <Search size={20} className="text-gray-400" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            handleSearchTerm(e.target.value)
          }
          onKeyDown={handlePress}
          placeholder="Search..."
          className="w-full py-3 px-4 pl-12 border-2 border-gray-200 rounded-lg text-base outline-none
                        bg-black text-white placeholder-gray-400
                        focus:border-blue-500 transition-colors"
        />
      </div>
    </div>
  );
};
