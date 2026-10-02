import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import os from 'node:os';

const skip = new Set([
  'node_modules',
  'dist',
  'dist-types',
  '.git',
  '.env',
  '.local',
  'output',
  'deliverables',
  '.playwright-cli',
]);

async function inventory(dir = '.') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (skip.has(entry.name) || entry.name.endsWith('.tsbuildinfo')) continue;
    const path = dir === '.' ? entry.name : `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...await inventory(path));
    else if (entry.isFile()) out.push(path);
  }
  return out.sort();
}

const allPaths = await inventory();
const hashes = [];
for (const path of allPaths) {
  const buf = await readFile(path);
  hashes.push({ path, sha256: createHash('sha256').update(buf).digest('hex') });
}

const snapshotHash = createHash('sha256').update(JSON.stringify(hashes)).digest('hex');
const revision = snapshotHash.slice(0, 16);

console.log(JSON.stringify({ revision, snapshotHash, fileCount: hashes.length }, null, 2));
