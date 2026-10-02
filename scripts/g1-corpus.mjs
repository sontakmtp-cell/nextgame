import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { digest, canonical, sha256 } from '../packages/contracts/dist/index.js';
import { buildSuite, sliceKits } from '../packages/content/dist/index.js';
import { createWorld, checkpoint, checkpointState, restore, step, simulationHash, ENGINE_DIGEST } from '../packages/engine/dist/index.js';
if(!isMainThread){
  for(const task of workerData.tasks){
    const started=performance.now(),w=await createWorld(sliceKits[task.a],sliceKits[task.b],task.seed,task.swap),checkpoints=[checkpoint(w)],eventHasher=createHash('sha256');let peakHeap=process.memoryUsage().heapUsed,peakRss=process.memoryUsage().rss;
    while(!w.result){step(w);if(w.events.length)eventHasher.update(canonical(w.events)+'\n');if(w.tick%60===0||w.result){checkpoints.push(checkpoint(w));peakHeap=Math.max(peakHeap,process.memoryUsage().heapUsed);peakRss=Math.max(peakRss,process.memoryUsage().rss);}}
    const simulationMs=performance.now()-started;let restoreCount=0;
    for(let i=0;i<checkpoints.length-1;i++){
      const resumed=restore(checkpoints[i]),next=checkpoints[i+1];while(resumed.tick<next.tick&&!resumed.result)step(resumed);
      if(await digest(checkpointState(checkpoint(resumed)))!==await digest(checkpointState(next)))throw new Error(`Checkpoint restore failed seed=${task.seed} boundary=${next.tick}`);restoreCount++;
    }
    if(await simulationHash(restore(checkpoints.at(-1)))!==await simulationHash(w))throw new Error('Terminal restore hash');
    if(workerData.baseline){const old=workerData.baseline.records[task.ordinal],current=w.manifest.engineDigest;w.manifest.engineDigest=workerData.baseline.engineDigest;const saved=checkpoint(w),actor=id=>{const a=saved.actors[id];return {...a,compiled:{brainAbiVersion:a.compiled.brainAbiVersion,compilerDigest:a.compiled.compilerDigest,normalizedIR:a.compiled.normalizedIR},intent:{...a.intent,modules:[]}};};const baselineHash=await digest({...saved,actors:{A:actor('A'),B:actor('B')},traces:[]});w.manifest.engineDigest=current;if(baselineHash!==old.simulationHash)throw new Error(`Geometry/checkpoint changes altered gameplay state seed=${task.seed}`);}
    const row={...task,scenarioId:w.manifest.scenarioId,packageHashes:w.manifest.packageHashes,result:w.result,simulationHash:await simulationHash(w),eventHash:eventHasher.digest('hex'),checkpointIntervals:restoreCount};
    parentPort.postMessage({row,profile:{simulationMs,totalMs:performance.now()-started,peakHeap,peakRss,vmSerializedBytes:Math.max(...['A','B'].map(id=>Buffer.byteLength(canonical(checkpoint(w).actors[id].vm))))}});
  }
}else{
  const args=process.argv.slice(2),option=(key,def)=>{const index=args.indexOf(key);return index<0?def:args[index+1];};
  const compare=option('--compare',null),write=option('--write',null),count=Number(option('--count','10')),out=option('--out',null);
  if(!Number.isInteger(count)||count<1||count>1000)throw new Error('count must be 1..1000');
  const golden=compare?JSON.parse(await readFile(compare,'utf8')):null;
  const baselinePath=option('--baseline',null),baseline=baselinePath?JSON.parse(await readFile(baselinePath,'utf8')):null;
  let tasks;
  if(golden){if(golden.engineDigest!==ENGINE_DIGEST||!Array.isArray(golden.records)||golden.records.length>1000)throw new Error('Golden engine/corpus binding');tasks=golden.records.slice(0,Number(option('--count',String(golden.records.length)))).map(({seed,a,b,swap,ordinal})=>({ordinal,seed,a,b,swap}));}
  else {const suite=await buildSuite(count,1);tasks=suite.tuning.map(({seed},ordinal)=>({ordinal,seed,a:ordinal%3,b:Math.floor(ordinal/3)%3,swap:!!(Math.floor(ordinal/9)%2)}));}
  const rows=[],profiles=[],workers=[],concurrency=Math.min(4,tasks.length),started=performance.now();
  for(let index=0;index<concurrency;index++)workers.push(new Promise((resolve,reject)=>{
    const worker=new Worker(new URL(import.meta.url),{workerData:{tasks:tasks.filter((_,i)=>i%concurrency===index),baseline}});
    worker.on('message',({row,profile})=>{rows.push(row);profiles.push(profile);if(rows.length%50===0)console.log(`G1 corpus ${rows.length}/${tasks.length}`);});worker.once('error',reject);worker.once('exit',code=>code===0?resolve():reject(new Error(`Worker exited ${code}`)));
  }));await Promise.all(workers);rows.sort((a,b)=>a.ordinal-b.ordinal);
  if(new Set(rows.map(r=>r.scenarioId)).size!==rows.length)throw new Error('Duplicate scenario IDs');
  if(golden)for(let i=0;i<rows.length;i++)if(JSON.stringify(rows[i])!==JSON.stringify(golden.records[i]))throw new Error(`Differential mismatch ordinal=${i} seed=${rows[i].seed}`);
  const values=profiles.map(p=>p.simulationMs).sort((a,b)=>a-b),percentile=p=>values[Math.floor((values.length-1)*p)],summary={engineDigest:ENGINE_DIGEST,records:rows,corpusDigest:await sha256(JSON.stringify(rows)),status:'passed',baselineGameplayParity:baseline?true:null,runtime:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,concurrency,wallMs:performance.now()-started,profile:{p50Ms:percentile(.5),p95Ms:percentile(.95),maxMs:values.at(-1),sampledProcessPeakRss:Math.max(...profiles.map(p=>p.peakRss)),sampledWorkerPeakHeap:Math.max(...profiles.map(p=>p.peakHeap)),vmSerializedBytes:Math.max(...profiles.map(p=>p.vmSerializedBytes))},checkpointIntervals:rows.reduce((sum,r)=>sum+r.checkpointIntervals,0)};
  if(write){await mkdir(dirname(write),{recursive:true});await writeFile(write,JSON.stringify({version:'g1-differential-v1',engineDigest:ENGINE_DIGEST,corpusDigest:summary.corpusDigest,records:rows},null,2)+'\n');}
  if(out){await mkdir(dirname(out),{recursive:true});await writeFile(out,JSON.stringify(summary,null,2)+'\n');}
  console.log(JSON.stringify({...summary,records:rows.length}));
}
