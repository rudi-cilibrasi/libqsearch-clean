import {parseAccessionNumber} from "./cache.js";

export const hasMetadata = (content) => {
    if (!content || content.trim() === '') {
        return false;
    }
    const lines = content.split("\n");
    if (lines.length === 0) {
        return false;
    }
    return lines[0].startsWith(">");
}


export const parseMultipleMetadataAndClean = (content) => {
    return parseMultipleMetadata(content).map(metadata => {
        return Object.fromEntries(
            Object.entries(metadata).map(([key, value]) => [
                key,
                typeof value === 'string' ? value.toLowerCase() : value
            ])
        );
    });
};

export const parseMultipleMetadata = (content) => {
    if (!content || content.trim() === '') {
        return [];
    }
    return parseFasta(content).map(fasta => {
        return {
            commonName: fasta.commonName,
            scientificName: fasta.scientificName,
            accession: fasta.accession
        };
    });
};


export const parseFasta = (content) => {
    if (!content || content.trim() === '') {
        return [];
    }
    const lines = content.split("\n");
    const isHeadless = !hasMetadata(content);
    if (isHeadless) {
        // if it's headless then sequences must be separated by 1 line of spaces
        let sequences = [];
        let currentSequence = "";
        lines.forEach(line => {
            if (line.trim() === "") {
                if (currentSequence) {
                    sequences.push({
                        sequence: currentSequence
                    })
                    currentSequence = "";
                }
            } else {
                currentSequence += line.trim();
            }
        })
        if (currentSequence) {
            sequences.push({
                sequence: currentSequence
            })
        }
        return sequences;
    } else {
        let currentHeader = {};
        let currentSequence = "";
        let sequences = [];
        lines.forEach(line => {
            if (line.startsWith(">") || line.trim() === '') {
                if (currentHeader && currentSequence) {
                    sequences.push({
                        ...currentHeader,
                        sequence: currentSequence
                    });
                    currentHeader = {};
                    currentSequence = "";
                }
                currentHeader = parseMetadata(line);
            } else {
                currentSequence += line.trim();
            }
        });
        if (currentHeader && currentSequence) {
            sequences.push(
                {
                    ...currentHeader,
                    sequence: currentSequence
                }
            )
        }
        return sequences;
    }
}
export const parseMetadata = (content) => {
    if (!hasMetadata(content)) {
        return {};
    }
    const metadata = {
        accession: "",
        scientificName: "",
        commonName: "",
    }
    const header = content.split("\n")[0];
    const commonNameMatch = header.match(/\((.*?)\)/);
    if (commonNameMatch) {
        metadata.commonName = commonNameMatch[1].trim();
    }
    const accession = parseAccessionNumber(header.split(">")[1].split(" ")[0]);
    metadata.accession = accession;
    const names = header.substring(header.indexOf(accession) + accession.length);
    const scientificNameMatch = names.match(/\s*([\w\s]+?)(?:\s*\(|$)/);
    if (scientificNameMatch) {
        metadata.scientificName = scientificNameMatch[1].trim();
    }
    return metadata;
}


export const getCleanSequence = (content) => {
    const withHeader = isValidFastaSequenceWithHeader(content);
    const withoutHeader = isValidFastaSequenceWithoutHeader(content);

    if (!withoutHeader && !withHeader) {
        return;
    }
    const sequence = content.split("\n");
    if (withHeader) {
        let seq = "";
        for (let i = 1; i < sequence.length; i++) {
            seq += sequence[i].toLowerCase().trim();
        }
        return seq;
    }
    if (withoutHeader) {
        let seq = "";
        for (let i = 0; i < sequence.length; i++) {
            seq += sequence[i].toLowerCase().trim();
        }
        return seq;
    }
    return "";
}


export const isValidFastaSequenceWithHeader = (content) => {
    if (hasMetadata(content)) {
        return validSequence(getOnlySequence(content));
    } else {
        return false;
    }
}


export const isValidFasta = (content) => {
    return isValidFastaSequenceWithHeader(content) || isValidFastaSequenceWithoutHeader(content);
}

const getOnlySequence = (content) => {
    if (hasMetadata(content)) {
        let seq = "";
        const lines = content.split("\n");
        for (let i = 1; i < lines.length; i++) {
            seq += lines[i];
        }
        return seq;
    } else {
        return content;
    }
}
export const isValidFastaSequenceWithoutHeader = (content) => {
    return validSequence(content);
}

export const validSequence = (content) => {
    const cleanContent = content.replace(/\s/g, '');
    const isDna = /^[ATCGNatcgn\s]*$/.test(cleanContent);  // DNA
    if (isDna) return true;
    const isRna = /^[AUCGNaucgn\s]*$/.test(cleanContent);  // RNA
    if (isRna) {
        return true;
    }
    return /^[ACDEFGHIKLMNPQRSTVWY\s]*$/.test(cleanContent); // protein
}


export const parseFastaAndClean = (fastaData) => {
    const fastaList = parseFasta(fastaData);
    for(let i = 0; i < fastaList.length; i++) {
        const fasta = fastaList[i];
        fasta.sequence = getCleanSequence(fasta.sequence);
    }
    return fastaList;
}


