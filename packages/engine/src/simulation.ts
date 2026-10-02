import { digest } from '@prompt-chien/contracts';
import type { MatchResult } from '@prompt-chien/contracts';
import { decide, heldIntent } from '@prompt-chien/brain';
import { allocate, collectWeapons, applyDamage, destruction, emit, resources } from './combat.js';
import { move, capabilities } from './motion.js';
import { bearing, clamp, norm, rotate, signedAngle } from './numeric.js';
import { checkpoint, checkpointState, publicFrame } from './world.js';
import type { Actor, RecordedMatch, World } from './types.js';
const ids=['A','B'] as const;
export function observation(world:World,a:Actor):Map<string,number> {
  const b=world.actors[a.id==='A'?'B':'A'],core=a.modules[a.core]!,otherCore=b.modules[b.core]!,dx=b.pose.x-a.pose.x,dy=b.pose.y-a.pose.y;
  const nearest=world.projectiles.filter(p=>p.owner!==a.id).map(p=>({p,distance:norm(p.x-a.pose.x,p.y-a.pose.y)})).sort((x,y)=>x.distance-y.distance||x.p.ordinal-y.p.ordinal)[0];
  const p=nearest?.p,centerDistance=norm(a.pose.x,a.pose.y),distance=norm(dx,dy),pv=p?rotate(18000,0,p.heading):[0,0];
  const map=new Map<string,number>(Object.entries({
    'clock.tick':world.tick,'clock.decision':a.vm.decision,'clock.stateAge':a.vm.stateAge,'self.energy':a.energy,'self.heat':a.heat,'self.coreHpPermille':Math.floor(core.hp*1000/core.initialHp),'self.overheated':Number(a.overheated),'self.speed':norm(a.vx,a.vy),'self.x':a.pose.x,'self.y':a.pose.y,'self.heading':a.pose.heading,
    'enemy.distance':distance,'enemy.bearing':distance?signedAngle(bearing(dx,dy)-a.pose.heading):0,'enemy.speed':norm(b.vx,b.vy),'enemy.heading':b.pose.heading,'enemy.coreHpPermille':Math.floor(otherCore.hp*1000/otherCore.initialHp),'enemy.telegraph':Number(b.modules.some(m=>m.alive&&!m.detached&&m.phase==='windup')),
    'arena.centerBearing':centerDistance?signedAngle(bearing(-a.pose.x,-a.pose.y)-a.pose.heading):0,'arena.centerDistance':centerDistance,'arena.controlOwner':world.controlOwner==='neutral'?0:world.controlOwner===a.id?1:-1,'arena.ringRadius':world.ringRadius,'self.outsideRing':Number(BigInt(a.pose.x)**2n+BigInt(a.pose.y)**2n>BigInt(world.ringRadius)**2n),
    'projectile.present':Number(!!p),'projectile.distance':nearest?.distance??0,'projectile.bearing':p?signedAngle(bearing(p.x-a.pose.x,p.y-a.pose.y)-a.pose.heading):0,
    'projectile.closingSpeed':p&&nearest!.distance?clamp(-Number((BigInt(p.x-a.pose.x)*BigInt(pv[0]!-a.vx)+BigInt(p.y-a.pose.y)*BigInt(pv[1]!-a.vy))/BigInt(nearest!.distance)),-2147483648,2147483647):0
  }));
  for(const m of a.modules){const alive=m.alive&&!m.detached;map.set(`self.moduleAlive.m${m.ordinal}`,Number(alive));map.set(`self.weaponReady.m${m.ordinal}`,Number(alive&&!a.overheated&&m.phase==='idle'&&(['blade','burst'].includes(m.placement.catalogId))));}
  return map;
}
export function scores(world:World):{A:number;B:number} {
  const score=(a:Actor,b:Actor):number=>5*Math.min(1000,Math.floor(a.controlTicks*1000/4800))+3*Math.min(1000,Math.floor(a.damage*1000/b.initialTotalHp))+2*Math.floor(a.modules[a.core]!.hp*1000/a.modules[a.core]!.initialHp);
  return {A:score(world.actors.A,world.actors.B),B:score(world.actors.B,world.actors.A)};
}
export function objective(world:World):void {
  const a=world.actors.A,b=world.actors.B,inside=(actor:Actor)=>BigInt(actor.pose.x)**2n+BigInt(actor.pose.y)**2n<=9000000n;
  world.controlOwner=inside(a)!==inside(b)?inside(a)?'A':'B':'neutral';
  if(world.tick>=600&&world.controlOwner!=='neutral')world.actors[world.controlOwner].controlTicks++;
  if(world.tick===3480)emit(world,'ringNotice','world');
  if(world.tick>=3600){world.ringRadius=25000-Math.floor(19000*(world.tick-3600)/1800);
    for(const id of ids){const actor=world.actors[id],core=actor.modules[actor.core]!;
      if(BigInt(actor.pose.x)**2n+BigInt(actor.pose.y)**2n>BigInt(world.ringRadius)**2n){actor.ringRemainder+=core.initialHp*50;const loss=Math.min(core.hp,Math.floor(actor.ringRemainder/60000));actor.ringRemainder%=60000;core.hp-=loss;if(loss)emit(world,'ringDamage',id,core.ordinal,core.ordinal,loss);}
      else actor.ringRemainder=0;
    }
  }
  const ahp=a.modules[a.core]!.hp,bhp=b.modules[b.core]!.hp;
  let result:Pick<MatchResult,'winner'|'cause'>|null=null;
  if(ahp===0||bhp===0)result={winner:ahp===0&&bhp===0?'draw':ahp===0?'B':'A',cause:ahp===0&&bhp===0?'coreDouble':'core'};
  else if(a.vm.faultStreak>=10||b.vm.faultStreak>=10)result={winner:a.vm.faultStreak>=10&&b.vm.faultStreak>=10?'draw':a.vm.faultStreak>=10?'B':'A',cause:'brainBudget'};
  else if(world.tick+1===5400){const value=scores(world);result={winner:Math.abs(value.A-value.B)<=100?'draw':value.A>value.B?'A':'B',cause:'timeout'};}
  if(result){world.result={...result,elapsedTicks:world.tick+1,scores:scores(world)};emit(world,'result','world',0,0,result.winner==='draw'?0:result.winner==='A'?1:2);}
}
export function step(world:World):void {
  if(world.result||world.tick>=5400)throw new Error('MATCH_TERMINAL');
  world.events=[];world.traces=[];resources(world);if(world.tick>=3600)world.ringRadius=25000-Math.floor(19000*(world.tick-3600)/1800);
  const observations={A:observation(world,world.actors.A),B:observation(world,world.actors.B)};
  for(const id of ids){const a=world.actors[id];
    if(world.tick%6===0){const previous=a.vm.stateId,d=decide(a.compiled,a.vm,observations[id],a.modules.map(m=>m.placement));a.vm=d.state;a.intent=d.intent;
      world.traces.push({tick:world.tick,actor:id,stateId:previous,ruleId:d.ruleId,gas:d.gas,fault:d.fault,observationsUsed:d.observationsUsed,varDiff:d.varDiff,intent:structuredClone(d.intent),rejections:d.rejections.map(r=>r.code)});
    }else a.intent=heldIntent(a.vm);
  }
  for(const id of ids){const a=world.actors[id],rejections=allocate(world,a,a.intent);world.traces.find(t=>t.actor===id)?.rejections.push(...rejections);}
  const before={A:{...world.actors.A.pose},B:{...world.actors.B.pose}};
  move(world);const hits=collectWeapons(world,before);applyDamage(world,hits);destruction(world);objective(world);
  // Ring death is simultaneous and belongs to the same commit; public status must match terminal HP.
  if(ids.some(id=>world.actors[id].modules[world.actors[id].core]!.hp===0))destruction(world);
  world.events.sort((a,b)=>a.key-b.key||a.module-b.module||a.target-b.target||(a.kind<b.kind?-1:a.kind>b.kind?1:0)||(a.actor<b.actor?-1:a.actor>b.actor?1:0));
  world.tick++;if(world.tick===5400)world.ringRadius=6000;
}
export async function simulationHash(world:World):Promise<string> {
  const saved=checkpointState(checkpoint(world));
  // Immutable Body/Brain code is already bound by packageHashes, diagnostics stay outside gameplay identity.
  for(const id of ids)saved.actors[id].intent={...saved.actors[id].intent,modules:[]};
  return digest(saved);
}
export async function simulate(world:World):Promise<RecordedMatch> {
  const frames=[publicFrame(world)],checkpoints=[checkpoint(world)],traces:RecordedMatch['traces']=[];
  let traceHash=await digest({manifest:world.manifest});
  while(!world.result){step(world);frames.push(publicFrame(world));
    traces.push(...world.traces);if(world.tick%60===0||world.result)checkpoints.push(checkpoint(world));
    for(const trace of world.traces)traceHash=await digest({previous:traceHash,trace});
  }
  return {manifest:world.manifest,frames,checkpoints,traces,result:world.result,simulationHash:await simulationHash(world),privateTraceHash:traceHash};
}
/** Quick headless path avoids replay allocations for seed/performance runs. */
export function finish(world:World):World {while(!world.result)step(world);return world;}
export { capabilities };
