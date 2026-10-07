import { ContractError, decodeJson, digest, validateSchema, validateBody } from '@prompt-chien/contracts';
import type { BotDefinition, Diagnostic } from '@prompt-chien/contracts';
import { compile, freezeBot } from '@prompt-chien/brain';
import { catalog, sampleKits, sampleCards, contentManifest, buildSuite } from '@prompt-chien/content';
import { createWorld, step, publicFrame, simulationHash } from '@prompt-chien/engine';
import { encodeReplay, verifyPublic } from '@prompt-chien/replay';
import type { Request,Response,Validation,LocalReplay,PairRow } from './protocol.js';
const scope=globalThis as unknown as {onmessage:(event:MessageEvent<Request>)=>void;postMessage:(response:Response)=>void};
const send=(value:Response)=>scope.postMessage(value);
async function validate(text:string):Promise<{bot:BotDefinition;validation:Validation}>{
  const raw=decodeJson(text);validateSchema('bot-definition',raw);const bot=raw as BotDefinition;
  const body=validateBody(bot.body,catalog),compiled=compile(bot.brain,body.modules),pack=await freezeBot(bot,catalog,contentManifest.catalogDigest,contentManifest.capabilityDigest);
  return {bot,validation:{packageHash:pack.packageHash,cost:body.cost,mass:body.mass,radius:Math.sqrt(body.radiusSquared),compiled,warnings:[]}};
}
async function run(bot:BotDefinition,opponent:BotDefinition,seed:string,swap:boolean,record:boolean):Promise<{result:NonNullable<LocalReplay['result']>;hash:string;replay:LocalReplay|null}>{
  const world=await createWorld(bot,opponent,seed,swap),frames=record?[publicFrame(world)]:[],traces:LocalReplay['owner']['traces']=[],resources:LocalReplay['owner']['resources']=record?[{energy:world.actors.A.energy,heat:world.actors.A.heat}]:[];
  while(!world.result){step(world);if(record){frames.push(publicFrame(world));traces.push(...world.traces.filter(t=>t.actor==='A').map(({actor:_,...trace})=>trace));resources.push({energy:world.actors.A.energy,heat:world.actors.A.heat});}}
  const hash=await simulationHash(world);if(!record)return {result:world.result,hash,replay:null};
  const archive=await encodeReplay(world.manifest,frames,world.result),index=await verifyPublic(archive);
  if(index.frameCount!==frames.length)throw new Error('REPLAY_FRAME_COUNT');
  return {result:world.result,hash,replay:{frames,result:world.result,manifest:world.manifest,simulationHash:hash,publicReplayHash:archive.manifest.publicReplayHash,owner:{traces,resources,compiled:world.actors.A.compiled},source:bot}};
}
let suite:ReturnType<typeof buildSuite>|undefined;
scope.onmessage=async ({data:request})=>{
  try{
    if(request.kind==='init'){send({id:request.id,kind:'init',templates:[...sampleKits],catalog:[...catalog],cards:[...sampleCards]});return;}
    let text=request.text;
    if(request.kind==='rule'){const raw=decodeJson(text);validateSchema('bot-definition',raw);const bot=raw as BotDefinition;const rule=decodeJson(request.ruleText);const state=bot.brain.states[request.state];if(!state||!state.rules[request.rule])throw new ContractError('RULE_INDEX','/brain/states');state.rules[request.rule]=rule as BotDefinition['brain']['states'][number]['rules'][number];text=JSON.stringify(bot);}
    const current=await validate(text);
    if(request.kind==='validate'||request.kind==='rule'){send({id:request.id,kind:'validate',...current});return;}
    const opponent=sampleKits[request.opponent];if(!opponent)throw new ContractError('OPPONENT','/opponent');
    if(request.kind==='practice'){const result=await run(current.bot,opponent,'00000000000000000000000000000000',false,true);send({id:request.id,kind:'match',replay:result.replay!,comparison:null});return;}
    if(![1,3,10].includes(request.count))throw new ContractError('EXPERIMENT_CAP','/count');
    const baseline=await validate(request.baseline);suite??=buildSuite();const seeds=(await suite).tuning.slice(0,request.count),rows:PairRow[]=[];let replay:LocalReplay|null=null,done=0;
    for(const {scenarioId,seed} of seeds){const row:PairRow={scenarioId,seed,baseline:0,candidate:0,legs:[]};
      for(const variant of ['baseline','candidate'] as const)for(const swap of [false,true]){
        const bot=variant==='baseline'?baseline.bot:current.bot,leg=await run(bot,opponent,seed,swap,variant==='candidate'&&replay===null);
        if(leg.replay)replay=leg.replay;row[variant]+=leg.result.winner==='A'?500:leg.result.winner==='draw'?250:0;
        row.legs.push({variant,swap,result:leg.result,simulationHash:leg.hash});send({id:request.id,kind:'progress',done:++done,total:seeds.length*4});
      }rows.push(row);
    }
    const opponentPack=await freezeBot(opponent,catalog,contentManifest.catalogDigest,contentManifest.capabilityDigest);
    send({id:request.id,kind:'match',replay:replay!,comparison:{rows,baselineHash:baseline.validation.packageHash,candidateHash:current.validation.packageHash,opponentHash:opponentPack.packageHash,seedSetDigest:await digest(seeds),engineDigest:replay!.manifest.engineDigest,rulesetDigest:contentManifest.rulesetDigest,meanDelta:rows.reduce((sum,r)=>sum+r.candidate-r.baseline,0)/rows.length/1000,confidence:null}});
  }catch(error){const diagnostic:Diagnostic=error instanceof ContractError?{code:error.code,pointer:error.pointer,message:error.message}:{code:'LOCAL_JOB_FAILED',pointer:'',message:String(error)};send({id:request.id,kind:'error',diagnostic});}
};
