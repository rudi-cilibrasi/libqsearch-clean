import { GroupPattern } from "@/clients/genbank";
export const TAXONOMIC_MAPPING: Record<string, TaxonomicEntry> = {
  // MAMMALS (40674)
  "felis catus": {
    id: "9685",
    group: "MAMMAL",
    commonNames: ["cat", "kitten", "kitty", "domestic cat"],
  },
  "canis lupus familiaris": {
    id: "9615",
    group: "MAMMAL",
    commonNames: ["dog", "puppy", "domestic dog"],
  },
  "equus caballus": {
    id: "9796",
    group: "MAMMAL",
    commonNames: ["horse", "pony", "mare", "stallion"],
  },
  "bos taurus": {
    id: "9913",
    group: "MAMMAL",
    commonNames: ["cow", "cattle", "bull", "calf"],
  },
  "sus scrofa domesticus": {
    id: "9825",
    group: "MAMMAL",
    commonNames: ["pig", "swine", "hog", "domestic pig"],
  },
  "ovis aries": {
    id: "9940",
    group: "MAMMAL",
    commonNames: ["sheep", "lamb", "ram", "ewe"],
  },
  "capra hircus": {
    id: "9925",
    group: "MAMMAL",
    commonNames: ["goat", "domestic goat", "kid"],
  },
  "oryctolagus cuniculus": {
    id: "9986",
    group: "MAMMAL",
    commonNames: ["rabbit", "bunny", "domestic rabbit"],
  },

  // Lab Animals
  "mus musculus": {
    id: "10090",
    group: "MAMMAL",
    commonNames: ["mouse", "lab mouse", "house mouse"],
  },
  "rattus norvegicus": {
    id: "10116",
    group: "MAMMAL",
    commonNames: ["rat", "lab rat", "brown rat"],
  },

  // Primates
  "pan troglodytes": {
    id: "9598",
    group: "MAMMAL",
    commonNames: ["chimpanzee", "chimp"],
  },
  "gorilla gorilla": {
    id: "9593",
    group: "MAMMAL",
    commonNames: ["gorilla", "western gorilla"],
  },
  "pongo abelii": {
    id: "9601",
    group: "MAMMAL",
    commonNames: ["orangutan", "sumatran orangutan"],
  },

  // Marine Mammals
  "tursiops truncatus": {
    id: "9739",
    group: "MAMMAL",
    commonNames: ["dolphin", "bottlenose dolphin"],
  },
  "orcinus orca": {
    id: "9733",
    group: "MAMMAL",
    commonNames: ["orca", "killer whale"],
  },

  // FISH (7898)
  // Commercial Food Fish
  "salmo salar": {
    id: "8030",
    group: "FISH",
    commonNames: ["salmon", "atlantic salmon"],
  },
  "thunnus thynnus": {
    id: "8237",
    group: "FISH",
    commonNames: ["tuna", "bluefin tuna"],
  },
  "gadus morhua": {
    id: "8049",
    group: "FISH",
    commonNames: ["cod", "atlantic cod"],
  },
  "oncorhynchus mykiss": {
    id: "8022",
    group: "FISH",
    commonNames: ["rainbow trout", "trout", "steelhead"],
  },
  "cyprinus carpio": {
    id: "7962",
    group: "FISH",
    commonNames: ["carp", "common carp"],
  },
  "oreochromis niloticus": {
    id: "8128",
    group: "FISH",
    commonNames: ["tilapia", "nile tilapia"],
  },

  // Aquarium Fish
  "danio rerio": {
    id: "7955",
    group: "FISH",
    commonNames: ["zebrafish", "zebra danio"],
  },
  "carassius auratus": { id: "7957", group: "FISH", commonNames: ["goldfish"] },
  "poecilia reticulata": {
    id: "8081",
    group: "FISH",
    commonNames: ["guppy", "fancy guppy"],
  },

  // BIRDS (8782)
  "gallus gallus": {
    id: "9031",
    group: "BIRD",
    commonNames: ["chicken", "rooster", "hen"],
  },
  "meleagris gallopavo": {
    id: "9103",
    group: "BIRD",
    commonNames: ["turkey", "wild turkey"],
  },
  "anas platyrhynchos": {
    id: "8839",
    group: "BIRD",
    commonNames: ["duck", "mallard", "mallard duck"],
  },
  "columba livia": {
    id: "8932",
    group: "BIRD",
    commonNames: ["pigeon", "dove", "rock dove"],
  },

  // Group level mappings for general searches
  MAMMAL: {
    id: "40674",
    group: "MAMMAL",
    searchTerms: ["breed", "strain", "subspecies"],
    generalCommonNames: [
      "mammal",
      "wolf",
      "bear",
      "lion",
      "tiger",
      "elephant",
      "giraffe",
      "rhinoceros",
      "hippopotamus",
      "kangaroo",
      "koala",
      "sloth",
      "bat",
    ],
  },
  FISH: {
    id: "7898",
    group: "FISH",
    searchTerms: ["strain", "variety", "population"],
    generalCommonNames: [
      "fish",
      "bass",
      "barracuda",
      "swordfish",
      "catfish",
      "perch",
      "mackerel",
      "halibut",
      "herring",
      "anchovy",
      "flounder",
    ],
  },
  BIRD: {
    id: "8782",
    group: "BIRD",
    searchTerms: ["breed", "strain", "subspecies"],
    generalCommonNames: [
      "bird",
      "eagle",
      "hawk",
      "owl",
      "parrot",
      "penguin",
      "flamingo",
      "sparrow",
      "crow",
      "raven",
      "woodpecker",
      "hummingbird",
    ],
  },
  REPTILE: {
    id: "8504",
    group: "REPTILE",
    searchTerms: ["strain", "subspecies", "population"],
    generalCommonNames: [
      "reptile",
      "snake",
      "lizard",
      "turtle",
      "tortoise",
      "crocodile",
      "alligator",
      "gecko",
      "iguana",
      "cobra",
      "python",
    ],
  },
  AMPHIBIAN: {
    id: "8292",
    group: "AMPHIBIAN",
    searchTerms: ["strain", "population", "subspecies"],
    generalCommonNames: [
      "amphibian",
      "frog",
      "toad",
      "salamander",
      "newt",
      "axolotl",
    ],
  },
  INSECT: {
    id: "50557",
    group: "INSECT",
    searchTerms: ["strain", "variety", "ecotype"],
    generalCommonNames: [
      "insect",
      "bug",
      "ant",
      "bee",
      "wasp",
      "butterfly",
      "moth",
      "beetle",
      "grasshopper",
      "cricket",
      "fly",
      "mosquito",
      "dragonfly",
    ],
  },
} as const;

type TaxonomicGroup =
  | "MAMMAL"
  | "FISH"
  | "BIRD"
  | "REPTILE"
  | "AMPHIBIAN"
  | "INSECT";

// Interface for species entries
export interface SpeciesEntry {
  id: string;
  group: TaxonomicGroup;
  commonNames: string[];
}

// Interface for group level entries
export interface GroupEntry {
  id: string;
  searchTerms: string[];
  group: string;
  generalCommonNames: string[];
}

export type TaxonomicEntry = SpeciesEntry | GroupEntry;

export const isGroupEntry = (entry: TaxonomicEntry): entry is GroupEntry => {
  return "searchTerms" in entry && "generalCommonNames" in entry;
};

export const TAXONOMIC_BASE_GROUPS: Record<
  TaxonomicGroupKey,
  TaxonomicBaseGroup
> = {
  MAMMALS: {
    id: "40674",
    searchTerms: ["breed", "strain", "subspecies"],
  },
  BIRDS: {
    id: "8782",
    searchTerms: ["breed", "strain", "subspecies"],
  },
  FISH: {
    id: "7898",
    searchTerms: ["strain", "variety", "population"],
  },
  REPTILES: {
    id: "8504",
    searchTerms: ["strain", "subspecies", "population"],
  },
  AMPHIBIANS: {
    id: "8292",
    searchTerms: ["strain", "population", "subspecies"],
  },
  INSECTS: {
    id: "50557",
    searchTerms: ["strain", "variety", "ecotype"],
  },
  VERTEBRATES: {
    id: "7742",
    searchTerms: ["breed", "strain", "subspecies"],
  },
};

interface AnimalGroup {
  genus: string;
  family: string;
  taxId: string;
  group: TaxonomicGroupKey; // Using the same type from GenbankCacheService
  searchTerms: string[];
  includes: string[];
}

// This type represents all possible animal keys
type AnimalKey =
  | "cat"
  | "tiger"
  | "lion"
  | "leopard"
  | "dog"
  | "wolf"
  | "fox"
  | "crocodile"
  | "alligator"
  | "snake"
  | "chicken"
  | "duck"
  | "eagle"
  | "dolphin"
  | "whale"
  | "gorilla"
  | "chimpanzee"
  | "bear";

export const ANIMAL_GROUPS: Record<AnimalKey, AnimalGroup> = {
  cat: {
    genus: "Felis",
    family: "Felidae",
    taxId: "9685",
    group: "MAMMALS",
    searchTerms: ["breed", "strain", "subspecies"],
    includes: [
      "siamese cat",
      "persian cat",
      "bengal cat",
      "maine coon",
      "british shorthair",
      "abyssinian",
      "russian blue",
      "ragdoll",
      "sphynx",
      "scottish fold",
      "norwegian forest cat",
      "burmese",
      "oriental shorthair",
      "turkish angora",
      "american shorthair",
    ],
  },
  tiger: {
    genus: "Panthera",
    family: "Felidae",
    taxId: "9694",
    group: "MAMMALS",
    searchTerms: ["subspecies", "population", "strain"],
    includes: [
      "bengal tiger",
      "siberian tiger",
      "sumatran tiger",
      "indochinese tiger",
      "malayan tiger",
      "south china tiger",
    ],
  },
  lion: {
    genus: "Panthera",
    family: "Felidae",
    taxId: "9689",
    group: "MAMMALS",
    searchTerms: ["subspecies", "population"],
    includes: [
      "african lion",
      "asiatic lion",
      "barbary lion",
      "transvaal lion",
      "masai lion",
    ],
  },
  leopard: {
    genus: "Panthera",
    family: "Felidae",
    taxId: "9691",
    group: "MAMMALS",
    searchTerms: ["subspecies", "population"],
    includes: [
      "african leopard",
      "indian leopard",
      "javan leopard",
      "arabian leopard",
      "amur leopard",
      "persian leopard",
    ],
  },

  // CANIDS (Dog Family)
  dog: {
    genus: "Canis",
    family: "Canidae",
    taxId: "9615",
    group: "MAMMALS",
    searchTerms: ["breed", "strain", "subspecies"],
    includes: [
      "german shepherd",
      "labrador retriever",
      "golden retriever",
      "bulldog",
      "beagle",
      "poodle",
      "rottweiler",
      "yorkshire terrier",
      "boxer",
      "dachshund",
      "siberian husky",
      "great dane",
      "doberman",
      "chihuahua",
      "pomeranian",
    ],
  },
  wolf: {
    genus: "Canis",
    family: "Canidae",
    taxId: "9612",
    group: "MAMMALS",
    searchTerms: ["subspecies", "population"],
    includes: [
      "gray wolf",
      "timber wolf",
      "arctic wolf",
      "ethiopian wolf",
      "mexican wolf",
      "red wolf",
      "indian wolf",
      "arabian wolf",
    ],
  },
  fox: {
    genus: "Vulpes",
    family: "Canidae",
    taxId: "9627",
    group: "MAMMALS",
    searchTerms: ["species", "subspecies", "population"],
    includes: [
      "red fox",
      "arctic fox",
      "fennec fox",
      "kit fox",
      "swift fox",
      "corsac fox",
      "bengal fox",
    ],
  },

  // REPTILES
  crocodile: {
    genus: "Crocodylus",
    family: "Crocodylidae",
    taxId: "8496",
    group: "REPTILES",
    searchTerms: ["species", "population", "complete"],
    includes: [
      "nile crocodile",
      "saltwater crocodile",
      "american crocodile",
      "orinoco crocodile",
      "freshwater crocodile",
      "philippine crocodile",
    ],
  },
  alligator: {
    genus: "Alligator",
    family: "Alligatoridae",
    taxId: "8496",
    group: "REPTILES",
    searchTerms: ["species", "population", "complete"],
    includes: ["american alligator", "chinese alligator"],
  },
  snake: {
    genus: "Serpentes",
    family: "Serpentes",
    taxId: "8570",
    group: "REPTILES",
    searchTerms: ["species", "subspecies", "population"],
    includes: [
      "python",
      "cobra",
      "viper",
      "boa constrictor",
      "anaconda",
      "king cobra",
      "black mamba",
      "rattlesnake",
    ],
  },

  // BIRDS
  chicken: {
    genus: "Gallus",
    family: "Phasianidae",
    taxId: "9031",
    group: "BIRDS",
    searchTerms: ["breed", "strain", "subspecies"],
    includes: [
      "leghorn",
      "rhode island red",
      "plymouth rock",
      "orpington",
      "wyandotte",
      "australorp",
      "brahma",
    ],
  },
  duck: {
    genus: "Anas",
    family: "Anatidae",
    taxId: "8839",
    group: "BIRDS",
    searchTerms: ["breed", "strain", "species"],
    includes: [
      "mallard duck",
      "pekin duck",
      "indian runner",
      "khaki campbell",
      "swedish blue",
      "cayuga",
    ],
  },
  eagle: {
    genus: "Aquila",
    family: "Accipitridae",
    taxId: "8962",
    group: "BIRDS",
    searchTerms: ["species", "population"],
    includes: [
      "golden eagle",
      "bald eagle",
      "white-tailed eagle",
      "steller sea eagle",
      "harpy eagle",
    ],
  },

  // MARINE MAMMALS
  dolphin: {
    genus: "Tursiops",
    family: "Delphinidae",
    taxId: "9739",
    group: "MAMMALS",
    searchTerms: ["species", "population"],
    includes: [
      "bottlenose dolphin",
      "common dolphin",
      "spinner dolphin",
      "rissos dolphin",
      "fraser dolphin",
    ],
  },
  whale: {
    genus: "Balaenoptera",
    family: "Balaenopteridae",
    taxId: "9771",
    group: "MAMMALS",
    searchTerms: ["species", "population"],
    includes: [
      "blue whale",
      "humpback whale",
      "fin whale",
      "minke whale",
      "sei whale",
      "bryde whale",
    ],
  },

  // PRIMATES
  gorilla: {
    genus: "Gorilla",
    family: "Hominidae",
    taxId: "9593",
    group: "MAMMALS",
    searchTerms: ["subspecies", "population"],
    includes: [
      "western gorilla",
      "eastern gorilla",
      "mountain gorilla",
      "lowland gorilla",
    ],
  },
  chimpanzee: {
    genus: "Pan",
    family: "Hominidae",
    taxId: "9598",
    group: "MAMMALS",
    searchTerms: ["subspecies", "population"],
    includes: [
      "common chimpanzee",
      "bonobo",
      "western chimpanzee",
      "eastern chimpanzee",
    ],
  },

  // BEARS
  bear: {
    genus: "Ursus",
    family: "Ursidae",
    taxId: "9632",
    group: "MAMMALS",
    searchTerms: ["species", "subspecies", "population"],
    includes: [
      "brown bear",
      "black bear",
      "polar bear",
      "asiatic black bear",
      "sun bear",
      "spectacled bear",
      "sloth bear",
    ],
  },
};

export type AnimalGroupData =
  (typeof ANIMAL_GROUPS)[keyof typeof ANIMAL_GROUPS];

export const isValidAnimalKey = (key: string): key is AnimalKey => {
  return key in ANIMAL_GROUPS;
};

export const getAnimalGroup = (key: string): AnimalGroup | undefined => {
  if (isValidAnimalKey(key)) {
    return ANIMAL_GROUPS[key];
  }
  return undefined;
};

export const findAnimalByName = (name: string): AnimalGroup | undefined => {
  const normalized = name.toLowerCase();
  return Object.values(ANIMAL_GROUPS).find((group) => {
    return group.includes.some((include) => include === normalized);
  });
};

export const getAnimalByGroup = (
  group: TaxonomicGroupKey
): AnimalGroup[] | undefined => {
  return Object.values(ANIMAL_GROUPS).filter(
    (animal) => animal.group === group
  );
};

// Broader pattern matching for animal groups
export const GROUP_PATTERNS: GroupPattern[] = [
  // Mammals - Carnivores
  {
    pattern: /(fox|vixen|kit|fennec)/i,
    group: "MAMMALS",
    family: "Canidae",
    taxId: "9627",
  },
  {
    pattern: /(wolf|wolves|canis|coyote|jackal)/i,
    group: "MAMMALS",
    family: "Canidae",
    taxId: "9612",
  },
  {
    pattern: /(lion|tiger|leopard|jaguar|panther|puma|cougar|cheetah)/i,
    group: "MAMMALS",
    family: "Felidae",
    taxId: "9689",
  },
  {
    pattern: /(bear|ursus|grizzly|polar bear|panda)/i,
    group: "MAMMALS",
    family: "Ursidae",
    taxId: "9632",
  },

  // Mammals - Marine
  {
    pattern: /(dolphin|porpoise|orca|killer whale)/i,
    group: "MAMMALS",
    family: "Delphinidae",
    taxId: "9739",
  },
  {
    pattern: /(whale|cetacean|baleen)/i,
    group: "MAMMALS",
    family: "Cetacea",
    taxId: "9721",
  },
  {
    pattern: /(seal|sea lion|walrus|pinniped)/i,
    group: "MAMMALS",
    family: "Pinnipedia",
    taxId: "9700",
  },

  // Mammals - Primates
  {
    pattern: /(ape|gorilla|chimpanzee|orangutan|bonobo)/i,
    group: "MAMMALS",
    family: "Hominidae",
    taxId: "9604",
  },
  {
    pattern: /(monkey|macaque|baboon|mandrill|lemur)/i,
    group: "MAMMALS",
    family: "Primates",
    taxId: "9443",
  },

  // Reptiles
  {
    pattern: /(crocodile|alligator|caiman|gavial)/i,
    group: "REPTILES",
    family: "Crocodylidae",
    taxId: "8496",
  },
  {
    pattern: /(snake|python|cobra|viper|boa|rattlesnake|serpent)/i,
    group: "REPTILES",
    family: "Serpentes",
    taxId: "8570",
  },
  {
    pattern: /(lizard|gecko|iguana|monitor|chameleon|skink)/i,
    group: "REPTILES",
    family: "Squamata",
    taxId: "8509",
  },
  {
    pattern: /(turtle|tortoise|terrapin)/i,
    group: "REPTILES",
    family: "Testudines",
    taxId: "8459",
  },

  // Fish
  {
    pattern: /(shark|ray|skate|dogfish)/i,
    group: "FISH",
    family: "Chondrichthyes",
    taxId: "7777",
  },
  {
    pattern: /(fish|bass|trout|salmon|tuna|cod|perch|carp)/i,
    group: "FISH",
    family: "Actinopterygii",
    taxId: "7898",
  },

  // Birds
  {
    pattern: /(eagle|hawk|falcon|kite|osprey|vulture)/i,
    group: "BIRDS",
    family: "Accipitridae",
    taxId: "8892",
  },
  {
    pattern: /(owl|barn owl|eagle owl|horned owl)/i,
    group: "BIRDS",
    family: "Strigiformes",
    taxId: "8896",
  },
  {
    pattern: /(parrot|macaw|cockatoo|parakeet|budgie)/i,
    group: "BIRDS",
    family: "Psittaciformes",
    taxId: "8932",
  },

  // Amphibians
  {
    pattern: /(frog|toad|treefrog|bullfrog)/i,
    group: "AMPHIBIANS",
    family: "Anura",
    taxId: "8342",
  },
  {
    pattern: /(salamander|newt|axolotl)/i,
    group: "AMPHIBIANS",
    family: "Caudata",
    taxId: "8292",
  },
];

export const TAXONOMIC_SEARCH_STRATEGIES = {
  MAMMAL: {
    primary: ["breed", "strain"],
    secondary: ["subspecies"],
    sequences: ["mitochondrion", "genome", "chromosome"],
    excludeTerms: ["partial", "segment"],
  },
  BIRD: {
    primary: ["breed", "subspecies"],
    secondary: ["strain", "population"],
    sequences: ["mitochondrion", "genome", "chromosome"],
    excludeTerms: ["partial"],
  },
  FISH: {
    primary: ["strain", "population"],
    secondary: ["variety", "subspecies"],
    sequences: ["mitochondrion", "genome", "complete"],
    excludeTerms: ["partial", "fragment"],
  },
  REPTILE: {
    primary: ["subspecies", "population"],
    secondary: ["strain", "variety"],
    sequences: ["mitochondrion", "genome"],
    excludeTerms: ["partial"],
  },
  AMPHIBIAN: {
    primary: ["strain", "population"],
    secondary: ["subspecies"],
    sequences: ["mitochondrion", "genome", "complete"],
    excludeTerms: ["partial"],
  },
  INSECT: {
    primary: ["strain", "variety"],
    secondary: ["ecotype", "population"],
    sequences: ["mitochondrion", "genome"],
    excludeTerms: ["partial", "segment"],
  },
  VERTEBRATE: {
    primary: ["breed", "strain", "subspecies"],
    secondary: ["population"],
    sequences: ["mitochondrion", "genome"],
    excludeTerms: ["partial"],
  },
};

export interface TaxonomicBaseGroup {
  id: string;
  searchTerms: string[];
}

export type TaxonomicGroupKey =
  | "MAMMALS"
  | "BIRDS"
  | "FISH"
  | "REPTILES"
  | "AMPHIBIANS"
  | "INSECTS"
  | "VERTEBRATES";
