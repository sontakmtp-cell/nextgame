import assert from 'node:assert/strict';
import { writeFile,unlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const file='packages/brain/src/boundary-selfcheck.ts';
let created=false;
try{
  await writeFile(file,"import fs from 'node:fs';\nimport { catalog } from '@prompt-chien/content';\nconst now = Date.now();\nexport {fs, catalog, now};\n",{flag:'wx'});
  created=true;
  const result=spawnSync(process.execPath,['scripts/boundaries.mjs'],{encoding:'utf8'});
  assert.equal(result.status,1);assert.match(result.stderr,/Node I\/O import/);assert.match(result.stderr,/forbidden import/);assert.match(result.stderr,/forbidden runtime Date/);
  console.log('Boundary negative injection rejected Node I/O, cross-package import and clock');
}finally{if(created)await unlink(file);}
const webFile='apps/web/src/boundary-selfcheck.ts';let webCreated=false;
try{
  await writeFile(webFile,"import { step } from '@prompt-chien/engine';\nimport './local.worker.js';\nexport {step};\n",{flag:'wx'});webCreated=true;
  const result=spawnSync(process.execPath,['scripts/boundaries.mjs'],{encoding:'utf8'});
  assert.equal(result.status,1);assert.match(result.stderr,/forbidden import @prompt-chien\/engine/);assert.match(result.stderr,/worker entry must only load via new Worker/);
  console.log('Web main-thread engine and eager worker import rejected');
}finally{if(webCreated)await unlink(webFile);}
const renderer3dFile='packages/renderer3d/src/boundary-selfcheck.ts';let renderer3dCreated=false;
try{
  await writeFile(renderer3dFile,"import '@prompt-chien/engine';\nimport '@prompt-chien/brain';\nimport '@prompt-chien/content';\nimport '@prompt-chien/renderer';\nimport 'pixi.js';\nimport './local.worker.js';\n",{flag:'wx'});renderer3dCreated=true;
  const result=spawnSync(process.execPath,['scripts/boundaries.mjs'],{encoding:'utf8'});
  assert.equal(result.status,1);
  for(const name of ['engine','brain','content','renderer'])assert.match(result.stderr,new RegExp(`forbidden import @prompt-chien/${name}`));
  assert.match(result.stderr,/renderer3d must not import Pixi or worker entry/);
  console.log('Renderer3d domain, legacy renderer, Pixi and worker imports rejected');
}finally{if(renderer3dCreated)await unlink(renderer3dFile);}
