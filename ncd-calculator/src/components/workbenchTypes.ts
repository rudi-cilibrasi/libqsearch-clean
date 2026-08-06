import {FASTA, FILE_UPLOAD, LANGUAGE} from "../constants/modalConstants";

export interface SelectedItem {
    id: string;
    label: string;
    content?: string;
    type: typeof FASTA | typeof LANGUAGE | typeof FILE_UPLOAD;
    cacheKey?: string;
}
