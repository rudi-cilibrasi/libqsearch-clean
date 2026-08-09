# CompLearn NCD Calculator

Browser-based normalized compression distance analysis for GenBank sequences, Universal Declaration of Human Rights translations, astronomical time series, P300 EEG derivatives, and local files. Compression, matrix construction, and layout optimization run in web workers so the interface remains responsive.

GenBank/NCBI Nucleotide retrieval is fail-fast and version-pinned: the requested accession version, ESummary metadata, and FASTA content must agree before a record can enter a comparison. Search supports complete mitochondrial genome, COI/COX1, and cytochrome b scopes with metadata, NCBI links, cancellation, and pagination. A structural preflight blocks mixed or partial sequence sets. Cached records carry separate sequence and provenance SHA-256 digests and are revalidated before reuse. See [`docs/GENBANK_SEQUENCE_PIPELINE.md`](docs/GENBANK_SEQUENCE_PIPELINE.md) and [`docs/GENBANK_ANIMAL_EXPERIMENTS.md`](docs/GENBANK_ANIMAL_EXPERIMENTS.md).

## Start the interface

```bash
cd ncd-calculator
npm install
npm run dev
```

Open `http://localhost:3000`. The built-in example set and local-file workflow do not require the Node backend. GenBank search and authentication use the backend API configured in `src/configs/api.tsx`.

If Vite reports `504 Outdated Optimize Dep` after dependencies or the Vite configuration change, stop the existing development server and run `npm run dev:clean`, then reload the browser tab. This performs a clean dependency optimization pass without deleting application data.

## Workbench workflow

The calculator opens directly at its input controls. Choose GenBank, UDHR, local files, or P300 EEG as the object source. **Animal example** resolves a version-pinned four-record mitochondrial set from NCBI, **Sequence example** provides a small local interface check, and **Astronomy example** loads a verified 16-object RXTE time-series corpus inspired by the astronomy experiment in *Clustering by Compression*. The P300 source provides a small, verified `ds003061` derivative in condition and electrode modes.

1. Add at least four objects, or use the example data.
2. Choose **Auto-select** or an explicit compressor model.
3. Select **Show Similarity**. The page reports compression progress and opens the quartet tree first, with optional cluster-report, K-grid, and distance-matrix views. EEG experiments add waveform QC, source provenance, a label-reveal evaluation, conventional baselines, and an electrode scalp map.

The compressor portfolio includes LZMA, Zstandard, gzip/DEFLATE, and Brotli. Explicit selection is carried into the calculation and exported provenance; it is no longer limited to the local-file browser. Each algorithm has a fail-fast ordered-pair limit derived from its effective history window. Auto-selection remains LZMA for pairs up to 2 MiB and Zstandard for larger pairs. The settings, scientific rationale, impact ratings, rejected candidates, and sensitivity-analysis workflow are documented in [`docs/COMPRESSOR_PORTFOLIO.md`](docs/COMPRESSOR_PORTFOLIO.md).

The sequence example contains two intentionally related pairs. It exercises the same compression pipeline as uploaded content and is suitable for interface and worker verification; it is not a scientific benchmark dataset. The astronomy example is a reproducible public analogue of the paper's private GRS 1915+105 intervals. Its exact source, objective interval-selection rule, canonical signal encoding, integrity checks, and scientific limits are documented in [`docs/ASTRONOMY_EXAMPLE.md`](docs/ASTRONOMY_EXAMPLE.md).

The EEG example is a public analogue derived offline with MNE-Python from subject 001, run 1 of OpenNeuro `ds003061` v1.1.2. A deterministic fixed-width ASCII serializer keeps only quantized signal values and constant segment boundaries in the compressed bytes; condition labels and all provenance stay outside that stream. Raw BIDS recordings are not parsed in the browser. Researchers can run the same fail-fast builder locally and import its bounded self-contained derivative package. The complete object contract, build procedure, evaluation design, and scientific limits are documented in [`docs/EEG_ANALYSIS.md`](docs/EEG_ANALYSIS.md).

The quartet-tree result opens in a planar 2D presentation so topology and labels can be read without manipulating a camera. The view automatically fits after layout and when the viewport changes, and provides explicit zoom, fit, and reset controls. **Interactive 3D** remains available for spatial exploration; its camera also fits the complete tree on entry and resize, while node selection reports whether the selected point is a leaf or an internal node.

After QSearch finishes, **Download JSON** exports the complete current experiment: exact UTF-8 inputs and source provenance, content hashes, all single and ordered-pair compressed sizes, directed and reflected-minimum matrices, the selected unrooted tree, edge stability, search seeds and score summary, timing, and integrity metadata. Imported matrices are marked explicitly and do not claim unavailable raw objects or compressor records. The versioned format and privacy implications are documented in [`docs/CLUSTERING_EXPERIMENT_EXPORT.md`](docs/CLUSTERING_EXPERIMENT_EXPORT.md), with its JSON Schema in [`public/schemas/clustering-experiment-v1.schema.json`](public/schemas/clustering-experiment-v1.schema.json).

Pair compression is explicitly order-dependent. The worker first constructs the complete directed matrix with separate `C(x || y)` and `C(y || x)` cells, then derives the symmetric QSearch/K-grid input by taking the minimum of each pair of reflected matrix cells. Both matrices are retained in the typed result. Directed compression results are stored in a SHA-256 content-addressed, versioned cache; incompatible legacy caches are removed automatically. QSearch uses a deterministic multi-start seed schedule and records selected-topology frequency and per-edge split stability for reproducibility. These diagnostics are kept out of the primary interface and retained in the typed result, explicit DOT exports, and technical documentation. The complete numerical contract is in [`docs/NCD_QSEARCH_REPRODUCIBILITY.md`](docs/NCD_QSEARCH_REPRODUCIBILITY.md).

## Verification

```bash
npm run build
npm run graphviz:verify-dev
npm run astronomy:verify
npm run eeg:verify
npm run workers:verify-dev
npm run export-schema:verify
npm run lint
npm run test
npm run typecheck
cd .. && make wasm-calculator
```

The planar renderer remains a lazy Graphviz/WASM chunk so it does not delay the landing page. In development, Graphviz is served directly rather than through Vite's disposable hashed dependency cache; `graphviz:verify-dev` checks that resolution and runs automatically during a build. Production builds separately verify that Graphviz was bundled into relative assets and fail if an unresolved `@hpcc-js/wasm` module specifier would reach the browser.

After changing dependencies or switching branches while the development server is running, restart Vite so its module graph matches the installed packages:

```bash
npm run dev -- --force
```

The planar-tree interface reports initialization failures and offers **Retry renderer**. The shared loader deduplicates concurrent initialization and clears failed attempts before retrying. Compression workers use Vite's native `new Worker(new URL(...))` transform rather than dynamically importing `?worker` wrapper modules; `workers:verify-dev` transforms and serves all four entries in middleware mode so development-only worker regressions fail before a build. The selected compressor starts lazily when a calculation begins—there is no competing prewarm—and has a 30-second cold-start window. Native worker load and message-decoding failures are reported immediately and failed workers are terminated.

Focused interface and export coverage is in `src/__test__/landingPage.test.tsx`, `src/__test__/workbench.test.tsx`, and `src/__test__/clusteringExperimentExport.test.ts`.

### Reproducible UDHR inputs

UDHR comparisons use a versioned UTF-8 snapshot generated from the Unicode UDHR Project at a pinned commit. Corpus v2 stores all 501 available stage-4 records locally, representing 431 ISO 639-3 language groups. Of those records, 465 link to an OHCHR translation and 36 retain a separate `unicode-complete` provenance tier. The audit accepts 496 records across 426 language codes for aligned comparison; five upstream XML records are preserved but blocked because they do not contain Articles 1–30 in full.

The interface presents the complete catalog as 431 concise language groups. A group with one record can be added directly; a group with multiple scripts, editions, regions, orthographies, or other source variants requires an explicit record choice. Stable `udhr:<source-key>` identifiers remain separate from presentation labels. Variant labels are globally unique, so selecting two records from one language keeps them distinguishable in the comparison set, distance matrix, K-grid, and quartet tree. Search covers group and source names, identifiers, BCP 47 tags, and human-readable script names with accent-insensitive multi-token matching. See [`docs/UDHR_LANGUAGE_BROWSER.md`](docs/UDHR_LANGUAGE_BROWSER.md) for the grouping and label contract.

The browser loads only selected same-origin, digest-addressed text assets, with at most six requests in flight. It decodes UTF-8 in fatal mode and verifies the byte count, Unicode code-point count, article count, NFC normalization, and SHA-256 digest before compression. A failed check stops the calculation. Assets use an in-memory promise cache and the browser HTTP cache instead of application-managed local storage.

```bash
npm run udhr:verify
npm run udhr:audit
npm run udhr:refresh
```

`udhr:verify` is offline and runs automatically before every production build. `udhr:audit` validates the complete pinned source without publishing files. `udhr:refresh` stages and regenerates the corpus from the immutable source commit configured in `scripts/udhr-corpus-config.mjs`; review the generated manifest, audit report, text changes, and source commit before accepting an update. The scientific scope is documented in [`docs/UDHR_CORPUS.md`](docs/UDHR_CORPUS.md), with the v2 implementation contract in [`docs/UDHR_CORPUS_V2_PIPELINE.md`](docs/UDHR_CORPUS_V2_PIPELINE.md) and grouped-browser contract in [`docs/UDHR_LANGUAGE_BROWSER.md`](docs/UDHR_LANGUAGE_BROWSER.md).

Compressor-based NCD converges toward its theoretical properties as compressed inputs grow. For very short or extremely periodic inputs, gzip headers, framing, and pair separators can dominate the compressed size and produce a nonzero empirical NCD even for repeated content. Formula tests therefore use synthetic compressed sizes, while compressor integration tests use the realistic mitochondrial fixture. The matrix diagonal remains exactly zero by definition in the worker pipeline.

## Visual system

The landing page and workbench share a restrained scientific/editorial system: warm paper, dark green structural surfaces, oxide annotations, serif headings, monospace metadata, square controls, and thin rules. Decorative gradients, glow effects, generic cards, and promotional copy are intentionally avoided. The design keeps the NCD equation, comparison set, computation state, and result matrix visually primary.

The production interface is for end users. Internal identifiers, seeds, protocol versions, worker throughput, iteration counts, objective values, cache state, and raw optimizer diagnostics belong in exports, logs, tests, or technical documents rather than the GUI. See [`docs/END_USER_UI_POLICY.md`](docs/END_USER_UI_POLICY.md).

## Accessibility

CompLearn targets WCAG 2.2 Level AA through staged, separately reviewed changes. The current accessibility foundation provides a keyboard-visible bypass link, route-specific titles and focus handoff, a focus-contained sign-in dialog with an inert background and focus restoration, and an automated axe-core A/AA regression check. Automated checks do not establish conformance; keyboard, zoom, forced-colors, screen-reader, visualization, and long-running-workflow reviews remain part of the delivery plan.

The prioritized feature list, 1–10 impact ratings, audit evidence, PR boundaries, and verification policy are maintained in [`docs/ACCESSIBILITY_ROADMAP.md`](docs/ACCESSIBILITY_ROADMAP.md). Each roadmap item is intended to ship in its own PR, with an explicit approval signal before the next item begins.

Updated 2026-08-10 (Asia/Ho_Chi_Minh).
