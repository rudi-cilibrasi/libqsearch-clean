import {AnimalBreed} from './types';

/**
 * Defines breeds/varieties for each species.
 * Each breed has a name and reference to its parent species.
 * This provides more detailed categorization for domesticated species.
 */
export const ANIMAL_BREEDS: Record<string, AnimalBreed[]> = {
    // Cats (9685)
    "9685": [
        {name: "Siamese", speciesId: "9685"},
        {name: "Persian", speciesId: "9685"},
        {name: "Bengal", speciesId: "9685"},
        {name: "Maine Coon", speciesId: "9685"},
        {name: "British Shorthair", speciesId: "9685"},
        {name: "Abyssinian", speciesId: "9685"},
        {name: "Russian Blue", speciesId: "9685"},
        {name: "Ragdoll", speciesId: "9685"},
        {name: "Sphynx", speciesId: "9685"},
        {name: "Scottish Fold", speciesId: "9685"},
        {name: "Norwegian Forest Cat", speciesId: "9685"},
        {name: "Burmese", speciesId: "9685"},
        {name: "Oriental Shorthair", speciesId: "9685"},
        {name: "Turkish Angora", speciesId: "9685"},
        {name: "American Shorthair", speciesId: "9685"}
    ],

    // Dogs (9615)
    "9615": [
        {name: "German Shepherd", speciesId: "9615"},
        {name: "Labrador Retriever", speciesId: "9615"},
        {name: "Golden Retriever", speciesId: "9615"},
        {name: "Bulldog", speciesId: "9615"},
        {name: "Beagle", speciesId: "9615"},
        {name: "Poodle", speciesId: "9615"},
        {name: "Rottweiler", speciesId: "9615"},
        {name: "Yorkshire Terrier", speciesId: "9615"},
        {name: "Boxer", speciesId: "9615"},
        {name: "Dachshund", speciesId: "9615"},
        {name: "Siberian Husky", speciesId: "9615"},
        {name: "Great Dane", speciesId: "9615"},
        {name: "Doberman", speciesId: "9615"},
        {name: "Chihuahua", speciesId: "9615"},
        {name: "Pomeranian", speciesId: "9615"}
    ],

    // Horses (9796)
    "9796": [
        {name: "Arabian Horse", speciesId: "9796"},
        {name: "Thoroughbred", speciesId: "9796"},
        {name: "Quarter Horse", speciesId: "9796"},
        {name: "Andalusian", speciesId: "9796"},
        {name: "Friesian", speciesId: "9796"},
        {name: "Appaloosa", speciesId: "9796"},
        {name: "Morgan Horse", speciesId: "9796"},
        {name: "Paint Horse", speciesId: "9796"},
        {name: "Clydesdale", speciesId: "9796"},
        {name: "Shire Horse", speciesId: "9796"}
    ],

    // Cows (9913)
    "9913": [
        {name: "Holstein", speciesId: "9913"},
        {name: "Angus", speciesId: "9913"},
        {name: "Hereford", speciesId: "9913"},
        {name: "Jersey Cow", speciesId: "9913"},
        {name: "Charolais", speciesId: "9913"},
        {name: "Limousin", speciesId: "9913"},
        {name: "Brahman", speciesId: "9913"},
        {name: "Simmental", speciesId: "9913"},
        {name: "Guernsey", speciesId: "9913"},
        {name: "Brown Swiss", speciesId: "9913"}
    ],

    // Pigs (9823)
    "9823": [
        {name: "Yorkshire Pig", speciesId: "9823"},
        {name: "Duroc", speciesId: "9823"},
        {name: "Hampshire Pig", speciesId: "9823"},
        {name: "Berkshire Pig", speciesId: "9823"},
        {name: "Landrace Pig", speciesId: "9823"},
        {name: "Pietrain", speciesId: "9823"},
        {name: "Large White Pig", speciesId: "9823"},
        {name: "Spotted Pig", speciesId: "9823"},
        {name: "Tamworth Pig", speciesId: "9823"}
    ],

    // Sheep (9940)
    "9940": [
        {name: "Merino Sheep", speciesId: "9940"},
        {name: "Suffolk Sheep", speciesId: "9940"},
        {name: "Dorper", speciesId: "9940"},
        {name: "Romney Sheep", speciesId: "9940"},
        {name: "Dorset Sheep", speciesId: "9940"},
        {name: "Hampshire Sheep", speciesId: "9940"},
        {name: "Texel Sheep", speciesId: "9940"},
        {name: "Jacob Sheep", speciesId: "9940"},
        {name: "Lincoln Sheep", speciesId: "9940"}
    ],

    // Goats (9925)
    "9925": [
        {name: "Nubian Goat", speciesId: "9925"},
        {name: "Alpine Goat", speciesId: "9925"},
        {name: "Saanen Goat", speciesId: "9925"},
        {name: "Boer Goat", speciesId: "9925"},
        {name: "Angora Goat", speciesId: "9925"},
        {name: "Pygmy Goat", speciesId: "9925"},
        {name: "Nigerian Dwarf Goat", speciesId: "9925"},
        {name: "LaMancha Goat", speciesId: "9925"},
        {name: "Toggenburg Goat", speciesId: "9925"}
    ],

    // Rabbits (9986)
    "9986": [
        {name: "Holland Lop", speciesId: "9986"},
        {name: "Netherland Dwarf", speciesId: "9986"},
        {name: "Mini Rex", speciesId: "9986"},
        {name: "Lionhead Rabbit", speciesId: "9986"},
        {name: "Flemish Giant", speciesId: "9986"},
        {name: "Dutch Rabbit", speciesId: "9986"},
        {name: "New Zealand White", speciesId: "9986"},
        {name: "Angora Rabbit", speciesId: "9986"},
        {name: "Rex Rabbit", speciesId: "9986"}
    ],

    // Lab mice (10090)
    "10090": [
        {name: "C57BL/6", speciesId: "10090"},
        {name: "BALB/c", speciesId: "10090"},
        {name: "Swiss Webster", speciesId: "10090"},
        {name: "CD-1 Mouse", speciesId: "10090"},
        {name: "Black 6 Mouse", speciesId: "10090"},
        {name: "Nude Mouse", speciesId: "10090"},
        {name: "Transgenic Mouse", speciesId: "10090"},
        {name: "Knockout Mouse", speciesId: "10090"},
        {name: "Lab Mouse", speciesId: "10090"}
    ],

    // Lab rats (10116)
    "10116": [
        {name: "Sprague Dawley", speciesId: "10116"},
        {name: "Wistar Rat", speciesId: "10116"},
        {name: "Long Evans", speciesId: "10116"},
        {name: "Fischer 344", speciesId: "10116"},
        {name: "Brown Norway", speciesId: "10116"},
        {name: "Lewis Rat", speciesId: "10116"},
        {name: "Laboratory Rat", speciesId: "10116"},
        {name: "Wild Type Rat", speciesId: "10116"},
        {name: "Zucker Rat", speciesId: "10116"}
    ],

    // Chickens (9031)
    "9031": [
        {name: "Leghorn", speciesId: "9031"},
        {name: "Rhode Island Red", speciesId: "9031"},
        {name: "Plymouth Rock", speciesId: "9031"},
        {name: "Orpington", speciesId: "9031"},
        {name: "Wyandotte", speciesId: "9031"},
        {name: "Australorp", speciesId: "9031"},
        {name: "Brahma", speciesId: "9031"}
    ],

    // Ducks (8839)
    "8839": [
        {name: "Pekin Duck", speciesId: "8839"},
        {name: "Indian Runner", speciesId: "8839"},
        {name: "Khaki Campbell", speciesId: "8839"},
        {name: "Swedish Blue", speciesId: "8839"},
        {name: "Cayuga", speciesId: "8839"}
    ]
};
