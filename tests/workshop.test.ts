import { expect,test } from 'vitest';
import { sliceKits } from '../packages/content/src/index.js';
import { newModule,editModule,occlusions,diffSummary } from '../apps/web/src/model.js';
import { eventLocation } from '../packages/renderer/src/index.js';
import { nodeLibrary,nodeUnavailable,insertLibraryNode,conditionSummary } from '../apps/web/src/brain-library.js';
import { compile,decide,initialVM } from '../packages/brain/dist/index.js';
import { catalog,sampleKits } from '../packages/content/dist/index.js';
import { validateBody,validateSchema } from '../packages/contracts/dist/index.js';
import { createWorld,observation } from '../packages/engine/dist/index.js';
test('Workshop edits keep the source immutable, unique IDs and cardinal muzzle diagnostics',()=>{
  const bot=structuredClone(sliceKits[2]!),before=JSON.stringify(bot),weapon=bot.body.modules.find(m=>m.catalogId==='burst')!;
  const added=newModule(bot,'armor',weapon.cell.x+1,weapon.cell.y);expect(JSON.stringify(bot)).toBe(before);expect(new Set(added.body.modules.map(m=>m.id)).size).toBe(added.body.modules.length);expect(occlusions(added)).toEqual([weapon.id]);
  const moved=editModule(added,weapon.id,{orientation:2});expect(added.body.modules.find(m=>m.id===weapon.id)!.orientation).toBe(0);expect(occlusions(moved)).toEqual([weapon.id]);
  const removed=editModule(added,added.body.modules.at(-1)!.id,null);expect(occlusions(removed)).toEqual([]);expect(diffSummary(bot,added)).toContain('+1');expect(diffSummary(bot,added)).toContain('Brain giữ nguyên');
});
test('public hit source maps to the victim module, while destruction stays on its owning module',()=>{
  const event={tick:12,kind:'hit' as const,actor:'A' as const,module:2,target:5,value:90,key:1};
  expect(eventLocation(event)).toEqual({actor:'B',module:5});
  expect(eventLocation({...event,kind:'destroyed'})).toEqual({actor:'A',module:2});
  expect(eventLocation({...event,kind:'blocked',actor:'B'})).toEqual({actor:'B',module:2});
});

test('library inserts runnable unique rules before fallback without changing source or safety priorities',()=>{
  expect(nodeLibrary).toHaveLength(16);
  for(const bot of sampleKits)for(const node of nodeLibrary){
    const before=JSON.stringify(bot),reason=nodeUnavailable(bot,0,node);
    if(reason){expect(()=>insertLibraryNode(bot,0,node)).toThrow(reason);continue;}
    const added=insertLibraryNode(bot,0,node);
    expect(JSON.stringify(bot)).toBe(before);
    expect(added.bot.brain.states[0]!.rules[0]).toEqual(bot.brain.states[0]!.rules[0]);
    validateSchema('bot-definition',added.bot);
    compile(added.bot.brain,validateBody(added.bot.body,catalog).modules);
    const again=insertLibraryNode(added.bot,0,node);
    compile(again.bot.brain,again.bot.body.modules);
    expect(new Set(again.bot.brain.states[0]!.rules.map(r=>r.id)).size).toBe(again.bot.brain.states[0]!.rules.length);
    const fallback=added.bot.brain.states[0]!.rules.at(-1)!;
    expect(fallback.id).toBe(bot.brain.states[0]!.rules.at(-1)!.id);
  }
});

test('library memory commits and recovery state returns after cooling using the real VM',async()=>{
  for(const id of ['memory','transition']){
    const node=nodeLibrary.find(node=>node.id===id)!,added=insertLibraryNode(sliceKits[2]!,0,node);
    // Isolate the newly inserted decision while retaining its real state references.
    added.bot.brain.states[0]!.rules=[added.bot.brain.states[0]!.rules[added.ruleIndex]!];
    const world=await createWorld(added.bot,sliceKits[0]!),a=world.actors.A,sensors=observation(world,a);
    sensors.set('enemy.distance',4000);sensors.set('self.heat',800);
    const first=decide(a.compiled,initialVM(a.compiled),sensors,a.modules.map(m=>m.placement));
    expect(first.fault).toBeNull();
    if(id==='memory'){
      expect(first.state.variables.get('v0')).toBe(1);
      expect(decide(a.compiled,first.state,sensors,a.modules.map(m=>m.placement)).state.variables.get('v0')).toBe(2);
    }else{
      expect(first.state.stateId).toBe('s1');
      const waiting=decide(a.compiled,first.state,sensors,a.modules.map(m=>m.placement));expect(waiting.state.stateId).toBe('s1');
      sensors.set('self.heat',400);
      const cooled=decide(a.compiled,waiting.state,sensors,a.modules.map(m=>m.placement));expect(cooled.fault).toBeNull();expect(cooled.state.stateId).toBe('s0');
    }
  }
});

test('node library respects state/rule/variable caps and describes compound conditions honestly',()=>{
  const bot=structuredClone(sliceKits[0]!);
  expect(nodeUnavailable(bot,0,nodeLibrary.find(n=>n.id==='burst')!)).toContain('súng Burst');
  bot.brain.states[0]!.rules=Array.from({length:32},(_,i)=>({...bot.brain.states[0]!.rules[0]!,id:`r${i}`}));
  expect(nodeUnavailable(bot,0,nodeLibrary[0]!)).toContain('32 luật');
  bot.brain.states[0]!.rules=[];
  bot.brain.states=Array.from({length:32},(_,i)=>({id:`s${i}`,rules:[]}));
  expect(nodeUnavailable(bot,0,nodeLibrary.find(n=>n.id==='transition')!)).toContain('32 trạng thái');
  bot.brain.variables=Array.from({length:64},(_,i)=>({id:`v${i}`,type:'int',initial:0}));
  expect(nodeUnavailable(bot,0,nodeLibrary.find(n=>n.id==='memory')!)).toContain('64 biến');
  expect(conditionSummary({kind:'all',args:[{kind:'bool',value:true}]})).toContain('AND');
  expect(conditionSummary({kind:'any',args:[{kind:'bool',value:false}]})).toContain('OR');
});
