import { sendRequestToProxy } from "./fetchProxy.js";

export const getFastaList = async (
  idList: string[],
): Promise<string> => {
  const FETCH_URI = getFastaListUri(idList);
  return await sendRequestToProxy({
    externalUrl: FETCH_URI,
  });
};


export const getFastaListUri = (idList: string[]): string => {
  const copy = [...idList];
  const ids = copy.join(",");
  return `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=${ids}&rettype=fasta&retmode=text`
};

export const getFastaAccessionNumbersFromIdsUri = (
  idList: string | string[],
): string => {
  if (typeof idList !== "string") {
    idList = idList.join(",");
  }
  return `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nucleotide&id=${idList}&rettype=acc`;
};

export const getFastaAccessionNumbersFromIds = async (
  idList: string[]
): Promise<string[]> => {
  const FETCH_URI = getFastaAccessionNumbersFromIdsUri(idList);
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
): string => {
  searchTerm =
    searchTerm.trim() + " AND mitochondrion[title] AND genome[title]";
  return `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=nuccore&term=${searchTerm}&retmode=text&rettype=fasta&retmax=${numItems}`;
};
