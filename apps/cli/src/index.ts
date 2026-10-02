#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { ContractError, decodeJson, validateBody } from '@prompt-chien/contracts';
import { compile } from '@prompt-chien/brain';
import { catalog, buildSuite } from '@prompt-chien/content';
// ponytail: G1 uses conservative rotation and milli-lattice melee (D17/D18); exact curved CCD is the upgrade if grazing/contact playtests fail.
import { createWorld, finish, simulate, ENGINE_DIGEST } from '@prompt-chien/engine';
import { verifyPublic } from '@prompt-chien/replay';
import { readBot, readReplay, verifyArchive, writeArchive } from './archive.js';
const usage='validate <bot.json> | simulate <A.json> <B.json> <new-output-dir> [seed128] [--swap] | verify <archive-dir> [--full] | seek <archive-dir> <boundary> | experiment <baseline.json> <candidate.json> <opponent.json> [seeds.json]';
try {
  const [command,...args]=process.argv.slice(2);
  if(command==='validate'&&args.length===1){const bot=await readBot(args[0]!),body=validateBody(bot.body,catalog),brain=compile(bot.brain,body.modules);console.log(JSON.stringify({status:'passed',cost:body.cost,mass:body.mass,irNodes:brain.nodeCount,compilerDigest:brain.compilerDigest}));}
  else if(command==='simulate'&&args.length>=3&&args.length<=5){const [ap,bp,out,...options]=args,a=await readBot(ap!),b=await readBot(bp!),seed=options.find(x=>x!=='--swap')??'00000000000000000000000000000000';
    const record=await simulate(await createWorld(a,b,seed,options.includes('--swap'))),manifest=await writeArchive(out!,a,b,record);console.log(JSON.stringify({status:'passed',local:'unofficial',output:out,result:record.result,simulationHash:record.simulationHash,publicReplayHash:manifest.publicReplayHash}));}
  else if(command==='verify'&&(args.length===1||(args.length===2&&args[1]==='--full')))console.log(JSON.stringify(await verifyArchive(args[0]!,args[1]==='--full')));
  else if(command==='seek'&&args.length===2){const replay=await readReplay(args[0]!),index=await verifyPublic(replay);console.log(JSON.stringify(index.seek(Number(args[1]))));}
  else if(command==='experiment'&&(args.length===3||args.length===4)){
    const [base,candidate,opponent]=await Promise.all(args.slice(0,3).map(readBot));
    const source=args[3]?decodeJson(await readFile(args[3],'utf8')):(await buildSuite()).tuning.slice(0,10).map(x=>x.seed);
    if(!Array.isArray(source)||source.length<1||source.length>1225||source.some(s=>typeof s!=='string'||!/^[a-f0-9]{32}$/.test(s)))throw new Error('seeds.json must be 1..1225 seed128 strings.');
    const seen=new Set<number>(),rows=[];
    for(const seed of source as string[]){const initial=await createWorld(base!,opponent!,seed);if(seen.has(initial.manifest.scenarioId))throw new Error('Duplicate scenario ID does not increase sample size.');seen.add(initial.manifest.scenarioId);
      const row:{scenarioId:number;baseline:number;candidate:number}={scenarioId:initial.manifest.scenarioId,baseline:0,candidate:0};
      for(const [key,bot] of [['baseline',base!],['candidate',candidate!]] as const)for(const swapped of [false,true]){const result=finish(await createWorld(bot,opponent!,seed,swapped)).result!;row[key]+=result.winner==='A'?500:result.winner==='draw'?250:0;}rows.push(row);
    }
    console.log(JSON.stringify({status:'completed',local:'unofficial',engineDigest:ENGINE_DIGEST,pairedResults:rows,meanDeltaMillionths:Math.trunc(rows.reduce((sum,r)=>sum+r.candidate-r.baseline,0)*1000/rows.length),confidence:null,limitation:'G1 paired comparison; no balance or statistical pass claim.'}));
  }else throw new Error(`Usage: prompt-chien ${usage}`);
}catch(error){console.error(JSON.stringify(error instanceof ContractError?{code:error.code,pointer:error.pointer,message:error.message}:{message:String(error)}));process.exitCode=1;}
