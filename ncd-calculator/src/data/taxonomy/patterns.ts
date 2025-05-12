import {GroupPattern} from './types';

/**
 * Defines regex patterns for matching text to taxonomic groups.
 * These patterns help identify animal groups from search terms
 * when exact matches are not found in the species or breed lists.
 */
export const GROUP_PATTERNS: GroupPattern[] = [
    // Mammals - Carnivores
    {
        pattern: /(fox|vixen|kit|fennec)/i,
        groupKey: "MAMMALS",
        familyId: "Canidae",
        taxId: "9627",
    },
    {
        pattern: /(wolf|wolves|canis|coyote|jackal)/i,
        groupKey: "MAMMALS",
        familyId: "Canidae",
        taxId: "9612",
    },
    {
        pattern: /(lion|tiger|leopard|jaguar|panther|puma|cougar|cheetah)/i,
        groupKey: "MAMMALS",
        familyId: "Felidae",
        taxId: "9689",
    },
    {
        pattern: /(bear|ursus|grizzly|polar bear|panda)/i,
        groupKey: "MAMMALS",
        familyId: "Ursidae",
        taxId: "9632",
    },

    // Mammals - Marine
    {
        pattern: /(dolphin|porpoise|orca|killer whale)/i,
        groupKey: "MAMMALS",
        familyId: "Delphinidae",
        taxId: "9739",
    },
    {
        pattern: /(whale|cetacean|baleen)/i,
        groupKey: "MAMMALS",
        familyId: "Balaenopteridae",
        taxId: "9721",
    },
    {
        pattern: /(seal|sea lion|walrus|pinniped)/i,
        groupKey: "MAMMALS",
        familyId: "Pinnipedia",
        taxId: "9700",
    },

    // Mammals - Primates
    {
        pattern: /(ape|gorilla|chimpanzee|orangutan|bonobo)/i,
        groupKey: "MAMMALS",
        familyId: "Hominidae",
        taxId: "9604",
    },
    {
        pattern: /(monkey|macaque|baboon|mandrill|lemur)/i,
        groupKey: "MAMMALS",
        familyId: "Primates",
        taxId: "9443",
    },

    // Reptiles
    {
        pattern: /(crocodile|alligator|caiman|gavial)/i,
        groupKey: "REPTILES",
        familyId: "Crocodylidae",
        taxId: "8496",
    },
    {
        pattern: /(snake|python|cobra|viper|boa|rattlesnake|serpent)/i,
        groupKey: "REPTILES",
        familyId: "Serpentes",
        taxId: "8570",
    },
    {
        pattern: /(lizard|gecko|iguana|monitor|chameleon|skink)/i,
        groupKey: "REPTILES",
        familyId: "Squamata",
        taxId: "8509",
    },
    {
        pattern: /(turtle|tortoise|terrapin)/i,
        groupKey: "REPTILES",
        familyId: "Testudines",
        taxId: "8459",
    },

    // Fish
    {
        pattern: /(shark|ray|skate|dogfish)/i,
        groupKey: "FISH",
        familyId: "Chondrichthyes",
        taxId: "7777",
    },
    {
        pattern: /(fish|bass|trout|salmon|tuna|cod|perch|carp)/i,
        groupKey: "FISH",
        familyId: "Actinopterygii",
        taxId: "7898",
    },

    // Birds
    {
        pattern: /(eagle|hawk|falcon|kite|osprey|vulture)/i,
        groupKey: "BIRDS",
        familyId: "Accipitridae",
        taxId: "8892",
    },
    {
        pattern: /(owl|barn owl|eagle owl|horned owl)/i,
        groupKey: "BIRDS",
        familyId: "Strigiformes",
        taxId: "8896",
    },
    {
        pattern: /(parrot|macaw|cockatoo|parakeet|budgie)/i,
        groupKey: "BIRDS",
        familyId: "Psittacidae",
        taxId: "8932",
    },

    // Amphibians
    {
        pattern: /(frog|toad|treefrog|bullfrog)/i,
        groupKey: "AMPHIBIANS",
        familyId: "Anura",
        taxId: "8342",
    },
    {
        pattern: /(salamander|newt|axolotl)/i,
        groupKey: "AMPHIBIANS",
        familyId: "Caudata",
        taxId: "8292",
    },

    // Rare animals
    {
        pattern: /(saola)/i,
        groupKey: "MAMMALS",
        familyId: "Bovidae",
        taxId: "97363",
    },
    {
        pattern: /(vaquita)/i,
        groupKey: "MAMMALS",
        familyId: "Phocoenidae",
        taxId: "42100",
    },
    {
        pattern: /(kakapo)/i,
        groupKey: "BIRDS",
        familyId: "Psittacidae",
        taxId: "2489341",
    },
    {
        pattern: /(quokka)/i,
        groupKey: "MAMMALS",
        familyId: "Macropodidae",
        taxId: "30670",
    },
    {
        pattern: /(Tassie Devil|Tasmanian Devil|Marsupial Devil)/i,
        groupKey: "MAMMALS",
        familyId: "Dasyuridae",
        taxId: "9305",
    },
];
