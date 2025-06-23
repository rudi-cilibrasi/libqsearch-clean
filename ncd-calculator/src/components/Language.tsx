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
        <div className="min-h-0 flex flex-col p-4 gap-4">
            {/* Fixed top section */}
            <div>
                <SearchInput
                    label="Available Languages"
                    type="language"
                    handleSearchTerm={handleSearchTerm}
                    searchTerm={searchTerm}
                />
            </div>

            {/* Information Box - Styled similarly to FileUpload */}
            <div className="p-3 bg-blue-900/30 border border-blue-700 rounded-lg">
                <div className="flex items-start gap-2">
                    <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-2">
                        <div>
                            <h3 className="text-blue-300 font-medium text-sm">
                                Explore Language Relationships! ✨
                            </h3>
                            <p className="text-blue-200 text-xs mt-1 leading-relaxed">
                                Using the Universal Declaration of Human Rights (UDHR), discover how
                                languages relate to each other. Select at least {MIN_ITEMS} languages
                                to generate a meaningful visualization.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Available Languages List */}
            <div className="flex-1 min-h-0">
                <div className="h-full overflow-y-auto">
                    <div className="flex flex-col gap-2">
                        {availableLanguages
                            .filter((lang) =>
                                lang.label.toLowerCase().includes(searchTerm.toLowerCase())
                            )
                            .map((lang) => (
                                <div
                                    key={lang.id}
                                    onClick={() => addItem(lang)}
                                    className={`flex justify-between items-center p-4 rounded-lg cursor-pointer transition-all
                                        ${
                                        isItemSelected(lang.id)
                                            ? "bg-blue-600/20 border border-blue-500"
                                            : "bg-gray-700 border border-gray-600 hover:bg-gray-650 hover:border-gray-500"
                                    }`}
                                >
                                    <span className="text-gray-200">{lang.label}</span>
                                    <ChevronRight size={20} className="text-gray-400" />
                                </div>
                            ))}
                    </div>
                </div>
            </div>
        </div>
    );
};