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

## Verification

```bash
npm run build
npm run lint
npm run test
npm run typecheck
```

Focused interface coverage is in `src/__test__/landingPage.test.tsx` and `src/__test__/workbench.test.tsx`.

UDHR translations are retrieved as PDFs through the configured backend proxy. PDF.js uses the worker bundled from the installed `pdfjs-dist` package so the parser and worker versions remain identical after dependency updates; do not replace it with a separately versioned CDN URL.

Compressor-based NCD converges toward its theoretical properties as compressed inputs grow. For very short or extremely periodic inputs, gzip headers, framing, and pair separators can dominate the compressed size and produce a nonzero empirical NCD even for repeated content. Formula tests therefore use synthetic compressed sizes, while compressor integration tests use the realistic mitochondrial fixture. The matrix diagonal remains exactly zero by definition in the worker pipeline.

## Visual system

The landing page and workbench share a restrained scientific/editorial system: warm paper, dark green structural surfaces, oxide annotations, serif headings, monospace metadata, square controls, and thin rules. Decorative gradients, glow effects, generic cards, and promotional copy are intentionally avoided. The design keeps the NCD equation, comparison set, computation state, and result matrix visually primary.

Updated 2026-08-06 (Asia/Ho_Chi_Minh).
