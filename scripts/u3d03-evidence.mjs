import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
export const evidence = 'deliverables/implementation/UI3D/U3D-03';
export const sha = value => createHash('sha256').update(value).digest('hex');
export async function save(path, value) { await mkdir(resolve(path, '..'), { recursive: true }); await writeFile(path, JSON.stringify(value, null, 2) + '\n'); }
const git = args => { const r = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }); if (r.status) throw Error(r.stderr); return r.stdout.trim(); };
const owned = p => /^(apps\/web\/src\/(App\.tsx|useSynthSession\.ts|Workshop3D\.tsx|workshop-intent\.ts|presentation\.css)|scripts\/u3d03-[^/]+|Docs\/U3D-03_REPORT\.md|tests\/workshop3d\.test\.ts)$/.test(p);
// Read-only observations made during this run. Never copy/revert these files.
// All other outside-scope changes still fail the audit.
const externallyObserved = new Set(['Docs/U3D-02_REPORT.md', 'deliverables/implementation/UI3D/U3D-02/hover-phase.json']);
async function snapshot() {
  const paths = git(['ls-files', '-co', '--exclude-standard', '-z']).split('\0').filter(p => p && !p.startsWith(evidence + '/'));
  const files = {};
  for (const p of paths) { const bytes = await readFile(p); files[p] = { bytes: bytes.length, sha256: sha(bytes) }; }
  return { at: new Date().toISOString(), branch: git(['branch', '--show-current']), head: git(['rev-parse', 'HEAD']), status: git(['status', '--short']), node: process.version, files };
}
async function checks(phase) {
  const results = [];
  for (const [name, args] of [
    ['typing', ['node_modules/typescript/bin/tsc', '-b']],
    ['test-typing', ['node_modules/typescript/bin/tsc', '-p', 'tests/tsconfig.json']],
    ['boundaries', ['scripts/boundaries.mjs']],
    ['negative-boundaries', ['scripts/boundary-selfcheck.mjs']],
    ['unit', ['node_modules/vitest/vitest.mjs', 'run']],
    ['corpus', ['scripts/g1-corpus.mjs', '--compare', 'tests/g1/corpus.json', '--count', '10']],
    ['build', ['apps/web/node_modules/vite/bin/vite.js', 'build', 'apps/web']],
  ]) {
    const start = performance.now(), r = spawnSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    await save(`${evidence}/${phase}/commands/${name}.json`, { command: ['node', ...args].join(' '), exit: r.status, ms: performance.now() - start, stdout: r.stdout, stderr: r.stderr });
    results.push({ name, exit: r.status, ms: performance.now() - start }); console.log(`${phase} ${name}: ${r.status}`);
  }
  await save(`${evidence}/${phase}/checks.json`, results);
  if (results.some(r => r.exit !== 0)) throw Error('Checks failed');
}
const phase = resolve(process.argv[1] ?? '') === resolve('scripts/u3d03-evidence.mjs') ? process.argv[2] : undefined;
if (phase === 'baseline') {
  try { await readFile(`${evidence}/baseline/snapshot.json`); throw Error('Baseline exists; refusing overwrite'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  await save(`${evidence}/baseline/snapshot.json`, await snapshot()); await checks(phase);
} else if (phase === 'final') {
  await checks(phase); await save(`${evidence}/final/snapshot.json`, await snapshot());
} else if (phase === 'seal') {
  const before = JSON.parse(await readFile(`${evidence}/baseline/snapshot.json`)), after = await snapshot();
  await save(`${evidence}/final/snapshot.json`, after);
  const changed = [], missing = [], violations = [], outsideScopeObserved = [];
  const audit = p => { if (owned(p)) return; if (externallyObserved.has(p)) outsideScopeObserved.push({ path: p, before: before.files[p] ?? null, after: after.files[p], note: 'Outside the files written by U3D-03; observed during execution and retained without writing. Not claimed unchanged.' }); else violations.push(p); };
  for (const [p, b] of Object.entries(before.files)) { if (!after.files[p]) missing.push(p); else if (after.files[p].sha256 !== b.sha256) { changed.push(p); audit(p); } }
  const added = Object.keys(after.files).filter(p => !before.files[p]); for (const p of added) audit(p);
  if (before.head !== after.head || before.branch !== after.branch) violations.push('git identity');
  await save(`${evidence}/preservation.json`, { unchanged: Object.keys(before.files).length - changed.length - missing.length, changed, added, missing, violations, outsideScopeObserved, head: after.head, branch: after.branch });
  if (violations.length || missing.length) throw Error('Preservation failed');
  for (const p of Object.keys(after.files).filter(owned)) { await mkdir(resolve(evidence, 'recipe', p, '..'), { recursive: true }); await cp(p, resolve(evidence, 'recipe', p)); }
  await save(`${evidence}/seal.json`, { kind: 'working tree SHA256 inventory, no commit', sha256: sha(JSON.stringify(after.files)), files: Object.fromEntries(Object.entries(after.files).filter(([p]) => owned(p))) });
} else if (phase !== undefined) throw Error('Use baseline/final/seal');
