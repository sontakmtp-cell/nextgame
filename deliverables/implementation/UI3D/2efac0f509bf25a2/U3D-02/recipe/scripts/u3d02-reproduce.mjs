import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { evidence, save, sha } from './u3d02-evidence.mjs';
const runs=[];
for(const script of ['assets','fixture']) {
 const hashes=[];
 for(let attempt=1;attempt<=2;attempt++) {
  const command=`scripts/u3d02-${script}.mjs`,start=performance.now(),r=spawnSync(process.execPath,[command],{encoding:'utf8'});
  runs.push({command:`node ${command}`,attempt,exit:r.status,ms:performance.now()-start,stdout:r.stdout,stderr:r.stderr});assert.equal(r.status,0);
  const files=script==='assets'?['apps/web/public/assets/ui3d/u3d02/floor.webp','apps/web/public/assets/ui3d/u3d02/recipe.json']:['.local/u3d02/fixture.json'];
  hashes.push(Object.fromEntries(await Promise.all(files.map(async f=>[f,sha(await readFile(f))]))));
 }
 assert.deepEqual(hashes[0],hashes[1]);runs.push({script,reproducible:true,hashes:hashes[0]});
}
await save(`${evidence}/reproduction.json`,{status:'passed',runs});console.log(JSON.stringify({status:'passed',runs}));
