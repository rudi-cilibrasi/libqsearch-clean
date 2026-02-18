#!/usr/bin/env node
/**
 * Test NCD with realistic genomic sequence sizes (~16KB mitochondrial genomes)
 */
import zlib from 'node:zlib';
import { promisify } from 'node:util';
const deflate = promisify(zlib.deflate);

function calculateNCD(sizeX, sizeY, sizeXY) {
  return Math.min(Math.max((sizeXY - Math.min(sizeX, sizeY)) / Math.max(sizeX, sizeY), 0), 1);
}
async function cs(str) { return (await deflate(Buffer.from(str), {level:9})).length; }
async function csp(a,b) { return cs(a + '\n###\n' + b); }

// Generate a pseudo-random DNA sequence with a seed
function makeDNA(len, seed=42) {
  const bases = 'ATCG';
  let s = seed;
  const arr = [];
  for (let i = 0; i < len; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    arr.push(bases[s % 4]);
  }
  return arr.join('');
}

// Mutate a sequence at rate mutations per base
function mutate(seq, rate=0.01, seed=999) {
  const bases = 'ATCG';
  let s = seed;
  const arr = [...seq];
  for (let i = 0; i < arr.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    if ((s % 10000) / 10000 < rate) {
      arr[i] = bases[s % 4];
    }
  }
  return arr.join('');
}

async function main() {
  const LEN = 16000; // realistic mitochondrial genome
  
  const base = makeDNA(LEN, 42);
  const similar = [
    { label: 'marmot_A', seq: base },
    { label: 'marmot_B', seq: mutate(base, 0.02, 100) },  // 2% divergence
    { label: 'marmot_C', seq: mutate(base, 0.05, 200) },  // 5% divergence
  ];
  const different = [
    { label: 'fish', seq: makeDNA(LEN, 9999) },            // totally different
    { label: 'bird', seq: makeDNA(LEN, 7777) },
    { label: 'fungus', seq: makeDNA(LEN, 1111) },
  ];
  
  const all = [...similar, ...different];
  const n = all.length;
  
  console.log('=== Realistic NCD Test (16KB sequences) ===\n');
  
  const sizes = [];
  for (const item of all) {
    sizes.push(await cs(item.seq));
  }
  console.log('Compressed sizes:', all.map((it,i) => `${it.label}=${sizes[i]}`).join(', '));
  
  const pad = (s, w=12) => s.toString().slice(0,w).padEnd(w);
  const matrix = Array.from({length:n}, () => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = i+1; j < n; j++) {
      const ps = await csp(all[i].seq, all[j].seq);
      matrix[i][j] = matrix[j][i] = calculateNCD(sizes[i], sizes[j], ps);
    }
  }
  
  console.log('\nNCD Matrix:');
  console.log(pad('') + all.map(it => pad(it.label)).join(''));
  for (let i = 0; i < n; i++) {
    console.log(pad(all[i].label) + all.map((_,j) => pad(matrix[i][j].toFixed(4))).join(''));
  }
  
  console.log('\n=== Similar pairs (should be < 0.5): ===');
  for (let i = 0; i < 3; i++) for (let j = i+1; j < 3; j++) {
    const v = matrix[i][j];
    console.log(`  ${v < 0.5 ? '✅' : '❌'} ${all[i].label}-${all[j].label}: ${v.toFixed(4)}`);
  }
  console.log('\n=== Cross pairs (should be > 0.8): ===');
  for (let i = 0; i < 3; i++) for (let j = 3; j < 6; j++) {
    const v = matrix[i][j];
    console.log(`  ${v > 0.8 ? '✅' : '❌'} ${all[i].label}-${all[j].label}: ${v.toFixed(4)}`);
  }

  // Now test what happens if the LZMA compression mode is used
  // The key issue: LZMA at level 9 with dynamic dictionary sizing
  // At 16KB input, dict is at least 16KB. Similar sequences should compress well together.
  
  // Test the "empty content" scenario that could happen in the app
  console.log('\n=== Empty content scenario ===');
  const emptySize = await cs('');
  const realSize = sizes[0];
  const pairEmptyReal = await csp('', all[0].seq);
  console.log(`NCD("", seq): ${calculateNCD(emptySize, realSize, pairEmptyReal).toFixed(4)}`);
  console.log(`This means if any item has content="" it would show NCD ~1.0 against real sequences`);
}

main().catch(console.error);
