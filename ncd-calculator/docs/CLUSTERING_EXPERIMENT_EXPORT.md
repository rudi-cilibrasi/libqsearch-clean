# Clustering experiment JSON export

Updated 2026-08-08 (Asia/Ho_Chi_Minh).

## Purpose

The result page provides **Download JSON** after the quartet search completes. The download is a scientific record of the current clustering experiment, not a screenshot or a visualization preset. It preserves the inputs and the numerical path from compressed lengths to the selected unrooted tree so another program can audit the result without reading browser state.

The export format is `complearn-clustering-experiment`, schema version 1. Its machine-readable JSON Schema is stored at [`public/schemas/clustering-experiment-v1.schema.json`](../public/schemas/clustering-experiment-v1.schema.json). The file is serialized as compact UTF-8 JSON to avoid adding unnecessary memory and download overhead for large inputs.

## Included data

For object-based experiments, every input entry contains its stable identifier, display label, source type, exact UTF-8 text, byte length, SHA-256 digest, and content-addressed cache key. GenBank entries include the verified accession version, UID, organism, taxon, retrieval time, record URL, expected length, and sequence digest. UDHR entries include the complete immutable corpus and record provenance. Astronomy entries retain their immutable RXTE asset, source coordinates, class, cadence, canonicalization contract, and digest provenance. Local files retain their filename, and bundled sequence examples retain their example identifier. Because the exact input text is required to reproduce compression, local or otherwise sensitive file contents are included deliberately; users should inspect the source set before sharing an export.

The distance section contains the complete ordered NCD matrix, the reflected-minimum matrix supplied to QSearch and K-grid, the compressor revision and pipeline contract, and all compressed sizes used in the calculation. The record set is complete even when some values came from the browser cache: cache hits and worker results are merged and checked before export. Each ordered `C(x,y)` remains separate from `C(y,x)`. Before a file is created, the exporter recalculates every directed NCD from `C(x)`, `C(y)`, and `C(x,y)`, reapplies the reflected-cell minimum, and refuses inconsistent state.

The quartet-tree section identifies the tree as unrooted and stores its nodes, reciprocal edges, stable leaf identifiers, display labels, internal-edge support, most-balanced display split, QSearch pipeline version, seed summary, score range, selected-topology frequency, and support interpretation. Repeated-search edge percentages remain optimization stability, not bootstrap confidence. Internal planar or 3D coordinates are not included because they are presentation state and do not change the inferred topology. K-grid layout state is also excluded because this download is the quartet-tree experiment record; the common input matrices are included.

An imported distance-matrix experiment cannot provide raw objects, ordered compression lengths, or compressor provenance. Its export therefore records the source filename, object labels, imported symmetric matrix, explicit `imported` provenance, and the resulting QSearch tree without inventing unavailable information.

## Integrity model

Each raw object carries its own SHA-256 digest. The export also computes a SHA-256 digest using the versioned `complearn-export-integrity-v1` contract. Its compact integrity material contains the complete input manifest, source provenance, content hashes and byte lengths, distance analysis, and quartet tree. It omits only the raw text from that second hashing pass because each text is already bound by its object digest; this prevents another full-size copy for large exports. The digest becomes both `integrity.sha256` and the experiment identifier. It detects accidental modification of inputs, provenance, numerical results, or topology. It is not a digital signature and does not establish who produced the file.

Export is fail-fast. A download is blocked if object metadata is out of order, content hashes are unavailable, compressed-size records are incomplete, the directed matrix cannot reproduce the reduced matrix, labels differ across stages, the tree is cyclic or disconnected, an edge-support value is invalid, or the balanced split disagrees with the selected topology.

## Operational limits

Input loading and compression already enforce browser-safe size bounds. Hashing is sequential to avoid multiplying peak memory. The final download still needs one JSON string and one `Blob`; therefore an export containing very large local inputs temporarily requires memory close to the serialized file size. Compact serialization avoids the substantial overhead of indentation. No input, token, API key, account information, browser fingerprint, or cache namespace is sent to a server during export.

The existing **Export DOT** action remains a convenient topology-only interchange format inside the tree viewer. Use **Download JSON** when the data, matrices, provenance, and search metadata must travel with the tree.

## Verification

Focused tests cover complete reconstruction from cache hits and worker results, exact input hashing, computed and imported matrix exports, topology and balanced-split metadata, result integrity, filename stability, and fail-fast rejection of an inconsistent reflected-minimum matrix:

```bash
npm test -- src/__test__/clusteringExperimentExport.test.ts src/__test__/workbench.test.tsx
npm run export-schema:verify
npm run build
```
