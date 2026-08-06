import React, { useState } from "react";
import {ChevronRight} from "lucide-react";
import {UDHR_LANGUAGES} from "../functions/udhr";
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

            <div
                className="source-browser__results source-browser__results--list source-browser__results--scrollable"
                role="region"
                aria-label="Available languages"
                tabIndex={0}
            >
                <ul className="source-option-list">
                    {UDHR_LANGUAGES
                        .filter((language) => {
                            const query = searchTerm.trim().toLowerCase();
                            return !query || [
                                language.name,
                                language.id,
                                language.languageTag,
                                language.iso6393,
                            ].some((value) => value?.toLowerCase().includes(query));
                        })
                        .map((language) => {
                            const selected = isItemSelected(language.id);
                            const item: SelectedItem = {
                                id: language.id,
                                type: LANGUAGE,
                                label: language.name,
                                content: "",
                            };
                            return (
                                <li key={language.id}>
                                    <button
                                        type="button"
                                        onClick={() => addItem(item)}
                                        disabled={selected}
                                        aria-pressed={selected}
                                        className="source-option"
                                    >
                                        <span>{language.name}</span>
                                        <small>{language.languageTag}</small>
                                        {selected ? <em>Added</em> : <ChevronRight size={17} aria-hidden="true"/>}
                                    </button>
                                </li>
                            );
                        })}
                </ul>
            </div>
        </div>
    );
};
