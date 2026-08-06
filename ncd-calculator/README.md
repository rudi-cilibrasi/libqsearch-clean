# CompLearn NCD Calculator

Browser-based normalized compression distance analysis for GenBank sequences, Universal Declaration of Human Rights translations, and local files. Compression, matrix construction, and layout optimization run in web workers so the interface remains responsive.

## Start the interface

```bash
cd ncd-calculator
npm install
npm run dev
```

Open `http://localhost:3000`. The built-in example set and local-file workflow do not require the Node backend. GenBank search and authentication use the backend API configured in `src/configs/api.tsx`.

## Workbench workflow

The calculator opens directly at its input controls. Choose GenBank, UDHR, or local files as the object source, or select **Try example data** beside the source tabs for an immediate self-contained run.

1. Add at least four objects, or use the example data.
2. Select **Show Similarity**. The page reports compression progress and exposes quartet-tree, K-grid, and distance-matrix result views.

The example data contains two intentionally related sequence pairs. It exercises the same compression pipeline as uploaded content and is suitable for interface and worker verification; it is not a scientific benchmark dataset.

The quartet-tree result opens in a planar 2D presentation so topology and labels can be read without manipulating a camera. The view automatically fits after layout and when the viewport changes, and provides explicit zoom, fit, and reset controls. **Interactive 3D** remains available for spatial exploration; its camera also fits the complete tree on entry and resize, while node selection reports whether the selected point is a leaf or an internal node.

## Verification

```bash
npm run build
npm run lint
npm run test
npm run typecheck
```

Production builds also verify that the Graphviz renderer was bundled into relative assets. The build fails if an unresolved `@hpcc-js/wasm` module specifier would reach the browser.

Focused interface coverage is in `src/__test__/landingPage.test.tsx` and `src/__test__/workbench.test.tsx`.

### Reproducible UDHR inputs

UDHR comparisons use a versioned UTF-8 snapshot generated from the Unicode UDHR Project at a pinned commit. Each of the 59 records is marked complete in the source index and linked there to an OHCHR translation. The comparison corpus contains the body of Articles 1–30 only: preambles, source notes, and localized headings are excluded so every language has identical section coverage. Paragraphs within an article are joined with one space, and the 30 article boundaries are represented by line feeds.

The browser loads only the selected same-origin text assets. It decodes UTF-8 in fatal mode and verifies the byte count, Unicode code-point count, article count, NFC normalization, and SHA-256 digest before compression. A failed check stops the calculation. Assets use the browser HTTP cache plus request deduplication instead of application-managed local storage.

```bash
npm run udhr:verify
npm run udhr:refresh
```

`udhr:verify` is offline and runs automatically before every production build. `udhr:refresh` regenerates the corpus from the immutable source commit configured in `scripts/udhr-corpus-config.mjs`; review the generated manifest, text changes, and source commit before accepting an update. The complete design and scientific scope are documented in [`docs/UDHR_CORPUS.md`](docs/UDHR_CORPUS.md).

Compressor-based NCD converges toward its theoretical properties as compressed inputs grow. For very short or extremely periodic inputs, gzip headers, framing, and pair separators can dominate the compressed size and produce a nonzero empirical NCD even for repeated content. Formula tests therefore use synthetic compressed sizes, while compressor integration tests use the realistic mitochondrial fixture. The matrix diagonal remains exactly zero by definition in the worker pipeline.

## Visual system

The landing page and workbench share a restrained scientific/editorial system: warm paper, dark green structural surfaces, oxide annotations, serif headings, monospace metadata, square controls, and thin rules. Decorative gradients, glow effects, generic cards, and promotional copy are intentionally avoided. The design keeps the NCD equation, comparison set, computation state, and result matrix visually primary.

Updated 2026-08-06 (Asia/Ho_Chi_Minh).
