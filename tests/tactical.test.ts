import { expect,test } from 'vitest';
import { validateBody,validateSchema } from '../packages/contracts/dist/index.js';
import { decide,initialVM } from '../packages/brain/dist/index.js';
import { catalog,sampleCards,sampleKits,sliceKits,tacticalKits } from '../packages/content/dist/index.js';
import { createWorld,observation,step } from '../packages/engine/dist/index.js';
import { occlusions } from '../apps/web/src/model.js';

test('four additional playable samples have legal bodies, clear muzzles and matching cards',()=>{
  expect(tacticalKits).toHaveLength(4);
  expect(sampleKits.slice(0,3)).toEqual(sliceKits);
  expect(sampleKits).toHaveLength(7);
  for(const bot of tacticalKits){
    validateSchema('bot-definition',bot);
    expect(validateBody(bot.body,catalog,true).cost).toBeLessThanOrEqual(100);
    expect(occlusions(bot)).toEqual([]);
    expect(sampleCards.find(card=>card.name===bot.name)).toBeDefined();
  }
});

test('tactical decisions handle safety, cooling hysteresis, incoming fire and weapon loss',async()=>{
  for(const bot of tacticalKits){
    const world=await createWorld(bot,sliceKits[0]!),actor=world.actors.A;
    const run=(values:Record<string,number>,state=initialVM(actor.compiled))=>{
      const sensors=observation(world,actor);for(const [name,value] of Object.entries(values))sensors.set(name,value);
      const result=decide(actor.compiled,state,sensors,actor.modules.map(m=>m.placement));
      expect(result.fault).toBeNull();expect(result.gas).toBeLessThan(4096);
      const rule=bot.brain.states[0]!.rules[Number(result.ruleId!.slice(1))]!.id;
      return {...result,rule};
    };
    expect(run({'self.outsideRing':1,'self.heat':950}).rule).toBe('returnToSafety');
    expect(run({'arena.centerDistance':8000,'arena.ringRadius':10000}).rule).toBe('returnToSafety');
    const hot=run({'self.heat':800});expect(hot.rule).toBe('coolDown');
    expect(hot.intent.modules.every(m=>m.action==='shieldOff')).toBe(true);
    expect(run({'self.heat':600},hot.state).rule).toBe('coolDown');
    expect(run({'self.heat':400},hot.state).rule).not.toBe('coolDown');
    const threat={'enemy.bearing':0,'enemy.distance':7000,'projectile.present':1,'projectile.distance':2500,'projectile.closingSpeed':18000,'projectile.bearing':300};
    const defended=run(threat);expect(defended.rule).toBe(bot.name.startsWith('Ironclad')?'blockThreat':'dodgeLeft');
    if(bot.name.startsWith('Ironclad'))expect(defended.intent.modules.some(m=>m.action==='shieldOn')).toBe(true);
    else expect(defended.intent.thrust.strafe).toBeLessThan(0);
    if(bot.name.startsWith('Ironclad')){
      const following=run({'enemy.distance':7000,'enemy.bearing':0,'clock.tick':18},defended.state);
      expect(following.rule).toBe('followThroughGuard');expect(following.intent.modules).toEqual([]);
      expect(run({'enemy.distance':7000,'clock.tick':42},defended.state).rule).not.toBe('followThroughGuard');
    }else expect(run({...threat,'projectile.bearing':-300}).intent.thrust.strafe).toBeGreaterThan(0);
    expect(run({...threat,'projectile.closingSpeed':-18000}).rule).not.toMatch(/dodge|block/);
    const lost=Object.fromEntries(actor.modules.filter(m=>['blade','burst'].includes(m.placement.catalogId)).map(m=>[`self.moduleAlive.m${m.ordinal}`,0]));
    expect(run(lost).rule).toBe('weaponsLost');
    const attack=run({'enemy.distance':3500,'enemy.bearing':0,'enemy.coreHpPermille':200});
    expect(attack.rule).toMatch(/^finishWith_/);expect(attack.intent.modules.some(m=>m.action==='activate')).toBe(true);
    const empty=run({'enemy.distance':3500,'enemy.bearing':0,'self.energy':0});
    expect(empty.intent.modules.some(m=>m.action==='activate')).toBe(false);
    if(bot.body.modules.some(m=>m.id==='secondary'&&m.catalogId==='blade')){
      const primary=actor.modules.find(m=>m.placement.catalogId===bot.body.modules.find(m=>m.id==='primary')!.catalogId)!;
      const fallback=run({'enemy.distance':3500,'enemy.bearing':0,'enemy.coreHpPermille':200,[`self.moduleAlive.m${primary.ordinal}`]:0,[`self.weaponReady.m${primary.ordinal}`]:0});
      expect(fallback.rule).toBe('finishWith_secondary');
    }
  }
});

test('new samples complete real fights on both spawn sides without brain faults',async()=>{
  for(const bot of tacticalKits)for(const swapped of [false,true]){
    const world=await createWorld(bot,sliceKits[bot.name.startsWith('Longshot')?0:2]!,'00000000000000000000000000000000',swapped);
    let attacks=0;
    while(!world.result){
      step(world);
      expect(world.traces.filter(t=>t.actor==='A').every(t=>t.fault===null)).toBe(true);
      attacks+=world.events.filter(e=>e.actor==='A'&&e.kind==='activation').length;
    }
    expect(world.result.cause).not.toBe('brainBudget');
    expect(attacks,`${bot.name} / swapped=${swapped}`).toBeGreaterThan(0);
    expect(world.actors.A.damage,`${bot.name} / swapped=${swapped}`).toBeGreaterThan(0);
  }
},60000);
