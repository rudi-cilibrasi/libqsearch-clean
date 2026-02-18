#!/usr/bin/env node
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
const deflate = promisify(zlib.deflate);

function calculateNCD(sX, sY, sXY) {
  return Math.min(Math.max((sXY - Math.min(sX, sY)) / Math.max(sX, sY), 0), 1);
}
async function cs(s) { return (await deflate(Buffer.from(s), {level:9})).length; }
async function csp(a,b) { return cs(a + '\n###\n' + b); }

function realRandomDNA(len) {
  const bases = 'ATCG';
  const bytes = crypto.randomBytes(len);
  return Array.from(bytes, b => bases[b % 4]).join('');
}

function mutate(seq, rate) {
  const bases = 'ATCG';
  return [...seq].map(c => Math.random() < rate ? bases[Math.floor(Math.random()*4)] : c).join('');
}

async function main() {
  const LEN = 16000;
  const base = realRandomDNA(LEN);
  
  const all = [
    { label: 'sp_A', seq: base },
    { label: 'sp_B', seq: mutate(base, 0.02) },
    { label: 'sp_C', seq: mutate(base, 0.05) },
    { label: 'diff1', seq: realRandomDNA(LEN) },
    { label: 'diff2', seq: realRandomDNA(LEN) },
    { label: 'diff3', seq: realRandomDNA(LEN) },
  ];
  
  const n = all.length;
  const sizes = [];
  for (const it of all) sizes.push(await cs(it.seq));
  
  console.log('Compressed sizes:', all.map((it,i) => `${it.label}=${sizes[i]}`).join(', '));
  
  const pad = (s,w=10) => s.toString().slice(0,w).padEnd(w);
  const matrix = Array.from({length:n}, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = i+1; j < n; j++) {
    matrix[i][j] = matrix[j][i] = calculateNCD(sizes[i], sizes[j], await csp(all[i].seq, all[j].seq));
  }
  
  console.log('\n' + pad('') + all.map(it => pad(it.label)).join(''));
  for (let i = 0; i < n; i++)
    console.log(pad(all[i].label) + all.map((_,j) => pad(matrix[i][j].toFixed(4))).join(''));
  
  console.log('\nSimilar (want < 0.3):');
  for (let i=0;i<3;i++) for (let j=i+1;j<3;j++)
    console.log(`  ${matrix[i][j]<0.3?'✅':'❌'} ${all[i].label}-${all[j].label}: ${matrix[i][j].toFixed(4)}`);
  console.log('Cross (want > 0.9):');
  for (let i=0;i<3;i++) for (let j=3;j<6;j++)
    console.log(`  ${matrix[i][j]>0.9?'✅':'❌'} ${all[i].label}-${all[j].label}: ${matrix[i][j].toFixed(4)}`);
}
main().catch(console.error);
