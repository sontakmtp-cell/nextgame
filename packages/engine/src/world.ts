import { ContractError, digest, validateBody, validateSchema } from '@prompt-chien/contracts';
import type { BotDefinition, MatchManifest, Pose, PublicFrame } from '@prompt-chien/contracts';
import { compile, freezeBot, initialVM } from '@prompt-chien/brain';
import { catalog, contentManifest, ruleset, scenarioForSeed } from '@prompt-chien/content';
import { ENGINE_DIGEST } from './identity.js';
import { angle, bearing, isqrt } from './numeric.js';
import { torque } from './motion.js';
import type { Actor, Checkpoint, CheckpointActor, World } from './types.js';
function immutable(value:unknown):void {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))immutable(child);}
}
export async function createWorld(botA:BotDefinition,botB:BotDefinition,seed='00000000000000000000000000000000',swapped=false):Promise<World> {
  const actors={} as {A:Actor;B:Actor};
  const packages=await Promise.all([botA,botB].map(bot=>freezeBot(bot,catalog,contentManifest.catalogDigest,contentManifest.capabilityDigest)));
  const {scenarioId,presetValues}=await scenarioForSeed(seed),{yLeft,yRight,jitterLeft,jitterRight}=presetValues;
  const poses:{left:Pose;right:Pose}={left:{x:-12000,y:yLeft,heading:angle(bearing(24000,yRight-yLeft)+jitterLeft)},right:{x:12000,y:yRight,heading:angle(bearing(-24000,yLeft-yRight)+jitterRight)}};
  for(const [id,bot,slot] of [['A',botA,swapped?'right':'left'],['B',botB,swapped?'left':'right']] as const){
    const {modules,mass,radiusSquared}=validateBody(bot.body,catalog),compiled=compile(bot.brain,modules);immutable(compiled);
    const state:Actor={id,pose:{...poses[slot]},vx:0,vy:0,omega:0,residual:{x:0,y:0,heading:0,accel:0,angular:0},mass,radius:Number(isqrt(BigInt(radiusSquared)))+(Number(isqrt(BigInt(radiusSquared)))**2<radiusSquared?1:0),torque0:0,initialTotalHp:0,core:modules.findIndex(m=>m.catalogId==='core'),modules:modules.map((placement,ordinal)=>{
      const entry=catalog.find(c=>c.id===placement.catalogId)!;
      return {placement:{...placement,id:`m${ordinal}`,cell:{...placement.cell}},ordinal,hp:entry.hp,initialHp:entry.hp,alive:true,detached:false,phase:'idle',offset:0,aim:0,attack:0,hit:false,shield:false,shieldLock:0};}),compiled,vm:initialVM(compiled),energy:1000,heat:0,overheated:false,damage:0,controlTicks:0,ringRemainder:0,intent:{thrust:{forward:0,strafe:0},turn:0,modules:[]}};
    state.energy+=state.modules.filter(m=>m.placement.catalogId==='capacitor').length*250;state.torque0=torque(state);state.initialTotalHp=state.modules.reduce((sum,m)=>sum+m.hp,0);actors[id]=state;
  }
  const manifest:MatchManifest={engineDigest:ENGINE_DIGEST,rulesetDigest:contentManifest.rulesetDigest,catalogDigest:contentManifest.catalogDigest,compilerDigest:contentManifest.compilerDigest,brainAbiVersion:'2.0',packageHashes:{A:packages[0]!.packageHash,B:packages[1]!.packageHash},seed,arenaDigest:await digest(ruleset.arena),arenaInitDigest:contentManifest.arenaInitDigest,scenarioId,presetValues,spawnSlotAssignment:{A:swapped?'right':'left',B:swapped?'left':'right'},maxTicks:5400,numericalAbiVersion:'milli-v1'};
  validateSchema('match',manifest);
  return {manifest,tick:0,actors,projectiles:[],nextProjectile:0,nextAttack:0,events:[],traces:[],controlOwner:'neutral',ringRadius:25000,result:null};
}
export async function assertBinding(manifest:MatchManifest,a:BotDefinition,b:BotDefinition):Promise<void> {
  validateSchema('match',manifest);
  const expected=(await createWorld(a,b,manifest.seed,manifest.spawnSlotAssignment.A==='right')).manifest;
  if(await digest(expected)!==await digest(manifest))throw new ContractError('MATCH_BINDING','/match');
}
export function publicFrame(world:World):PublicFrame {
  const project=(a:Actor)=>({pose:{...a.pose},overheated:a.overheated,controlTicks:a.controlTicks,modules:a.modules.map(m=>({ordinal:m.ordinal,catalogId:m.placement.catalogId,x:m.placement.cell.x,y:m.placement.cell.y,orientation:m.placement.orientation,hp:m.hp,status:m.detached?'detached' as const:m.alive?'alive' as const:'destroyed' as const,phase:m.phase,phaseOffset:m.offset,shield:m.shield,aim:m.aim}))});
  return {boundary:world.tick,actors:{A:project(world.actors.A),B:project(world.actors.B)},projectiles:world.projectiles.map(p=>({ordinal:p.ordinal,owner:p.owner,x:p.x,y:p.y,heading:p.heading})),controlOwner:world.controlOwner,ringRadius:world.ringRadius,events:world.events.map(e=>({...e}))};
}
export function checkpoint(world:World):Checkpoint {
  const actor=(a:Actor):CheckpointActor=>({...a,vm:{...a.vm,variables:[...a.vm.variables.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0)}});
  // Snapshot every mutable field; no alias back to the running world.
  const copy=structuredClone({...world,actors:{A:{...actor(world.actors.A),compiled:null},B:{...actor(world.actors.B),compiled:null}},traces:[]});
  return {...copy,actors:{A:{...copy.actors.A,compiled:world.actors.A.compiled},B:{...copy.actors.B,compiled:world.actors.B.compiled}}};
}
/** Immutable code is bound by MatchManifest package/compiler hashes, stored once in private inputs. */
export function checkpointState(saved:Checkpoint) {
  const actor=(a:CheckpointActor)=>{const {compiled,...state}=a;return state;};
  return {...saved,actors:{A:actor(saved.actors.A),B:actor(saved.actors.B)},traces:[]};
}
export function restore(saved:Checkpoint):World {
  const copy=structuredClone(checkpointState(saved)),actor=(a:typeof copy.actors.A,compiled:Actor['compiled']):Actor=>({...a,compiled,vm:{...a.vm,variables:new Map(a.vm.variables)}});
  return {...copy,actors:{A:actor(copy.actors.A,saved.actors.A.compiled),B:actor(copy.actors.B,saved.actors.B.compiled)}};
}
