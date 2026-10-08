import { readFile } from 'node:fs/promises';
import { catalog, sampleKits, passiveVariant, ruleset } from '../packages/content/dist/index.js';
import { createWorld, step, publicFrame, simulationHash } from '../packages/engine/dist/index.js';
import { save, evidence, sha } from './u3d04-evidence.mjs';
const baseline = JSON.parse(await readFile(`${evidence}/baseline/chrome/replay.json`));
const world = await createWorld(sampleKits.at(-3), sampleKits.at(-1), '00000000000000000000000000000001');
const ranged = [publicFrame(world)]; while (!world.result) { step(world); ranged.push(publicFrame(world)); }
const twentyFour = { modules: [{ catalogId:'core', cell:{x:3,y:4}, orientation:0 }] };
for(let y=3;y<=7&&twentyFour.modules.length<24;y++)for(let x=2;x<=8&&twentyFour.modules.length<24;x++)if(!(x>=3&&x<=4&&y>=4&&y<=5))twentyFour.modules.push({catalogId:'armor',cell:{x,y},orientation:(x+y)%4});
const stress = Array.from({ length: 181 }, (_, tick) => {
  const f = structuredClone(ranged[tick % ranged.length]); f.boundary = tick;
  for (const team of ['A','B']) {
    f.actors[team].modules = twentyFour.modules.map((m,i)=>({ ordinal:i,catalogId:m.catalogId,x:m.cell.x,y:m.cell.y,orientation:m.orientation,hp:m.catalogId==='core'?800:300,status:'alive',phase:i%4===0?'windup':'idle',phaseOffset:tick%18,aim:0,shield:false }));
    f.actors[team].pose = { x: team==='A'?-6000:6000, y:0, heading:team==='A'?0:2048 };
  }
  f.projectiles = Array.from({length:128},(_,i)=>({ordinal:i,owner:i%2?'A':'B',x:(i%16-8)*1000+tick*10,y:(Math.floor(i/16)-4)*1000,heading:i*31%4096}));
  f.events = Array.from({length:256},(_,i)=>({tick:tick-1,kind:i%4===0?'destroyed':'hit',actor:i%2?'A':'B',module:i%24,target:(i+1)%24,value:32,key:i}));
  return f;
});
const ringWorld = await createWorld(passiveVariant(sampleKits[0]), passiveVariant(sampleKits[1]), '00000000000000000000000000000001');
const ring = [publicFrame(ringWorld)]; while (!ringWorld.result) { step(ringWorld); ring.push(publicFrame(ringWorld)); }
const fixtures = { practice:baseline.frames, ranged, ring, stress };
const fixture = { fixtures, footprints:Object.fromEntries(catalog.map(c=>[c.id,c.footprint])), maxHp:Object.fromEntries(catalog.map(c=>[c.id,c.hp])), layout:{width:ruleset.arena.width/1000,depth:ruleset.arena.height/1000,objective:{x:0,z:0,radius:ruleset.arena.controlRadius/1000},props:[]}, provenance:{practice:'unchanged production worker baseline',ranged:{source:[world.manifest.packageHashes.A,world.manifest.packageHashes.B],manifest:world.manifest,result:world.result,simulationHash:await simulationHash(world),framesHash:sha(JSON.stringify(ranged)),events:[...new Set(ranged.flatMap(f=>f.events.map(e=>e.kind)))]},ring:{manifest:ringWorld.manifest,result:ringWorld.result,framesHash:sha(JSON.stringify(ring)),events:[...new Set(ring.flatMap(f=>f.events.map(e=>e.kind)))]},stress:'synthetic render-only 48 module/128 projectile/256 event per boundary, not valid match'} };
await save('.local/u3d04/fixture.json',fixture); await save(`${evidence}/fixture-provenance.json`,fixture.provenance);
console.log(JSON.stringify({practice:baseline.frames.length,ranged:ranged.length,events:fixture.provenance.ranged.events}));
