import { ruleset } from '@prompt-chien/content';
import type { CombatEvent, ControlIntent, Pose } from '@prompt-chien/contracts';
import { cells, corners, moduleCenter, muzzle, segmentCell } from './geometry.js';
import type { Point } from './geometry.js';
import { Q, angle, bearing, ceilDiv, integrate, mulDiv, norm, rotate, signedAngle } from './numeric.js';
import type { Actor, ActorId, HitPacket, ModuleState, World } from './types.js';
const ids=['A','B'] as const;
const enemy=(id:ActorId):ActorId=>id==='A'?'B':'A';
export function emit(world:World,kind:CombatEvent['kind'],actor:ActorId|'world',module=0,target=0,value=0,key=0):void {
  if(world.events.length>=256)throw new Error('EVENT_CAP: infraFailure');
  world.events.push({tick:world.tick,kind,actor,module,target,value,key});
}
const live=(m:ModuleState):boolean=>m.alive&&!m.detached;
export const energyCapacity=(a:Actor):number=>1000+250*a.modules.filter(m=>live(m)&&m.placement.catalogId==='capacitor').length;
function shieldOff(w:World,a:Actor,m:ModuleState):void {if(m.shield){m.shield=false;m.shieldLock=30;emit(w,'shieldOff',a.id,m.ordinal);}}
function checkHeat(w:World,a:Actor):void {
  a.heat=Math.min(1000,a.heat);
  if(a.heat>=1000&&!a.overheated){a.overheated=true;emit(w,'overheated',a.id);for(const m of a.modules)shieldOff(w,a,m);}
}
export function resources(world:World):void {
  for(const id of ids){const a=world.actors[id];a.energy=Math.min(energyCapacity(a),a.energy+2);a.heat=Math.max(0,a.heat-1-a.modules.filter(m=>live(m)&&m.placement.catalogId==='radiator').length);
    if(a.overheated&&a.heat<=600){a.overheated=false;emit(world,'cooled',id);}
    for(const m of a.modules)if(m.shieldLock)m.shieldLock--;
  }
}
export function allocate(world:World,a:Actor,intent:ControlIntent):string[] {
  const rejections:string[]=[];
  const reject=(ordinal:number,reason:string):void=>{rejections.push(`${ordinal}:${reason}`);};
  for(const event of [...intent.modules].sort((x,y)=>x.priority-y.priority||x.moduleOrdinal-y.moduleOrdinal)){
    const m=a.modules[event.moduleOrdinal];if(!m||!live(m)){reject(event.moduleOrdinal,'unavailable');continue;}
    if(event.action==='shieldOff'){if(m.placement.catalogId==='shield')shieldOff(world,a,m);else reject(m.ordinal,'notShield');continue;}
    if(a.overheated){reject(m.ordinal,'overheated');continue;}
    if(event.action==='shieldOn'){
      if(m.placement.catalogId!=='shield'||m.shield||m.shieldLock){reject(m.ordinal,'shieldUnavailable');continue;}
      if(a.energy<40){reject(m.ordinal,'energy');continue;}
      a.energy-=40;a.heat+=20;m.shield=true;emit(world,'shieldOn',a.id,m.ordinal);checkHeat(world,a);continue;
    }
    if(event.action!=='activate')continue;
    const kind=m.placement.catalogId;if((kind!=='blade'&&kind!=='burst')||m.phase!=='idle'){reject(m.ordinal,'weaponUnavailable');continue;}
    const stats=ruleset.weapons[kind];if(a.energy<stats.energy){reject(m.ordinal,'energy');continue;}
    if(kind==='blade'&&event.aimOffset!==0){reject(m.ordinal,'aim');continue;}
    a.energy-=stats.energy;a.heat+=stats.heat;m.phase='windup';m.offset=0;m.aim=event.aimOffset;m.attack=world.nextAttack++;m.hit=false;
    emit(world,'activation',a.id,m.ordinal,0,stats.windup,m.attack);checkHeat(world,a);
  }
  for(const m of a.modules)if(m.shield){if(!live(m)||a.overheated||a.energy<1)shieldOff(world,a,m);else a.energy--;}
  return rejections;
}
function clip(points:Point[],normal:Point):Point[] {
  const out:Point[]=[],dot=(p:Point)=>BigInt(p.x)*BigInt(normal.x)+BigInt(p.y)*BigInt(normal.y);
  for(let i=0;i<points.length;i++){const p=points[i]!,q=points[(i+1)%points.length]!,dp=dot(p),dq=dot(q);
    if(dp>=0n)out.push(p);
    if((dp<0n)!==(dq<0n)){const d=dp-dq;out.push({x:p.x+Number(BigInt(q.x-p.x)*dp/d),y:p.y+Number(BigInt(q.y-p.y)*dp/d)});}
  }return out;
}
/** Convex cell clipped by a 90-degree wedge, then exact integer segment-circle distance. */
export function sectorCell(origin:Point,heading:number,reach:number,polygon:Point[]):boolean {
  let points=polygon.map(p=>{const [x,y]=rotate(p.x-origin.x,p.y-origin.y,-heading);return {x,y};});
  points=clip(clip(points,{x:1,y:1}),{x:1,y:-1});if(!points.length)return false;
  const radius=BigInt(reach)**2n;
  if(points.some(p=>BigInt(p.x)**2n+BigInt(p.y)**2n<=radius))return true;
  for(let i=0;i<points.length;i++){
    const p=points[i]!,q=points[(i+1)%points.length]!,dx=BigInt(q.x-p.x),dy=BigInt(q.y-p.y),length=dx*dx+dy*dy,dot=-BigInt(p.x)*dx-BigInt(p.y)*dy;
    if(length&&dot>=0n&&dot<=length){const cross=BigInt(p.x)*dy-BigInt(p.y)*dx;if(cross*cross<=radius*length)return true;}
  }return false;
}
function interpolate(start:Pose,end:Pose,time:number):Pose {return {x:start.x+mulDiv(end.x-start.x,time,Q),y:start.y+mulDiv(end.y-start.y,time,Q),heading:angle(start.heading+mulDiv(signedAngle(end.heading-start.heading),time,Q))};}
// ponytail: milli-lattice TOI can miss sub-milli grazing; replace with analytic/conservative curved TOI if that ceiling matters.
function bladeTarget(a:Actor,b:Actor,m:ModuleState,before:Record<ActorId,Pose>|undefined):{module:number;origin:Point}|null {
  const startA=before?.[a.id]??a.pose,startB=before?.[b.id]??b.pose,endA=a.pose,endB=b.pose;
  if(norm(a.pose.x-b.pose.x,a.pose.y-b.pose.y)>a.radius+b.radius+1500+norm(endA.x-startA.x,endA.y-startA.y)+norm(endB.x-startB.x,endB.y-startB.y))return null;
  const steps=Math.max(1,norm(endA.x-startA.x,endA.y-startA.y)+norm(endB.x-startB.x,endB.y-startB.y)+ceilDiv((a.radius+b.radius)*Math.max(Math.abs(signedAngle(endA.heading-startA.heading)),Math.abs(signedAngle(endB.heading-startB.heading)))*7,4096));
  if(steps>1024)throw new Error('MELEE_MOTION_BOUND: infraFailure');
  const targets=cells(b);
  for(let sample=0;sample<=steps;sample++){
    const time=mulDiv(sample,Q,steps),pa=interpolate(startA,endA,time),pb=interpolate(startB,endB,time),aa={...a,pose:pa},shot=muzzle(aa,m),bb={...b,pose:pb};
    const hits=targets.filter(c=>sectorCell(shot.point,shot.heading,1500,corners(c,pb))).map(c=>{const center=moduleCenter(bb,b.modules[c.module]!);return {module:c.module,distance:norm(center.x-shot.point.x,center.y-shot.point.y)};}).sort((x,y)=>x.distance-y.distance||x.module-y.module);
    if(hits[0])return {module:hits[0].module,origin:shot.point};
  }return null;
}
export function collectWeapons(world:World,before?:Record<ActorId,Pose>):HitPacket[] {
  const hits:HitPacket[]=[];
  for(const id of ids){const a=world.actors[id],b=world.actors[enemy(id)];
    for(const m of a.modules){if(!live(m)||(m.placement.catalogId!=='blade'&&m.placement.catalogId!=='burst'))continue;
      const stats=ruleset.weapons[m.placement.catalogId];
      if(m.phase==='active'){
        const shot=muzzle(a,m);
        if(m.placement.catalogId==='burst'&&([0,4,8] as number[]).includes(m.offset)){
          if(world.projectiles.length>=128)throw new Error('PROJECTILE_CAP: infraFailure');
          const p={ordinal:world.nextProjectile++,owner:id,weapon:m.ordinal,attack:m.attack,x:shot.point.x,y:shot.point.y,heading:shot.heading,remaining:12000,born:world.tick,residual:{x:0,y:0},origin:{...shot.point}};
          world.projectiles.push(p);emit(world,'shot',id,m.ordinal,0,p.ordinal,m.attack);
        }
        if(m.placement.catalogId==='blade'&&!m.hit){
          const hit=bladeTarget(a,b,m,before);
          if(hit){m.hit=true;hits.push({key:m.attack*16384+16383,source:id,target:b.id,module:hit.module,raw:90,origin:hit.origin,attack:m.attack});}
        }
      }
      if(m.phase!=='idle'){
        m.offset++;
        const duration=m.phase==='windup'?stats.windup:m.phase==='active'?stats.active:stats.recovery;
        if(m.offset>=duration){m.phase=m.phase==='windup'?'active':m.phase==='active'?'recovery':'idle';m.offset=0;}
      }
    }
  }
  const survivors:World['projectiles']=[];
  for(const p of world.projectiles){const owner=world.actors[p.owner],target=world.actors[enemy(p.owner)],start={x:p.x,y:p.y},[vx,vy]=rotate(18000,0,p.heading),[dx,rx]=integrate(vx,p.residual.x),[dy,ry]=integrate(vy,p.residual.y),end={x:p.x+dx,y:p.y+dy};
    const travel=norm(dx,dy);if(travel>p.remaining){const fraction=mulDiv(p.remaining,Q,travel);end.x=p.x+mulDiv(dx,fraction,Q);end.y=p.y+mulDiv(dy,fraction,Q);}
    const candidates:{time:number;self:boolean;module:number}[]=[];
    for(const [actor,self] of [[owner,true],[target,false]] as const)for(const cell of cells(actor)){
      if(self&&cell.module===p.weapon)continue;
      const previous=p.born===world.tick?actor.pose:before?.[actor.id]??actor.pose,relativeEnd={x:end.x-(actor.pose.x-previous.x),y:end.y-(actor.pose.y-previous.y)},pad=ceilDiv(actor.radius*Math.abs(signedAngle(actor.pose.heading-previous.heading))*7,4096);
      const time=segmentCell(start,relativeEnd,cell,previous,pad);if(time!==null)candidates.push({time,self,module:cell.module});}
    candidates.sort((x,y)=>x.time-y.time||Number(y.self)-Number(x.self)||x.module-y.module);
    const hit=candidates[0];
    if(hit){if(!hit.self)hits.push({key:p.attack*16384+p.ordinal,source:p.owner,target:target.id,module:hit.module,raw:32,origin:p.origin,attack:p.attack});else emit(world,'blocked',p.owner,p.weapon,hit.module,0,p.ordinal);continue;}
    p.x=end.x;p.y=end.y;p.remaining-=Math.min(travel,p.remaining);p.residual={x:rx,y:ry};
    if(p.remaining>0&&Math.abs(p.x)<=20000&&Math.abs(p.y)<=14000)survivors.push(p);
  }
  world.projectiles=survivors;return hits;
}
export function largestRemainder(total:number,weights:number[],keys:number[]):number[] {
  const sum=weights.reduce((a,b)=>a+b,0);if(!sum)return weights.map(()=>0);
  const parts=weights.map(w=>mulDiv(total,w,sum)),order=weights.map((w,i)=>({i,remainder:BigInt(total)*BigInt(w)%BigInt(sum),key:keys[i]!})).sort((a,b)=>a.remainder>b.remainder?-1:a.remainder<b.remainder?1:a.key-b.key);
  let left=total-parts.reduce((a,b)=>a+b,0);for(const row of order){if(!left--)break;parts[row.i]=parts[row.i]!+1;}return parts;
}
function covered(a:Actor,shield:ModuleState,p:HitPacket):boolean {
  const radius=a.radius+250,dx=p.origin.x-a.pose.x,dy=p.origin.y-a.pose.y;
  if(BigInt(dx)**2n+BigInt(dy)**2n<=BigInt(radius)**2n)return false;
  const center=moduleCenter(a,a.modules[p.module]!);
  if(norm(center.x-a.pose.x,center.y-a.pose.y)>radius)return false;
  return Math.abs(signedAngle(bearing(dx,dy)-a.pose.heading-shield.placement.orientation*1024))<=512;
}
export function applyDamage(world:World,packets:HitPacket[]):void {
  for(const id of ids){const a=world.actors[id],incoming=packets.filter(p=>p.target===id).sort((p,q)=>p.key-q.key),blocked=incoming.map(()=>0),shield=a.modules.find(m=>live(m)&&m.shield);
    if(shield){const indices=incoming.map((p,i)=>covered(a,shield,p)?i:-1).filter(i=>i>=0),weights=indices.map(i=>incoming[i]!.raw),raw=weights.reduce((a,b)=>a+b,0),amount=Math.min(Math.floor(raw*700/1000),2*a.energy),parts=largestRemainder(amount,weights,indices.map(i=>incoming[i]!.key));
      a.energy-=ceilDiv(amount,2);indices.forEach((index,i)=>{blocked[index]=parts[i]!;if(parts[i])emit(world,'blocked',id,shield.ordinal,incoming[index]!.module,parts[i]!,incoming[index]!.key);});}
    const damage=incoming.map((p,i)=>Math.floor((p.raw-blocked[i]!)*(a.modules[p.module]!.placement.catalogId==='armor'?700:1000)/1000));
    for(const m of a.modules){const indices=incoming.map((p,i)=>p.module===m.ordinal?i:-1).filter(i=>i>=0);if(!indices.length)continue;
      const amount=Math.min(m.hp,indices.reduce((sum,i)=>sum+damage[i]!,0)),parts=largestRemainder(amount,indices.map(i=>damage[i]!),indices.map(i=>incoming[i]!.key));m.hp-=amount;
      indices.forEach((index,i)=>{const p=incoming[index]!;world.actors[p.source].damage+=parts[i]!;emit(world,'hit',p.source,p.module,m.ordinal,parts[i]!,p.attack);});
    }
  }
}
export function destruction(world:World):void {
  for(const id of ids){const a=world.actors[id];
    for(const m of a.modules)if(m.alive&&m.hp<=0){m.hp=0;m.alive=false;m.phase='idle';shieldOff(world,a,m);emit(world,'destroyed',id,m.ordinal);}
    const occupied=new Map<string,number>();for(const cell of cells(a))occupied.set(`${cell.x},${cell.y}`,cell.module);
    const queue=a.modules[a.core]!.alive?['-1000,-1000']:[],seen=new Set(queue),connected=new Set<number>();
    for(let i=0;i<queue.length;i++){const key=queue[i]!,ordinal=occupied.get(key);if(ordinal===undefined)continue;connected.add(ordinal);const [x,y]=key.split(',').map(Number) as [number,number];
      for(const [dx,dy] of [[1000,0],[-1000,0],[0,1000],[0,-1000]] as const){const next=`${x+dx},${y+dy}`;if(occupied.has(next)&&!seen.has(next)){seen.add(next);queue.push(next);}}}
    for(const m of a.modules)if(m.alive&&!m.detached&&!connected.has(m.ordinal)){m.detached=true;m.phase='idle';shieldOff(world,a,m);emit(world,'detached',id,m.ordinal);}
    a.energy=Math.min(a.energy,energyCapacity(a));checkHeat(world,a);
  }
}
