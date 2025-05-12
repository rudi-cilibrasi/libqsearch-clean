// src/data/taxonomy/groups.ts
import {TaxonomicGroup, TaxonomicGroupKey} from './types';

/**
 * Defines the core taxonomic groups with their search strategies.
 * Each group contains its unique taxonomy ID, display name, search terms,
 * and a specific search strategy tailored to how GenBank organizes data
 * for that particular taxonomic group.
 */
export const TAXONOMIC_GROUPS: Record<TaxonomicGroupKey, TaxonomicGroup> = {
    MAMMALS: {
        id: "40674",
        name: "MAMMALS",
        displayName: "Mammals",
        searchTerms: ["breed", "strain", "subspecies"],
        searchStrategy: {
            primary: ["breed", "strain"],
            secondary: ["subspecies"],
            sequences: ["mitochondrion", "genome", "chromosome", "mitochondrial genome", "complete genome"],
            excludeTerms: ["partial", "segment", "fragment", "unplaced", "contig", "scaffold"],
        }
    },
    BIRDS: {
        id: "8782",
        name: "BIRDS",
        displayName: "Birds",
        searchTerms: ["breed", "strain", "subspecies"],
        searchStrategy: {
            primary: ["breed", "subspecies"],
            secondary: ["strain", "population"],
            sequences: ["mitochondrion", "genome", "chromosome", "complete mitochondrial genome"],
            excludeTerms: ["partial", "fragment", "unplaced"],
        }
    },
    REPTILES: {
        id: "8504",
        name: "REPTILES",
        displayName: "Reptiles",
        searchTerms: ["strain", "subspecies", "population"],
        searchStrategy: {
            primary: ["subspecies", "population"],
            secondary: ["strain", "variety"],
            sequences: ["mitochondrion", "genome", "complete genome", "mitochondrial DNA"],
            excludeTerms: ["partial", "unplaced", "contig"],
        }
    },
    AMPHIBIANS: {
        id: "8292",
        name: "AMPHIBIANS",
        displayName: "Amphibians",
        searchTerms: ["strain", "population", "subspecies"],
        searchStrategy: {
            primary: ["strain", "population"],
            secondary: ["subspecies"],
            sequences: ["mitochondrion", "genome", "complete", "mitochondrial genome"],
            excludeTerms: ["partial", "fragment", "unplaced"],
        }
    },
    FISH: {
        id: "7898",
        name: "FISH",
        displayName: "Fish",
        searchTerms: ["strain", "variety", "population"],
        searchStrategy: {
            primary: ["strain", "population"],
            secondary: ["variety", "subspecies"],
            sequences: ["mitochondrion", "genome", "complete", "D-loop", "control region", "mitochondrial DNA"],
            excludeTerms: ["partial", "fragment", "unplaced", "contig"],
        }
    },
    INSECTS: {
        id: "50557",
        name: "INSECTS",
        displayName: "Insects",
        searchTerms: ["strain", "variety", "ecotype"],
        searchStrategy: {
            primary: ["strain", "variety"],
            secondary: ["ecotype", "population"],
            sequences: ["mitochondrion", "genome", "complete genome", "mitochondrial DNA"],
            excludeTerms: ["partial", "segment", "unplaced"],
        }
    },
    VERTEBRATES: {
        id: "7742",
        name: "VERTEBRATES",
        displayName: "Vertebrates",
        searchTerms: ["breed", "strain", "subspecies"],
        searchStrategy: {
            primary: ["breed", "strain", "subspecies"],
            secondary: ["population"],
            sequences: ["mitochondrion", "genome", "complete genome", "mitochondrial genome"],
            excludeTerms: ["partial", "unplaced", "contig", "scaffold"],
        }
    }
};
