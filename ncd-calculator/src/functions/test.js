import { getApiResponse, getFastaListUri, parseFasta } from "/Users/namdo/Desktop/rnd/libqsearch-clean/ncd-calculator/src/functions/getPublicFasta.js";
import { writeFileSync } from 'fs';

const stuff = "PQ380006 PQ380005 OZ193855 PQ157935 PQ483949 PQ165088 PQ469261 OZ193823 PQ380008 PQ354418 PQ423887 PQ423886 PQ423885 PQ423884 PQ309109 PQ284211 PQ284210 PQ284209 PQ284208 PQ284207 PQ284206 PQ284205 PQ284204 PQ284203 PQ284202 PQ284201 PQ284200 PQ284199 PQ284198 PQ284197 PQ284196 PQ284195 PQ284194 PQ284193 PQ284192 PQ240359 PQ240358 PQ240357 OP612947 ON652842";
const accessionNumbers = stuff.split(/\s+/).map(acc => acc.toLowerCase());

const parseAccessionNumber = label => {
    if (!label || label === '') {
        return null;
    }
    return label.split(".")[0].trim().toLowerCase();
};

const execute = async () => {
    try {
        // Get the URI and API response
        const uri = await getFastaListUri(accessionNumbers);
        const apiResponse = await getApiResponse(uri);
        const data = parseFasta(apiResponse);

        // Reorder the sequences to match the input order
        const orderedContents = accessionNumbers.map(accession => {
            const index = data.labels.findIndex(label => 
                parseAccessionNumber(label) === accession
            );
            return index !== -1 ? data.contents[index] : null;
        });

        // Write files in order
        const files = [];
        for(let i = 0; i < accessionNumbers.length; i++) {
            const file = `/Users/namdo/Desktop/rnd/sample/${accessionNumbers[i]}.fasta`;
            files.push(file);
            if (orderedContents[i] !== null) {
                writeFileSync(
                    file, 
                    `>${accessionNumbers[i]}\n${orderedContents[i]}`
                );
                console.log(`Created file for ${accessionNumbers[i]}`);
            } else {
                console.warn(`No data found for accession number: ${accessionNumbers[i]}`);
            }
        }

        console.log('All files have been created successfully');
        console.log(files.join(" "));
    } catch (error) {
        console.error('Error during execution:', error);
        throw error;
    }
};

execute();