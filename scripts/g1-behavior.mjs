import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { canonical } from '../packages/contracts/dist/index.js';
import { sliceKits, passiveVariant, buildSuite } from '../packages/content/dist/index.js';
import { createWorld, finish, step, ENGINE_DIGEST } from '../packages/engine/dist/index.js';
const out=process.argv[2]??'.local/g1/behavior.json',suite=await buildSuite(),rows=[];
for(let kit=0;kit<3;kit++)for(const scenario of suite.tuning.slice(0,3)){
  const bot=sliceKits[kit],passive=passiveVariant(bot),opponent=sliceKits[(kit+1)%3];
  const baseline=await createWorld(passive,opponent,scenario.seed),candidate=await createWorld(bot,opponent,scenario.seed);let difference=null;
  while(!baseline.result&&!candidate.result&&!difference){step(baseline);step(candidate);if(canonical(baseline.actors.A.intent)!==canonical(candidate.actors.A.intent))difference={tick:baseline.tick-1,baseline:baseline.traces[0]??{intent:baseline.actors.A.intent},candidate:candidate.traces[0]??{intent:candidate.actors.A.intent}};}
  const results={baseline:[],candidate:[]};for(const [key,b] of [['baseline',passive],['candidate',bot]])for(const swap of [false,true])results[key].push(finish(await createWorld(b,opponent,scenario.seed,swap)).result);
  if(!difference)throw new Error(`No observed behavior difference ${bot.name}`);
  rows.push({kit:bot.name,opponent:opponent.name,scenario,...results,difference});
}
await mkdir(dirname(out),{recursive:true});await writeFile(out,JSON.stringify({status:'passed',engineDigest:ENGINE_DIGEST,local:'unofficial',claim:'Same Bodies, paired seeds/slots; observed action differences. No statistical improvement or fun pass claim.',rows},null,2)+'\n');console.log(JSON.stringify({status:'passed',rows:rows.length,out}));
