import { ContractError, digest, sha256, validateSchema } from '@prompt-chien/contracts';
import type { CombatEvent, MatchManifest, MatchResult, PublicActor, PublicFrame, ReplayManifest } from '@prompt-chien/contracts';
const catalogs=['core','thruster','armor','blade','lance','burst','shield','breaker','capacitor','radiator'] as const;
const phases=['idle','windup','active','recovery'] as const,statuses=['alive','destroyed','detached'] as const;
const kinds:CombatEvent['kind'][]=['activation','intentRejected','shot','hit','blocked','destroyed','detached','shieldOn','shieldOff','overheated','cooled','collisionFallback','ringNotice','ringDamage','result'];
const actors=['A','B','world'] as const;
const fail=(code:string):never=>{throw new ContractError(code,'/replay');};
export interface PublicReplay {manifest:ReplayManifest;chunks:Uint8Array[]}
/** PCG1 v2: immutable Body fields once per chunk, full dynamic snapshots each boundary. */
export function encodeChunk(frames:readonly PublicFrame[]):Uint8Array {
  if(!frames.length||frames.length>61)fail('CHUNK_FRAME_CAP');
  const words:number[]=[0x31474350,2,frames.length];
  const push=(...values:number[]):void=>{for(const value of values){if(!Number.isInteger(value)||value< -2147483648||value>2147483647)fail('CODEC_INTEGER');words.push(value);}};
  for(const id of ['A','B'] as const){const modules=frames[0]!.actors[id].modules;push(modules.length);for(const m of modules)push(m.ordinal,catalogs.indexOf(m.catalogId as typeof catalogs[number]),m.x,m.y,m.orientation);}
  for(const frame of frames){push(frame.boundary);
    for(const id of ['A','B'] as const){const a=frame.actors[id],body=frames[0]!.actors[id].modules;if(a.modules.length!==body.length)fail('BODY_CONTINUITY');push(a.pose.x,a.pose.y,a.pose.heading,Number(a.overheated),a.controlTicks);
      for(const [i,m] of a.modules.entries()){const b=body[i]!;if(m.ordinal!==b.ordinal||m.catalogId!==b.catalogId||m.x!==b.x||m.y!==b.y||m.orientation!==b.orientation)fail('BODY_CONTINUITY');push(m.hp,statuses.indexOf(m.status),phases.indexOf(m.phase),m.phaseOffset,Number(m.shield),m.aim);}}
    push(frame.projectiles.length);for(const p of frame.projectiles)push(p.ordinal,p.owner==='A'?0:1,p.x,p.y,p.heading);
    push(frame.controlOwner==='neutral'?2:frame.controlOwner==='A'?0:1,frame.ringRadius,frame.events.length);
    for(const e of frame.events)push(e.tick,kinds.indexOf(e.kind),actors.indexOf(e.actor),e.module,e.target,e.value,e.key);
  }
  if(words.length*4>1048576)fail('CHUNK_BYTE_CAP');
  const bytes=new Uint8Array(words.length*4),view=new DataView(bytes.buffer);words.forEach((value,i)=>view.setInt32(i*4,value,true));
  decodeChunk(bytes);return bytes;
}
export function decodeChunk(bytes:Uint8Array):PublicFrame[] {
  if(bytes.length>1048576||bytes.length%4||bytes.length<12)fail('CHUNK_BYTE_CAP');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let offset=0;
  const read=(lo=-2147483648,hi=2147483647):number=>{if(offset+4>bytes.length)fail('CHUNK_TRUNCATED');const n=view.getInt32(offset,true);offset+=4;if(n<lo||n>hi)fail('CHUNK_FIELD');return n;};
  if(read()!==0x31474350||read()!==2)fail('CHUNK_VERSION');const count=read(1,61),frames:PublicFrame[]=[];
  type BodyModule=Pick<PublicActor['modules'][number],'ordinal'|'catalogId'|'x'|'y'|'orientation'>;
  const bodies:BodyModule[][]=[];
  for(let actor=0;actor<2;actor++){const length=read(1,24),body:BodyModule[]=[];for(let j=0;j<length;j++){const ordinal=read(0,23);if(ordinal!==j)fail('MODULE_ORDINAL');body.push({ordinal,catalogId:catalogs[read(0,9)]!,x:read(0,11),y:read(0,11),orientation:read(0,3)});}bodies.push(body);}
  for(let i=0;i<count;i++){const boundary=read(0,5400);
    const actor=(body:BodyModule[]):PublicActor=>{
      const pose={x:read(-20000,20000),y:read(-14000,14000),heading:read(0,4095)},overheated=!!read(0,1),controlTicks=read(0,4800),modules:PublicActor['modules']=[];
      for(const m of body){
        modules.push({...m,hp:read(0,1000000),status:statuses[read(0,2)]!,phase:phases[read(0,3)]!,phaseOffset:read(0,90),shield:!!read(0,1),aim:read(-256,256)});
      }return {pose,overheated,controlTicks,modules};
    };
    const A=actor(bodies[0]!),B=actor(bodies[1]!),projectiles:PublicFrame['projectiles']=[],length=read(0,128),ordinals=new Set<number>();
    for(let j=0;j<length;j++){const ordinal=read(0,1000000);if(ordinals.has(ordinal))fail('PROJECTILE_ORDINAL');ordinals.add(ordinal);projectiles.push({ordinal,owner:read(0,1)?'B':'A',x:read(-20000,20000),y:read(-14000,14000),heading:read(0,4095)});}
    const owner=read(0,2),ringRadius=read(6000,25000),events:CombatEvent[]=[],eventCount=read(0,256);
    for(let j=0;j<eventCount;j++){const tick=read(0,5399);if(tick!==boundary-1)fail('EVENT_BOUNDARY');events.push({tick,kind:kinds[read(0,kinds.length-1)]!,actor:actors[read(0,2)]!,module:read(0,23),target:read(0,23),value:read(0,1000000),key:read(0,2147483647)});}
    frames.push({boundary,actors:{A,B},projectiles,controlOwner:owner===2?'neutral':owner===0?'A':'B',ringRadius,events});
  }
  if(offset!==bytes.length)fail('CHUNK_TRAILING');return frames;
}
export async function encodeReplay(match:MatchManifest,frames:readonly PublicFrame[],result:MatchResult):Promise<PublicReplay> {
  validateSchema('match',match);validateSchema('match-result',result);
  const chunks:Uint8Array[]=[],index:ReplayManifest['chunks']=[];
  for(let boundary=0;boundary<frames.length;){const count=boundary===0?61:60,part=frames.slice(boundary,boundary+count),bytes=encodeChunk(part);chunks.push(bytes);index.push({firstBoundary:part[0]!.boundary,lastBoundary:part.at(-1)!.boundary,bytes:bytes.length,hash:await sha256(bytes)});boundary+=count;}
  if(chunks.reduce((sum,b)=>sum+b.length,0)>8388608)fail('PUBLIC_REPLAY_CAP');
  const publicReplayHash=await digest({version:'2.0',match,chunks:index,result}),manifest:ReplayManifest={version:'2.0',match,publicReplayHash,chunks:index,result};
  const replay={manifest,chunks};await verifyPublic(replay);return replay;
}
export async function verifyPublic(replay:PublicReplay):Promise<{seek:(boundary:number)=>PublicFrame;frameCount:number}> {
  validateSchema('replay',replay.manifest);
  const {manifest,chunks}=replay;
  if(chunks.length!==manifest.chunks.length||chunks.reduce((sum,b)=>sum+b.length,0)>8388608)fail('PUBLIC_REPLAY_CAP');
  if(await digest({version:manifest.version,match:manifest.match,chunks:manifest.chunks,result:manifest.result})!==manifest.publicReplayHash)fail('PUBLIC_REPLAY_HASH');
  const frames:PublicFrame[]=[];let previous:PublicFrame|undefined;
  for(let i=0;i<chunks.length;i++){
    const bytes=chunks[i]!,entry=manifest.chunks[i]!;
    if(bytes.length!==entry.bytes||await sha256(bytes)!==entry.hash)fail('CHUNK_HASH');
    const part=decodeChunk(bytes);
    if(part[0]!.boundary!==entry.firstBoundary||part.at(-1)!.boundary!==entry.lastBoundary)fail('CHUNK_INDEX');
    for(const frame of part){
      if(frame.boundary!==frames.length)fail('POSE_CONTINUITY');
      if(previous)for(const id of ['A','B'] as const){const a=previous.actors[id],b=frame.actors[id];if(a.modules.length!==b.modules.length||b.controlTicks<a.controlTicks||b.controlTicks>a.controlTicks+1)fail('POSE_CONTINUITY');
        for(let j=0;j<a.modules.length;j++){const x=a.modules[j]!,y=b.modules[j]!;if(x.catalogId!==y.catalogId||x.x!==y.x||x.y!==y.y||x.orientation!==y.orientation||y.hp>x.hp||(x.status!=='alive'&&y.status==='alive'))fail('POSE_CONTINUITY');}}
      frames.push(frame);previous=frame;
    }
  }
  if(!previous||previous.boundary!==manifest.result.elapsedTicks||frames[0]!.events.length)fail('REPLAY_TERMINAL');
  const first=frames[0]!;
  for(const id of ['A','B'] as const){const slot=manifest.match.spawnSlotAssignment[id],pose=first.actors[id].pose;if(pose.x!==(slot==='left'?-12000:12000)||pose.y!==(slot==='left'?manifest.match.presetValues.yLeft:manifest.match.presetValues.yRight))fail('REPLAY_INIT');}
  return {frameCount:frames.length,seek:(boundary:number)=>{if(!Number.isInteger(boundary)||boundary<0||boundary>=frames.length)fail('SEEK_BOUNDARY');return structuredClone(frames[boundary]!);}};
}
