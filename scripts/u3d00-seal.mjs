import assert from 'node:assert/strict';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = 'deliverables/implementation/UI3D/U3D-00';
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const sha = data => createHash('sha256').update(data).digest('hex');
const baseline = await json(`${root}/baseline/snapshot.json`), final = await json(`${root}/final/snapshot.json`);
const ownedExisting = new Set(['Docs/04_ARCHITECTURE.md', 'Docs/DECISIONS.md', 'apps/web/package.json', 'apps/web/src/App.tsx', 'apps/web/tsconfig.json', 'pnpm-lock.yaml', 'scripts/boundaries.mjs', 'scripts/boundary-selfcheck.mjs', 'scripts/u3d00-evidence.mjs', 'tsconfig.json']);
const ownedNew = path => path.startsWith('packages/renderer3d/') || /^scripts\/u3d00-[a-z-]+\.mjs$/.test(path) || ['Docs/UI3D_IMPLEMENTATION.md', 'Docs/UI3D_REPORT.md', 'apps/web/src/presentation.ts', 'apps/web/src/presentation.css', 'tests/presentation.test.ts'].includes(path);
const current = new Map(final.files.map(f => [f.path, f]));
const changed = [], preserved = [], missing = [], unexpected = [];
for (const f of baseline.files) {
  const after = current.get(f.path);
  if (!after) missing.push(f.path);
  else if (after.sha256 !== f.sha256) { changed.push(f.path); if (!ownedExisting.has(f.path)) unexpected.push(f.path); }
  else preserved.push(f.path);
}
for (const f of final.files) {
  assert.equal(sha(await readFile(f.path)), f.sha256, `Live checkout changed since final snapshot: ${f.path}`);
  if (!baseline.files.some(b => b.path === f.path) && !ownedNew(f.path)) unexpected.push(f.path);
}
assert.deepEqual(missing, []); assert.deepEqual(unexpected, []);
assert.equal(execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(), 'remake-ui3d');
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), baseline.head);
const commands = [];
for (const name of await readdir(`${root}/final/commands`)) {
  const command = await json(`${root}/final/commands/${name}`);
  assert.equal(command.exitCode, 0, name); commands.push({ name, command: command.command, exitCode: command.exitCode, elapsedMs: command.elapsedMs });
}
assert.equal(commands.length, 9);
const browser = await json(`${root}/final/browser.json`), oldBrowser = await json(`${root}/baseline/browser.json`);
assert.equal(browser.status, 'passed'); assert.deepEqual(browser.match, oldBrowser.match);
for (const width of [1600, 1920]) assert((await readFile(`${root}/baseline-stable/screenshots/brain-lab-${width}.png`)).equals(await readFile(`${root}/final/screenshots/brain-lab-${width}.png`)));
const oldBudget = await json(`${root}/baseline/budget.json`), budget = await json(`${root}/final/budget.json`);
const worker = data => data.shellFiles.find(f => f.path.includes('local.worker-')).sha256;
assert.equal(worker(budget), worker(oldBudget), 'Worker output unchanged');
const archive = `deliverables/implementation/UI3D/${final.revision}/U3D-00`;
const proof = { timestamp: new Date().toISOString(), status: 'passed', baselineSnapshotHash: baseline.snapshotHash, finalSnapshotHash: final.snapshotHash, revision: final.revision, branch: 'remake-ui3d', headUnchanged: baseline.head, preservedCount: preserved.length, preserved, changedOwnedExisting: changed, missing, unexpected, workerBundleUnchanged: worker(budget), commands, archive, note: 'Compares working-tree bytes to pre-edit inventory, including initially untracked sources/assets. Exclusions are explicit in snapshots. Presentation uses 2D fallback; no 3D performance/art acceptance implied.' };
await writeFile(`${root}/preservation.json`, JSON.stringify(proof, null, 2) + '\n');
await cp('.local/u3d00/baseline-web/src/App.tsx', `${root}/baseline/App.original.tsx`);
const artifacts = [];
async function collect(dir, prefix = '') {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`, relative = `${prefix}${entry.name}`;
    if (entry.isDirectory()) await collect(path, `${relative}/`);
    else if (entry.isFile() && relative !== 'seal.json') { const data = await readFile(path); artifacts.push({ path: relative, bytes: data.length, sha256: sha(data) }); }
  }
}
await collect(root); artifacts.sort((a, b) => a.path.localeCompare(b.path));
await writeFile(`${root}/seal.json`, JSON.stringify({ revision: final.revision, sourceSnapshotHash: final.snapshotHash, archive, artifacts }, null, 2) + '\n');
await mkdir(archive, { recursive: true });
await cp(root, archive, { recursive: true });
await cp('Docs/UI3D_IMPLEMENTATION.md', `${archive}/UI3D_IMPLEMENTATION.md`);
await cp('Docs/UI3D_REPORT.md', `${archive}/UI3D_REPORT.md`);
console.log(JSON.stringify({ status: proof.status, revision: final.revision, preservedCount: preserved.length, changedOwnedExisting: changed, archive }, null, 2));
