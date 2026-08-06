# CODEBASE.md — NCD Calculator Architecture

## Overview

This is a **Normalized Compression Distance (NCD)** calculator — a TypeScript/React web application that measures similarity between files, sequences, or text using compression-based distance metrics. It computes an NCD matrix and visualizes the results as quartet trees (QSearch) and grid layouts.

## Key Concepts

### NCD (Normalized Compression Distance)
A similarity metric based on Kolmogorov complexity. For two strings x and y:

```
NCD(x, y) = (C(xy) - min(C(x), C(y))) / max(C(x), C(y))
```

Where `C(x)` is the compressed size of x. The empirical implementation uses `min(C(x || s || y), C(y || s || x))` for the pair term. Values are normally near the interval from zero to one, but finite compressor effects can produce values above one.

### QSearch Quartet Trees
An algorithm that builds phylogenetic-like trees from a distance matrix. The randomized native search runs multiple times with a deterministic seed schedule. The highest-scoring result is selected and canonical unrooted splits are counted across runs. The reported percentages are search stability, not bootstrap confidence. QSearch runs in a WebAssembly module compiled from C++.

### Compressors
Two compression algorithms are available:
- **LZMA** — High compression ratio, good for files ≤ 2MB (source code, text)
- **ZSTD** — Fast compression for files up to 128MB

### KGrid Visualization
A 2D grid layout that arranges items so that similar items are adjacent. Uses simulated annealing optimization with a toroidal (wraparound) grid topology.

## Directory Structure

```
ncd-calculator/
├── src/
│   ├── main.tsx                    # App entry point
│   ├── App.tsx                     # Router setup
│   ├── components/
│   │   ├── QSearch.tsx             # Main NCD calculator page (orchestrates everything)
│   │   ├── ListEditor.tsx          # Input management (FASTA, files, languages)
│   │   ├── InputHolder.tsx         # Selected items display
│   │   ├── MatrixTable.tsx         # NCD matrix display
│   │   ├── KGridVisualization.tsx  # 2D grid similarity visualization
│   │   ├── KGridDualOptimization.tsx # Dual-run grid optimization
│   │   ├── GridDisplay.tsx         # Grid cell rendering
│   │   ├── DotGraphVisualizer.tsx  # Graphviz DOT tree rendering
│   │   ├── FastaSearch.tsx         # GenBank FASTA sequence search
│   │   ├── FileUpload.tsx          # File drag-and-drop upload
│   │   ├── Language.tsx            # UDHR language selection
│   │   ├── LandingPage.tsx         # Home/marketing page
│   │   ├── LandingPage.css         # Scientific/editorial visual system shared by landing and header
│   │   ├── AboutPage.tsx           # Project, contributor, and research context
│   │   ├── AboutPage.css           # About-page extension of the shared visual system
│   │   ├── HeroSection.tsx         # NCD equation and example distance matrix
│   │   ├── FeaturesSection.tsx     # Domain-specific analysis entry points
│   │   ├── HowItWorksSection.tsx   # Compression-to-structure method pipeline
│   │   ├── ResearchSection.tsx     # Research basis and primary citation
│   │   ├── tree/                   # 3D tree visualization (Three.js/R3F)
│   │   │   ├── QSearchTree.tsx     # Main 3D tree component
│   │   │   ├── NodeObject.tsx      # 3D node rendering
│   │   │   ├── SpringObject.tsx    # Edge rendering
│   │   │   ├── physics.ts          # Force-directed layout
│   │   │   ├── treeLayout.ts       # Tree layout algorithms
│   │   │   └── ...
│   │   └── ui/                     # Reusable UI primitives
│   ├── workers/
│   │   ├── shared/
│   │   │   └── utils.ts            # NCD math and bidirectional pair processing
│   │   ├── lzmaWorker.ts           # LZMA compression web worker
│   │   ├── zstdWorker.ts           # ZSTD compression web worker
│   │   ├── qsearchWorker.ts        # QSearch tree algorithm worker
│   │   └── kgridWorker.ts          # Grid optimization worker
│   ├── services/
│   │   ├── CompressionService.ts   # Compression worker orchestration (singleton)
│   │   ├── CompressionProtocol.ts  # Versioned compressor and pair policy
│   │   ├── QSearchProtocol.ts      # Seed schedule, canonical splits, support
│   │   ├── CompressorCapabilities.ts
│   │   ├── ZSTDCompressor.ts       # ZSTD wrapper
│   │   ├── GenBankSearchService.ts # NCBI GenBank API client
│   │   └── genbank.ts              # GenBank utilities
│   ├── wasm/
│   │   ├── qsearch.js              # Checked-in QSearch WASM module
│   │   └── qsearch.d.ts            # Typed WASM boundary
│   ├── datastructures/
│   │   ├── kgrid.ts               # Grid state, NCD calculation, simulated annealing
│   │   └── unionFind.ts           # Union-Find data structure
│   ├── functions/
│   │   ├── fasta.ts               # FASTA format parsing and validation
│   │   ├── file.ts                # File reading utilities
│   │   ├── matrix.ts              # Matrix formatting for QSearch
│   │   ├── qtree.ts               # Tree data conversion
│   │   ├── graphExport.ts         # DOT/Newick export
│   │   ├── labelUtils.ts          # Label management (display names)
│   │   ├── labelSanitizer.ts      # Label sanitization
│   │   ├── udhr.ts                # Universal Declaration of Human Rights texts
│   │   ├── encoding.ts            # Text encoding utilities
│   │   └── ...
│   ├── cache/
│   │   ├── CompressionCache.ts     # Versioned SHA-256 compression cache
│   │   ├── LocalStorageCache.ts   # Browser localStorage cache
│   │   ├── MemoryCache.ts         # In-memory cache
│   │   └── ...
│   ├── types/
│   │   ├── ncd.d.ts               # NCD-related TypeScript types
│   │   ├── wasm.d.ts              # WASM module types
│   │   └── global.d.ts            # Global type declarations
│   ├── hooks/
│   │   └── useNCDCache.ts         # React hook for NCD result caching
│   ├── constants/
│   │   ├── modalConstants.tsx     # Input type constants (FASTA, FILE_UPLOAD, LANGUAGE)
│   │   └── taxonomy.tsx           # Taxonomic data
│   ├── configs/
│   │   └── api.tsx                # API configuration
│   └── libs/
│       └── lzma.ts                # LZMA library wrapper
└── public/
    ├── qsearch.wasm               # Compiled QSearch WASM binary
    └── udhr/v1/*.txt              # Versioned, integrity-checked UDHR article corpus
```

## Data Flow

```
User Input (FASTA sequences / files / UDHR translations)
       │
       ▼
┌─────────────────┐
│   ListEditor    │  Collects and validates input items
│                 │  Resolves FASTA accessions via GenBank API
└────────┬────────┘
         │ { labels[], contents[] }
         ▼
┌─────────────────────┐
│  CompressionService │  Selects algorithm (LZMA vs ZSTD) based on sizes
│    (singleton)      │  Manages compression web workers
└────────┬────────────┘
         │ Posts to worker
         ▼
┌─────────────────────┐
│  lzmaWorker.ts /    │  For each pair (i,j):
│  zstdWorker.ts      │    1. Compress x, y, x||y, and y||x
│                     │    2. Use min(C(x||y), C(y||x))
│                     │    3. Calculate NCD(x,y)
│  (uses utils.ts)    │  Reports progress back to main thread
└────────┬────────────┘
         │ NCD matrix (n×n)
         ▼
┌─────────────────────┐
│     QSearch.tsx      │  Receives matrix, dispatches to visualizations
│  (orchestrator)     │
└──┬──────────┬───────┘
   │          │
   ▼          ▼
┌────────┐  ┌──────────────┐
│QSearch │  │   KGrid      │
│Worker  │  │  Worker      │
│seeded  │  │(sim.anneal.) │
└───┬────┘  └──────┬───────┘
    │              │
    ▼              ▼
┌────────┐  ┌──────────────┐
│Quartet │  │  Grid Layout │
│ Tree   │  │  (toroidal)  │
│(3D/DOT)│  │              │
└────────┘  └──────────────┘
```

## Entry Points

- **`src/main.tsx`** — React app bootstrap, renders `<App />`
- **`src/App.tsx`** — React Router setup, routes to `LandingPage` and `QSearch`
- **`src/components/QSearch.tsx`** — Main calculator page, orchestrates the full pipeline

## Landing Page Visual System

Updated 2026-08-06 (Asia/Ho_Chi_Minh).

The landing and About pages use a restrained scientific/editorial system rather than a generic software-marketing layout. They are built from warm paper, dark green ink, an oxide annotation color, serif display typography, monospace labels, square controls, and thin rules. The pages avoid gradients, particles, glow effects, decorative badges, and repeated rounded cards. Their primary visuals use the actual NCD equation, so the method remains central throughout the public site.

The landing-page sections are intentionally small and domain-specific: applications, the compression pipeline, output interpretation, and the research basis. Navigation into the calculator uses React Router and preserves the selected analysis mode. `src/__test__/landingPage.test.tsx` verifies the scientific content, route handoff, and sign-in entry point. The shared header uses the same visual system on both the landing page and calculator route.

## NCD Workbench Interface

Updated 2026-08-06 (Asia/Ho_Chi_Minh).

The calculator route begins directly at the source controls and comparison set. `ListEditor.tsx` owns input selection and computation readiness; the source components handle GenBank, UDHR, and local-file acquisition; `InputHolder.tsx` provides a compact accessible object inventory. **Try example data** remains available beside the source selector, while the primary **Show Similarity** action closes the workflow at the bottom right. Long source corpora, including the UDHR language list, scroll within a keyboard-focusable work area instead of extending the page.

`Workbench.css` extends the landing-page visual system across input preparation, progress, and result interpretation. The production GUI follows `ncd-calculator/docs/END_USER_UI_POLICY.md`: it shows actionable controls, meaningful progress, canonical object names, and scientific results, while seeds, internal identifiers, protocol versions, worker rates, iteration counts, objective values, cache state, and optimizer diagnostics remain in exports, logs, tests, or technical documentation. `src/__test__/workbench.test.tsx` verifies the example-set invariants, minimum-set readiness message, empty state, and accessible item removal; visualization tests prevent internal QSearch diagnostics from returning to the live tree.

## UDHR Corpus Pipeline

Updated 2026-08-06 (Asia/Ho_Chi_Minh).

Language comparison no longer parses PDFs in the browser. `scripts/build-udhr-corpus.mjs` reads a pinned Unicode UDHR Project commit, verifies that every configured record is complete and OHCHR-linked, validates the XML structure, and emits one canonical UTF-8 asset per language plus `src/generated/udhr-manifest.json`. The canonical representation contains the body of Articles 1–30, one article per line. This gives every input the same section coverage and removes PDF layout, page-break, font-map, and heading-number artifacts from the compression input.

`src/functions/udhr.ts` lazy-loads selected assets and fails closed unless their UTF-8 length, Unicode code-point count, 30-article structure, NFC form, and SHA-256 digest match the manifest. Concurrent requests for one language share the same promise; successful content is held in memory while immutable assets use normal browser HTTP caching. The retired `udhr_cache` local-storage entry is deleted during storage initialization so old lossy PDF extraction results cannot be reused.

`scripts/verify-udhr-corpus.mjs` performs an offline verification and runs before production builds. Corpus generation, limitations, and update review are detailed in `ncd-calculator/docs/UDHR_CORPUS.md`.

## How to Run

```bash
cd ncd-calculator
npm install
npm run dev          # Development server (Vite)
npm run build        # Production build
npm run test         # Run tests (vitest)
npm run typecheck    # TypeScript type checking
```

### Running Tests (excluding web worker tests)

```bash
cd ncd-calculator
npx vitest --run --exclude='**/webworker*'
```

## Key Patterns

- **Web Workers** — All heavy computation (compression, QSearch, grid optimization) runs in dedicated web workers to keep the UI responsive.
- **Singleton Services** — `CompressionService` uses a singleton pattern with factory injection for testability.
- **Protocol-versioned caching** — Compression results use SHA-256 content identities and cache keys that include the pipeline, compressor revision, and pair policy. Stale schemas are removed rather than reused.
- **Seeded multi-start QSearch** — A bounded deterministic schedule explores multiple randomized starts. Canonical split counting reports optimization stability.
- **Pinned QSearch WASM** — `make wasm-calculator` builds the checked-in module with Emscripten 3.1.74. CI verifies that regeneration is clean.

The exact numerical, cache, selection, and support definitions are documented in `ncd-calculator/docs/NCD_QSEARCH_REPRODUCIBILITY.md`.
