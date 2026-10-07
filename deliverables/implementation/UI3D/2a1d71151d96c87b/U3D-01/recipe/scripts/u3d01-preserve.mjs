import assert from 'node:assert/strict';
import { readFile, readdir, copyFile, cp, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { json, save, sha, out, evidence } from './u3d01-lib.mjs';
const baseline=await json(`${evidence}/baseline.json`),changed=[],missing=[];
for(const f of baseline.files){try{if(sha(await readFile(f.path))!==f.sha256)changed.push(f.path);}catch(e){if(e.code==='ENOENT')missing.push(f.path);else throw e;}}
const current=[...new Set(execFileSync('git',['ls-files','-co','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean).filter(p=>!p.startsWith('.workbuddy-ai/')))];
const before=new Set(baseline.files.map(f=>f.path)),added=current.filter(p=>!before.has(p));
const allowed=p=>p.startsWith(`${out}/`)||p.startsWith('tools/u3d01/')||/^scripts\/u3d01-[a-z-]+\.(mjs|py|json|html)$/.test(p)||p.startsWith(`${evidence}/`)||/^deliverables\/implementation\/UI3D\/[a-f0-9]{16}\/U3D-01\//.test(p)||p==='Docs/U3D-01_REPORT.md';
const unexpected=added.filter(p=>!allowed(p));
assert.deepEqual(changed,[],'Existing checkout bytes changed');assert.deepEqual(missing,[]);assert.deepEqual(unexpected,[]);
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),baseline.head);
assert.equal(execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),baseline.branch);
await save(`${evidence}/preservation.json`,{command:'node scripts/u3d01-preserve.mjs',status:'passed',preservedFiles:baseline.files.length,changed,missing,unexpected,added,head:baseline.head,branch:baseline.branch,excluded:'.workbuddy-ai and Git ignored files (dependencies, .local, compiled outputs, env files). No reset/stash/commit/push/deploy.'});
console.log(JSON.stringify({preservedFiles:baseline.files.length,changed:changed.length,added:added.length}));
if(process.argv.includes('--seal')){
 const manifest=await json(`${out}/manifest.json`),dir=`deliverables/implementation/UI3D/${manifest.assetRevision}/U3D-01`;
 await mkdir(`${evidence}/bake`,{recursive:true});
 for(const name of await readdir('.local/u3d01/build'))if(/-(medium|low)-(bake\.log|baked\.glb\.json)$/.test(name))await copyFile(`.local/u3d01/build/${name}`,`${evidence}/bake/${name}`);
 await cp(evidence,dir,{recursive:true});await cp(out,`${dir}/assets`,{recursive:true});
 await mkdir(`${dir}/recipe`,{recursive:true});
 for(const path of added.filter(p=>p.startsWith('scripts/u3d01-')||p.startsWith('tools/u3d01/'))){await mkdir(`${dir}/recipe/${path.slice(0,path.lastIndexOf('/'))}`,{recursive:true});await copyFile(path,`${dir}/recipe/${path}`);}
 const report=(await readFile('Docs/U3D-01_REPORT.md','utf8')).replaceAll(`../${out}/`,'assets/').replaceAll(`../${evidence}/`,'');
 await import('node:fs/promises').then(fs=>fs.writeFile(`${dir}/REPORT.md`,report));
 const artifacts=[];
 async function collect(path,prefix=''){for(const e of await readdir(path,{withFileTypes:true})){const rel=prefix+e.name;if(e.isDirectory())await collect(`${path}/${e.name}`,`${rel}/`);else if(rel!=='seal.json'){const b=await readFile(`${path}/${e.name}`);artifacts.push({path:rel,bytes:b.length,sha256:sha(b)});}}}
 await collect(dir);await save(`${dir}/seal.json`,{assetRevision:manifest.assetRevision,archive:dir,artifacts});await save(`${evidence}/seal.json`,{assetRevision:manifest.assetRevision,archive:dir,sealSha256:sha(await readFile(`${dir}/seal.json`))});
 console.log({archive:dir,artifacts:artifacts.length});
}
