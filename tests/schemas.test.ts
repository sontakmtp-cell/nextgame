import { it, expect } from 'vitest';
import { validateSchema } from '../packages/contracts/dist/index.js';
import type { Experiment, ExperimentSpec, MatchManifest, MatchResult, Observation, Ratings, ReplayManifest, ValidationReport } from '../packages/contracts/dist/index.js';
import { compile, freezeBot } from '../packages/brain/dist/index.js';
import { catalog,contentManifest } from '../packages/content/dist/index.js';
import { brain, sample } from './helpers.js';
const h='a'.repeat(64);
const spec:ExperimentSpec={baselineHash:h,candidateHash:h,opponentHashes:[h],seedSetDigest:h,engineDigest:h,rulesetDigest:h,phase:'holdout'};
const match:MatchManifest={engineDigest:h,rulesetDigest:h,catalogDigest:h,compilerDigest:h,brainAbiVersion:'2.0',packageHashes:{A:h,B:h},seed:'0'.repeat(32),arenaDigest:h,arenaInitDigest:h,scenarioId:0,presetValues:{yLeft:-3000,yRight:-3000,jitterLeft:-128,jitterRight:-128},spawnSlotAssignment:{A:'left',B:'right'},maxTicks:5400,numericalAbiVersion:'milli-v1'};
const result:MatchResult={winner:'draw',cause:'timeout',elapsedTicks:5400,scores:{A:1000,B:1000}};
const validation:ValidationReport={packageHash:h,engineDigest:h,rulesetDigest:h,suiteDigest:h,status:'passed',diagnostics:[]};
const experiment:Experiment={manifestDigest:h,spec,status:'completed',pairedResults:[{scenarioId:0,baseline:500,candidate:1000}],confidence:{meanDeltaMillionths:500000,lower95Millionths:200000,upper95Millionths:750000,resamples:10000},cost:2};
const replay:ReplayManifest={version:'2.0',match,publicReplayHash:h,chunks:[{firstBoundary:0,lastBoundary:60,hash:h,bytes:300}],result};
const ratings:Ratings={userId:'Alice',seasonId:'alpha',runId:'original',rating:-100,played:10,wins:3,draws:2,revision:1};
const observation:Observation={tick:0,sensors:{'self.energy':1000,'enemy.distance':24000}};
it('all frozen schema families have typed positive and unknown-field negative fixtures',async()=>{
  const bot=sample(),compiled=compile(brain(),bot.body.modules);
  const fixtures={'bot-definition':bot,body:bot.body,brain:brain(),ir:compiled.normalizedIR,'compiled-brain':compiled,'bot-package':await freezeBot(bot,catalog,contentManifest.catalogDigest,contentManifest.capabilityDigest),intent:{thrust:{forward:0,strafe:0},turn:0,modules:[]},observation,validation,'experiment-spec':spec,experiment,match,'match-result':result,replay,ratings};
  for(const [name,value] of Object.entries(fixtures)){expect(()=>validateSchema(name,value),name).not.toThrow();expect(()=>validateSchema(name,{...value,rogue:true}),name).toThrow();}
});
it('rejects floats, actor slot duplication, invalid seeds, private replay leaks, invalid bounds',()=>{
  for(const [name,value] of [
    ['match',{...match,spawnSlotAssignment:{A:'left',B:'left'}}],['match',{...match,seed:'not-a-seed'}],
    ['match-result',{...result,elapsedTicks:5401}],['observation',{...observation,sensors:{'self.energy':0.5}}],
    ['observation',{...observation,sensors:{'enemy.energy':1000}}],
    ['replay',{...replay,brain:brain()}],['ratings',{...ratings,rating:1.5}],['experiment',{...experiment,cost:-1}]
  ] as const)expect(()=>validateSchema(name,value)).toThrow();
});
it('normalized IR rejects unbound parameters and parameter state objects',()=>{
  const compiled=compile(brain(),sample().body.modules);
  compiled.normalizedIR.states[0]!.rules[0]!.intent.thrust.forward={kind:'param',id:'unbound'};
  expect(()=>validateSchema('ir',compiled.normalizedIR)).toThrow();
  compiled.normalizedIR.states[0]!.rules[0]!.intent.thrust.forward={kind:'const',value:0};
  compiled.normalizedIR.states[0]!.rules[0]!.nextState={parameter:'unbound'};
  expect(()=>validateSchema('ir',compiled.normalizedIR)).toThrow();
});
it('experiment confidence uses explicit units and server handles use the 128-char ASCII contract',()=>{
  expect(()=>validateSchema('experiment',{...experiment,status:'queued',confidence:null})).not.toThrow();
  expect(()=>validateSchema('experiment',{...experiment,confidence:{...experiment.confidence,resamples:999}})).toThrow();
  expect(()=>validateSchema('ratings',{...ratings,userId:'0'.repeat(128)})).not.toThrow();
  expect(()=>validateSchema('ratings',{...ratings,userId:'0'.repeat(129)})).toThrow();
});
