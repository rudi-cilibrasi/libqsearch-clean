import React, { useState } from "react";
import {ChevronRight} from "lucide-react";
import { LANGUAGE_NAMES } from "../functions/udhr";
import { SearchInput } from "./SearchInput";
import {LANGUAGE} from "../constants/modalConstants";
import type {SelectedItem} from "./workbenchTypes";

interface LanguageProps {
    addItem: (item: SelectedItem) => void;
    selectedItems: SelectedItem[];
}

export const Language: React.FC<LanguageProps> = ({
                                                      addItem,
                                                      selectedItems,
                                                  }) => {
    const [searchTerm, setSearchTerm] = useState<string>("");

    const safeSelectedItems = Array.isArray(selectedItems) ? selectedItems : [];

    const availableLanguages: SelectedItem[] = Object.entries(LANGUAGE_NAMES).map(
        ([code, name]) => ({
            id: code,
            type: LANGUAGE,
            label: name,
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
        <div className="source-browser language-browser">
            <div className="source-browser__search">
                <SearchInput
                    label="Filter languages"
                    type="language"
                    handleSearchTerm={handleSearchTerm}
                    searchTerm={searchTerm}
                />
            </div>

            <div className="source-browser__results source-browser__results--list">
                <div className="source-option-list">
                    {availableLanguages
                        .filter((lang) => lang.label.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map((lang) => {
                            const selected = isItemSelected(lang.id);
                            return (
                                <button
                                    type="button"
                                    key={lang.id}
                                    onClick={() => addItem(lang)}
                                    disabled={selected}
                                    aria-pressed={selected}
                                    className="source-option"
                                >
                                    <span>{lang.label}</span>
                                    <small>{lang.id.toUpperCase()}</small>
                                    {selected ? <em>Added</em> : <ChevronRight size={17} aria-hidden="true"/>}
                                </button>
                            );
                        })}
                </div>
            </div>
        </div>
    );
};
