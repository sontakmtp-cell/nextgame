import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import os from 'node:os';
import { canonical, validateBody } from '../packages/contracts/dist/index.js';
import { compile } from '../packages/brain/dist/index.js';
import { catalog, sliceKits } from '../packages/content/dist/index.js';
import { createWorld, checkpoint, step, ENGINE_DIGEST } from '../packages/engine/dist/index.js';
const out=process.argv[2]??'.local/g1/serial-profile.json',c=value=>({kind:'const',value}),sensor=name=>({kind:'sensor',name});
const stress=structuredClone(sliceKits[0]);stress.name='G1 legal capacity fixture';stress.body.modules=stress.body.modules.filter(m=>['core','thruster','blade'].includes(m.catalogId));
for(const [i,[x,y]] of [[3,5],[3,6],[4,4],[4,7],[5,4],[5,7],[6,4],[6,7],[7,4],[7,6],[7,7],[8,4],[8,6]].entries())stress.body.modules.push({id:`armor${i}`,catalogId:'armor',cell:{x,y},orientation:0});
stress.brain.variables=Array.from({length:64},(_,i)=>({id:`v${i}`,type:'int',initial:0}));
const expensive=Array.from({length:15},()=>({kind:'compare',op:'gte',left:{kind:'op',op:'add',left:sensor('clock.tick'),right:c(0)},right:c(0)}));
const idle={thrust:{forward:c(0),strafe:c(0)},turn:c(0),modules:[]};
const failedRules=Array.from({length:22},(_,i)=>({id:`cost${i}`,when:{kind:'all',args:[...structuredClone(expensive),{kind:'compare',op:'gt',left:sensor('clock.tick'),right:c(2147483647)}]},intent:structuredClone(idle)}));
stress.brain.states[0].rules=[...failedRules,...stress.brain.states[0].rules.slice(-1)];
const body=validateBody(stress.body,catalog,true),compiled=compile(stress.brain,body.modules);
await mkdir('tests/g1',{recursive:true});await writeFile('tests/g1/stress.bot.json',JSON.stringify(stress,null,2)+'\n');
const rows=[];
for(const [index,bot] of [...sliceKits,stress].entries())for(let run=0;run<3;run++){
  const w=await createWorld(bot,sliceKits[(index+run)%3],BigInt(run).toString(16).padStart(32,'0')),start=performance.now();let sampledRss=0,sampledHeap=0,maxGas=0;
  while(!w.result){step(w);for(const trace of w.traces)maxGas=Math.max(maxGas,trace.gas);if(w.tick%60===0){sampledRss=Math.max(sampledRss,process.memoryUsage().rss);sampledHeap=Math.max(sampledHeap,process.memoryUsage().heapUsed);}}
  rows.push({bot:bot.name,run,elapsedTicks:w.tick,wallMs:performance.now()-start,sampledRss,sampledHeap,maxGas,vmSerializedBytes:Math.max(...['A','B'].map(id=>Buffer.byteLength(canonical(checkpoint(w).actors[id].vm))))});
}
await mkdir(dirname(out),{recursive:true});await writeFile(out,JSON.stringify({engineDigest:ENGINE_DIGEST,runtime:process.version,platform:process.platform,cpu:os.cpus()[0]?.model,concurrency:1,stress:{modules:body.modules.length,cost:body.cost,mass:body.mass,irNodes:compiled.nodeCount,variables:64},claim:'Sampled process memory/serialized VM, not a proof of peak interpreter allocations or OS-enforced isolation. Run with other simulation workloads stopped for reference timings.',rows},null,2)+'\n');console.log(JSON.stringify({out,stressIr:compiled.nodeCount,rows:rows.length}));
