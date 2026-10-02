import { mkdir, writeFile } from 'node:fs/promises';
import { sliceKits, buildSuite } from '../packages/content/dist/index.js';
import { createWorld, simulate } from '../packages/engine/dist/index.js';
import { writeArchive, verifyArchive } from '../apps/cli/dist/archive.js';
const out=process.argv[2]??'.local/g1/fixtures';await mkdir(out,{recursive:true});const rows=[],seeds=(await buildSuite()).tuning.slice(0,3);
for(let index=0;index<3;index++)for(const {seed,scenarioId} of seeds){
  const a=sliceKits[index],b=sliceKits[(index+1)%3],path=`${out}/${a.name}-${scenarioId}`,record=await simulate(await createWorld(a,b,seed)),manifest=await writeArchive(path,a,b,record),verification=await verifyArchive(path,true);
  rows.push({kit:a.name,opponent:b.name,seed,scenarioId,path:path.split('/').at(-1),result:record.result,simulationHash:record.simulationHash,publicReplayHash:manifest.publicReplayHash,privateTraceHash:record.privateTraceHash,checkpoints:verification.checkpoints,publicBytes:manifest.chunks.reduce((sum,c)=>sum+c.bytes,0)});console.log(`Fixture ${a.name}/${scenarioId}: full verify passed`);
}
await writeFile(`${out}/manifest.json`,JSON.stringify({version:'g1-fixtures-v1',status:'passed',local:'unofficial',rows},null,2)+'\n');
