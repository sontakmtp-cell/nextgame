import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

// Reconstruct ONLY the additive U3D-00 App fragments in an isolated copy.
// Refuse to build unless its bytes match the pre-edit snapshot, not just HEAD.
const root = '.local/u3d00/baseline-web';
const snapshot = JSON.parse(await readFile('deliverables/implementation/UI3D/U3D-00/baseline/snapshot.json', 'utf8'));
const sha = data => createHash('sha256').update(data).digest('hex');
const source = await readFile('apps/web/src/App.tsx', 'utf8');
const original = source
  .replace(/^import \{ presentationUrl, readPresentationMode \} from.*\r?\n/m, '')
  .replace(/^import '\.\/presentation\.css';\r?\n/m, '')
  .replace(/^  const \[presentation, setPresentation\].*\r?\n/m, '')
  .replace(/          \{\['Workshop', 'Arena', 'My Synths'\]\.includes\(view\) && \([\s\S]*?          \)\}\r?\n/, '')
  .replace(/          \{presentation === '3d'[\s\S]*?          \)\}\r?\n/, '');
assert.equal(sha(original), snapshot.files.find(f => f.path === 'apps/web/src/App.tsx').sha256, 'Exact pre-edit App bytes required');
for (const f of snapshot.files.filter(f => f.path.startsWith('apps/web/src/') && f.path !== 'apps/web/src/App.tsx' || f.path.startsWith('apps/web/public/') || f.path === 'apps/web/index.html')) {
  assert.equal(sha(await readFile(f.path)), f.sha256, `${f.path} baseline bytes`);
}
await mkdir(root, { recursive: true });
await cp('apps/web/src', `${root}/src`, { recursive: true });
await cp('apps/web/public', `${root}/public`, { recursive: true });
await cp('apps/web/index.html', `${root}/index.html`);
await writeFile(`${root}/src/App.tsx`, original);
await writeFile(`${root}/package.json`, '{"type":"module","private":true}\n');
try { await symlink(resolve('apps/web/node_modules'), resolve(`${root}/node_modules`), 'junction'); } catch (e) { if (e.code !== 'EEXIST') throw e; }
const result = spawnSync(process.execPath, [resolve('apps/web/node_modules/vite/bin/vite.js'), 'build', root], { encoding: 'utf8' });
const record = { command: 'node scripts/u3d00-baseline-preview.mjs', timestamp: new Date().toISOString(), exactOriginalAppSha256: sha(original), baselineSnapshotHash: snapshot.snapshotHash, root, exitCode: result.status, stdout: result.stdout, stderr: result.stderr, note: 'Reproducible original UI built in temporary copy to compare settled screenshots. Original first-capture screenshots and failed byte comparison retained.' };
await writeFile('deliverables/implementation/UI3D/U3D-00/baseline/reconstructed-preview.json', JSON.stringify(record, null, 2) + '\n');
console.log(JSON.stringify({ root, exitCode: result.status, stderr: result.stderr }));
process.exitCode = result.status ?? 1;
