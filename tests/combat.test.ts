import { expect, test } from 'vitest';
import { referenceKits, sliceKits, passiveVariant, catalog } from '../packages/content/dist/index.js';
import { createWorld, collectWeapons, allocate, applyDamage, destruction, largestRemainder, resources, observation, objective, step, finish, checkpoint, restore, simulationHash, segmentCell, sectorCell, energyCapacity } from '../packages/engine/dist/index.js';
import type { HitPacket } from '../packages/engine/dist/index.js';
import { validateBody } from '../packages/contracts/dist/index.js';
test('all three slice Bodies and two Brain variants are valid, full catalog remains disabled',async()=>{
  for(const bot of sliceKits){expect(validateBody(bot.body,catalog,true).cost).toBeLessThanOrEqual(100);await createWorld(bot,passiveVariant(bot));}
  expect(catalog.find(c=>c.id==='lance')!.enabled).toBe(false);expect(catalog.find(c=>c.id==='breaker')!.enabled).toBe(false);
});
test('windup is exactly 18 ticks, Burst fires offsets 0/4/8, recovery receives no queued edge',async()=>{
  const w=await createWorld(referenceKits[2]!,referenceKits[0]!),a=w.actors.A,m=a.modules.find(m=>m.placement.catalogId==='burst')!;
  allocate(w,a,{thrust:{forward:0,strafe:0},turn:0,modules:[{moduleOrdinal:m.ordinal,action:'activate',aimOffset:0,priority:0}]});
  const shots:number[]=[];for(let tick=0;tick<73;tick++){w.tick=tick;w.events=[];collectWeapons(w);if(w.events.some(e=>e.kind==='shot'))shots.push(tick);if(tick===17)expect(m.phase).toBe('active');if(tick===70)expect(m.phase).toBe('recovery');}
  expect(shots).toEqual([18,22,26]);expect(m.phase).toBe('idle');expect(a.energy).toBe(1070);
});
test('held drive does not repeat activation between 10 Hz decisions and snapshot hides enemy energy',async()=>{
  const w=await createWorld(sliceKits[0]!,sliceKits[2]!);step(w);for(let i=0;i<5;i++){step(w);expect(w.actors.A.intent.modules).toEqual([]);expect(w.traces).toEqual([]);}
  const snapshot=observation(w,w.actors.A);expect(snapshot.has('enemy.energy')).toBe(false);expect(snapshot.has('enemy.heat')).toBe(false);
});
test('overheat hysteresis preserves a paid windup, shuts shield, clears at 600',async()=>{
  const w=await createWorld(sliceKits[1]!,referenceKits[0]!),a=w.actors.A,blade=a.modules.find(m=>m.placement.catalogId==='blade')!,shield=a.modules.find(m=>m.placement.catalogId==='shield')!;
  a.heat=820;shield.shield=true;
  allocate(w,a,{thrust:{forward:0,strafe:0},turn:0,modules:[{moduleOrdinal:blade.ordinal,action:'activate',aimOffset:0,priority:0}]});
  expect(a.overheated).toBe(true);expect(shield.shield).toBe(false);expect(blade.phase).toBe('windup');a.heat=602;resources(w);expect(a.overheated).toBe(true);resources(w);expect(a.overheated).toBe(false);
});
test('shield upkeep and 30 tick reset are paid per sim tick, energy rejection continues arbitration',async()=>{
  const w=await createWorld(sliceKits[1]!,referenceKits[0]!),a=w.actors.A,shield=a.modules.find(m=>m.placement.catalogId==='shield')!,weapon=a.modules.find(m=>m.placement.catalogId==='blade')!;
  a.energy=50;allocate(w,a,{thrust:{forward:0,strafe:0},turn:0,modules:[{moduleOrdinal:weapon.ordinal,action:'activate',aimOffset:0,priority:0},{moduleOrdinal:shield.ordinal,action:'shieldOn',priority:1}]});expect(a.energy).toBe(9);expect(shield.shield).toBe(true);expect(weapon.phase).toBe('idle');
  allocate(w,a,{thrust:{forward:0,strafe:0},turn:0,modules:[{moduleOrdinal:shield.ordinal,action:'shieldOff',priority:0}]});expect(shield.shieldLock).toBe(30);for(let i=0;i<29;i++)resources(w);expect(shield.shieldLock).toBe(1);resources(w);expect(shield.shieldLock).toBe(0);
});
test('shield batch 2x energy and largest remainder is independent of input order; inside/behind shield bypass',async()=>{
  const w=await createWorld(sliceKits[1]!,referenceKits[2]!),a=w.actors.A;a.pose={x:0,y:0,heading:0};a.energy=10;a.modules.find(m=>m.placement.catalogId==='shield')!.shield=true;
  const packets:HitPacket[]=[{key:1,source:'B',target:'A',module:a.core,raw:90,origin:{x:10000,y:0},attack:0},{key:2,source:'B',target:'A',module:a.core,raw:32,origin:{x:10000,y:0},attack:1}],v=restore(checkpoint(w));
  applyDamage(w,packets);applyDamage(v,[...packets].reverse());expect(a.energy).toBe(0);expect(a.modules[a.core]!.hp).toBe(698);expect(checkpoint(v)).toEqual(checkpoint(w));
  expect(largestRemainder(3,[1,1],[9,1])).toEqual([1,2]);
  const inside=restore(checkpoint(v));inside.actors.A.energy=100;applyDamage(inside,[{...packets[0]!,origin:{x:0,y:0}}]);expect(inside.actors.A.energy).toBe(100);
});
test('armor applies after shield, actual damage never farms overkill or detach',async()=>{
  const w=await createWorld(referenceKits[0]!,referenceKits[2]!),a=w.actors.A,armor=a.modules.find(m=>m.placement.catalogId==='armor')!;
  applyDamage(w,[{key:1,source:'B',target:'A',module:armor.ordinal,raw:100,origin:{x:0,y:0},attack:0}]);expect(armor.hp).toBe(230);armor.hp=1;const before=w.actors.B.damage;
  applyDamage(w,[{key:2,source:'B',target:'A',module:armor.ordinal,raw:1000,origin:{x:0,y:0},attack:1}]);destruction(w);expect(w.actors.B.damage-before).toBe(1);
  const capacitor=await createWorld(referenceKits[2]!,referenceKits[0]!);capacitor.actors.A.modules.find(m=>m.placement.catalogId==='capacitor')!.hp=0;destruction(capacitor);expect(energyCapacity(capacitor.actors.A)).toBe(1000);expect(capacitor.actors.A.energy).toBe(1000);
});
test('core kills collected in the same damage phase draw; ring takes priority over Brain loss',async()=>{
  const w=await createWorld(referenceKits[0]!,referenceKits[2]!);const packets:HitPacket[]=(['A','B'] as const).map((id,key)=>({key,source:id==='A'?'B':'A',target:id,module:w.actors[id].core,raw:10000,origin:{x:0,y:0},attack:key}));
  applyDamage(w,packets);w.actors.A.vm.faultStreak=10;objective(w);expect(w.result?.cause).toBe('coreDouble');expect(w.result?.winner).toBe('draw');expect(w.actors.A.damage).toBe(800);expect(w.actors.B.damage).toBe(800);
});
test('connectivity prunes a branch without free HP damage or zero-mass acceleration',async()=>{
  const bot=structuredClone(referenceKits[0]!);bot.body.modules.push({id:'branch',catalogId:'armor',cell:{x:8,y:5},orientation:0});const w=await createWorld(bot,referenceKits[2]!),a=w.actors.A,mass=a.mass;
  a.modules.find(m=>m.placement.catalogId==='blade')!.hp=0;destruction(w);expect(a.modules.find(m=>m.placement.cell.x===8)!.detached).toBe(true);expect(a.mass).toBe(mass);expect(w.actors.B.damage).toBe(0);
});
test('Blade sector is exact for front/behind/edge cells, one hit per activation survives collector destruction',async()=>{
  expect(sectorCell({x:0,y:0},0,1500,[{x:1000,y:-500},{x:2000,y:-500},{x:2000,y:500},{x:1000,y:500}])).toBe(true);expect(sectorCell({x:0,y:0},0,1500,[{x:-2000,y:0},{x:-1000,y:0},{x:-1000,y:1000},{x:-2000,y:1000}])).toBe(false);
  const w=await createWorld(referenceKits[0]!,referenceKits[2]!),a=w.actors.A,m=a.modules.find(m=>m.placement.catalogId==='blade')!;a.pose={x:0,y:0,heading:0};w.actors.B.pose={x:4000,y:0,heading:2048};m.phase='active';m.offset=0;
  const packets=collectWeapons(w);expect(packets.length).toBe(1);for(let i=0;i<5;i++)expect(collectWeapons(w).length).toBe(0);expect(m.phase).toBe('recovery');m.hp=0;applyDamage(w,packets);destruction(w);expect(w.actors.A.damage).toBeGreaterThan(0);
});
test('projectile first-hit CCD, negative directions, muzzle self occlusion absorbs without friendly damage',async()=>{
  expect(segmentCell({x:-5000,y:500},{x:5000,y:500},{module:0,x:0,y:0},{x:0,y:0,heading:0})).toBe(500000);
  expect(segmentCell({x:5000,y:500},{x:-5000,y:500},{module:0,x:0,y:0},{x:0,y:0,heading:0})).toBe(400000);
  const bot=structuredClone(referenceKits[2]!);bot.body.modules.push({id:'plug',catalogId:'armor',cell:{x:8,y:5},orientation:0});const w=await createWorld(bot,referenceKits[0]!),a=w.actors.A,m=a.modules.find(m=>m.placement.catalogId==='burst')!;m.phase='active';m.offset=0;const hp=a.modules.reduce((s,m)=>s+m.hp,0);
  collectWeapons(w);expect(w.projectiles.length).toBe(0);expect(a.modules.reduce((s,m)=>s+m.hp,0)).toBe(hp);expect(w.events.some(e=>e.kind==='blocked')).toBe(true);
});
test('ring remainder exactly 40 HP/second outside, resets inside; 4800 control opportunities and timeout tie <=100',async()=>{
  const w=await createWorld(referenceKits[0]!,referenceKits[2]!);w.actors.A.pose={x:19000,y:10000,heading:0};w.actors.B.pose={x:0,y:0,heading:0};
  for(let t=5000;t<5060;t++){w.tick=t;w.events=[];objective(w);}expect(w.actors.A.modules[w.actors.A.core]!.hp).toBe(760);expect(w.actors.A.damage).toBe(0);
  w.actors.A.ringRemainder=123;w.actors.A.pose={x:0,y:0,heading:0};objective(w);expect(w.actors.A.ringRemainder).toBe(0);
  const v=await createWorld(referenceKits[0]!,referenceKits[2]!);v.actors.A.pose={x:0,y:0,heading:0};v.actors.B.pose={x:4000,y:0,heading:0};for(let t=600;t<5400;t++){v.tick=t;v.events=[];objective(v);}expect(v.actors.A.controlTicks).toBe(4800);expect(v.result?.elapsedTicks).toBe(5400);
  const tie=await createWorld(referenceKits[0]!,referenceKits[0]!);tie.tick=5399;tie.actors.A.controlTicks=96;objective(tie);expect(tie.result?.winner).toBe('draw');tie.result=null;tie.actors.A.controlTicks=101;objective(tie);expect(restore(checkpoint(tie)).result?.winner).toBe('A');
});
test('same body passive/adaptive brains select different trace/actions and a full match is deterministic',async()=>{
  const bot=sliceKits[0]!,a=await createWorld(passiveVariant(bot),sliceKits[2]!),b=await createWorld(bot,sliceKits[2]!);step(a);step(b);expect(a.traces[0]!.ruleId).not.toBe(b.traces[0]!.ruleId);expect(a.actors.A.intent).not.toEqual(b.actors.A.intent);
  const same=restore(checkpoint(b));finish(b);finish(same);expect(await simulationHash(b)).toBe(await simulationHash(same));
});
test('ten consecutive runtime faults cause a simultaneous Brain draw at the tenth decision',async()=>{
  const bot=structuredClone(referenceKits[0]!);bot.brain.states[0]!.rules=[{id:'fault',when:{kind:'bool',value:true},intent:{thrust:{forward:{kind:'op',op:'div',left:{kind:'const',value:1},right:{kind:'const',value:0}},strafe:{kind:'const',value:0}},turn:{kind:'const',value:0},modules:[]}}];
  const w=finish(await createWorld(bot,bot));expect(w.result).toMatchObject({winner:'draw',cause:'brainBudget',elapsedTicks:55});expect(w.actors.A.vm.faultStreak).toBe(10);
});
test('radiator loss changes cooling next tick, thruster loss changes drive without an instantaneous velocity clamp',async()=>{
  const w=await createWorld(referenceKits[0]!,referenceKits[2]!),a=w.actors.A;a.heat=10;resources(w);expect(a.heat).toBe(8);a.modules.find(m=>m.placement.catalogId==='radiator')!.hp=0;destruction(w);resources(w);expect(a.heat).toBe(7);
  const thruster=a.modules.find(m=>m.placement.catalogId==='thruster')!;thruster.hp=0;destruction(w);a.vx=2000;a.intent.thrust.forward=1000;const mass=a.mass;
  const { move, capabilities }=await import('../packages/engine/dist/index.js');move(w);expect(a.mass).toBe(mass);expect(a.vx).toBeGreaterThan(capabilities(a).vMax);expect(a.vx).toBeLessThan(2000);
});
