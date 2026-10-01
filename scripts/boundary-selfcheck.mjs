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
