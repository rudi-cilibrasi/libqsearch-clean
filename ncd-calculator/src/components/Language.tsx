import React, {useMemo, useState} from "react";
import {ChevronDown, ChevronRight} from "lucide-react";
import {
    getUdhrLanguage,
    getUdhrRecordDisplayLabel,
    UDHR_LANGUAGE_GROUPS,
    UDHR_SCRIPT_NAMES,
} from "../functions/udhr";
import {SearchInput} from "./SearchInput";
import {LANGUAGE} from "../constants/modalConstants";
import type {SelectedItem} from "./workbenchTypes";
import type {UdhrLanguageGroup, UdhrLanguageRecord} from "../functions/udhr";

interface LanguageProps {
    addItem: (item: SelectedItem) => void;
    selectedItems: SelectedItem[];
}

const normalizeSearchText = (value: string): string => value
    .normalize("NFKD")
    .replace(/\p{Mark}+/gu, "")
    .toLocaleLowerCase("en")
    .trim();

const getSearchText = (group: UdhrLanguageGroup): string => normalizeSearchText([
    group.name,
    group.id,
    ...group.records.flatMap((record) => [
        record.name,
        record.sourceName ?? "",
        record.sourceKey,
        record.languageTag,
        record.script,
        UDHR_SCRIPT_NAMES[record.script] ?? "",
    ]),
].join(" "));

const GROUP_SEARCH_INDEX = new Map(
    UDHR_LANGUAGE_GROUPS.map((group) => [group.id, getSearchText(group)]),
);

export const Language: React.FC<LanguageProps> = ({addItem, selectedItems}) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedGroupIds, setExpandedGroupIds] = useState<ReadonlySet<string>>(new Set());

    const selectedRecordIds = useMemo(() => new Set(
        (Array.isArray(selectedItems) ? selectedItems : [])
            .filter(({type}) => type === LANGUAGE)
            .map(({id}) => getUdhrLanguage(id)?.id)
            .filter((id): id is string => id !== undefined),
    ), [selectedItems]);

    const visibleGroups = useMemo(() => {
        const tokens = normalizeSearchText(searchTerm).split(/\s+/u).filter(Boolean);
        if (tokens.length === 0) return UDHR_LANGUAGE_GROUPS;
        return UDHR_LANGUAGE_GROUPS.filter((group) => {
            const searchable = GROUP_SEARCH_INDEX.get(group.id) ?? "";
            return tokens.every((token) => searchable.includes(token));
        });
    }, [searchTerm]);

    const addRecord = (record: UdhrLanguageRecord): void => {
        const label = getUdhrRecordDisplayLabel(record.id) ?? record.name;
        addItem({id: record.id, type: LANGUAGE, label, content: ""});
    };

    const toggleGroup = (groupId: string): void => {
        setExpandedGroupIds((current) => {
            const next = new Set(current);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    };

    const renderRecordButton = (
        record: UdhrLanguageRecord,
        group: UdhrLanguageGroup,
    ): React.ReactNode => {
        const selected = selectedRecordIds.has(record.id);
        const label = getUdhrRecordDisplayLabel(record.id) ?? record.name;
        const disabled = selected || !record.comparisonReady;
        return (
            <button
                type="button"
                onClick={() => addRecord(record)}
                disabled={disabled}
                aria-pressed={selected}
                aria-label={record.comparisonReady ? label : `${label}, unavailable for comparison`}
                className="language-variant"
            >
                <span>{group.records.length === 1 ? group.name : label}</span>
                <em>{selected ? "Added" : record.comparisonReady ? "Add" : "Unavailable"}</em>
            </button>
        );
    };

    return (
        <div className="source-browser language-browser">
            <div className="source-browser__search">
                <SearchInput
                    label="Filter languages"
                    type="language"
                    handleSearchTerm={setSearchTerm}
                    searchTerm={searchTerm}
                    describedBy="language-search-count"
                />
                <output id="language-search-count" className="language-browser__count" aria-live="polite">
                    {visibleGroups.length} {visibleGroups.length === 1 ? "language" : "languages"}
                </output>
            </div>

            <div
                className="source-browser__results source-browser__results--list source-browser__results--scrollable"
                role="region"
                aria-label="Available UDHR language groups"
                tabIndex={0}
            >
                {visibleGroups.length === 0 ? (
                    <p className="language-browser__empty" role="status">No matching languages</p>
                ) : (
                    <ul className="source-option-list language-group-list">
                        {visibleGroups.map((group) => {
                            const hasVariants = group.records.length > 1;
                            const variantListId = `udhr-variants-${group.id}`;
                            const expanded = hasVariants && expandedGroupIds.has(group.id);
                            const onlyRecord = group.records[0];
                            return (
                                <li key={group.id} className="language-group">
                                    {hasVariants ? (
                                        <button
                                            type="button"
                                            onClick={() => toggleGroup(group.id)}
                                            aria-expanded={expanded}
                                            aria-controls={variantListId}
                                            aria-label={`${group.name}, ${group.records.length} variants`}
                                            className="source-option language-group__toggle"
                                        >
                                            <span>{group.name}</span>
                                            <small>{group.records.length} variants</small>
                                            <ChevronDown size={17} aria-hidden="true"/>
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => addRecord(onlyRecord)}
                                            disabled={!onlyRecord.comparisonReady || selectedRecordIds.has(onlyRecord.id)}
                                            aria-pressed={selectedRecordIds.has(onlyRecord.id)}
                                            aria-label={onlyRecord.comparisonReady
                                                ? group.name
                                                : `${group.name}, unavailable for comparison`}
                                            className="source-option"
                                        >
                                            <span>{group.name}</span>
                                            <em>{selectedRecordIds.has(onlyRecord.id)
                                                ? "Added"
                                                : onlyRecord.comparisonReady ? "Add" : "Unavailable"}</em>
                                            <ChevronRight size={17} aria-hidden="true"/>
                                        </button>
                                    )}
                                    {hasVariants && expanded && (
                                        <ul id={variantListId} className="language-variant-list" aria-label={`${group.name} variants`}>
                                            {group.records.map((record) => (
                                                <li key={record.id}>{renderRecordButton(record, group)}</li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
};
