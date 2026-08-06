import {FILE_UPLOAD} from "../constants/modalConstants";
import type {SelectedItem} from "./workbenchTypes";

const repeatSequence = (motif: string): string => motif.repeat(48);

const EXAMPLE_ITEMS: ReadonlyArray<SelectedItem> = [
    {
        id: "example-alpha",
        label: "Sequence alpha",
        type: FILE_UPLOAD,
        content: repeatSequence("ACGTTGCAACGTCGTA"),
    },
    {
        id: "example-beta",
        label: "Sequence beta",
        type: FILE_UPLOAD,
        content: repeatSequence("ACGTTGCAACGTCGTT"),
    },
    {
        id: "example-gamma",
        label: "Sequence gamma",
        type: FILE_UPLOAD,
        content: repeatSequence("TTAGGCCATTAGCGCA"),
    },
    {
        id: "example-delta",
        label: "Sequence delta",
        type: FILE_UPLOAD,
        content: repeatSequence("TTAGGCCATTAGCGCT"),
    },
];

/**
 * Return a fresh comparison set so callers can safely modify item content.
 * Alpha/beta and gamma/delta form two deliberately related pairs.
 */
export const getWorkbenchExampleItems = (): SelectedItem[] => (
    EXAMPLE_ITEMS.map((item) => ({...item}))
);
