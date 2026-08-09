# GenBank sequence pipeline

Last updated: 2026-08-09 (Asia/Ho_Chi_Minh)

## Scope

CompLearn retrieves public nucleotide records through the NCBI Nucleotide (`nuccore`) E-utilities service. NCBI Nucleotide includes archival GenBank records and NCBI-derived records such as RefSeq. A record passing this pipeline is a faithful, versioned copy of the sequence NCBI served at retrieval time. That does not prove that the submitter's organism identification, assembly, annotation, or biological interpretation is correct. GenBank performs automated validation and manual review during submission, but archival records can still contain contamination, sequencing error, chimeras, misassemblies, incomplete coverage, or later revisions. NCBI describes its processing responsibilities in [NLM GenBank and SRA Data Processing](https://www.ncbi.nlm.nih.gov/sra/docs/sequence-data-processing/) and its sequence-quality checks in [Ribosomal RNA Sequence Processing](https://www.ncbi.nlm.nih.gov/genbank/sequencecheck/).

NCD measures similarity between the bytes supplied to the compressor. A valid GenBank record is therefore necessary but not sufficient for a valid biological experiment. Researchers must choose comparable material. For phylogenetic or taxonomic work, records should normally represent the same locus or the same complete organelle/genome scope, use compatible orientation, have similar completeness, and exclude known problematic records. Mixing a complete genome, a short marker, and an unrelated chromosome produces a valid compression calculation but usually not a defensible biological comparison.

## Retrieval and verification contract

The `genbank-sequence-v3` pipeline applies these stages in order and stops at the first failure:

1. Accept one to 64 unique NCBI UIDs or accession identifiers. Accession versions are retained rather than stripped.
2. Retrieve ESummary metadata, followed by FASTA content, in bounded requests through the backend.
3. Resolve every requested identifier through its NCBI UID and `accessionversion`. Response order is never used as identity.
4. Parse every FASTA record independently. Headers, duplicate accessions, empty records, and characters outside the IUPAC nucleotide alphabet are rejected.
5. Require an explicitly requested accession version, the returned ESummary accession version, and the FASTA header version to agree. Silent substitution of an older or newer sequence version is rejected.
6. Require the parsed base count to equal ESummary `slen` exactly.
7. Enforce resource limits of 20 million bases per record and 128 million bases per comparison before compression begins.
8. Require non-empty title and organism metadata plus a numeric taxonomy ID. Compute SHA-256 over the normalized uppercase nucleotide sequence. Compute a second SHA-256 over the canonical provenance fields and sequence digest so metadata tampering is detected as well as sequence tampering.
9. Admit the comparison only when every selected object resolves to non-empty, validated content. Partial batches never continue to NCD.

Ambiguity symbols such as `N`, `R`, and `Y` are preserved because they are legitimate IUPAC nucleotide symbols and carry information about the submitted record. Whitespace and FASTA headers are excluded from compression. Letter case is normalized to uppercase so formatting differences do not create artificial distance.

## Cache behavior

Validated sequences are stored in IndexedDB rather than `localStorage`, together with their complete provenance record. A cached entry is reused only when its pipeline version, requested identifier, database, UID, accession relationship, metadata, canonical NCBI URL, expected length, IUPAC validation, sequence digest, and provenance digest all pass. The application storage schema is version 53 and removes older sequence-only entries while preserving unrelated same-origin browser data. Search pages use a small, typed, time-bounded memory cache; shared unauthenticated Redis access is not exposed to the browser.

The cache makes repeated interactive analyses efficient, but it is not a permanent scientific archive. A reproducible publication or experiment should record the accession version and digest from the typed provenance data. If long-term byte-for-byte recovery is required, export or archive the exact validated FASTA inputs with the analysis.

## Scaling and NCBI policy

All browser requests pass through a backend scheduler. The scheduler removes client-supplied API keys, adds the server-owned key plus the configured `tool` and `email`, and permits only HTTPS requests to ESearch, ESummary, and EFetch. Each endpoint has an explicit allowlist for databases, parameters, identifiers, result counts, offsets, response modes, and URL length. It limits the shared process to three requests per second without an API key or ten with one, allows at most four upstream requests concurrently, keeps a bounded queue, retries transient network, rate-limit, and 5xx failures with exponential delay, honors `Retry-After`, and caps response size and request duration. Browser cancellation is propagated to the backend upstream request. These values follow the [NCBI E-utilities usage guidelines](https://www.ncbi.nlm.nih.gov/books/NBK25497/).

Interactive browser analysis remains intentionally bounded. A server-side batch workflow using Entrez History, durable object storage, job isolation, and exported manifests is the appropriate next architecture for hundreds or thousands of large genomes. Increasing the browser limit would consume more memory without making the experiment more reliable.

## Recommended research procedure

Define the biological comparison rule before searching. The interface makes the user select complete mitochondrial genome, COI/COX1, or cytochrome b scope; shows versioned accession, length, source database, organism, title, and NCBI link; and exposes explicit pagination. Before computation it blocks mixed scopes, partial records, unknown scope, and missing metadata, while warning about length outliers and duplicate organisms. For complete mitochondrial genomes it also warns that circular molecules can use different origins and strands; ordinary compression is not rotation-invariant, so this remains a researcher decision rather than an automatic biological correction.

Save the exact accession-version list and sequence and provenance hashes with the result. Repeat the analysis with a documented alternative compressor or carefully justified record set when conclusions depend on small distance differences. Treat the quartet tree as a topology optimized from the selected compression distances, not as automatic proof of evolutionary ancestry. See [GenBank animal experiments](GENBANK_ANIMAL_EXPERIMENTS.md) for the user workflow and guided example.
