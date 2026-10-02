import { expect, test } from 'vitest';
import { referenceKits } from '../packages/content/dist/index.js';
import { createWorld, move, norm, normalize, rotate, bearing, signedAngle, integrate, sweepCells, bodyOverlap, inWalls, checkpoint, restore } from '../packages/engine/dist/index.js';
test('numeric negative/remainders/LUT/quadrants and floor norm cap',()=>{
  expect(rotate(1000,500,2048)).toEqual([-1000,-500]);expect(integrate(-61,0)).toEqual([-1,-1]);
  for(let x=-100;x<=100;x++)expect(norm(...normalize(x,37,50))).toBeLessThanOrEqual(50);
  expect(bearing(1000,0)).toBe(0);expect(bearing(0,-1000)).toBe(3072);expect(signedAngle(2048)).toBe(-2048);
});
test('continuous SAT stops high-speed translation past a complete cell',()=>{
  const c={module:0,x:0,y:0};expect(sweepCells(c,{x:-5000,y:0,heading:0},{x:10000,y:0},c,{x:0,y:0,heading:0},{x:0,y:0})?.time).toBe(400000);
  expect(sweepCells(c,{x:-5000,y:2000,heading:0},{x:10000,y:0},c,{x:0,y:0,heading:0},{x:0,y:0})).toBeNull();
});
test('body CCD, corner walls, rotation contact and checkpoint keep occupied cells outside each other',async()=>{
  const w=await createWorld(referenceKits[0]!,referenceKits[2]!);
  w.actors.A.pose={x:-5000,y:0,heading:0};w.actors.B.pose={x:5000,y:0,heading:2048};w.actors.A.vx=600000;w.actors.B.vx=-600000;
  move(w);expect(bodyOverlap(w.actors.A,w.actors.B)).toBe(false);expect(w.actors.A.pose.x).toBeLessThan(w.actors.B.pose.x);
  w.actors.A.pose={x:-17000,y:10000,heading:0};w.actors.A.vx=-600000;w.actors.A.vy=600000;w.actors.A.omega=1000;w.actors.A.intent.turn=1000;
  move(w);expect(inWalls(w.actors.A)).toBe(true);expect(checkpoint(restore(checkpoint(w)))).toEqual(checkpoint(w));
});
test('half-turn and actor relabel have symmetric motion; symmetric exact overlap freezes both',async()=>{
  const w=await createWorld(referenceKits[0]!,referenceKits[0]!),v=restore(checkpoint(w));
  for(const a of [w.actors.A,w.actors.B]){a.intent.thrust.forward=1000;a.intent.turn=300;}
  for(const id of ['A','B'] as const){const a=v.actors[id],source=w.actors[id==='A'?'B':'A'];a.pose={x:-source.pose.x,y:-source.pose.y,heading:(source.pose.heading+2048)%4096};a.intent=structuredClone(source.intent);}
  for(let t=0;t<240;t++){move(w);move(v);}
  expect(v.actors.A.pose).toEqual({x:-w.actors.B.pose.x,y:-w.actors.B.pose.y,heading:(w.actors.B.pose.heading+2048)%4096});
  w.actors.A.pose={x:0,y:0,heading:0};w.actors.B.pose={x:0,y:0,heading:0};w.actors.A.vx=w.actors.B.vx=0;
  move(w);expect(w.actors.A.pose).toEqual(w.actors.B.pose);expect(w.events.some(e=>e.kind==='collisionFallback')).toBe(true);
});
