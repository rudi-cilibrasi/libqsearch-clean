# CODEBASE.md — NCD Calculator Architecture

## Overview

This is a **Normalized Compression Distance (NCD)** calculator — a TypeScript/React web application that measures similarity between files, sequences, or text using compression-based distance metrics. It computes an NCD matrix and visualizes the results as quartet trees (QSearch) and grid layouts.

## Key Concepts

### NCD (Normalized Compression Distance)
A similarity metric based on Kolmogorov complexity. For two strings x and y:

```
NCD(x, y) = (C(xy) - min(C(x), C(y))) / max(C(x), C(y))
```

Where `C(x)` is the compressed size of x. Values range from 0 (identical) to ~1 (completely different).

### QSearch Quartet Trees
An algorithm that builds phylogenetic-like trees from a distance matrix. It works by finding optimal quartet topologies and merging them into a full tree. The QSearch algorithm runs in a WebAssembly module compiled from C++.

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
│   │   ├── tree/                   # 3D tree visualization (Three.js/R3F)
│   │   │   ├── QSearchTree.tsx     # Main 3D tree component
│   │   │   ├── NodeObject.tsx      # 3D node rendering
│   │   │   ├── SpringObject.tsx    # Edge rendering
│   │   │   ├── physics.ts          # Force-directed layout
│   │   │   ├── treeLayout.ts       # Tree layout algorithms
│   │   │   └── ...
│   │   ├── demo/                   # Demo/showcase components
│   │   └── ui/                     # Reusable UI primitives
│   ├── workers/
│   │   ├── shared/
│   │   │   └── utils.ts            # NCD math, CRC32, pair processing
│   │   ├── lzmaWorker.ts           # LZMA compression web worker
│   │   ├── zstdWorker.ts           # ZSTD compression web worker
│   │   ├── qsearchWorker.ts        # QSearch tree algorithm worker
│   │   └── kgridWorker.ts          # Grid optimization worker
│   ├── services/
│   │   ├── CompressionService.ts   # Compression worker orchestration (singleton)
│   │   ├── CompressorCapabilities.ts
│   │   ├── ZSTDCompressor.ts       # ZSTD wrapper
│   │   ├── GenBankSearchService.ts # NCBI GenBank API client
│   │   └── genbank.ts              # GenBank utilities
│   ├── wasm/
│   │   └── qsearch.ts             # QSearch WASM module (Emscripten-compiled C++)
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
│   │   ├── CRCCache.ts            # CRC-based compression cache
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
    └── qsearch.wasm               # Compiled QSearch WASM binary
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
│  zstdWorker.ts      │    1. Compress x, compress y, compress x+y
│                     │    2. Calculate NCD(x,y)
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
│Worker  │  │  Worker       │
│(WASM)  │  │(sim.anneal.) │
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
- **CRC-based Caching** — Compression results are cached by CRC32 hash of content, avoiding redundant compression.
- **WASM for QSearch** — The quartet tree algorithm is compiled from C++ to WebAssembly via Emscripten, called through `wasm/qsearch.ts`.
