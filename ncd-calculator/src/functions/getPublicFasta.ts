import { sendRequestToProxy } from "./fetchProxy.js";
import { encodeURIWithApiKey } from "./api.js";
import { parseFastaAndClean } from "./fasta.js";

export const getFastaList = async (
  idList: string[],
  apiKey: string
): Promise<string> => {
  const FETCH_URI = getFastaListUri(idList, apiKey);
  return await sendRequestToProxy({
    externalUrl: FETCH_URI,
  });
};

export const getFastaListAndParse = async (
  idList: string[],
  apiKey: string
) => {
  const data = await getFastaList(idList, apiKey);
  return parseFastaAndClean(data);
};

export const getFastaListUri = (idList: string[], apiKey: string): string => {
  const copy = [...idList];
  const ids = copy.join(",");
  return encodeURIWithApiKey(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=${ids}&rettype=fasta&retmode=text`,
    apiKey
  );
};

export const getFastaAccessionNumbersFromIdsUri = (
  idList: string | string[],
  apiKey: string
): string => {
  if (typeof idList !== "string") {
    idList = idList.join(",");
  }
  return encodeURIWithApiKey(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nucleotide&id=${idList}&rettype=acc`,
    apiKey
  );
};

export const getFastaAccessionNumbersFromIds = async (
  idList: string | string[],
  apiKey: string
): Promise<string[]> => {
  const FETCH_URI = getFastaAccessionNumbersFromIdsUri(idList, apiKey);
  let accessions = await sendRequestToProxy({
    externalUrl: FETCH_URI,
  });
  if (accessions && accessions !== "") {
    return accessions.split("\n").filter((accession: any) => accession != null);
  }
  return [];
};

export const getSequenceIdsBySearchTermUri = (
  searchTerm: string,
  numItems: string | number,
  apiKey: string
): string => {
  searchTerm =
    searchTerm.trim() + " AND mitochondrion[title] AND genome[title]";
  return encodeURIWithApiKey(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=nuccore&term=${searchTerm}&retmode=text&rettype=fasta&retmax=${numItems}`,
    apiKey
  );
};

export const getSequenceIdsBySearchTerm = async (
  searchTerm: string,
  numItems: number | string,
  apiKey: string
): Promise<string[]> => {
  const ID_LIST_URI: string = getSequenceIdsBySearchTermUri(
    searchTerm,
    numItems,
    apiKey
  );
  let idList: string[] = [];
  const searchResult = await sendRequestToProxy({
    externalUrl: ID_LIST_URI,
  });
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(searchResult, "text/xml");
  idList = Array.from(xmlDoc.getElementsByTagName("Id"))
    .map((idNode) => idNode.textContent)
    .filter((text): text is string => text !== null);
  if (idList.length === 0) {
    console.log("No IDs found for the search term.");
    return [];
  }
  return idList;
};
