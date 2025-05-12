// base type
export type TaxonomicGroupKey =
    | "MAMMALS"
    | "BIRDS"
    | "FISH"
    | "REPTILES"
    | "AMPHIBIANS"
    | "INSECTS"
    | "VERTEBRATES"

export interface TaxonomicGroup {
    id: string; // NCBI Taxonomy ID
    name: TaxonomicGroupKey;
    displayName: string; // human-readable name
    searchTerms: string[]; // terms for building search queries
    searchStrategy: SearchStrategy; // how to search this group
}


export interface SearchStrategy {
    primary: string[]; // primary search terms;
    secondary: string[]; // secondary search terms;
    sequences: string[]; // sequence-related terms
    excludeTerms: string[]; // terms to exclude
}


export interface TaxonomicFamily {
    id: string; // NCBI taxonomic ID
    name: string; // scientific name
    commonName: string;
    groupKey: TaxonomicGroupKey; // reference to parent group
}

export interface TaxonomicGenus {
    id: string;
    familyName: string;
    name: string; // reference to family
}

export interface AnimalSpecies {
    id: string;
    scientificName: string;
    commonNames: string[];
    genus: string;
    family: string;
    groupKey: TaxonomicGroupKey;
}


export interface AnimalBreed {
    name: string;
    speciesId: string; // reference to parent species
}

export interface GroupPattern {
    pattern: RegExp;
    groupKey: TaxonomicGroupKey;
    familyId: string;
    taxId: string;
}


export interface TaxonomyDatabase {
    groups: Record<TaxonomicGroupKey, TaxonomicGroup>;
    families: Record<string, TaxonomicFamily>;
    genera: Record<string, TaxonomicGenus>;
    species: Record<string, AnimalSpecies>;
    breeds: Record<string, AnimalBreed[]>;
    commonNameMap: Record<string, string>; // map common names to speciesId
    patterns: GroupPattern[];
}



