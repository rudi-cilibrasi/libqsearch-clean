import {AnimalSpecies} from "@/data/taxonomy/types.ts";
import {findByScientificName, findSpeciesByCommonName, TAXONOMY_DB} from "@/data/taxonomy";
import {TaxonomicInfo} from "@/services/genbank.ts";
import {TAXONOMIC_GROUPS} from "@/data/taxonomy/groups.ts";

export class AnimalTaxonomyRepository {

    findByName(name: string): AnimalSpecies | null {
        const normalizedName = name.toLowerCase().trim();
        const species = findSpeciesByCommonName(normalizedName);
        if (species) return species;

        // try scientific name
        const scientificMatch = findByScientificName(normalizedName);
        if (scientificMatch) return scientificMatch;

        // try singular/plural forms
        const singularForm = normalizedName.endsWith("s") ? normalizedName.slice(0, -1) : normalizedName;
        const pluralForm = normalizedName.endsWith("s") ? normalizedName : `${normalizedName}s`;

        const singularMatch = findSpeciesByCommonName(singularForm);
        if (singularMatch) return singularMatch;

        const pluralMatch = findSpeciesByCommonName(pluralForm);
        if (pluralMatch) return pluralMatch;

        // if all direct lookup fails, try fuzzy matching
        return this.findByFuzzyMatch(normalizedName);
    }

    findByFuzzyMatch(name: string): AnimalSpecies | null {
        for (const pattern of TAXONOMY_DB.patterns) {
            if (pattern.pattern.test(name)) {
                const familySpecies = Object.values(TAXONOMY_DB.species).filter(
                    species => species.family === pattern.familyId
                );
                // if we found any species, returns the first one
                if (familySpecies.length > 0) {
                    return familySpecies[0];
                }

                // If no species in family, create a pseudo-species with the family info
                const family = TAXONOMY_DB.families[pattern.familyId];
                if (family) {
                    return {
                        id: pattern.taxId,
                        scientificName: family.name,
                        commonNames: [family.commonName],
                        genus: "", // Unknown at this level
                        family: family.name,
                        groupKey: pattern.groupKey
                    };
                }
            }
        }

        const commonNames = Object.values(TAXONOMY_DB.commonNameMap);
        let bestMatch = null;
        let bestScore = Infinity;

        for (const commonName of commonNames) {
            const score = this.levenshteinDistance(name, commonName);
            if (score < bestScore && score <= Math.floor(name.length * 0.4)) {
                bestScore = score;
                bestMatch = commonName;
            }
        }

        if (bestMatch) {
            const speciesId = TAXONOMY_DB.commonNameMap[bestMatch];
            return TAXONOMY_DB.species[speciesId] || null;
        }

        return null;
    }

    convertToTaxonomicInfo(species: AnimalSpecies): TaxonomicInfo {
        const group = TAXONOMIC_GROUPS[species.groupKey];
        return {
            taxId: species.id,
            taxonomicGroup: group.searchTerms,
            scientificName: species.scientificName,
            commonName: species.commonNames[0] || "",
            group: species.groupKey,
            isExactMatch: true
        };
    }

    levenshteinDistance(a: string, b: string): number {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;

        const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));

        for (let i = 0; i <= a.length; i++) {
            matrix[i][0] = i;
        }
        for (let j = 0; j < b.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j < b.length; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1, // deletion
                    matrix[i][j - 1] + 1, // insertion
                    matrix[i - 1][j - 1] + cost // substitution
                );
            }
        }

        return matrix[a.length][b.length];
    }

}
