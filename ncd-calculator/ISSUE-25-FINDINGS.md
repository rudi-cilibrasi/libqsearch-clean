# Issue #25: NCD Distances Near 1.0 — Root Cause Analysis

## Summary

The NCD formula and compression logic are **correct**. The bug is in the **data pipeline** that feeds sequences to the compression workers. Multiple issues cause sequences to arrive as empty strings (`""`), which produce NCD values near 1.0.

## Verified: NCD Algorithm Works

Using zlib deflate level 9 on realistic 16KB DNA sequences:
- 2% divergent sequences → NCD ≈ 0.19 ✅
- Unrelated sequences → NCD ≈ 0.97 ✅
- Empty string vs real sequence → NCD ≈ 0.99 ⚠️

## Root Cause #1: `parseFastaAndClean()` — All-or-Nothing Validation

**File:** `src/functions/fasta.ts`, line ~177

```typescript
const isValidFastaWithSequence = (fastaList: FastaMetadata[]): boolean => {
  for (let i = 0; i < fastaList.length; i++) {
    if (!fastaList[i].sequence || fastaList[i].sequence?.trim() === "") return false;
    // ...
  }
  return true;
};

export const parseFastaAndClean = (fastaData: string): FastaMetadata[] => {
  const fastaList = parseFasta(fastaData);
  if (!isValidFastaWithSequence(fastaList)) return []; // ALL sequences rejected!
```

If **any single** sequence in the batch is invalid (empty, malformed), the **entire batch** is discarded and returns `[]`. This means `getFastaSequences()` returns empty contents for ALL species, not just the problematic one.

## Root Cause #2: Silent Error Swallowing

**File:** `src/components/ListEditor.tsx`, `computeFastaNcdInput()`

```typescript
const computeFastaNcdInput = async (...): Promise<SelectedItem[]> => {
  // ...
  try {
    const searchResults = await fetchFastaSequenceAndProcess(fastaItems, apiKey);
    if (searchResults.length === 0) return [];
    // ...
  } catch (error) {
    console.error("Error in computeFastaNcdInput:", error);
    return []; // silently returns empty — items keep content=""
  }
};
```

When the fetch fails (network error, proxy issue, GenBank rate limiting), the error is caught and `[]` is returned. Items that never received content stay with `content: undefined`, which later becomes `""` via:

```typescript
contents: ncdSelectedItems.map((item) => item.content || "")
```

## Root Cause #3: Content Never Set for Some Items

**File:** `src/components/ListEditor.tsx`, `fetchFastaSequenceAndProcess()`

```typescript
arr.forEach((item) => {
  const fastItem = map.get(item.accession);
  if (fastItem) {
    fastItem.content = item.sequence;
  }
});
```

If the accession from the FASTA response doesn't match the item ID (e.g., due to UID fallback in `GenBankSearchService.ts`), the content is never set.

## What Gets Passed to Compression Workers

When a user selects "marmot" species:

1. Item created with `content: ""`
2. On compute, `fetchFastaSequenceAndProcess` attempts to fetch sequences by accession ID
3. If successful: content = clean nucleotide sequence (lowercased, no headers) ✅
4. If failed (any reason above): content = `""` → compressed as empty string → NCD ≈ 1.0 ❌

## FASTA Headers

Headers are **correctly stripped**. `parseFasta()` properly separates headers from sequence data, and `getCleanSequence()` lowercases the sequence.

## Recommended Fixes

1. **Fix `parseFastaAndClean`**: Validate/filter per-sequence instead of all-or-nothing
2. **Add error feedback**: Show user when sequence fetch fails instead of silently proceeding
3. **Guard against empty content**: Don't pass items with `content === ""` to compression workers
4. **Add content validation before NCD computation**: Check that all contents are non-empty sequences
