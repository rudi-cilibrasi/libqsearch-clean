import {GenbankCache} from "@/cache/GenbankCache.ts";
import {GenBankQueries} from "@/services/GenBankQueries.ts";
import {AnimalTaxonomyRepository} from "@/repositories/AnimalTaxonomyRepository.ts";
import {TaxonomicInfo} from "@/services/genbank.ts";

export class EnhancedGenbankService {
    private readonly genbankCache: GenbankCache;
    private readonly genBankQueries: GenBankQueries;
    private readonly taxonomyRepository: AnimalTaxonomyRepository;
    private readonly taxonomyCache: Map<string, { data: TaxonomicInfo; timestamp: number }>
    private readonly CACHE_TTL: number = 30 * 60 * 1000; // 30 minutes
    private readonly searchStrategies: Array<(searchTerm: string) => Promise<TaxonomicInfo>>;

    constructor() {
        this.genbankCache = new GenbankCache();
        this.genBankQueries = new GenBankQueries();
        this.taxonomyRepository = new AnimalTaxonomyRepository();
        this.taxonomyCache = new Map();


        // Define search strategies in order of preference
        this.searchStrategies = [
            this.directTaxonomyRepositoryLookup.bind(this),
            this.fuzzyTaxonomyRepositoryLookup.bind(this),
            this.genbankTaxonomyLookup.bind(this),
            this.advancedVariantSearch.bind(this),
            this.broadTaxonomySearch.bind(this)
        ];
    }


}
