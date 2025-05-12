import {TaxonomicGenus} from './types';

/**
 * Defines genera within each taxonomic family.
 * Each genus has its NCBI taxonomy ID, scientific name,
 * and reference to its parent family.
 */
export const TAXONOMIC_GENERA: Record<string, TaxonomicGenus> = {
    // Felidae (Cats)
    "Felis": {
        id: "9682",
        name: "Felis",
        familyName: "Felidae"
    },
    "Panthera": {
        id: "9688",
        name: "Panthera",
        familyName: "Felidae"
    },

    // Canidae (Dogs)
    "Canis": {
        id: "9611",
        name: "Canis",
        familyName: "Canidae"
    },
    "Vulpes": {
        id: "9627",
        name: "Vulpes",
        familyName: "Canidae"
    },

    // Bovidae (Cattle)
    "Bos": {
        id: "9903",
        name: "Bos",
        familyName: "Bovidae"
    },
    "Ovis": {
        id: "9935",
        name: "Ovis",
        familyName: "Bovidae"
    },
    "Capra": {
        id: "9922",
        name: "Capra",
        familyName: "Bovidae"
    },
    "Pseudoryx": {
        id: "97362",
        name: "Pseudoryx",
        familyName: "Bovidae"
    },

    // Equidae (Horses)
    "Equus": {
        id: "9789",
        name: "Equus",
        familyName: "Equidae"
    },

    // Suidae (Pigs)
    "Sus": {
        id: "9822",
        name: "Sus",
        familyName: "Suidae"
    },

    // Leporidae (Rabbits)
    "Oryctolagus": {
        id: "9984",
        name: "Oryctolagus",
        familyName: "Leporidae"
    },

    // Muridae (Mice and Rats)
    "Mus": {
        id: "10088",
        name: "Mus",
        familyName: "Muridae"
    },
    "Rattus": {
        id: "10114",
        name: "Rattus",
        familyName: "Muridae"
    },

    // Delphinidae (Dolphins)
    "Tursiops": {
        id: "9738",
        name: "Tursiops",
        familyName: "Delphinidae"
    },
    "Orcinus": {
        id: "9733",
        name: "Orcinus",
        familyName: "Delphinidae"
    },

    // Balaenopteridae (Whales)
    "Balaenoptera": {
        id: "9771",
        name: "Balaenoptera",
        familyName: "Balaenopteridae"
    },

    // Phocoenidae (Porpoises)
    "Phocoena": {
        id: "9745",
        name: "Phocoena",
        familyName: "Phocoenidae"
    },

    // Hominidae (Great Apes)
    "Pan": {
        id: "9597",
        name: "Pan",
        familyName: "Hominidae"
    },
    "Gorilla": {
        id: "9592",
        name: "Gorilla",
        familyName: "Hominidae"
    },
    "Pongo": {
        id: "9599",
        name: "Pongo",
        familyName: "Hominidae"
    },

    // Ursidae (Bears)
    "Ursus": {
        id: "9639",
        name: "Ursus",
        familyName: "Ursidae"
    },

    // Macropodidae (Kangaroos and Wallabies)
    "Setonix": {
        id: "30669",
        name: "Setonix",
        familyName: "Macropodidae"
    },

    // Dasyuridae (Marsupial Carnivores)
    "Sarcophilus": {
        id: "9304",
        name: "Sarcophilus",
        familyName: "Dasyuridae"
    },

    // Phasianidae (Pheasants and Chickens)
    "Gallus": {
        id: "9030",
        name: "Gallus",
        familyName: "Phasianidae"
    },
    "Meleagris": {
        id: "9102",
        name: "Meleagris",
        familyName: "Phasianidae"
    },

    // Anatidae (Ducks and Geese)
    "Anas": {
        id: "8835",
        name: "Anas",
        familyName: "Anatidae"
    },

    // Columbidae (Pigeons and Doves)
    "Columba": {
        id: "8930",
        name: "Columba",
        familyName: "Columbidae"
    },

    // Psittacidae (Parrots)
    "Strigops": {
        id: "2489340",
        name: "Strigops",
        familyName: "Psittacidae"
    },

    // Crocodylidae (Crocodiles)
    "Crocodylus": {
        id: "8494",
        name: "Crocodylus",
        familyName: "Crocodylidae"
    },

    // Alligatoridae (Alligators)
    "Alligator": {
        id: "8492",
        name: "Alligator",
        familyName: "Alligatoridae"
    },

    // Actinopterygii (Ray-finned Fishes)
    "Salmo": {
        id: "8028",
        name: "Salmo",
        familyName: "Actinopterygii"
    },
    "Thunnus": {
        id: "8235",
        name: "Thunnus",
        familyName: "Actinopterygii"
    },
    "Gadus": {
        id: "8048",
        name: "Gadus",
        familyName: "Actinopterygii"
    },
    "Oncorhynchus": {
        id: "8016",
        name: "Oncorhynchus",
        familyName: "Actinopterygii"
    },
    "Cyprinus": {
        id: "7961",
        name: "Cyprinus",
        familyName: "Actinopterygii"
    },
    "Oreochromis": {
        id: "8127",
        name: "Oreochromis",
        familyName: "Actinopterygii"
    },
    "Danio": {
        id: "7954",
        name: "Danio",
        familyName: "Actinopterygii"
    },
    "Carassius": {
        id: "7956",
        name: "Carassius",
        familyName: "Actinopterygii"
    },
    "Poecilia": {
        id: "8080",
        name: "Poecilia",
        familyName: "Actinopterygii"
    }
};
