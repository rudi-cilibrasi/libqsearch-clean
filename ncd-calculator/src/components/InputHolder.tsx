import React from "react";
import {Dna, FileType2, Globe2, Telescope, X} from "lucide-react";
import {FASTA, FILE_UPLOAD, LANGUAGE} from "../constants/modalConstants";
import type {SelectedItem} from "./workbenchTypes";

export interface InputAccumulatorProps {
  MIN_ITEMS?: number;
  selectedItems: SelectedItem[];
  onRemoveItem: (id: string) => void;
  authenticated?: boolean;
}

export const InputHolder: React.FC<InputAccumulatorProps> = ({
  MIN_ITEMS = 4,
  selectedItems,
  onRemoveItem,
  authenticated,
}) => {
  const items = Array.isArray(selectedItems) ? selectedItems : [];
  const remainingItems = Math.max(MIN_ITEMS - items.length, 0);

  const renderItemWithIcon = (
    item: SelectedItem,
    type: typeof FASTA | typeof LANGUAGE | typeof FILE_UPLOAD
  ) => {
    switch (type) {
      case FASTA:
        return (
          <div className="selected-object__identity">
            <Dna size={17} aria-hidden="true" />
            <span>{item.label}</span>
          </div>
        );
      case LANGUAGE:
        return (
          <div className="selected-object__identity">
            <Globe2 size={17} aria-hidden="true" />
            <span>{item.label}</span>
          </div>
        );
      default:
        return (
          <div className="selected-object__identity">
            {item.astronomyProvenance
              ? <Telescope size={17} aria-hidden="true" />
              : <FileType2 size={17} aria-hidden="true" />}
            <span>{item.label}</span>
          </div>
        );
    }
  };
    return (
        <section className="workbench-panel selected-objects" aria-label="Comparison set">
            <div className="selected-objects__summary" aria-live="polite">
                <strong>{items.length} {items.length === 1 ? "object" : "objects"}</strong>
                {remainingItems > 0 && <span>{remainingItems} more needed</span>}
                {!authenticated && items.length > 16 && (
                    <p className="selected-objects__limit" role="alert">
                        Sign in to prepare a set larger than 16 objects.
                    </p>
                )}
            </div>
            <div className="selected-objects__progress" aria-label={`${items.length} of ${MIN_ITEMS} required objects selected`}>
                <span style={{width: `${Math.min((items.length / MIN_ITEMS) * 100, 100)}%`}} />
            </div>
            <div className="selected-objects__body">
                {items.length === 0 ? (
                    <div className="selected-objects__empty">
                        <span aria-hidden="true">∅</span>
                        <strong>No objects yet</strong>
                    </div>
                ) : (
                  <ol className="selected-objects__list">
                    {items.map((item) => (
                        <li
                            key={item.id}
                            className="selected-object"
                        >
                            {renderItemWithIcon(item, item.type)}
                            <button type="button" onClick={() => onRemoveItem(item.id)} aria-label={`Remove ${item.label || "object"}`}>
                                <X size={16} aria-hidden="true"/>
                            </button>
                        </li>
                    ))}
                  </ol>
                )}
            </div>
        </section>
    );
};
