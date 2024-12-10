import React, { useState } from "react";
import { ChevronRight, Info } from "lucide-react";
import { LANGUAGE_NAMES } from "../functions/udhr";
import { SearchInput } from "./SearchInput";

interface LanguageItem {
    id: string;
    type: "language";
    label: string;
    content: string;
}

interface LanguageProps {
    MIN_ITEMS: number;
    addItem: (item: LanguageItem) => void;
    selectedItems: LanguageItem[];
}

export const Language: React.FC<LanguageProps> = ({
                                                      MIN_ITEMS,
                                                      addItem,
                                                      selectedItems,
                                                  }) => {
    const [searchTerm, setSearchTerm] = useState<string>("");

    const safeSelectedItems = Array.isArray(selectedItems) ? selectedItems : [];

    const availableLanguages: LanguageItem[] = Object.keys(LANGUAGE_NAMES).map(
        (code) => ({
            id: code,
            type: "language" as const,
            label: LANGUAGE_NAMES[code],
            content: "",
        })
    );

    const handleSearchTerm = (searchTerm: string): void => {
        setSearchTerm(searchTerm);
    };

    const isItemSelected = (langId: string): boolean => {
        return safeSelectedItems.some((item) => item.id === langId);
    };

    return (
        <div className="p-4 h-[700px] flex flex-col">
            <SearchInput
                label="Available Languages"
                type="language"
                handleSearchTerm={handleSearchTerm}
                searchTerm={searchTerm}
            />
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
                <Info className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                <p className="m-0 text-blue-800 text-sm leading-relaxed">
                    Explore language relationships through the{" "}
                    <strong>Universal Declaration of Human Rights (UDHR)</strong>. Select
                    at least {MIN_ITEMS} languages to generate a meaningful language tree
                    visualization using Normalized Compression Distance (NCD).
                </p>
            </div>
            <div className="flex flex-col gap-2.5 max-h-[350px] overflow-y-auto p-1">
                {availableLanguages
                    .filter((lang) =>
                        lang.label.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((lang) => (
                        <div
                            key={lang.id}
                            onClick={() => addItem(lang)}
                            className={`flex justify-between items-center p-4 rounded-lg cursor-pointer transition-all
                ${isItemSelected(lang.id)
                                ? "bg-blue-50 border border-blue-200"
                                : "bg-gray-50 border border-gray-200 hover:bg-gray-100"
                            }`}
                        >
                            <span className="text-gray-700">{lang.label}</span>
                            <ChevronRight size={20} className="text-gray-400" />
                        </div>
                    ))}
            </div>
        </div>
    );
};