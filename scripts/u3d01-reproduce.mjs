import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { ids, levels, out, evidence, save, sha } from './u3d01-lib.mjs';
const id=process.argv[2]??'thruster';assert(ids.includes(id));
const paths=Object.keys(levels).flatMap(q=>['model.glb','baseColor.ktx2','normal.ktx2','metallicRoughness.ktx2'].map(f=>`${out}/modules/${id}/${q}/${f}`));
const before=await Promise.all(paths.map(async path=>({path,sha256:sha(await readFile(path))})));
const start=performance.now();const log=execFileSync(process.execPath,['scripts/u3d01-build.mjs',id],{encoding:'utf8',maxBuffer:16*1048576});
const rows=[];for(const b of before){const after=sha(await readFile(b.path));rows.push({...b,after,identical:after===b.sha256});}
const status=rows.every(r=>r.identical)?'passed':'failed';await save(`${evidence}/reproducibility.json`,{command:`node scripts/u3d01-reproduce.mjs ${id}`,status,elapsedMs:performance.now()-start,rows,log,note:'Actual repeat of one pilot module, including fresh Blender bake. Other modules are not claimed repeated.'});assert.equal(status,'passed');console.log({status,files:rows.length});
