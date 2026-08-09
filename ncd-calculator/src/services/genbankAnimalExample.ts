import type {SelectedItem} from "../components/workbenchTypes";
import {GenBankSearchService} from "./GenBankSearchService";

export const GENBANK_ANIMAL_EXAMPLE_ACCESSIONS = [
  "NC_012920.1", // Homo sapiens
  "NC_001643.1", // Pan troglodytes
  "NC_002083.1", // Pongo abelii
  "NC_007596.2", // Mammuthus primigenius
] as const;

export const getGenBankAnimalExampleItems = async (): Promise<SelectedItem[]> => {
  const service = new GenBankSearchService();
  const pages = await Promise.all(GENBANK_ANIMAL_EXAMPLE_ACCESSIONS.map(query => service.searchRecords({
    query,
    scope: "mitochondrial-genome",
  })));
  const records = pages.map((page, index) => {
    const record = page.records[0];
    if (!record || record.accessionVersion !== GENBANK_ANIMAL_EXAMPLE_ACCESSIONS[index]) {
      throw new Error(`NCBI did not resolve the guided animal record ${GENBANK_ANIMAL_EXAMPLE_ACCESSIONS[index]}.`);
    }
    if (record.scope !== "mitochondrial-genome" || !record.isComplete) {
      throw new Error(`The guided animal record ${record.accessionVersion} no longer satisfies the complete mitochondrial-genome contract.`);
    }
    return record;
  });
  return records.map(record => ({
    type: "fasta",
    id: record.accessionVersion,
    label: `${record.organism} · ${record.accessionVersion}`,
    genBankCandidate: record,
  }));
};
