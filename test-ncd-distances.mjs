#!/usr/bin/env node
/**
 * Test NCD distances for Issue #25 diagnosis.
 * Uses zlib (Node.js built-in) to replicate compression behavior.
 * Also tests with the same LZMA library used by the workers.
 */

import zlib from 'node:zlib';
import { promisify } from 'node:util';

const deflate = promisify(zlib.deflate);

// --- Test data ---
// 3 similar sequences (mitochondrial-like, small mutations)
const BASE = 'ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG'.repeat(10);
const similar = [
  { label: 'species_A', seq: BASE },
  { label: 'species_B', seq: BASE.replace(/^ATCG/, 'TTCG').replace(/GATC$/, 'GTTC') }, // 4 bp diff
  { label: 'species_C', seq: BASE.slice(0, -4) + 'NNNN' }, // last 4 changed
];

// 3 very different sequences
const different = [
  { label: 'random_1', seq: Array.from({length: BASE.length}, () => 'ACGT'[Math.floor(Math.random()*4)]).join('') },
  { label: 'polyA',    seq: 'A'.repeat(BASE.length) },
  { label: 'text',     seq: 'The quick brown fox jumps over the lazy dog. '.repeat(Math.ceil(BASE.length/46)).slice(0, BASE.length) },
];

const all = [...similar, ...different];

// --- NCD computation ---
function calculateNCD(sizeX, sizeY, sizeXY) {
  const numerator = sizeXY - Math.min(sizeX, sizeY);
  const denominator = Math.max(sizeX, sizeY);
  return Math.min(Math.max(numerator / denominator, 0), 1);
}

async function compressedSize(str) {
  const buf = Buffer.from(str, 'utf-8');
  const compressed = await deflate(buf, { level: 9 });
  return compressed.length;
}

async function compressedSizePair(str1, str2) {
  const combined = str1 + '\n###\n' + str2;
  return compressedSize(combined);
}

// --- Main ---
async function main() {
  const n = all.length;
  
  console.log('=== NCD Distance Test ===\n');
  console.log('Sequences:');
  for (const item of all) {
    console.log(`  ${item.label}: ${item.seq.length} chars, preview: ${item.seq.slice(0,40)}...`);
  }
  console.log();

  // Compute single compressed sizes
  const sizes = [];
  for (const item of all) {
    sizes.push(await compressedSize(item.seq));
  }
  console.log('Compressed sizes:', all.map((item, i) => `${item.label}=${sizes[i]}`).join(', '));
  console.log();

  // Compute NCD matrix
  const matrix = Array.from({length: n}, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const pairSize = await compressedSizePair(all[i].seq, all[j].seq);
      const ncd = calculateNCD(sizes[i], sizes[j], pairSize);
      matrix[i][j] = ncd;
      matrix[j][i] = ncd;
    }
  }

  // Print matrix
  const pad = (s, w=12) => s.toString().slice(0, w).padEnd(w);
  console.log('NCD Matrix:');
  console.log(pad('') + all.map(item => pad(item.label)).join(''));
  for (let i = 0; i < n; i++) {
    const row = all.map((_, j) => pad(matrix[i][j].toFixed(4)));
    console.log(pad(all[i].label) + row.join(''));
  }
  console.log();

  // Verify expectations
  console.log('=== Verification ===');
  const simNcds = [];
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) {
      simNcds.push({ pair: `${all[i].label}-${all[j].label}`, ncd: matrix[i][j] });
    }
  }
  const diffNcds = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 3; j < 6; j++) {
      diffNcds.push({ pair: `${all[i].label}-${all[j].label}`, ncd: matrix[i][j] });
    }
  }

  console.log('\nSimilar pairs (should be LOW, < 0.3):');
  for (const {pair, ncd} of simNcds) {
    const ok = ncd < 0.3 ? '✅' : '❌';
    console.log(`  ${ok} ${pair}: ${ncd.toFixed(4)}`);
  }

  console.log('\nDifferent pairs (should be HIGH, > 0.5):');
  for (const {pair, ncd} of diffNcds) {
    const ok = ncd > 0.5 ? '✅' : '❌';
    console.log(`  ${ok} ${pair}: ${ncd.toFixed(4)}`);
  }

  // --- Test edge case: what if content is empty string? ---
  console.log('\n=== Edge Case: Empty/Short Content ===');
  const emptySize = await compressedSize('');
  const shortSize = await compressedSize('ATCG');
  const realSize = await compressedSize(BASE);
  console.log(`Empty string compressed size: ${emptySize}`);
  console.log(`"ATCG" compressed size: ${shortSize}`);
  console.log(`640-char sequence compressed size: ${realSize}`);
  
  const emptyPair = await compressedSizePair('', '');
  const ncdEmpty = calculateNCD(emptySize, emptySize, emptyPair);
  console.log(`NCD("", ""): ${ncdEmpty.toFixed(4)}`);
  
  const mixPair = await compressedSizePair('', BASE);
  const ncdMix = calculateNCD(emptySize, realSize, mixPair);
  console.log(`NCD("", real_seq): ${ncdMix.toFixed(4)}`);

  // --- Test: what if FASTA header is included? ---
  console.log('\n=== Bug Hypothesis: FASTA headers included ===');
  const header1 = '>NC_001234.1 Marmota marmota mitochondrion, complete genome';
  const header2 = '>NC_005678.1 Marmota monax mitochondrion, complete genome';
  const seqOnly1 = BASE;
  const seqOnly2 = BASE.replace(/^ATCG/, 'TTCG');
  const withHeader1 = header1 + '\n' + seqOnly1;
  const withHeader2 = header2 + '\n' + seqOnly2;
  
  const sizeSeq1 = await compressedSize(seqOnly1);
  const sizeSeq2 = await compressedSize(seqOnly2);
  const sizeHdr1 = await compressedSize(withHeader1);
  const sizeHdr2 = await compressedSize(withHeader2);
  
  const pairSeqOnly = await compressedSizePair(seqOnly1, seqOnly2);
  const pairWithHdr = await compressedSizePair(withHeader1, withHeader2);
  
  const ncdSeqOnly = calculateNCD(sizeSeq1, sizeSeq2, pairSeqOnly);
  const ncdWithHdr = calculateNCD(sizeHdr1, sizeHdr2, pairWithHdr);
  
  console.log(`NCD (sequence only): ${ncdSeqOnly.toFixed(4)}`);
  console.log(`NCD (with headers):  ${ncdWithHdr.toFixed(4)}`);
  console.log(`Headers inflate NCD: ${ncdWithHdr > ncdSeqOnly ? 'YES ⚠️' : 'NO'}`);

  // --- Test: what if content is just the accession ID? ---
  console.log('\n=== Bug Hypothesis: Only accession/label passed instead of sequence ===');
  const acc1 = 'NC_001234';
  const acc2 = 'NC_005678';
  const sizeAcc1 = await compressedSize(acc1);
  const sizeAcc2 = await compressedSize(acc2);
  const pairAcc = await compressedSizePair(acc1, acc2);
  const ncdAcc = calculateNCD(sizeAcc1, sizeAcc2, pairAcc);
  console.log(`NCD of accession IDs: ${ncdAcc.toFixed(4)} (should be ~1 if this is what's happening)`);
  
  // --- Test: empty string fallback ---
  console.log('\n=== Bug Hypothesis: content is "" (empty fallback) ===');
  // In the code: contents.push(item.content || "")
  // If content was never fetched, it stays ""
  const emptyContents = ['', '', '', ''];
  const emptySizes = [];
  for (const c of emptyContents) {
    emptySizes.push(await compressedSize(c));
  }
  console.log(`All empty compressed sizes: ${emptySizes}`);
  for (let i = 0; i < 3; i++) {
    const ps = await compressedSizePair(emptyContents[i], emptyContents[i+1]);
    const ncd = calculateNCD(emptySizes[i], emptySizes[i+1], ps);
    console.log(`NCD("", ""): ${ncd.toFixed(4)}`);
  }
}

main().catch(console.error);
