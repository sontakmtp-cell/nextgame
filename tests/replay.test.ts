import { expect, test } from 'vitest';
import { canonical, digest } from '../packages/contracts/dist/index.js';
import { sliceKits, referenceKits } from '../packages/content/dist/index.js';
import { createWorld, simulate, checkpoint, checkpointState, restore, step, simulationHash, finish, assertBinding } from '../packages/engine/dist/index.js';
import { decodeChunk, encodeChunk, encodeReplay, verifyPublic } from '../packages/replay/dist/index.js';
import { readFile, mkdtemp, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseBot } from '../packages/contracts/dist/index.js';
import { writeArchive, verifyArchive } from '../apps/cli/dist/archive.js';
test('binary public codec round trips every frame, arbitrary seeks equal playback, no private fields',async()=>{
  const record=await simulate(await createWorld(sliceKits[0]!,sliceKits[2]!)),replay=await encodeReplay(record.manifest,record.frames,record.result),index=await verifyPublic(replay);
  expect(index.frameCount).toBe(record.frames.length);
  for(let boundary=0;boundary<record.frames.length;boundary+=37)expect(index.seek(boundary)).toEqual(record.frames[boundary]);
  expect(index.seek(record.result.elapsedTicks)).toEqual(record.frames.at(-1));
  for(const chunk of replay.chunks){const text=JSON.stringify(decodeChunk(chunk));for(const field of ['energy','variables','intent','brain','sourceMap','compiled'])expect(text).not.toContain(`"${field}"`);}
  expect(()=>index.seek(-1)).toThrow();expect(()=>index.seek(0.5)).toThrow();
  const broken={manifest:replay.manifest,chunks:replay.chunks.map(c=>new Uint8Array(c))};broken.chunks[0]![20]=broken.chunks[0]![20]!^1;await expect(verifyPublic(broken)).rejects.toThrow('CHUNK_HASH');await expect(verifyPublic({...replay,chunks:replay.chunks.slice(1)})).rejects.toThrow();
  expect(()=>decodeChunk(replay.chunks[0]!.slice(0,-4))).toThrow();expect(()=>decodeChunk(new Uint8Array([1,2,3,4]))).toThrow();
  expect(()=>encodeChunk([{...record.frames[0]!,boundary:-1}])).toThrow();
});
test('every checkpoint interval restores identically, hence every suffix reaches the same final state',async()=>{
  const record=await simulate(await createWorld(sliceKits[1]!,sliceKits[2]!));
  for(let i=0;i<record.checkpoints.length;i++){
    const resumed=restore(record.checkpoints[i]!),next=record.checkpoints[i+1];
    if(next){while(resumed.tick<next.tick&&!resumed.result)step(resumed);expect(await digest(checkpointState(checkpoint(resumed))),`boundary ${next.tick}`).toBe(await digest(checkpointState(next)));}
    else expect(await simulationHash(resumed)).toBe(record.simulationHash);
  }
  const terminal=record.frames.at(-1)!;expect(terminal.boundary).toBe(record.result.elapsedTicks);if(terminal.boundary===5400)expect(terminal.ringRadius).toBe(6000);
});
test('module rename/permutation does not change gameplay hash, and manifest tampering is rejected',async()=>{
  const bot=structuredClone(sliceKits[2]!),other=sliceKits[0]!;
  for(const m of bot.body.modules){const old=m.id;m.id=`new${old}`;const rename=(value:unknown):void=>{if(value&&typeof value==='object')for(const [key,v] of Object.entries(value)){const target=value as Record<string,unknown>;if(key==='moduleId'&&v===old)target[key]=m.id;else if(key==='name'&&typeof v==='string'&&v.endsWith(`.${old}`))target[key]=v.slice(0,-old.length)+m.id;else rename(v);}};rename(bot.brain);}
  bot.body.modules.reverse();bot.name='Another display name';
  const a=finish(await createWorld(sliceKits[2]!,other)),b=finish(await createWorld(bot,other));expect(await simulationHash(a)).toBe(await simulationHash(b));
  const bad=structuredClone(a.manifest);bad.scenarioId=(bad.scenarioId+1)%1225;await expect(assertBinding(bad,sliceKits[2]!,other)).rejects.toThrow('MATCH_BINDING');
  expect(canonical(a.result)).toBe(canonical(b.result));
});
test('full combat whole-world 180 degree + actor relabel preserves outcomes',async()=>{
  const a=await createWorld(sliceKits[0]!,sliceKits[2]!),b=await createWorld(sliceKits[2]!,sliceKits[0]!);
  for(const id of ['A','B'] as const){const source=a.actors[id==='A'?'B':'A'];b.actors[id].pose={x:-source.pose.x,y:-source.pose.y,heading:(source.pose.heading+2048)%4096};}
  finish(a);finish(b);expect(b.result).toEqual({...a.result!,winner:a.result!.winner==='draw'?'draw':a.result!.winner==='A'?'B':'A',scores:{A:a.result!.scores.B,B:a.result!.scores.A}});
  expect(b.actors.A.pose).toEqual({x:-a.actors.B.pose.x,y:-a.actors.B.pose.y,heading:(a.actors.B.pose.heading+2048)%4096});
});
test('a full 5400-tick replay of the largest point-budget legal idle Bodies stays below 8 MiB',async()=>{
  const bot=structuredClone(referenceKits[0]!);bot.name='Replay capacity fixture';bot.body.modules=bot.body.modules.filter(m=>m.catalogId==='core');
  for(let y=3;y<=8&&bot.body.modules.length<21;y++)for(let x=3;x<=8&&bot.body.modules.length<21;x++){if((x===5||x===6)&&(y===5||y===6))continue;bot.body.modules.push({id:`armor${x}_${y}`,catalogId:'armor',cell:{x,y},orientation:0});}
  const record=await simulate(await createWorld(bot,bot));expect(record.result.elapsedTicks).toBe(5400);const replay=await encodeReplay(record.manifest,record.frames,record.result);
  expect(replay.chunks.reduce((sum,c)=>sum+c.length,0)).toBeLessThanOrEqual(8388608);expect((await verifyPublic(replay)).seek(5400)).toEqual(record.frames.at(-1));
});
test('two near-IR-cap Brains share only frozen code; private snapshots fit quotas and fully verify',async()=>{
  const bot=parseBot(await readFile('tests/g1/stress.bot.json','utf8')),world=await createWorld(bot,bot),saved=checkpoint(world);
  expect(Object.isFrozen(saved.actors.A.compiled.normalizedIR)).toBe(true);
  expect(saved.actors.A.compiled).toBe(world.actors.A.compiled);
  saved.actors.A.modules[0]!.hp--;
  expect(world.actors.A.modules[0]!.hp).toBe(saved.actors.A.modules[0]!.hp+1);
  const record=await simulate(world),root=await mkdtemp(join(tmpdir(),'nextgame-g1-')),path=join(root,'archive');
  await writeArchive(path,bot,bot,record);
  const files=await readdir(join(path,'private')),sizes=await Promise.all(files.map(name=>stat(join(path,'private',name)).then(s=>s.size)));
  expect(Math.max(...sizes)).toBeLessThanOrEqual(262144);expect(sizes.reduce((a,b)=>a+b,0)).toBeLessThanOrEqual(16777216);
  expect((await verifyArchive(path,true)).status).toBe('passed');
},60000);
