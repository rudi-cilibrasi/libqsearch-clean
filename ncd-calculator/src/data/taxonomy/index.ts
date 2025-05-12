import {ANIMAL_SPECIES} from "@/data/taxonomy/species.ts";
import {ANIMAL_BREEDS} from "@/data/taxonomy/breeds.ts";
import {AnimalSpecies, TaxonomyDatabase} from "@/data/taxonomy/types.ts";
import {TAXONOMIC_GROUPS} from "@/data/taxonomy/groups.ts";
import {TAXONOMIC_GENERA} from "@/data/taxonomy/genera.ts";
import {TAXONOMIC_FAMILIES} from "@/data/taxonomy/families.ts";
import {GROUP_PATTERNS} from "@/data/taxonomy/patterns.ts";

const buildCommonNameMap = (): Record<string, string> => {
    const map: Record<string, string> = {};
    // add all common names from species definitions
    Object.entries(ANIMAL_SPECIES).forEach(([speciesId, species]) => {
        species.commonNames.forEach((commonName: string) => {
            map[commonName.toLowerCase()] = speciesId;
        })
    })

    // Add breed names with reference to their species
    Object.entries(ANIMAL_BREEDS).forEach(([speciesId, breeds]) => {
        breeds.forEach(breed => {
            map[breed.name.toLowerCase()] = speciesId;
        })
    });
    return map;
}


/**
 * The complete taxonomy database with all hierarchical relationships
 * This serves as the central point of access for all taxonomy data
 */

export const TAXONOMY_DB: TaxonomyDatabase = {
    groups: TAXONOMIC_GROUPS,
    genera: TAXONOMIC_GENERA,
    families: TAXONOMIC_FAMILIES,
    species: ANIMAL_SPECIES,
    breeds: ANIMAL_BREEDS,
    commonNameMap: buildCommonNameMap(),
    patterns: GROUP_PATTERNS
}


export const findSpeciesByCommonName = (name: string): AnimalSpecies | null => {
    const normalized = name.toLowerCase().trim();
    const speciesId = TAXONOMY_DB.commonNameMap[normalized];
    return speciesId ? TAXONOMY_DB.species[speciesId] : null;
}

export const findByScientificName = (name: string): AnimalSpecies | null => {
    const normalized = name.toLowerCase().trim();
    return Object.values(TAXONOMY_DB.species).find(species => {
        return species.scientificName.toLowerCase() === normalized
    }) || null;
}

export const findBySpeciesId = (speciesId: string): AnimalSpecies | null => {
    return TAXONOMY_DB.species[speciesId] || null;
}

export const findSpeciesByGroup = (groupKey: string): AnimalSpecies[] => {
    return Object.values(TAXONOMY_DB.species).filter(species => species.groupKey === groupKey);
}

export const getBreedsForSpecies = (speciesId: string): AnimalSpecies[] => {
    const breeds = TAXONOMY_DB.breeds[speciesId] || [];
    return breeds.map(breed => ({
        ...TAXONOMY_DB.species[speciesId],
        commonNames: [breed.name]
    }));
}
