# Reproducible NCD and QSearch pipeline

Updated 2026-08-09 (Asia/Ho_Chi_Minh).

This document defines the numerical and provenance contract used by the browser workbench. It is intended to make a result repeatable and to prevent cache or search behavior from being mistaken for scientific evidence.

## Directed empirical NCD and matrix reduction

For objects `x` and `y`, separator `s = "\n###\n"`, and compressor `C`, compression is defined for an ordered pair:

```text
C(x, y) = C(x || s || y)
D(x, y) = (C(x, y) - min(C(x), C(y))) / max(C(x), C(y))
```

The pipeline first constructs the complete directed matrix `D`. No equality between `C(x, y)` and `C(y, x)` is assumed or imposed: the two ordered compressed lengths and the two directed NCD cells are computed and cached independently. The diagonal is defined as zero and is not estimated by compressing an object twice. Slight empirical values above one are retained because compressor overhead and finite input length can violate the ideal bounds. Negative values are floored at zero.

QSearch and the current K-grid require a symmetric distance matrix. Their input is derived only after the directed matrix is complete, by applying one reflected-cell operation:

```text
R[i, j] = min(D[i, j], D[j, i])
R[i, i] = 0
```

Thus directionality belongs to compression and the full matrix, while the minimum belongs to an explicit matrix reduction. The worker result preserves both `directedNcdMatrix = D` and the reduced `ncdMatrix = R` so downstream code cannot confuse the two stages.

This policy fixes the former pair-order cache defect. A sorted cache key previously allowed one direction to occupy both reflected positions. Version 3 instead stores ordered cells under distinct keys and performs no reduction inside the cache or pair-compression operation.

## Compressor settings and window guard

The active revisions are LZMA mode 9, bundled Zstandard level 22, `pako` 3.0.1 gzip framing at DEFLATE level 9, and `brotli-wasm` 3.0.1 at quality 11 with its default `lgwin` 22. gzip and Brotli share the same typed worker pipeline as the existing compressors; only the byte-to-compressed-length function changes.

Before hashing, cache access, or worker initialization, the service measures the two largest UTF-8 objects plus the pair separator. The ordered pair must fit inside the selected compressor's effective history window. Current pair limits are 2 MiB for the application-bounded LZMA worker, 128 MiB for Zstandard, 32 KiB for DEFLATE, and 4 MiB for Brotli. An explicit selection outside its limit fails with a readable error. Auto-selection uses LZMA through 2 MiB and Zstandard above that threshold.

These compressors do not establish empirical universality. Repeating one experiment across the portfolio is a sensitivity analysis: agreement can strengthen robustness, while disagreement identifies dependence on the model, window, framing overhead, or object representation. The decision record and candidate evaluation are in [Compressor portfolio and sensitivity analysis](COMPRESSOR_PORTFOLIO.md).

## Content-addressed, versioned cache

Object identities are SHA-256 digests of the exact UTF-8 bytes sent to the compressor. A cache key contains:

```text
pipeline version / compressor revision / object-or-pair / pair policy / content digest(s)
```

Pair digests preserve source-target order. `x → y` and `y → x` therefore occupy separate entries even when their compressed sizes happen to match. Cache writes are validated, batched once per matrix calculation, and bounded to the newest 20,000 entries. This avoids one local-storage serialization per cell and limits unbounded browser growth.

`CompressionCache` removes `compression_cache`, schemas 1 and 2, and every stale `ncd-compression-cache:*` namespace during initialization. It also rejects a current-schema envelope whose pipeline version or numeric values are invalid. This migration is intentionally destructive: a previously reduced pair entry cannot be reconstructed into two directed cells.

Changing a compressor build, compression level, separator, pair policy, or formula behavior requires a new compressor revision or pipeline version. Changing the serialized envelope requires a new cache schema version.

## Reproducible multi-start QSearch

QSearch is a randomized hill-climbing heuristic. A single run can end at one of several locally optimal tree topologies. The workbench now derives a stable unsigned 32-bit base seed from the full-precision serialized matrix and expands it into a deterministic seed schedule. The native random generator is shared across C++ translation units and is reset before every search.

Runs are performed sequentially inside one worker. Sequential execution is required because the native generator is process-global, and it bounds WebAssembly memory as the number of objects grows. The default schedule is 16 runs for at most 16 objects, 10 for at most 64, 6 for at most 128, and 4 beyond 128. The selected result is the highest-scoring run. Exact score ties prefer the topology seen most often, then a canonical split key and the smaller seed, so selection remains deterministic.

Matrix rows use collision-free positional leaf identifiers. Original Unicode labels are restored by leaf index after native execution. The serializer preserves the shortest decimal representation that round-trips to the same IEEE-754 value; the former six-decimal rounding has been removed.

The workbench also keeps computational identifiers separate from presentation labels. Stable identifiers such as `eng`, `fra`, and `deu` are used for content lookup, matrix ordering, caching, and QSearch. A same-length display-label vector carries `English`, `French`, and `German, Standard (1901)` into the selected-object list, distance matrix, K-grid, tree, and exported topology. The boundary rejects missing, blank, or positionally mismatched names instead of guessing. Older saved UDHR selections and imported matrices whose identifiers match the corpus manifest are upgraded to the canonical corpus names at load time.

The checked-in `qsearch.js` is generated with the pinned `emscripten/emsdk:3.1.74` image:

```bash
make wasm-calculator
```

CI rebuilds the module and fails if it differs from the checked-in artifact. With the same matrix, seed schedule, native source, and WASM artifact, the chosen result is reproducible. A compiler or algorithm revision should be treated as a new computational protocol and recorded with exported results.

## Topology and edge support

Each unrooted tree is represented by its non-trivial leaf splits. Node numbering, drawing orientation, and internal-node labels do not affect the canonical topology key. For each split on the selected tree, the computation records:

```text
split stability = runs containing the split / total seeded runs
```

It also records the selected topology frequency, number of distinct topologies, selected score, and selected seed. These values measure optimization stability under different random starts. They are not bootstrap support, confidence intervals, posterior probabilities, or evidence that a linguistic or biological grouping is true. Statistical support would require a justified resampling design over exchangeable input units, which this pipeline does not currently perform.

The result also identifies the internal edge with the most even number of leaves on its two sides. This "most balanced split" is a deterministic display summary. Search stability and canonical node-index ordering break ties. It does not change the NCD matrix, select a different QSearch topology, infer an evolutionary root, or assert that either side is a known scientific class. Leaf indices rather than display labels define the split, so repeated human-readable names cannot make distinct inputs collide.

These diagnostics remain in the typed QSearch result and are included as comments and edge metadata when the user explicitly exports DOT. They are intentionally absent from the live tree: seed values, optimizer scores, protocol identifiers, edge-level percentages, and heuristic split summaries are reproducibility metadata rather than primary tree labels. The explainable cluster report may state how often the selected complete topology recurred across the bounded deterministic schedule, together with the run count and an explicit warning that this is optimization repeatability rather than scientific confidence. The live tree itself presents the inferred unrooted topology and object names only.

## Fail-fast boundaries

The pipeline stops when content hashing is unavailable, a compressed size is non-finite or non-positive, the directed matrix is malformed, the reflected-minimum matrix is malformed or asymmetric, a native run has a non-finite score, or a returned graph is disconnected, cyclic, or has non-reciprocal edges. It does not draw a synthetic fallback tree. A visible error is preferable to a plausible but fabricated result.

Regression coverage includes pair-order reduction, cache migration and reload, empirical values above one, stable-ID/display-name separation, canonical unrooted splits, deterministic seed schedules, topology support aggregation, native seed repeatability, and a complete browser-worker/WASM repeatability test.

## Scientific references

Using the minimum of reflected ordered comparisons as a conservative matrix reduction is discussed in the context of compression clustering by Cilibrasi and Vitányi, *Clustering by Compression*: <https://homepages.cwi.nl/~paulv/papers/cluster.pdf>.

QSearch is described as a randomized hill-climbing method in Cilibrasi and Vitányi, *A fast quartet tree heuristic for hierarchical clustering*: <https://arxiv.org/abs/cs/0606048>.
