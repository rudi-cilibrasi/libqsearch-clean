import { describe, beforeEach, it, expect } from 'vitest';
import { GenBankSearchService } from '../services/GenBankSearchService';

describe('Animals Live Tests', () => {
    let service: GenBankSearchService;

    beforeEach(() => {
        service = new GenBankSearchService();
    });

    const TIMEOUT = 5000;

    const popularAnimals = [
        { name: 'dog', taxId: '9615', scientificName: 'Canis lupus familiaris' },
        { name: 'cat', taxId: '9685', scientificName: 'Felis catus' },
        { name: 'horse', taxId: '9796', scientificName: 'Equus caballus' },
        { name: 'cow', taxId: '9913', scientificName: 'Bos taurus' },
        { name: 'pig', taxId: '9823', scientificName: 'Sus scrofa' },
        { name: 'chicken', taxId: '9031', scientificName: 'Gallus gallus' },
        { name: 'sheep', taxId: '9940', scientificName: 'Ovis aries' },
        { name: 'goat', taxId: '9925', scientificName: 'Capra hircus' },
        { name: 'rabbit', taxId: '9986', scientificName: 'Oryctolagus cuniculus' },
        { name: 'mouse', taxId: '10090', scientificName: 'Mus musculus' },
        { name: 'rat', taxId: '10116', scientificName: 'Rattus norvegicus' },
        { name: 'tiger', taxId: '9694', scientificName: 'Panthera tigris' },
        { name: 'lion', taxId: '9689', scientificName: 'Panthera leo' },
        { name: 'dolphin', taxId: '9739', scientificName: 'Tursiops truncatus' },
        { name: 'whale', taxId: '9771', scientificName: 'Balaenoptera' }
    ];

    const rareAnimals = [
        { name: 'Saola', taxId: '97363', scientificName: 'Pseudoryx nghetinhensis' },
        { name: 'Vaquita', taxId: '42100', scientificName: 'Phocoena sinus' },
        { name: 'Kakapo', taxId: '2489341', scientificName: 'strigops habroptila' },
        { name: 'Quokka', taxId: '30670', scientificName: 'setonix brachyurus' },
        { name: 'Tasmanian Devil', taxId: '9305', scientificName: 'sarcophilus harrisii' },
    ];

    describe('Live popular taxonomy searches', () => {
        it('should find correct taxonomy IDs for all common names in parallel', async () => {
            const results = await Promise.all(
                popularAnimals.map(animal =>
                    service.getTaxonomicGroupInfo(animal.name.toLowerCase())
                        .then(result => ({
                            animal,
                            result,
                            searchType: 'common'
                        }))
                )
            );

            results.forEach(({ animal, result }) => {
                expect(result.taxId).toBe(animal.taxId);
            });
        }, TIMEOUT);

        it('should find taxonomy IDs for all scientific names in parallel', async () => {
            const results = await Promise.all(
                popularAnimals.map(animal =>
                    service.getTaxonomicGroupInfo(animal.scientificName.toLowerCase())
                        .then(result => ({
                            animal,
                            result,
                            searchType: 'scientific'
                        }))
                )
            );

            results.forEach(({ animal, result }) => {
                expect(result.taxId).toBe(animal.taxId);
            });
        }, TIMEOUT);
    });

    describe('Rare taxonomy searches', () => {
        it('should find correct taxonomy IDs for all common names in parallel', async () => {
            const results = await Promise.all(
                rareAnimals.map(animal =>
                    service.getTaxonomicGroupInfo(animal.name.toLowerCase())
                        .then(result => ({
                            animal,
                            result,
                            searchType: 'common'
                        }))
                )
            );

            results.forEach(({ animal, result }) => {
                expect(result.taxId).toBe(animal.taxId);
            });
        }, TIMEOUT);

        it('should find taxonomy IDs for all scientific names in parallel', async () => {
            const results = await Promise.all(
                rareAnimals.map(animal =>
                    service.getTaxonomicGroupInfo(animal.scientificName.toLowerCase())
                        .then(result => ({
                            animal,
                            result,
                            searchType: 'scientific'
                        }))
                )
            );

            results.forEach(({ animal, result }) => {
                expect(result.taxId).toBe(animal.taxId);
            });
        }, TIMEOUT);
    });
});