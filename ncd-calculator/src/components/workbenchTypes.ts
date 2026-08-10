import {EEG, FASTA, FILE_UPLOAD, LANGUAGE} from "../constants/modalConstants";
import type {GenBankSequenceProvenance} from "../services/genbankSequencePipeline";
import type {GenBankRecordSuggestion} from "../services/genbank";
import type {AstronomyExampleProvenance} from "../services/astronomyExample";
import type {EegObjectProvenance} from "@/types/eeg";

export interface SelectedItem {
    id: string;
    label: string;
    content?: string;
    type: typeof FASTA | typeof LANGUAGE | typeof FILE_UPLOAD | typeof EEG;
    cacheKey?: string;
    genBankProvenance?: GenBankSequenceProvenance;
    genBankCandidate?: GenBankRecordSuggestion;
    astronomyProvenance?: AstronomyExampleProvenance;
    eegProvenance?: EegObjectProvenance;
}
