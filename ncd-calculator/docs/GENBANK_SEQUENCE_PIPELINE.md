# GenBank sequence pipeline

Last updated: 2026-08-07

## Scope

CompLearn retrieves public nucleotide records through the NCBI Nucleotide (`nuccore`) E-utilities service. NCBI Nucleotide includes archival GenBank records and NCBI-derived records such as RefSeq. A record passing this pipeline is a faithful, versioned copy of the sequence NCBI served at retrieval time. That does not prove that the submitter's organism identification, assembly, annotation, or biological interpretation is correct. GenBank performs automated validation and manual review during submission, but archival records can still contain contamination, sequencing error, chimeras, misassemblies, incomplete coverage, or later revisions. NCBI describes its processing responsibilities in [NLM GenBank and SRA Data Processing](https://www.ncbi.nlm.nih.gov/sra/docs/sequence-data-processing/) and its sequence-quality checks in [Ribosomal RNA Sequence Processing](https://www.ncbi.nlm.nih.gov/genbank/sequencecheck/).

NCD measures similarity between the bytes supplied to the compressor. A valid GenBank record is therefore necessary but not sufficient for a valid biological experiment. Researchers must choose comparable material. For phylogenetic or taxonomic work, records should normally represent the same locus or the same complete organelle/genome scope, use compatible orientation, have similar completeness, and exclude known problematic records. Mixing a complete genome, a short marker, and an unrelated chromosome produces a valid compression calculation but usually not a defensible biological comparison.

## Retrieval and verification contract

The `genbank-sequence-v2` pipeline applies these stages in order and stops at the first failure:

1. Accept one to 64 unique NCBI UIDs or accession identifiers. Accession versions are retained rather than stripped.
2. Retrieve ESummary metadata, followed by FASTA content, in bounded requests through the backend.
3. Resolve every requested identifier through its NCBI UID and `accessionversion`. Response order is never used as identity.
4. Parse every FASTA record independently. Headers, duplicate accessions, empty records, and characters outside the IUPAC nucleotide alphabet are rejected.
5. Require the returned FASTA accession version to equal the ESummary accession version. Silent substitution of an older or newer sequence version is rejected.
6. Require the parsed base count to equal ESummary `slen` exactly.
7. Enforce resource limits of 20 million bases per record and 128 million bases per comparison before compression begins.
8. Compute SHA-256 over the normalized uppercase nucleotide sequence and retain the digest with the NCBI UID, accession, accession version, title, organism, taxonomy ID, expected length, retrieval time, and permanent record URL.
9. Admit the comparison only when every selected object resolves to non-empty, validated content. Partial batches never continue to NCD.

Ambiguity symbols such as `N`, `R`, and `Y` are preserved because they are legitimate IUPAC nucleotide symbols and carry information about the submitted record. Whitespace and FASTA headers are excluded from compression. Letter case is normalized to uppercase so formatting differences do not create artificial distance.

## Cache behavior

The browser cache stores the sequence together with its complete provenance record. A cached entry is reused only when its pipeline version, requested identifier, expected length, IUPAC validation, and SHA-256 digest all pass. The storage schema version was raised to 52, which removes older sequence-only cache entries. This prevents unversioned, truncated, corrupted, or previously mis-associated content from entering a new analysis.

The cache makes repeated interactive analyses efficient, but it is not a permanent scientific archive. A reproducible publication or experiment should record the accession version and digest from the typed provenance data. If long-term byte-for-byte recovery is required, export or archive the exact validated FASTA inputs with the analysis.

## Scaling and NCBI policy

All browser requests pass through a backend scheduler. The scheduler removes client-supplied API keys, adds the server-owned key plus the configured `tool` and `email`, and permits only HTTPS requests to the ESearch, ESummary, and EFetch endpoints for the supported NCBI databases. It limits the shared process to three requests per second without an API key or ten with one, allows at most four upstream requests concurrently, keeps a bounded queue, retries transient network, rate-limit, and 5xx failures with exponential delay, honors `Retry-After`, and caps response size and request duration. These values follow the [NCBI E-utilities usage guidelines](https://www.ncbi.nlm.nih.gov/books/NBK25497/).

Interactive browser analysis remains intentionally bounded. A server-side batch workflow using Entrez History, durable object storage, job isolation, and exported manifests is the appropriate next architecture for hundreds or thousands of large genomes. Increasing the browser limit would consume more memory without making the experiment more reliable.

## Recommended research procedure

Define the biological comparison rule before searching. Record why each locus or genome scope is comparable, prefer explicit accession versions, inspect NCBI titles and source metadata, exclude suppressed or unsuitable records, and save the exact accession-version list and sequence hashes with the result. Repeat the analysis with a documented alternative compressor or carefully justified record set when conclusions depend on small distance differences. Treat the quartet tree as a topology optimized from the selected compression distances, not as automatic proof of evolutionary ancestry.
