import { sliceKits, passiveVariant } from '../../packages/content/src/index.js';
import { createWorld, step, simulate, simulationHash } from '../../packages/engine/src/index.js';
import { canonical, sha256 } from '../../packages/contracts/src/index.js';
import { encodeReplay, verifyPublic } from '../../packages/replay/src/index.js';
declare const self:DedicatedWorkerGlobalScope;
self.onmessage=async(e:MessageEvent)=>{
  try{
    const job=e.data as {kind:'match'|'parity';a:number;b:number;passive:boolean};
    if(job.kind==='match'){
      const bot=job.passive?passiveVariant(sliceKits[job.a]!):sliceKits[job.a]!,record=await simulate(await createWorld(bot,sliceKits[job.b]!));
      const replay=await encodeReplay(record.manifest,record.frames,record.result),index=await verifyPublic(replay);let seekChecks=0;
      for(let tick=0;tick<record.frames.length;tick+=37){if(canonical(index.seek(tick))!==canonical(record.frames[tick]))throw new Error(`Browser codec seek ${tick}`);seekChecks++;}
      if(canonical(index.seek(record.result.elapsedTicks))!==canonical(record.frames.at(-1)))throw new Error('Browser codec terminal seek');
      self.postMessage({kind:'match',frames:record.frames,result:record.result,match:record.manifest,codec:{status:'passed',engineDigest:record.manifest.engineDigest,publicReplayHash:replay.manifest.publicReplayHash,simulationHash:record.simulationHash,frameCount:index.frameCount,seekChecks:seekChecks+1,userAgent:navigator.userAgent}});
    }else{
      const corpus=await (await fetch('/corpus.json')).json() as {engineDigest:string;records:{seed:string;a:number;b:number;swap:boolean;simulationHash:string;eventHash:string;scenarioId:number}[]};
      const rows=[];for(const row of corpus.records){const w=await createWorld(sliceKits[row.a]!,sliceKits[row.b]!,row.seed,row.swap),events:string[]=[];while(!w.result){step(w);if(w.events.length)events.push(canonical(w.events)+'\n');}const hash=await simulationHash(w),eventHash=await sha256(events.join(''));
        if(hash!==row.simulationHash||eventHash!==row.eventHash||w.manifest.scenarioId!==row.scenarioId||w.manifest.engineDigest!==corpus.engineDigest)throw new Error(`Browser differential seed ${row.seed}`);
        rows.push({seed:row.seed,scenarioId:row.scenarioId,simulationHash:hash,eventHash});self.postMessage({kind:'progress',count:rows.length,total:corpus.records.length});}
      self.postMessage({kind:'parity',status:'passed',engineDigest:corpus.engineDigest,records:rows,userAgent:navigator.userAgent});
    }
  }catch(error){self.postMessage({kind:'error',message:String(error)});}
};
