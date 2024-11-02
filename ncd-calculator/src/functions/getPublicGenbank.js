import { parseAccessionNumber } from "./cache";
import { getApiResponseText } from "./fetch";
const parseGenbankEntry = (entry) => {
  const sourceMatch = entry.match(/SOURCE\s+([^\n]+)/);
  let commonName = "";
  let scientificName = "";
  let source = "";
  if (sourceMatch) {
    source = sourceMatch[1];
    const commonNameMatch = source.match(/\((.*?)\)/);
    if (commonNameMatch) {
      commonName = commonNameMatch[1].trim();
    }
    const scientificNameMatch = source.match(/\s*([\w\s]+?)(?:\s*\(|$)/);
    if (scientificNameMatch) {
      scientificName = scientificNameMatch[1].trim();
    }
  }

  const accessionMatch = entry.match(/ACCESSION\s+(\w+)/);
  const accessionNumber = accessionMatch ? accessionMatch[1] : "";

  const originMatch = entry.match(/ORIGIN\s+([^/]+)/);
  let sequence = "";
  if (originMatch) {
    sequence = originMatch[1].replace(/\d+/g, "").replace(/\s+/g, "").trim();
  }

  let displayName = "";
  if (commonName) {
    displayName = commonName;
  } else if (scientificName) {
    displayName = scientificName;
  } else {
    displayName = accessionNumber;
  }
  const response = {
    commonName,
    scientificName,
    accessionNumber,
    sequence,
  };
  return response;
};

const parseGenbankList = (text) => {
  if (!text) {
    return {};
  }
  const list = text
    .split("//")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
  const parsedSequences = list
    .map(parseGenbankEntry)
    .filter(
      (sequence) =>
        sequence.accessionNumber && sequence.accessionNumber.trim() !== ""
    );
  let labels = determineDisplayName(parsedSequences);
  let contents = [];
  let accessionNumbers = [];
  for (let i = 0; i < parsedSequences.length; i++) {
    const sequence = parsedSequences[i];
    contents.push(sequence["sequence"]);
    accessionNumbers.push(sequence["accessionNumber"]);
  }
  const resp = {
    labels: labels,
    contents: contents,
    accessions: accessionNumbers.map(parseAccessionNumber),
  };
  return resp;
};

const hasDuplicates = (arr) => {
  const counts = {};
  for (const item of arr) {
    if (item) {
      counts[item] = (counts[item] || 0) + 1;
      if (counts[item] > 1) return true;
    }
  }
  return false;
};

const determineDisplayName = (sequences) => {
  const commonNames = sequences.map((seq) => seq.commonName);
  const scientificNames = sequences.map((seq) => seq.scientificName);

  const hasCommonNameDuplicates = hasDuplicates(commonNames);
  const hasScientificNameDuplicates = hasDuplicates(scientificNames);

  return sequences.map((seq) => {
    let name = "";
    if (hasCommonNameDuplicates) {
      if (hasScientificNameDuplicates) {
        name = seq.commonName;
      } else {
        name = seq.scientificName;
      }
    } else {
      if (seq.commonName) {
        name = seq.commonName;
      } else if (seq.scientificName) {
        name = seq.scientificName;
      } else {
        name = seq.accessionNumber;
      }
    }
    if (name === "") {
      return seq.accessionNumber;
    } else {
      if (name !== seq.accessionNumber) {
        return `${name} (${seq.accessionNumber})`;
      } else {
        return name;
      }
    }
  });
};

const getGenbankListUri = (ids) => {
  const IDS = ids.join(",");
  return encodeURI(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=${IDS}&rettype=genbank&retmode=text`
  );
};

export const getGenbankSequences = async (ids) => {
  const uri = getGenbankListUri(ids);
  const textResponse = await getApiResponseText(uri);
  return parseGenbankList(textResponse);
};
