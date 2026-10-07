import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import os from 'node:os';
export const evidence = 'deliverables/implementation/UI3D/U3D-02';
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export async function save(path, value) { await mkdir(resolve(path, '..'), { recursive: true }); await writeFile(path, JSON.stringify(value, null, 2) + '\n'); }
const git = args => { const r = spawnSync('git', args, { encoding: 'utf8' }); if (r.status) throw Error(r.stderr); return r.stdout.trim(); };
async function snapshot() {
  const paths = git(['ls-files', '-co', '--exclude-standard', '-z']).split('\0').filter(p => p && !p.startsWith(evidence + '/') && !/deliverables\/implementation\/UI3D\/[^/]+\/U3D-02\//.test(p));
  const files = {};
  for (const p of paths) { const bytes = await readFile(p); files[p] = { bytes: bytes.length, sha256: sha(bytes) }; }
  return { time: new Date().toISOString(), branch: git(['branch', '--show-current']), head: git(['rev-parse', 'HEAD']), status: git(['status', '--short']), node: process.version, platform: os.platform(), cpu: os.cpus()[0]?.model, files };
}
const owned = p => /^(packages\/renderer3d\/|packages\/presentation\/|scripts\/u3d02-|tests\/u3d02\/|tests\/renderer3d\.test\.ts$|apps\/web\/public\/assets\/ui3d\/u3d02\/|Docs\/U3D-02_REPORT\.md$)/.test(p) || ['pnpm-lock.yaml','tsconfig.json','scripts/boundaries.mjs','packages/renderer/package.json','packages/renderer/tsconfig.json','packages/renderer/src/index.ts','Docs/UI3D_IMPLEMENTATION.md'].includes(p);
export async function checks(phase) {
 const commands = [
  ['typing', ['node_modules/typescript/bin/tsc','-b']],
  ['test-typing', ['node_modules/typescript/bin/tsc','-p','tests/tsconfig.json']],
  ['g1-typing', ['node_modules/typescript/bin/tsc','-p','tests/g1-browser/tsconfig.json']],
  ['g2-typing', ['node_modules/typescript/bin/tsc','-p','tests/g2-viewer/tsconfig.json']],
  ...(phase === 'final' ? [['scene-typing', ['node_modules/typescript/bin/tsc','-p','tests/u3d02/tsconfig.json']]] : []),
  ['boundaries',['scripts/boundaries.mjs']], ['negative-boundaries',['scripts/boundary-selfcheck.mjs']],
  ['unit',['node_modules/vitest/vitest.mjs','run']],
  ['corpus',['scripts/g1-corpus.mjs','--compare','tests/g1/corpus.json','--count','10']],
  ['build',['apps/web/node_modules/vite/bin/vite.js','build','apps/web']]
  ,...(phase === 'final' ? [['scene-build', ['apps/web/node_modules/vite/bin/vite.js','build','--config','tests/u3d02/vite.config.mjs']]] : [])
 ];
 const results=[];
 for(const [name,args] of commands) {
  const start=performance.now(),r=spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:10*1024*1024});
  const record={command:[process.execPath,...args],exit:r.status,ms:performance.now()-start,stdout:r.stdout,stderr:r.stderr};
  await save(`${evidence}/${phase}/commands/${name}.json`,record); results.push({name,exit:r.status,ms:record.ms}); console.log(`${phase} ${name}: ${r.status}`);
 }
 await save(`${evidence}/${phase}/checks.json`,results); if(results.some(r=>r.exit!==0))throw Error(`${phase} checks failed`);
}
async function main() {
 const phase=process.argv[2];
 if(phase==='baseline') { try { await readFile(`${evidence}/baseline/snapshot.json`); throw Error('Baseline exists; refusing overwrite'); } catch(e) { if(e.code!=='ENOENT')throw e; } await save(`${evidence}/baseline/snapshot.json`,await snapshot()); await checks(phase); }
 else if(phase==='final') { await checks(phase); await save(`${evidence}/final/snapshot.json`,await snapshot()); }
 else if(phase==='seal') {
  const before=JSON.parse(await readFile(`${evidence}/baseline/snapshot.json`)),after=await snapshot();
  const changed=[],missing=[],violations=[];
  for(const[p,b]of Object.entries(before.files)) {const a=after.files[p];if(!a)missing.push(p);else if(a.sha256!==b.sha256){changed.push(p);if(!owned(p))violations.push(p);}}
  const added=Object.keys(after.files).filter(p=>!before.files[p]);for(const p of added)if(!owned(p))violations.push(p);
  if(before.head!==after.head || before.branch!==after.branch)violations.push('git identity');
  const revision=sha(JSON.stringify(Object.fromEntries(Object.entries(after.files).filter(([p])=>owned(p))))).slice(0,16);
  await save(`${evidence}/preservation.json`,{unchanged:Object.keys(before.files).length-changed.length-missing.length,changed,added,missing,violations,head:after.head,branch:after.branch,revision});
  if(missing.length||violations.length)throw Error('Preservation failed');
  await save(`${evidence}/seal.json`,{revision,kind:'working-tree SHA256 inventory; not a commit',path:`deliverables/implementation/UI3D/${revision}/U3D-02`});
  await cp(evidence,`deliverables/implementation/UI3D/${revision}/U3D-02`,{recursive:true});
  const recipe=`deliverables/implementation/UI3D/${revision}/U3D-02/recipe`;
  for(const p of Object.keys(after.files).filter(owned)){await mkdir(resolve(recipe,p,'..'),{recursive:true});await cp(p,resolve(recipe,p));}
  console.log(revision);
 } else throw Error('Use baseline, final or seal');
}
if(resolve(process.argv[1]??'')===resolve('scripts/u3d02-evidence.mjs'))await main();
