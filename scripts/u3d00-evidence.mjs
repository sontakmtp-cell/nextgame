import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import os from 'node:os';

// U3D-00 only: capture existing bytes, never regenerate source or change fixtures.
const phase = process.argv[2] ?? 'baseline';
if (!['baseline', 'final'].includes(phase)) throw new Error('Expected baseline or final');
const root = 'deliverables/implementation/UI3D/U3D-00';
if (phase === 'baseline') {
  try { await readFile(`${root}/baseline/snapshot.json`); throw new Error('Baseline already exists. Preserve it; use a separate evidence directory for a new task.'); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
}
await mkdir(`${root}/${phase}/commands`, { recursive: true });
const sha = data => createHash('sha256').update(data).digest('hex');
const skip = new Set(['.git', '.local', '.workbuddy-ai', 'node_modules', 'dist', 'dist-types', 'output', 'deliverables', 'test-results', 'playwright-report', '.playwright-cli']);
async function inventory(dir = '.') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (skip.has(entry.name) || entry.name.startsWith('.env') || entry.name.endsWith('.tsbuildinfo')) continue;
    const path = dir === '.' ? entry.name : `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...await inventory(path));
    else if (entry.isFile()) { const data = await readFile(path); out.push({ path, bytes: data.length, sha256: sha(data) }); }
  }
  return out.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
const files = await inventory();
const snapshotHash = sha(JSON.stringify(files));
const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
const snapshot = { phase, timestamp: new Date().toISOString(), snapshotHash, revision: snapshotHash.slice(0, 16), head: git(['rev-parse', 'HEAD']), branch: git(['branch', '--show-current']), originalBranch: 'home-6.1-sol', status: git(['status', '--porcelain=v1', '--untracked-files=all']), runtime: process.version, platform: process.platform, cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, ramBytes: os.totalmem(), files, exclusions: [...skip, '.env*', '*.tsbuildinfo'], note: 'Source/content inventory; secrets, user tooling, dependencies and generated evidence excluded. Uncommitted checkout, not a release.' };
await writeFile(`${root}/${phase}/snapshot.json`, JSON.stringify(snapshot, null, 2) + '\n');
if (process.argv.includes('--snapshot-only')) { console.log(JSON.stringify({ phase, revision: snapshot.revision, snapshotOnly: true })); process.exit(0); }
const commands = [
  ['types', 'node_modules/typescript/bin/tsc', '-b'],
  ['test-types', 'node_modules/typescript/bin/tsc', '-p', 'tests/tsconfig.json'],
  ['g1-types', 'node_modules/typescript/bin/tsc', '-p', 'tests/g1-browser/tsconfig.json'],
  ['g2-types', 'node_modules/typescript/bin/tsc', '-p', 'tests/g2-viewer/tsconfig.json'],
  ['boundaries', 'scripts/boundaries.mjs'],
  ['boundary-negative', 'scripts/boundary-selfcheck.mjs'],
  ['unit', 'node_modules/vitest/vitest.mjs', 'run'],
  ['sim-corpus', 'scripts/g1-corpus.mjs', '--compare', 'tests/g1/corpus.json', '--count', '10'],
  ['build', 'apps/web/node_modules/vite/bin/vite.js', 'build', 'apps/web'],
];
let failed = false;
for (const [name, ...args] of commands) {
  const startedAt = new Date().toISOString(), start = performance.now();
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const record = { command: `node ${args.join(' ')}`, startedAt, elapsedMs: performance.now() - start, exitCode: result.status, stdout: result.stdout, stderr: result.stderr, error: result.error?.message };
  await writeFile(`${root}/${phase}/commands/${name}.json`, JSON.stringify(record, null, 2) + '\n');
  console.log(`${phase}: ${name}: exit ${result.status} (${Math.round(record.elapsedMs)} ms)`);
  if (result.status !== 0) failed = true;
}
if (!failed) {
  const html = await readFile('apps/web/dist/index.html', 'utf8');
  const assets = await readdir('apps/web/dist/assets');
  const main = html.match(/src="(\/assets\/index-[^"]+\.js)"/)[1];
  const shell = ['index.html', main.slice(1), ...assets.filter(f => /^(?:index-.*\.css|rolldown-runtime-.*\.js|local\.worker-.*\.js)$/.test(f)).map(f => `assets/${f}`)];
  const shellFiles = [];
  for (const path of shell) { const data = await readFile(`apps/web/dist/${path}`); shellFiles.push({ path, bytes: data.length, gzipBytes: gzipSync(data).length, sha256: sha(data) }); }
  const art = JSON.parse(await readFile('assets/generated/manifest.json', 'utf8'));
  const fonts = JSON.parse(await readFile('apps/web/public/fonts/manifest.json', 'utf8'));
  const budget = { timestamp: new Date().toISOString(), shellFiles, shellGzipBytes: shellFiles.reduce((sum, f) => sum + f.gzipBytes, 0), legacyArtAndFontUpperBoundBytes: [...Object.values(art.files), ...Object.values(fonts)].reduce((sum, f) => sum + f.bytes, 0), note: 'Current 2D build bound. No 3D assets/decoders installed in U3D-00; not a U3D-07 3D budget pass.' };
  await writeFile(`${root}/${phase}/budget.json`, JSON.stringify(budget, null, 2) + '\n');
}
console.log(JSON.stringify({ phase, revision: snapshot.revision, failed, root }));
process.exitCode = failed ? 1 : 0;
