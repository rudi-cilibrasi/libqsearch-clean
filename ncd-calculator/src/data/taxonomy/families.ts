import {TaxonomicFamily} from './types';

/**
 * Defines taxonomic families within each major group.
 * Each family has its unique NCBI taxonomy ID, scientific name,
 * common name, and reference to its parent taxonomic group.
 */
export const TAXONOMIC_FAMILIES: Record<string, TaxonomicFamily> = {
    // MAMMALS - Carnivores
    "Felidae": {
        id: "9681",
        name: "Felidae",
        commonName: "Cats",
        groupKey: "MAMMALS"
    },
    "Canidae": {
        id: "9608",
        name: "Canidae",
        commonName: "Dogs",
        groupKey: "MAMMALS"
    },
    "Ursidae": {
        id: "9632",
        name: "Ursidae",
        commonName: "Bears",
        groupKey: "MAMMALS"
    },

    // MAMMALS - Domestic/Farm
    "Bovidae": {
        id: "9895",
        name: "Bovidae",
        commonName: "Cattle",
        groupKey: "MAMMALS"
    },
    "Equidae": {
        id: "9789",
        name: "Equidae",
        commonName: "Horses",
        groupKey: "MAMMALS"
    },
    "Suidae": {
        id: "9821",
        name: "Suidae",
        commonName: "Pigs",
        groupKey: "MAMMALS"
    },
    "Leporidae": {
        id: "9975",
        name: "Leporidae",
        commonName: "Rabbits",
        groupKey: "MAMMALS"
    },
    "Muridae": {
        id: "10066",
        name: "Muridae",
        commonName: "Mice and Rats",
        groupKey: "MAMMALS"
    },

    // MAMMALS - Marine
    "Delphinidae": {
        id: "9726",
        name: "Delphinidae",
        commonName: "Dolphins",
        groupKey: "MAMMALS"
    },
    "Balaenopteridae": {
        id: "9767",
        name: "Balaenopteridae",
        commonName: "Whales",
        groupKey: "MAMMALS"
    },
    "Pinnipedia": {
        id: "9700",
        name: "Pinnipedia",
        commonName: "Seals",
        groupKey: "MAMMALS"
    },
    "Phocoenidae": {
        id: "9740",
        name: "Phocoenidae",
        commonName: "Porpoises",
        groupKey: "MAMMALS"
    },

    // MAMMALS - Primates
    "Hominidae": {
        id: "9604",
        name: "Hominidae",
        commonName: "Great Apes",
        groupKey: "MAMMALS"
    },
    "Primates": {
        id: "9443",
        name: "Primates",
        commonName: "Primates",
        groupKey: "MAMMALS"
    },
    "Macropodidae": {
        id: "9307",
        name: "Macropodidae",
        commonName: "Kangaroos and Wallabies",
        groupKey: "MAMMALS"
    },
    "Dasyuridae": {
        id: "9277",
        name: "Dasyuridae",
        commonName: "Marsupial Carnivores",
        groupKey: "MAMMALS"
    },

    // BIRDS
    "Phasianidae": {
        id: "9005",
        name: "Phasianidae",
        commonName: "Pheasants and Chickens",
        groupKey: "BIRDS"
    },
    "Anatidae": {
        id: "8825",
        name: "Anatidae",
        commonName: "Ducks and Geese",
        groupKey: "BIRDS"
    },
    "Accipitridae": {
        id: "8892",
        name: "Accipitridae",
        commonName: "Eagles and Hawks",
        groupKey: "BIRDS"
    },
    "Psittacidae": {
        id: "9223",
        name: "Psittacidae",
        commonName: "Parrots",
        groupKey: "BIRDS"
    },
    "Strigiformes": {
        id: "8896",
        name: "Strigiformes",
        commonName: "Owls",
        groupKey: "BIRDS"
    },

    // REPTILES
    "Crocodylidae": {
        id: "8496",
        name: "Crocodylidae",
        commonName: "Crocodiles",
        groupKey: "REPTILES"
    },
    "Alligatoridae": {
        id: "8496",  // Note: This is intentionally the same as Crocodylidae as per original data
        name: "Alligatoridae",
        commonName: "Alligators",
        groupKey: "REPTILES"
    },
    "Serpentes": {
        id: "8570",
        name: "Serpentes",
        commonName: "Snakes",
        groupKey: "REPTILES"
    },
    "Squamata": {
        id: "8509",
        name: "Squamata",
        commonName: "Lizards",
        groupKey: "REPTILES"
    },
    "Testudines": {
        id: "8459",
        name: "Testudines",
        commonName: "Turtles",
        groupKey: "REPTILES"
    },

    // FISH
    "Chondrichthyes": {
        id: "7777",
        name: "Chondrichthyes",
        commonName: "Sharks and Rays",
        groupKey: "FISH"
    },
    "Actinopterygii": {
        id: "7898",
        name: "Actinopterygii",
        commonName: "Ray-finned Fishes",
        groupKey: "FISH"
    },

    // AMPHIBIANS
    "Anura": {
        id: "8342",
        name: "Anura",
        commonName: "Frogs and Toads",
        groupKey: "AMPHIBIANS"
    },
    "Caudata": {
        id: "8292",
        name: "Caudata",
        commonName: "Salamanders and Newts",
        groupKey: "AMPHIBIANS"
    }
};
