# Compressor portfolio and sensitivity analysis

Updated 2026-08-09 (Asia/Ho_Chi_Minh).

CompLearn supports four compression models: LZMA, Zstandard, gzip/DEFLATE, and Brotli. The purpose of the portfolio is to make compressor sensitivity visible and to let the same NCD protocol operate over different practical coding models. Agreement across compressors is useful robustness evidence. It is not proof that a finite empirical compressor is universal, and disagreement is a result to investigate rather than hide.

## Active implementations

| Compressor | Coding model | Pinned application settings | Maximum ordered pair | Role | Impact |
| --- | --- | --- | ---: | --- | ---: |
| LZMA | Lempel–Ziv dictionary coding with range coding | nmrugg LZMA mode 9 | 2 MiB | Existing high-ratio baseline for compact objects | 8/10 |
| Zstandard | LZ77 with entropy coding | bundled `zstd-wasm`, level 22 | 128 MiB | Existing large-window default | 9/10 |
| gzip / DEFLATE | LZ77 with Huffman coding | `pako` 3.0.1, gzip framing, level 9 | 32 KiB | Classical baseline that is easy to compare with published NCD work | 8/10 |
| Brotli | LZ77, context modeling, Huffman coding, and a static dictionary | `brotli-wasm` 3.0.1, quality 11, default `lgwin` 22 | 4 MiB | Modern text-oriented high-ratio comparison | 8/10 |

The maximum is the encoded size of `x + "\n###\n" + y`, not the size of either object alone. CompLearn rejects an explicit compressor before hashing or worker startup when the largest pair exceeds that compressor's history window. This matters most for DEFLATE, whose 32 KiB window cannot discover matches farther back in a larger pair. A result outside the effective window can look numerically valid while failing to measure the intended shared information.

Auto-selection remains conservative: it chooses LZMA for pairs up to 2 MiB and Zstandard above that threshold. gzip and Brotli are explicit sensitivity-analysis choices. Adding them to auto-selection would change existing experiments without evidence that either is a generally better model for every corpus.

## Why these two additions

gzip/DEFLATE is a strong reference point because the format is standardized, the algorithm is widely understood, and gzip has a long history in empirical NCD studies. The browser implementation uses pinned, deterministic `pako` output rather than the browser `CompressionStream` API, so compressor revisions remain under application control.

Brotli is a useful modern contrast. It combines backward references with literal context modeling and a static dictionary, and its maintained WebAssembly package provides the same implementation in supported browsers. Quality 11 prioritizes compressed length over encoding speed because NCD consumes lengths rather than transport latency.

Both additions run in dedicated workers and share one typed matrix pipeline. They use the same UTF-8 encoding, separator, content fingerprints, directed pair policy, cache schema, NCD formula, and reflected-minimum reduction as LZMA and Zstandard. Compressor-specific cache revisions prevent results from one implementation or setting from being reused by another.

## How to run a compressor sensitivity check

Use exactly the same objects, ordering, and serialization for every run. Select one compressor in **Compressor model**, run **Show Similarity**, and download the experiment JSON. Repeat for the other compressors. Compare the directed matrix first, then the reflected-minimum matrix and inferred topology. The export records the selected algorithm, exact compressor revision, all single and ordered-pair compressed sizes, and both matrices.

Do not select a compressor because it produces the desired grouping. Report the complete set of tried compressors and explain large differences using window size, framing overhead, dictionary behavior, object length, and input representation. For short objects, framing and the pair separator can dominate compressed length. For objects near a history-window boundary, use a larger-window compressor as the primary analysis.

## Candidates evaluated but not included

| Candidate | Potential impact | Decision |
| --- | ---: | --- |
| Bzip2 / Burrows–Wheeler transform | 9/10 | Scientifically attractive because it adds a more distinct coding family. The available all-browser multi-codec package is old, GPL-2.0 licensed, and has not been published in many years. Defer until a maintained, security-reviewed implementation with acceptable licensing is available. |
| PPM / context modeling | 9/10 | Closest to important historical compression-clustering experiments and highly valuable for algorithmic diversity. Current browser choices do not meet the maintenance and integration standard. A future implementation should be version-pinned, worker-safe, deterministic, and tested on realistic corpora. |
| LZ4 | 5/10 | Excellent for speed, but its lower compression ratio makes it a weaker NCD model and current browser wrappers are less mature. It is better treated as a performance-control experiment than the next scientific default. |

The next high-value addition is a maintained BWT or PPM codec. Before inclusion it must expose deterministic compressed lengths, document its block or context limit, run without a remote service, carry a compatible license, and pass the same ordered-matrix and browser-worker tests as the active portfolio.

## Verification contract

`src/__test__/compressorPortfolio.test.ts` checks capability metadata, fail-fast window limits, explicit selection and provenance, deterministic Brotli output, the shared ordered-pair pipeline, finite symmetric reductions, and meaningful nearest pairs on a four-object fixture. `npm run workers:verify-dev` verifies all four native worker entry points through Vite. The production build must emit the Brotli and Zstandard WebAssembly assets and complete without unresolved module imports.

Primary technical references:

- Cilibrasi and Vitányi, [Clustering by Compression](https://arxiv.org/abs/cs/0312044).
- Cebrián, Alfonseca, and Ortega, [Common Pitfalls Using the Normalized Compression Distance](https://intlpress.com/site/pub/files/_fulltext/journals/cis/2005/0005/0004/CIS-2005-0005-0004-a001.pdf).
- IETF, [DEFLATE Compressed Data Format Specification (RFC 1951)](https://www.rfc-editor.org/rfc/rfc1951).
- IETF, [Brotli Compressed Data Format (RFC 7932)](https://www.rfc-editor.org/rfc/rfc7932).
- [`pako` package](https://www.npmjs.com/package/pako) and [`brotli-wasm` package](https://www.npmjs.com/package/brotli-wasm).
