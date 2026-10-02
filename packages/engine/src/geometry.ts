import type { Pose } from '@prompt-chien/contracts';
import { COS, SIN } from '@prompt-chien/content';
import { Q, angle, mulDiv, norm, rotate } from './numeric.js';
import type { Actor, ModuleState } from './types.js';
export interface Cell { module:number;x:number;y:number }
export interface Point {x:number;y:number}
export interface Sweep {time:number;nx:number;ny:number}
export function cells(actor:Actor):Cell[] {
  const core=actor.modules[actor.core]!.placement,rows:Cell[]=[];
  for(const m of actor.modules)if(m.alive&&!m.detached){const size=m.placement.catalogId==='core'?2:1;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++)rows.push({module:m.ordinal,x:(m.placement.cell.x+x-core.cell.x-1)*1000,y:(m.placement.cell.y+y-core.cell.y-1)*1000});}
  return rows;
}
export function corners(cell:Cell,pose:Pose):Point[] {
  return [[0,0],[1000,0],[1000,1000],[0,1000]].map(([dx,dy])=>{const [x,y]=rotate(cell.x+dx!,cell.y+dy!,pose.heading);return {x:x+pose.x,y:y+pose.y};});
}
export function axes(heading:number):Point[] {const h=angle(heading);return [{x:COS[h]!,y:SIN[h]!},{x:-SIN[h]!,y:COS[h]!}];}
function project(points:Point[],axis:Point):[bigint,bigint] {const values=points.map(p=>BigInt(p.x)*BigInt(axis.x)+BigInt(p.y)*BigInt(axis.y));return [values.reduce((a,b)=>a<b?a:b),values.reduce((a,b)=>a>b?a:b)];}
export function projectedCells(actor:Actor,normals:readonly Point[]):{cell:Cell;points:Point[];ranges:[bigint,bigint][];minX:number;maxX:number;minY:number;maxY:number}[] {
  return cells(actor).map(cell=>{const points=corners(cell,actor.pose);return {cell,points,ranges:normals.map(n=>project(points,n)),minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};});
}
/** Continuous SAT for translating convex cells. Inflation bounds all rotational vertex arcs. */
export function sweepCells(a:Cell,pa:Pose,da:Point,b:Cell,pb:Pose,db:Point,padA=0,padB=0):Sweep|null {
  const normals=[...axes(pa.heading),...axes(pb.heading)],ap=corners(a,pa),bp=corners(b,pb);
  return sweepProjected(normals.map(axis=>project(ap,axis)),normals.map(axis=>project(bp,axis)),normals,normals.map(axis=>BigInt(da.x-db.x)*BigInt(axis.x)+BigInt(da.y-db.y)*BigInt(axis.y)),padA+padB,{x:pa.x-pb.x,y:pa.y-pb.y});
}
export function sweepProjected(ap:readonly [bigint,bigint][],bp:readonly [bigint,bigint][],normals:readonly Point[],speeds:readonly bigint[],inflation:number,difference:Point):Sweep|null {
  let entry=0n,exit=BigInt(Q),nx=0,ny=0;
  const pad=BigInt(inflation)*BigInt(Q);
  for(let i=0;i<normals.length;i++){
    const axis=normals[i]!,[amin,amax]=ap[i]!,[bmin,bmax]=bp[i]!;
    const low=bmin-amax-pad,high=bmax-amin+pad;
    const speed=speeds[i]!;
    if(speed===0n){if(low>0n||high<0n)return null;continue;}
    const start=speed>0n?low*BigInt(Q)/speed:high*BigInt(Q)/speed;
    const end=speed>0n?high*BigInt(Q)/speed:low*BigInt(Q)/speed;
    if(start>entry){entry=start;nx=speed>0n?-axis.x:axis.x;ny=speed>0n?-axis.y:axis.y;}
    if(end<exit)exit=end;
    if(entry>exit)return null;
  }
  if(exit<0n||entry>BigInt(Q))return null;
  if(nx===0&&ny===0){const {x:dx,y:dy}=difference,l=norm(dx,dy);if(l){nx=mulDiv(dx,Q,l);ny=mulDiv(dy,Q,l);}}
  return {time:Number(entry<0n?0n:entry),nx,ny};
}
export function overlaps(a:Cell,pa:Pose,b:Cell,pb:Pose):boolean {
  const ap=corners(a,pa),bp=corners(b,pb);
  for(const axis of [...axes(pa.heading),...axes(pb.heading)]){const [amin,amax]=project(ap,axis),[bmin,bmax]=project(bp,axis);if(amax<=bmin||bmax<=amin)return false;}
  return true;
}
export function bodyOverlap(a:Actor,b:Actor):boolean {
  if(norm(a.pose.x-b.pose.x,a.pose.y-b.pose.y)>a.radius+b.radius)return false;
  const normals=[...axes(a.pose.heading),...axes(b.pose.heading)],ca=projectedCells(a,normals),cb=projectedCells(b,normals);
  return ca.some(x=>cb.some(y=>x.ranges.every(([min,max],i)=>max>y.ranges[i]![0]&&y.ranges[i]![1]>min)));
}
export function inWalls(actor:Actor):boolean {return cells(actor).every(cell=>corners(cell,actor.pose).every(p=>Math.abs(p.x)<=20000&&Math.abs(p.y)<=14000));}
/** Slab segment vs the exact rotated cell; point projectile (Burst has no radius in alpha-0). */
export function segmentCell(start:Point,end:Point,cell:Cell,pose:Pose,pad=0):number|null {
  const [sx,sy]=rotate(start.x-pose.x,start.y-pose.y,-pose.heading),[ex,ey]=rotate(end.x-pose.x,end.y-pose.y,-pose.heading);
  let entry=0n,exit=BigInt(Q);
  for(const [p,d,lo,hi] of [[sx,ex-sx,cell.x-pad,cell.x+1000+pad],[sy,ey-sy,cell.y-pad,cell.y+1000+pad]]){
    if(d===0){if(p!<lo!||p!>hi!)return null;continue;}
    const n1=BigInt(lo!-p!)*BigInt(Q)/BigInt(d!),n2=BigInt(hi!-p!)*BigInt(Q)/BigInt(d!);
    const low=n1<n2?n1:n2,high=n1>n2?n1:n2;
    if(low>entry)entry=low;if(high<exit)exit=high;if(entry>exit)return null;
  }
  return exit<0n||entry>BigInt(Q)?null:Number(entry<0n?0n:entry);
}
export function moduleCenter(actor:Actor,module:ModuleState):Point {
  const core=actor.modules[actor.core]!.placement,size=module.placement.catalogId==='core'?2:1;
  const [x,y]=rotate((module.placement.cell.x-core.cell.x-1)*1000+size*500,(module.placement.cell.y-core.cell.y-1)*1000+size*500,actor.pose.heading);
  return {x:x+actor.pose.x,y:y+actor.pose.y};
}
export function muzzle(actor:Actor,module:ModuleState):{point:Point;heading:number} {
  const heading=angle(actor.pose.heading+module.placement.orientation*1024+module.aim),center=moduleCenter(actor,module);
  const local=axes(module.aim)[0]!,distance=Math.floor(500*Q/Math.max(Math.abs(local.x),Math.abs(local.y)))+1,[x,y]=rotate(distance,0,heading);
  return {point:{x:center.x+x,y:center.y+y},heading};
}
