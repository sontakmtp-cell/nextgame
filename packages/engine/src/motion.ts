import { ruleset } from '@prompt-chien/content';
import { axes, bodyOverlap, inWalls, projectedCells, sweepProjected } from './geometry.js';
import type { Point } from './geometry.js';
import { Q, angle, ceilDiv, clamp, integrate, mulDiv, norm, normalize, rotate } from './numeric.js';
import type { Actor, World } from './types.js';
export function torque(actor:Actor):number {
  const core=actor.modules[actor.core]!.placement;
  return actor.modules.filter(m=>m.alive&&!m.detached&&m.placement.catalogId==='thruster').reduce((sum,m)=>sum+1000+Math.min(4000,norm((m.placement.cell.x-core.cell.x-1)*1000+500,(m.placement.cell.y-core.cell.y-1)*1000+500)),0);
}
export function capabilities(actor:Actor):{vMax:number;accel:number;wMax:number} {
  const n=actor.modules.filter(m=>m.alive&&!m.detached&&m.placement.catalogId==='thruster').length,drive=Math.min(1000,Math.floor(8000*n/actor.mass));
  return {vMax:Math.floor(6000*drive/1000),accel:Math.floor(12000*drive/1000),wMax:actor.torque0?Math.floor(1024*Math.min(1000,Math.floor(torque(actor)*1000/actor.torque0))/1000):0};
}
function advanceVelocity(actor:Actor):{x:number;y:number;heading:number} {
  const {vMax,accel,wMax}=capabilities(actor),[f,s]=normalize(clamp(actor.intent.thrust.forward,-1000,1000),clamp(actor.intent.thrust.strafe,-1000,1000),1000);
  if(f===0&&s===0){actor.vx-=Math.sign(actor.vx)*Math.min(Math.abs(actor.vx),100);actor.vy-=Math.sign(actor.vy)*Math.min(Math.abs(actor.vy),100);actor.residual.accel=0;}
  else {
    const [dx,dy]=normalize(...rotate(mulDiv(vMax,f,1000),mulDiv(vMax,s,1000),actor.pose.heading),vMax);
    const [step,residual]=integrate(accel,actor.residual.accel),[ax,ay]=normalize(dx-actor.vx,dy-actor.vy,step);
    actor.vx+=ax;actor.vy+=ay;actor.residual.accel=actor.vx===dx&&actor.vy===dy?0:residual;
  }
  const target=mulDiv(wMax,clamp(actor.intent.turn,-1000,1000),1000),[step,ar]=integrate(2048,actor.residual.angular);
  actor.omega+=clamp(target-actor.omega,-step,step);actor.residual.angular=actor.omega===target?0:ar;
  const [x,xr]=integrate(actor.vx,actor.residual.x),[y,yr]=integrate(actor.vy,actor.residual.y),[heading,hr]=integrate(actor.omega,actor.residual.heading);
  actor.residual.x=xr;actor.residual.y=yr;actor.residual.heading=hr;return {x,y,heading};
}
interface Contact {time:number;nx:number;ny:number;wall:'A'|'B'|null;rotation:boolean;key:number[]}
const compareKey=(a:Contact,b:Contact):number=>a.time-b.time||a.key.reduce((out,n,i)=>out||n-b.key[i]!,0);
function contacts(a:Actor,b:Actor,da:{x:number;y:number;heading:number},db:{x:number;y:number;heading:number}):Contact[] {
  const out:Contact[]=[];
  const padA=ceilDiv(a.radius*Math.abs(da.heading)*7,4096),padB=ceilDiv(b.radius*Math.abs(db.heading)*7,4096);
  const near=norm(a.pose.x-b.pose.x,a.pose.y-b.pose.y)<=a.radius+b.radius+norm(da.x-db.x,da.y-db.y)+padA+padB,normals=near?[...axes(a.pose.heading),...axes(b.pose.heading)]:[],ca=projectedCells(a,normals),cb=projectedCells(b,normals),speeds=normals.map(axis=>BigInt(da.x-db.x)*BigInt(axis.x)+BigInt(da.y-db.y)*BigInt(axis.y));
  if(near){
    for(const ac of ca)for(const bc of cb){
      const x=ac.cell,y=bc.cell,hit=sweepProjected(ac.ranges,bc.ranges,normals,speeds,padA+padB,{x:a.pose.x-b.pose.x,y:a.pose.y-b.pose.y});if(!hit)continue;
      const approach=BigInt(da.x-db.x)*BigInt(hit.nx)+BigInt(da.y-db.y)*BigInt(hit.ny);
      if(hit.time===0&&approach>=0n&&!padA&&!padB)continue;
      // Absolute pair geometry is unchanged by a whole-world half turn or actor relabel.
      out.push({...hit,wall:null,rotation:!!(padA+padB),key:[Math.min(x.module,y.module),Math.max(x.module,y.module),Math.abs(x.x+y.x),Math.abs(x.y+y.y)]});}
  }
  for(const [actor,delta,cs,pad] of [[a,da,ca,padA],[b,db,cb,padB]] as const){
    for(const {cell,points} of cs)for(const p of points)for(const [coordinate,change,limit,nx,ny] of [[p.x,delta.x,20000,-Q,0],[p.y,delta.y,14000,0,-Q]] as const){
      for(const side of [-1,1]){const distance=limit-side*coordinate-pad,speed=side*change;
        if(speed<=0&&distance>=0)continue;
        const time=distance<=0?0:mulDiv(distance,Q,speed);
        if(time>=0&&time<=Q)out.push({time,nx:nx*side,ny:ny*side,wall:actor.id,rotation:!!pad,key:[cell.module,Math.abs(p.x),Math.abs(p.y),Math.abs(nx)]});}
    }
  }
  return out.sort(compareKey);
}
function respond(a:Actor,b:Actor,contact:Contact):void {
  const {nx,ny}=contact;
  if(contact.wall){const actor=contact.wall===a.id?a:b,normal=Number((BigInt(actor.vx)*BigInt(nx)+BigInt(actor.vy)*BigInt(ny))/BigInt(Q));
    if(normal<0){actor.vx-=mulDiv(normal,nx,Q);actor.vy-=mulDiv(normal,ny,Q);}if(contact.rotation)actor.omega=0;return;}
  const relative=Number((BigInt(a.vx-b.vx)*BigInt(nx)+BigInt(a.vy-b.vy)*BigInt(ny))/BigInt(Q));
  if(relative<0){
    const impulse=-relative,total=a.mass+b.mass;
    let ca=mulDiv(impulse,b.mass,total),cb=mulDiv(impulse,a.mass,total);
    // Fractional impulse remainder goes by geometric pose key, never actor label.
    const geoA=[Math.abs(a.pose.x),Math.abs(a.pose.y),a.pose.heading%2048],geoB=[Math.abs(b.pose.x),Math.abs(b.pose.y),b.pose.heading%2048];
    const order=geoA.reduce((out,n,i)=>out||n-geoB[i]!,0),remainder=impulse-ca-cb;
    if(order<0)ca+=remainder;else if(order>0)cb+=remainder;
    a.vx+=mulDiv(ca,nx,Q);a.vy+=mulDiv(ca,ny,Q);b.vx-=mulDiv(cb,nx,Q);b.vy-=mulDiv(cb,ny,Q);
  }
  if(contact.rotation){a.omega=0;b.omega=0;}
}
/** Four fixed solver passes; a conservative rotational hit may stop rotation early (D17). */
// ponytail: rotation inflation stops early near contact; use bounded curved conservative advancement if playtests expose sticking.
export function move(world:World):void {
  const a=world.actors.A,b=world.actors.B,oldA={...a.pose},oldB={...b.pose};
  let da=advanceVelocity(a),db=advanceVelocity(b),remaining=Q;
  let exhausted=false;
  for(let iteration=0;iteration<ruleset.movement.solverIterations;iteration++){
    const list=contacts(a,b,da,db),hit=list[0];
    if(!hit){a.pose={x:a.pose.x+da.x,y:a.pose.y+da.y,heading:angle(a.pose.heading+da.heading)};b.pose={x:b.pose.x+db.x,y:b.pose.y+db.y,heading:angle(b.pose.heading+db.heading)};remaining=0;break;}
    const time=Math.max(0,hit.time-1);
    for(const [actor,delta] of [[a,da],[b,db]] as const)actor.pose={x:actor.pose.x+mulDiv(delta.x,time,Q),y:actor.pose.y+mulDiv(delta.y,time,Q),heading:angle(actor.pose.heading+mulDiv(delta.heading,time,Q))};
    for(const contact of list.filter(c=>c.time===hit.time))respond(a,b,contact);
    remaining=mulDiv(remaining,Q-time,Q);
    da={x:mulDiv(a.vx,remaining,60*Q),y:mulDiv(a.vy,remaining,60*Q),heading:mulDiv(a.omega,remaining,60*Q)};
    db={x:mulDiv(b.vx,remaining,60*Q),y:mulDiv(b.vy,remaining,60*Q),heading:mulDiv(b.omega,remaining,60*Q)};
    if(!da.x&&!da.y&&!da.heading&&!db.x&&!db.y&&!db.heading){remaining=0;break;}
    exhausted=iteration===3;
  }
  if(bodyOverlap(a,b)||!inWalls(a)||!inWalls(b)){
    a.pose=oldA;b.pose=oldB;a.vx=a.vy=a.omega=b.vx=b.vy=b.omega=0;exhausted=true;
  }
  if(exhausted){world.events.push({tick:world.tick,kind:'collisionFallback',actor:'world',module:0,target:0,value:4,key:0});}
}
/** Numeric fixture helper for SAT normals; exported for debug cells rather than renderer physics. */
export const cellAxes=axes;
export type MotionPoint=Point;
