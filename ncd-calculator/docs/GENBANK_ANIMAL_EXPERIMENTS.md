# GenBank animal experiments

Last updated: 2026-08-09 (Asia/Ho_Chi_Minh)

## What the feature supports

The GenBank source is designed for small, exploratory animal sequence comparisons. A user can search by animal common or scientific name, or enter an exact NCBI UID or accession. Before a name search, the user chooses one comparison scope: complete mitochondrial genome, COI/COX1, or cytochrome b. Results expose the organism, exact accession version, sequence length, inferred scope, RefSeq or GenBank source, record title, and a permanent NCBI record link. Additional results are loaded explicitly, and changing a query cancels obsolete work.

The accession version is the computational identity. For example, `NC_012920.1` is not reduced to `NC_012920`. Exact-version search and retrieval both reject a response that resolves to another version. When the user starts a comparison, ESummary metadata and FASTA sequence content are retrieved and verified as described in [the sequence pipeline](GENBANK_SEQUENCE_PIPELINE.md). Computation stops if any selected record fails; a partially retrieved set is never analyzed.

## Guided animal example

The **Animal example** action resolves four complete mitochondrial records from NCBI at runtime:

| Organism | Accession version |
| --- | --- |
| *Homo sapiens* | `NC_012920.1` |
| *Pan troglodytes* | `NC_001643.1` |
| *Pongo abelii* | `NC_002083.1` |
| *Mammuthus primigenius* | `NC_007596.2` |

The loader checks that each exact identity still resolves and that its current title describes a complete mitochondrial genome. This set is an interface and method demonstration, not a curated benchmark or a claim that four records are sufficient for a phylogenetic conclusion.

## Preflight decisions

The structural preflight blocks computation when a GenBank selection lacks verified metadata, has unknown sequence scope, mixes genome and marker scopes, or includes a partial record. It warns when the longest sequence is more than 1.5 times the shortest or when multiple records name the same organism. These checks prevent common accidental comparisons, but they do not establish biological quality. Users should still inspect record annotations, taxonomic identification, assembly evidence, known contamination, sampling design, and whether strain or population duplicates are scientifically intended.

Complete mitochondrial genomes need extra care because the molecule is circular. Two equivalent circular sequences can be deposited with different starting coordinates, and a record can use the opposite strand. Standard byte compression is sensitive to both representation choices. The application warns about this and preserves the original NCBI sequence; it does not silently rotate or reverse-complement records. A future canonicalization mode should be explicit, recorded in provenance, and validated against a biologically justified anchor such as an orthologous gene rather than chosen only to minimize distance.

## Implementation notes and future scale

The interactive implementation is intentionally bounded: 20 search results per backend call, 64 records per retrieval, 20 million bases per record, and 128 million bases per comparison. Search metadata is cached briefly in memory. Validated sequence records use IndexedDB and are reverified on every reuse. The backend accepts only the NCBI E-utilities request shapes needed by the feature and owns the NCBI credentials and shared rate budget.

For large systematic studies, move acquisition into a server-side job that records an immutable input manifest, uses Entrez History or datasets, stores validated objects in content-addressed durable storage, and separates data curation from the browser computation. Useful future additions include GenBank flat-file parsing for topology and feature coordinates, record-status checks for suppressed or replaced accessions, an explicit circular-sequence canonicalization contract, and export of the preflight report beside the NCD experiment manifest.
