import {AnimalSpecies} from './types';

/**
 * Defines animal species with their taxonomic information.
 * Each species has its NCBI taxonomy ID, scientific name, common names,
 * and references to its genus, family, and taxonomic group.
 */
export const ANIMAL_SPECIES: Record<string, AnimalSpecies> = {
    // MAMMALS - Domestic Cats
    "9685": {
        id: "9685",
        scientificName: "Felis catus",
        commonNames: ["cat", "kitten", "kitty", "domestic cat"],
        genus: "Felis",
        family: "Felidae",
        groupKey: "MAMMALS"
    },

    // MAMMALS - Big Cats
    "9694": {
        id: "9694",
        scientificName: "Panthera tigris",
        commonNames: ["tiger", "bengal tiger", "siberian tiger"],
        genus: "Panthera",
        family: "Felidae",
        groupKey: "MAMMALS"
    },
    "9689": {
        id: "9689",
        scientificName: "Panthera leo",
        commonNames: ["lion", "african lion"],
        genus: "Panthera",
        family: "Felidae",
        groupKey: "MAMMALS"
    },
    "9691": {
        id: "9691",
        scientificName: "Panthera pardus",
        commonNames: ["leopard", "african leopard"],
        genus: "Panthera",
        family: "Felidae",
        groupKey: "MAMMALS"
    },

    // MAMMALS - Canines
    "9615": {
        id: "9615",
        scientificName: "Canis lupus familiaris",
        commonNames: ["dog", "puppy", "domestic dog"],
        genus: "Canis",
        family: "Canidae",
        groupKey: "MAMMALS"
    },
    "9612": {
        id: "9612",
        scientificName: "Canis lupus",
        commonNames: ["wolf", "gray wolf", "timber wolf"],
        genus: "Canis",
        family: "Canidae",
        groupKey: "MAMMALS"
    },
    "9627": {
        id: "9627",
        scientificName: "Vulpes vulpes",
        commonNames: ["fox", "red fox"],
        genus: "Vulpes",
        family: "Canidae",
        groupKey: "MAMMALS"
    },

    // MAMMALS - Farm/Domestic Animals
    "9796": {
        id: "9796",
        scientificName: "Equus caballus",
        commonNames: ["horse", "pony", "mare", "stallion"],
        genus: "Equus",
        family: "Equidae",
        groupKey: "MAMMALS"
    },
    "9913": {
        id: "9913",
        scientificName: "Bos taurus",
        commonNames: ["cow", "cattle", "bull", "calf"],
        genus: "Bos",
        family: "Bovidae",
        groupKey: "MAMMALS"
    },
    "9823": {
        id: "9823",
        scientificName: "Sus scrofa",
        commonNames: ["pig", "swine", "hog", "domestic pig"],
        genus: "Sus",
        family: "Suidae",
        groupKey: "MAMMALS"
    },
    "9940": {
        id: "9940",
        scientificName: "Ovis aries",
        commonNames: ["sheep", "lamb", "ram", "ewe"],
        genus: "Ovis",
        family: "Bovidae",
        groupKey: "MAMMALS"
    },
    "9925": {
        id: "9925",
        scientificName: "Capra hircus",
        commonNames: ["goat", "domestic goat", "kid"],
        genus: "Capra",
        family: "Bovidae",
        groupKey: "MAMMALS"
    },
    "9986": {
        id: "9986",
        scientificName: "Oryctolagus cuniculus",
        commonNames: ["rabbit", "bunny", "domestic rabbit"],
        genus: "Oryctolagus",
        family: "Leporidae",
        groupKey: "MAMMALS"
    },

    // MAMMALS - Lab Animals
    "10090": {
        id: "10090",
        scientificName: "Mus musculus",
        commonNames: ["mouse", "lab mouse", "house mouse"],
        genus: "Mus",
        family: "Muridae",
        groupKey: "MAMMALS"
    },
    "10116": {
        id: "10116",
        scientificName: "Rattus norvegicus",
        commonNames: ["rat", "lab rat", "brown rat"],
        genus: "Rattus",
        family: "Muridae",
        groupKey: "MAMMALS"
    },

    // MAMMALS - Primates
    "9598": {
        id: "9598",
        scientificName: "Pan troglodytes",
        commonNames: ["chimpanzee", "chimp"],
        genus: "Pan",
        family: "Hominidae",
        groupKey: "MAMMALS"
    },
    "9593": {
        id: "9593",
        scientificName: "Gorilla gorilla",
        commonNames: ["gorilla", "western gorilla"],
        genus: "Gorilla",
        family: "Hominidae",
        groupKey: "MAMMALS"
    },
    "9601": {
        id: "9601",
        scientificName: "Pongo abelii",
        commonNames: ["orangutan", "sumatran orangutan"],
        genus: "Pongo",
        family: "Hominidae",
        groupKey: "MAMMALS"
    },

    // MAMMALS - Marine Mammals
    "9739": {
        id: "9739",
        scientificName: "Tursiops truncatus",
        commonNames: ["dolphin", "bottlenose dolphin"],
        genus: "Tursiops",
        family: "Delphinidae",
        groupKey: "MAMMALS"
    },
    "9733": {
        id: "9733",
        scientificName: "Orcinus orca",
        commonNames: ["orca", "killer whale"],
        genus: "Orcinus",
        family: "Delphinidae",
        groupKey: "MAMMALS"
    },
    "9771": {
        id: "9771",
        scientificName: "Balaenoptera musculus",
        commonNames: ["whale", "blue whale", "great blue whale"],
        genus: "Balaenoptera",
        family: "Balaenopteridae",
        groupKey: "MAMMALS"
    },

    // MAMMALS - Bears
    "9632": {
        id: "9632",
        scientificName: "Ursus arctos",
        commonNames: ["bear", "brown bear", "grizzly bear"],
        genus: "Ursus",
        family: "Ursidae",
        groupKey: "MAMMALS"
    },

    // MAMMALS - Rare/Endangered
    "97363": {
        id: "97363",
        scientificName: "Pseudoryx nghetinhensis",
        commonNames: ["saola", "spindlehorn", "asian unicorn", "vu quang bovid"],
        genus: "Pseudoryx",
        family: "Bovidae",
        groupKey: "MAMMALS"
    },
    "42100": {
        id: "42100",
        scientificName: "Phocoena sinus",
        commonNames: ["vaquita"],
        genus: "Phocoena",
        family: "Phocoenidae",
        groupKey: "MAMMALS"
    },
    "30670": {
        id: "30670",
        scientificName: "Setonix brachyurus",
        commonNames: ["quokka"],
        genus: "Setonix",
        family: "Macropodidae",
        groupKey: "MAMMALS"
    },
    "9305": {
        id: "9305",
        scientificName: "Sarcophilus harrisii",
        commonNames: ["Marsupial Devil", "Tassie Devil", "Tasmanian Devil"],
        genus: "Sarcophilus",
        family: "Dasyuridae",
        groupKey: "MAMMALS"
    },

    // FISH - Commercial Food Fish
    "8030": {
        id: "8030",
        scientificName: "Salmo salar",
        commonNames: ["salmon", "atlantic salmon"],
        genus: "Salmo",
        family: "Actinopterygii",
        groupKey: "FISH"
    },
    "8237": {
        id: "8237",
        scientificName: "Thunnus thynnus",
        commonNames: ["tuna", "bluefin tuna"],
        genus: "Thunnus",
        family: "Actinopterygii",
        groupKey: "FISH"
    },
    "8049": {
        id: "8049",
        scientificName: "Gadus morhua",
        commonNames: ["cod", "atlantic cod"],
        genus: "Gadus",
        family: "Actinopterygii",
        groupKey: "FISH"
    },
    "8022": {
        id: "8022",
        scientificName: "Oncorhynchus mykiss",
        commonNames: ["rainbow trout", "trout", "steelhead"],
        genus: "Oncorhynchus",
        family: "Actinopterygii",
        groupKey: "FISH"
    },
    "7962": {
        id: "7962",
        scientificName: "Cyprinus carpio",
        commonNames: ["carp", "common carp"],
        genus: "Cyprinus",
        family: "Actinopterygii",
        groupKey: "FISH"
    },
    "8128": {
        id: "8128",
        scientificName: "Oreochromis niloticus",
        commonNames: ["tilapia", "nile tilapia"],
        genus: "Oreochromis",
        family: "Actinopterygii",
        groupKey: "FISH"
    },

    // FISH - Aquarium Fish
    "7955": {
        id: "7955",
        scientificName: "Danio rerio",
        commonNames: ["zebrafish", "zebra danio"],
        genus: "Danio",
        family: "Actinopterygii",
        groupKey: "FISH"
    },
    "7957": {
        id: "7957",
        scientificName: "Carassius auratus",
        commonNames: ["goldfish"],
        genus: "Carassius",
        family: "Actinopterygii",
        groupKey: "FISH"
    },
    "8081": {
        id: "8081",
        scientificName: "Poecilia reticulata",
        commonNames: ["guppy", "fancy guppy"],
        genus: "Poecilia",
        family: "Actinopterygii",
        groupKey: "FISH"
    },

    // BIRDS
    "9031": {
        id: "9031",
        scientificName: "Gallus gallus",
        commonNames: ["chicken", "rooster", "hen"],
        genus: "Gallus",
        family: "Phasianidae",
        groupKey: "BIRDS"
    },
    "9103": {
        id: "9103",
        scientificName: "Meleagris gallopavo",
        commonNames: ["turkey", "wild turkey"],
        genus: "Meleagris",
        family: "Phasianidae",
        groupKey: "BIRDS"
    },
    "8839": {
        id: "8839",
        scientificName: "Anas platyrhynchos",
        commonNames: ["duck", "mallard", "mallard duck"],
        genus: "Anas",
        family: "Anatidae",
        groupKey: "BIRDS"
    },
    "8932": {
        id: "8932",
        scientificName: "Columba livia",
        commonNames: ["pigeon", "dove", "rock dove"],
        genus: "Columba",
        family: "Columbidae",
        groupKey: "BIRDS"
    },
    "2489341": {
        id: "2489341",
        scientificName: "Strigops habroptila",
        commonNames: ["kakapo", "night parrot", "owl parrot"],
        genus: "Strigops",
        family: "Psittacidae",
        groupKey: "BIRDS"
    },

    // REPTILES
    "8496": {
        id: "8496",
        scientificName: "Crocodylus niloticus",
        commonNames: ["crocodile", "nile crocodile"],
        genus: "Crocodylus",
        family: "Crocodylidae",
        groupKey: "REPTILES"
    }
};
