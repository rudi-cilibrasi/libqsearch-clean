import { parseAccessionAndRemoveVersion } from "../cache/cache.ts";
import { FILE_UPLOAD } from "../constants/modalConstants.js";
import { SelectedItem } from '../components/InputAccumulator';
import {FileInfo} from "@/functions/file.ts";

export interface FastaMetadata {
  accession: string | undefined;
  scientificName: string;
  commonName: string;
  sequence?: string;
}


export const hasMetadata = (content: string): boolean => {
  if (!content || content.trim() === "") {
    return false;
  }
  const lines = content.split("\n");
  if (lines.length === 0) {
    return false;
  }
  return lines[0].startsWith(">");
};

export const parseMultipleMetadataAndClean = (
  content: string
): FastaMetadata[] => {
  return parseMultipleMetadata(content).map((metadata) => {
    return Object.fromEntries(
      Object.entries(metadata).map(([key, value]) => [
        key,
        typeof value === "string" ? value.toLowerCase() : value,
      ])
    ) as FastaMetadata;
  });
};

export const parseMultipleMetadata = (content: string): FastaMetadata[] => {
  if (!content || content.trim() === "") {
    return [];
  }
  return parseFasta(content).map((fasta) => {
    return {
      commonName: fasta.commonName,
      scientificName: fasta.scientificName,
      accession: fasta.accession,
    };
  });
};

export const parseFasta = (content: string): FastaMetadata[] => {
  if (!content?.trim()) {
    return [];
  }

  const lines = content.split("\n");
  const sequences: FastaMetadata[] = [];
  let currentHeader: FastaMetadata = {
    accession: "",
    scientificName: "",
    commonName: "",
  };
  let currentSequence = "";
  lines.forEach((line) => {
    if (line.startsWith(">")) {
      if (currentSequence) {
        sequences.push({
          ...currentHeader,
          sequence: currentSequence,
        });
      }
      currentSequence = "";
      currentHeader = {
        accession: "",
        scientificName: "",
        commonName: "",
        ...parseMetadata(line)
      };
    } else {
      currentSequence += line.trim();
    }
  });

  if (currentSequence) {
    sequences.push({
      ...currentHeader,
      sequence: currentSequence,
    });
  }
  return sequences;
};
export const parseMetadata = (content: string): FastaMetadata | {} => {
  if (!hasMetadata(content)) {
    return { };
  }
  const metadata: FastaMetadata = {
    accession: "",
    scientificName: "",
    commonName: "",
  };

  const header = content.split("\n")[0];

  const accession = header.split(">")[1].split(" ")[0];
  metadata.accession = parseAccessionAndRemoveVersion(accession);

  const commonNameMatch = header.match(/\((.*?)\)/);
  if (commonNameMatch) {
    metadata.commonName = commonNameMatch[1].trim();
  }
  const afterAccession = header.substring(
    header.indexOf(accession) + accession.length
  );
  const beforeParentheses = commonNameMatch
    ? afterAccession.substring(0, afterAccession.indexOf("("))
    : afterAccession;
  metadata.scientificName = beforeParentheses.split(",")[0].trim();
  return metadata;
};

export const getCleanSequence = (content: string): string | undefined => {
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
};

export const isValidFastaSequenceWithHeader = (content: string): boolean => {
  if (hasMetadata(content)) {
    return validSequence(getOnlySequence(content));
  } else {
    return false;
  }
};

export const isValidFasta = (content: string): boolean => {
  return (
    isValidFastaSequenceWithHeader(content) ||
    isValidFastaSequenceWithoutHeader(content)
  );
};

const getOnlySequence = (content: string): string => {
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
};

export const isValidFastaSequenceWithoutHeader = (content: string): boolean => {
  return validSequence(content);
};

export const validSequence = (content: string): boolean => {
  const cleanContent = content.replace(/\s/g, "");
  const isDna = /^[ATCGNatcgn\s]*$/.test(cleanContent); // DNA
  if (isDna) return true;
  const isRna = /^[AUCGNaucgn\s]*$/.test(cleanContent); // RNA
  if (isRna) {
    return true;
  }
  return /^[ACDEFGHIKLMNPQRSTVWY\s]*$/.test(cleanContent); // protein
};

export const isFasta = (fileInfo: FileInfo): boolean => {
  if (!fileInfo) return false;
  const ext = fileInfo.ext;
  if ("fasta" === ext) return true;
  const content = fileInfo.content;
  return typeof content === "string" ? isValidFasta(content) : false;
};

export const parseFastaAndClean = (fastaData: string): FastaMetadata[] => {
  const fastaList = parseFasta(fastaData);
  if (!isValidFastaWithSequence(fastaList)) return [];
  for (let i = 0; i < fastaList.length; i++) {
    const fasta = fastaList[i];
    fasta.sequence = getCleanSequence(fasta.sequence || "");
  }
  return fastaList;
};

const isValidFastaWithSequence = (fastaList: FastaMetadata[]): boolean => {
  if (!fastaList || fastaList.length === 0) return false;
  for (let i = 0; i < fastaList.length; i++) {
    if (!fastaList[i].sequence || fastaList[i].sequence?.trim() === "")
      return false;
    if (!isValidFastaSequenceWithoutHeader(fastaList[i].sequence || ""))
      return false;
  }
  return true;
};

export const getFastaInfoFromFile = (fileInfo: FileInfo): SelectedItem => {
  const content = fileInfo.content;
  let label = fileInfo.name;
  if (typeof content === "string" && hasMetadata(content)) {
    const headerWithSequence = parseFasta(content);
    const first = headerWithSequence[0];
    if (first.commonName && first.commonName.trim() !== "") {
      label = first.commonName;
    } else if (first.scientificName && first.scientificName.trim() !== "") {
      const p = first.scientificName.split(" ");
      const t: string[] = [];
      for (let i = 0; i < p.length && i < 2; i++) {
        t.push(p[i]);
      }
      label = t.join(" ");
    } else {
      label = first.accession;
    }
    return {
      type: FILE_UPLOAD,
      content: getCleanSequence(first.sequence || ""),
      label: label,
      id: fileInfo.name,
    };
  } else {
    return {
      type: FILE_UPLOAD,
      content: typeof fileInfo.content === "string" ? getCleanSequence(fileInfo.content) : undefined,
      label: label,
      id: fileInfo.name,
    };
  }
};
