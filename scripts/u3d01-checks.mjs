import { spawnSync } from 'node:child_process';
import { save, evidence } from './u3d01-lib.mjs';
const commands = [
 ['types','node_modules/typescript/bin/tsc','-b'],
 ['test-types','node_modules/typescript/bin/tsc','-p','tests/tsconfig.json'],
 ['g1-types','node_modules/typescript/bin/tsc','-p','tests/g1-browser/tsconfig.json'],
 ['g2-types','node_modules/typescript/bin/tsc','-p','tests/g2-viewer/tsconfig.json'],
 ['boundaries','scripts/boundaries.mjs'],
 ['boundary-negative','scripts/boundary-selfcheck.mjs'],
 ['unit','node_modules/vitest/vitest.mjs','run'],
 ['sim-corpus','scripts/g1-corpus.mjs','--compare','tests/g1/corpus.json','--count','10'],
 ['replay','node_modules/vitest/vitest.mjs','run','tests/replay.test.ts'],
 ['build','apps/web/node_modules/vite/bin/vite.js','build','apps/web'],
];
for(const[name,...args]of commands){const start=performance.now();const result=spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:16*1048576});await save(`${evidence}/commands/${name}.json`,{command:`node ${args.join(' ')}`,exitCode:result.status,elapsedMs:performance.now()-start,stdout:result.stdout,stderr:result.stderr,error:result.error?.message});console.log(`${name}: exit ${result.status}`);if(result.status!==0)process.exitCode=1;}
