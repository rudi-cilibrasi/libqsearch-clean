# GRS 1915+105 astronomy example

Updated 2026-08-08 (Asia/Ho_Chi_Minh).

## What the original paper did

Cilibrasi and Vitányi used photonometric X-ray observations of the Galactic microquasar GRS 1915+105 as an astronomy proof of principle in *Clustering by Compression*. The observations came from the Rossi X-ray Timing Explorer (RXTE). Expert classification used photon-count sequences and spectral hardness ratios to describe the source's variability. The NCD experiment treated short observation intervals as generic time-series objects and computed its matrix with PPMZ.

Figure 20 shows four intervals from each of four Belloni variability classes: delta, gamma, phi, and theta. The paper writes these as the Roman capitals D, G, P, and T and labels the 16 leaves `Dab1`–`Dab4`, `Gab1`–`Gab4`, `Pb1`–`Pb4`, and `Tac1`–`Tac4`. The reported tree groups the four modes and has standardized benefit `S(T) = 0.994`.

There is an internal count inconsistency in the article. The Figure 20 caption and the visible tree contain 16 intervals, while the nearby paragraph says “12 objects.” The implemented example follows the figure and caption because all 16 leaves are explicitly present.

The exact Figure 20 input files are not a public benchmark. The paper says that M. Klein Wolt and T. Maccarone supplied the data, and it does not report RXTE observation IDs, timestamps, or a byte-level preprocessing specification for the 16 intervals. Those omissions prevent an honest exact reconstruction.

## What CompLearn includes

CompLearn includes a reproducible public analogue, not a claim of reproducing Figure 20. The source is the CC BY 4.0 dataset *GRS 1915+105 Hand-Annotated RXTE Light Curves*, published on Figshare in 2016 by Daniela Huppenkothen, Lucy M. Heil, David W. Hogg, and Andreas Müller. It contains RXTE light curves whose annotations follow Belloni et al. (2000) and Klein-Wolt et al. (2002).

The workbench example has 16 objects: four Delta, four Gamma, four Phi, and four Theta intervals. The labels shown in matrices and trees are concise class names and ordinals. Stable identifiers and source filenames remain in typed provenance rather than the end-user display.

The public source and the paper experiment differ in three scientifically important ways. The source intervals are selected from a later public release rather than the private Figure 20 files. The browser uses LZMA for these small objects, whereas the paper used PPMZ. CompLearn also defines an explicit serialization that the paper did not publish. A tree from this example is therefore an independent demonstration of the same method and astronomical phenomenon. It must not be presented as a replication of the paper's numerical matrix, topology, or `S(T)` value.

## Deterministic selection

The source archive is Figshare file 6886539 from article 4220409. Its required MD5 digest is `72f3ca22510b26a8c59d839185102982`. The build fails before extraction if this digest does not match.

The selection rule is fixed in `scripts/build-astronomy-corpus.py`:

1. Restrict records to delta, gamma, phi, and theta.
2. Sort the source filenames by their numeric `grs1915_lc<N>.txt` index.
3. For each class, choose the first four files containing at least 480 consecutive samples at the documented 0.125-second cadence.
4. Within each chosen file, take its first valid continuous 480-sample window.

This produces a 60-second segment from each source file. The rule is deliberately independent of NCD values and tree topology. It was not adjusted to make the expected classes cluster more cleanly.

The selected public source indices are:

| Class | Source indices |
| --- | --- |
| Delta | 18, 19, 20, 21 |
| Gamma | 306, 307, 308, 309 |
| Phi | 6, 7, 10, 11 |
| Theta | 29, 30, 31, 32 |

## Canonical compressed object

Each time sample in the public release contains mission time and four photon-rate columns named `total`, `low`, `mid`, and `high`. The compressed object preserves all four rate columns in their released order. Every rate is multiplied by 10 and rounded half-up to an integer, then serialized as headerless ASCII CSV with LF line endings. Every object therefore contains exactly 480 rows and four integer fields per row.

Mission time is excluded. It advances at a constant cadence and primarily identifies when an observation occurred; retaining the large absolute timestamp could give the compressor identity information unrelated to signal shape. Headers, class annotations, filenames, labels, and provenance are also excluded. In particular, the expected class is never present in the bytes passed to the compressor. This prevents a trivial metadata leak from producing an apparently successful cluster.

Fixed-point decimal text was chosen instead of native floating-point bytes because it is portable across browsers, reviewable in the repository, and reproducible without depending on machine endianness or binary floating-point formatting. The quantization preserves the released single-decimal resolution evident in the light-curve rates.

## Integrity and loading pipeline

The browser uses the following fail-fast stages:

1. Fetch a small same-origin `manifest.json` under a 128 KiB limit.
2. Validate the schema version, dataset identity, public source identity, licence, exact-reproduction flag, class balance, IDs, labels, source filenames, byte bounds, and immutable asset names.
3. Load at most four records concurrently. The total corpus contract is bounded to 1 MiB, and each record is bounded to 64 KiB.
4. Check the fetched byte count and SHA-256 digest before decoding.
5. Decode UTF-8 in fatal mode, require LF-only canonical text, and require exactly 480 four-integer rows.
6. Only after all 16 records pass validation, replace the comparison set. A partial or corrupted set is never submitted to NCD.
7. Immediately before every computation, revalidate typed provenance, canonical rows, and the SHA-256 digest. This applies to records restored from local storage as well as records loaded in the current session.

Every asset name contains the first 16 hexadecimal characters of its full SHA-256 digest. The complete digest and source coordinates are recorded in the manifest and copied into the selected item's typed provenance. Production builds run the independent offline verifier before Vite bundles the application.

## Refresh and verification

To verify the committed snapshot without network access:

```bash
cd ncd-calculator
npm run astronomy:verify
```

To regenerate it from the pinned public archive:

```bash
cd ncd-calculator
npm run astronomy:refresh
npm run astronomy:verify
```

Python 3 is required only for refresh. The builder downloads the archive to a temporary directory, enforces a 200 MiB transfer bound, verifies the archive MD5, validates every selected row, and writes digest-addressed assets. It refuses to complete if stale CSV assets remain in the corpus directory. A reviewer should inspect the manifest and asset diff before accepting a refreshed snapshot.

Tests in `src/__test__/astronomyExample.test.ts` exercise the committed corpus, manifest contract, digest failure, and concurrency bound. The workbench test verifies that one action loads all 16 records. `npm run build` runs both the offline corpus verifier and the application production build.

## Interpretation

The example asks whether generic compression finds recurring structure that agrees with independently assigned variability modes. Agreement is useful evidence that the signal representation and compressor capture relevant regularity, but it is not a classification accuracy estimate. The 16 intervals are neither a random sample nor an independent held-out test set. Repeated QSearch stability measures optimization repeatability for one NCD matrix; it is not bootstrap confidence and does not quantify uncertainty in interval selection, measurement noise, preprocessing, or compressor choice.

For a publishable study, retain the directed pair-compression matrix, the symmetric matrix used by QSearch, compressor and protocol versions, selected source records, all manifest digests, and the deterministic QSearch seed schedule. Sensitivity analysis should vary window position, window length, serialization, energy-band selection, and compressor without selecting settings based only on the desired class tree.

## Primary references

- R. Cilibrasi and P. M. B. Vitányi, “Clustering by Compression,” *IEEE Transactions on Information Theory* 51(4), 2005, 1523–1545. Figure 20 and Section VIII-F.
- T. Belloni, M. Klein-Wolt, M. Méndez, M. van der Klis, and J. van Paradijs, “A model-independent analysis of the variability of GRS 1915+105,” *Astronomy & Astrophysics* 355, 2000, 271–290. arXiv:astro-ph/0001103.
- D. Huppenkothen, L. M. Heil, D. W. Hogg, and A. Müller, *GRS 1915+105 Hand-Annotated RXTE Light Curves*, Figshare article 4220409, 2016, CC BY 4.0.
