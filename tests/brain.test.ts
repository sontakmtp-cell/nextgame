import { describe,it,expect } from 'vitest';
import { ContractError, geometryOrder, validateSchema } from '../packages/contracts/dist/index.js';
import type { BrainSource,Expr } from '../packages/contracts/dist/index.js';
import { compile, decide, evaluate, GasMeter, heldIntent, initialVM, isqrt, SENSORS } from '../packages/brain/dist/index.js';
import { b,brain,c,drive,sample } from './helpers.js';
const modules=()=>sample().body.modules.sort(geometryOrder);
const run=(source:BrainSource,sensors:Map<string,number>=new Map())=>{const compiled=compile(source,modules());return decide(compiled,initialVM(compiled),sensors,modules());};
const arithmetic=(op:'add'|'sub'|'mul'|'div'|'min'|'max',left:number,right:number):Expr=>({kind:'op',op,left:c(left),right:c(right)});
describe('all integer/boolean opcodes and sensors',()=>{
  it.each([
    ['add',2,3,5],['add',2147483647,1,2147483647],['sub',2,3,-1],['sub',-2147483648,1,-2147483648],
    ['mul',2147483647,2147483647,2147483647],['mul',-2147483648,2,-2147483648],['mul',-3,4,-12],
    ['div',-7,3,-2],['div',7,-3,-2],['div',-2147483648,-1,2147483647],['min',-3,4,-3],['max',-3,4,4]
  ] as const)('%s(%d,%d) = %d',(op,left,right,expected)=>{const expr=arithmetic(op,left,right);validateSchema('brain',brain(b(true),expr));expect(evaluate(expr,new Map(),new Map(),new GasMeter())).toBe(expected);});
  it.each(['eq','ne','lt','lte','gt','gte'] as const)('comparison %s',op=>{
    const expr:Expr={kind:'compare',op,left:c(2),right:c(3)};compile(brain(expr),modules());
    expect(evaluate(expr,new Map(),new Map(),new GasMeter())).toBe({eq:false,ne:true,lt:true,lte:true,gt:false,gte:false}[op]);
  });
  it('bool eq/ne, not, clamp, variable lookup are typed',()=>{
    for(const op of ['eq','ne'] as const)expect(evaluate({kind:'compare',op,left:b(true),right:b(false)},new Map(),new Map(),new GasMeter())).toBe(op==='ne');
    expect(evaluate({kind:'not',value:b(true)},new Map(),new Map(),new GasMeter())).toBe(false);
    expect(evaluate({kind:'clamp',value:c(-10),min:c(-5),max:c(8)},new Map(),new Map(),new GasMeter())).toBe(-5);
    expect(evaluate({kind:'var',id:'x'},new Map([['x',99]]),new Map(),new GasMeter())).toBe(99);
    expect(()=>evaluate(arithmetic('div',1,0),new Map(),new Map(),new GasMeter())).toThrowError(expect.objectContaining({code:'DIV_ZERO'}));
  });
  it.each(SENSORS)('allowlisted sensor %s',name=>{
    const result=run(brain(b(true),{kind:'sensor',name}),new Map([[name,17]]));
    const expected=name==='clock.stateAge'||name==='clock.decision'?0:17;
    expect(result.fault).toBeNull();expect(result.intent.thrust.forward).toBe(expected);expect(result.observationsUsed[name]).toBe(expected);
  });
  it('resolves module sensors to geometry ordinal and rejects private enemy resources',()=>{
    const source=brain(b(true),{kind:'sensor',name:'self.weaponReady.bladeFront'}),list=modules(),ordinal=list.findIndex(m=>m.id==='bladeFront');
    expect(run(source,new Map([[`self.weaponReady.m${ordinal}`,1]])).intent.thrust.forward).toBe(1);
    source.states[0]!.rules[0]={id:'first',when:b(true),intent:drive({kind:'sensor',name:'self.moduleAlive.coreMain'})};const core=list.findIndex(m=>m.id==='coreMain');expect(run(source,new Map([[`self.moduleAlive.m${core}`,1]])).fault).toBeNull();
    for(const name of ['enemy.energy','enemy.heat','process.env','Math.random','self.weaponReady.unknown'])expect(()=>compile(brain(b(true),{kind:'sensor',name}),list)).toThrow();
  });
  it('short-circuits all/any left to right and counts only visited expressions',()=>{
    const fault:Expr={kind:'compare',op:'eq',left:arithmetic('div',1,0),right:c(0)};
    for(const expr of [{kind:'all',args:[b(false),fault]},{kind:'any',args:[b(true),fault]}] satisfies Expr[]){const gas=new GasMeter();expect(()=>evaluate(expr,new Map(),new Map(),gas)).not.toThrow();expect(gas.used).toBe(2);}
    const gas=new GasMeter();expect(evaluate({kind:'all',args:[b(true),b(true)]},new Map(),new Map(),gas)).toBe(true);expect(gas.used).toBe(3);
  });
  it('accepts work 4096 and rejects work 4097 without any effect',()=>{
    const gas=new GasMeter();for(let i=0;i<4096;i++)gas.consume();expect(gas.used).toBe(4096);expect(()=>gas.consume()).toThrowError(expect.objectContaining({code:'GAS_EXHAUSTED'}));
    const source=brain();source.variables=[{id:'x',type:'int',initial:1}];source.states[0]!.rules=[{id:'first',when:b(true),intent:drive(c(5)),set:[{variable:'x',value:c(2)}],nextState:'idle'}];
    const compiled=compile(source,modules()),initial=initialVM(compiled),good=decide(compiled,initial,new Map(),modules()),limit=good.gas;
    const failed=decide(compiled,initial,new Map(),modules(),limit-1);expect(failed.fault).toBe('GAS_EXHAUSTED');expect(failed.intent).toEqual({thrust:{forward:0,strafe:0},turn:0,modules:[]});expect(failed.state.variables.get('v0')).toBe(1);expect(failed.varDiff).toEqual({});
    expect(decide(compiled,initial,new Map(),modules(),limit).fault).toBeNull();
  });
  it('the VM itself accepts a synthetic 4096-work decision and atomically faults at 4097',()=>{
    const tree=(nodes:number):Expr=>{
      if(nodes===1)return b(true);
      const childCount=Math.min(16,nodes-1),base=Math.floor((nodes-1)/childCount),extra=(nodes-1)%childCount;
      return {kind:'all',args:Array.from({length:childCount},(_,i)=>tree(base+(i<extra?1:0)))};
    };
    const compiled=compile(brain(),modules());
    // Deliberately bypass the compiler's smaller 2048-node cap to stress the VM's independent gas fence.
    compiled.normalizedIR.states[0]!.rules[0]!.when=tree(4092);
    const good=decide(compiled,initialVM(compiled),new Map(),modules());expect(good.fault).toBeNull();expect(good.gas).toBe(4096);
    compiled.normalizedIR.states[0]!.rules[0]!.when=tree(4093);
    const failed=decide(compiled,initialVM(compiled),new Map(),modules());expect(failed.fault).toBe('GAS_EXHAUSTED');expect(failed.gas).toBe(4097);expect(failed.intent.modules).toEqual([]);expect(failed.state.stateId).toBe('s0');
  });
  it('boolean variables are typed, read from the snapshot and updated atomically',()=>{
    const source=brain({kind:'var',id:'flag'},c(500));source.variables=[{id:'flag',type:'bool',initial:true}];
    source.states[0]!.rules=[{id:'first',when:{kind:'var',id:'flag'},intent:drive(c(500)),set:[{variable:'flag',value:{kind:'not',value:{kind:'var',id:'flag'}}}]}];
    const compiled=compile(source,modules()),first=decide(compiled,initialVM(compiled),new Map(),modules());expect(first.intent.thrust.forward).toBe(500);expect(first.state.variables.get('v0')).toBe(false);
    expect(decide(compiled,first.state,new Map(),modules()).ruleId).toBeNull();
  });
  it.each([0n,1n,2n,3n,4n,9n,10n,18446744073709551615n])('integer square root %s is floor',value=>{const result=isqrt(value);expect(result*result<=value&&(result+1n)*(result+1n)>value).toBe(true);});
});
describe('FSM decision transaction, memory, and event edges',()=>{
  it('first match wins; no match returns idle; holds movement alone until next decision',()=>{
    const source=brain(b(true),c(800));source.states[0]!.rules.push({id:'second',when:b(true),intent:drive(c(-800))});
    const result=run(source);expect(result.intent.thrust.forward).toBe(800);expect(result.ruleId).toBe('r0');expect(heldIntent(result.state)).toEqual({thrust:{forward:800,strafe:0},turn:0,modules:[]});
    const unmatched=run(brain(b(false),c(800)));expect(unmatched.ruleId).toBeNull();expect(unmatched.intent.thrust.forward).toBe(0);
  });
  it('simultaneous writes use the snapshot, commit together, and are hygienic under renaming',()=>{
    const source=brain();source.variables=[{id:'x',type:'int',initial:1},{id:'y',type:'int',initial:2}];source.states[0]!.rules=[{id:'swap',when:b(true),intent:drive(),set:[{variable:'x',value:{kind:'var',id:'y'}},{variable:'y',value:{kind:'var',id:'x'}}]}];
    const result=run(source);expect([...result.state.variables.values()]).toEqual([2,1]);expect(result.varDiff).toEqual({v0:2,v1:1});
    const renamed=JSON.parse(JSON.stringify(source).replaceAll('"x"','"first"').replaceAll('"y"','"second"')) as BrainSource;expect(compile(renamed,modules()).normalizedIR).toEqual(compile(source,modules()).normalizedIR);
  });
  it('state transition is visible on the following decision and stateAge counts decisions',()=>{
    const source=brain();source.states[0]!.rules=[{id:'switch',when:b(true),intent:drive(c(1)),nextState:'other'}];source.states.push({id:'other',rules:[{id:'stay',when:b(true),intent:drive(c(2)),nextState:'other'}]});
    const compiled=compile(source,modules()),first=decide(compiled,initialVM(compiled),new Map(),modules());expect(first.intent.thrust.forward).toBe(1);expect(first.state.stateAge).toBe(0);
    const second=decide(compiled,first.state,new Map(),modules());expect(second.intent.thrust.forward).toBe(2);expect(second.state.stateAge).toBe(1);
  });
  it('division0/clamp faults discard intents/writes/transition and zero held drive; 10 consecutive faults lose',()=>{
    const source=brain(b(true),arithmetic('div',1,0));source.variables=[{id:'x',type:'int',initial:7}];source.states[0]!.rules=[{id:'fault',when:b(true),intent:drive(c(800)),set:[{variable:'x',value:c(4)},{variable:'x2',value:arithmetic('div',1,0)}],nextState:'other'}];source.variables.push({id:'x2',type:'int',initial:9});source.states.push({id:'other',rules:[]});
    const compiled=compile(source,modules());let state=initialVM(compiled);state.held={thrust:{forward:999,strafe:0},turn:800};
    for(let i=1;i<=10;i++){const result=decide(compiled,state,new Map(),modules());expect(result.fault).toBe('DIV_ZERO');expect(result.state.variables.get('v0')).toBe(7);expect(result.state.stateId).toBe('s0');expect(result.brainBudgetLoss).toBe(i===10);expect(result.state.held.turn).toBe(0);expect(result.state.stateAge).toBe(i);state=result.state;}
    expect(run(brain(b(true),{kind:'clamp',value:c(0),min:c(1),max:c(0)})).fault).toBe('CLAMP_FAULT');
  });
  it('a valid decision resets fault streak and missing/float/out-of-range observations fault',()=>{
    const compiled=compile(brain(),modules()),state=initialVM(compiled);state.faultStreak=9;expect(decide(compiled,state,new Map(),modules()).state.faultStreak).toBe(0);
    for(const sensors of [new Map(),new Map([['self.energy',1.5]]),new Map([['self.energy',2147483648]])])expect(run(brain(b(true),{kind:'sensor',name:'self.energy'}),sensors).fault).toBe('OBSERVATION_INVALID');
  });
  it('two Brains on the same body produce different sensor-driven decisions',()=>{
    const passive=brain(),adaptive=brain({kind:'compare',op:'eq',left:{kind:'sensor',name:'enemy.telegraph'},right:c(1)},c(-800));
    expect(run(passive).intent.thrust.forward).toBe(0);expect(run(adaptive,new Map([['enemy.telegraph',1]])).intent.thrust.forward).toBe(-800);expect(run(adaptive,new Map([['enemy.telegraph',0]])).intent.thrust.forward).toBe(0);
  });
  it('module events sort by priority then geometry ordinal, never module spelling; activation is an edge',()=>{
    const source=brain(),list=modules();source.states[0]!.rules=[{id:'fire',when:b(true),intent:{...drive(c(800)),modules:[{moduleId:'shieldMain',action:'shieldOn',priority:0},{moduleId:'bladeFront',action:'activate',aimOffset:c(0),priority:0}]}}];
    const result=run(source);expect(result.intent.modules.map(m=>m.moduleOrdinal)).toEqual([list.findIndex(m=>m.id==='bladeFront'),list.findIndex(m=>m.id==='shieldMain')]);expect(heldIntent(result.state).modules).toEqual([]);
  });
  it.each([-257,-256,256,257])('ranged aim %d clamps with a private diagnostic',aim=>{
    const list=modules();list.find(m=>m.id==='bladeFront')!.catalogId='burst';const source=brain();source.states[0]!.rules=[{id:'fire',when:b(true),intent:{...drive(),modules:[{moduleId:'bladeFront',action:'activate',aimOffset:c(aim),priority:0}]}}];
    const compiled=compile(source,list),result=decide(compiled,initialVM(compiled),new Map(),list);expect(result.intent.modules[0]).toHaveProperty('aimOffset',Math.max(-256,Math.min(256,aim)));expect(result.rejections).toHaveLength(Math.abs(aim)>256?1:0);
  });
  it.each([-1,0,1])('Blade aim %d is rejected unless zero, without faulting the decision',aim=>{
    const source=brain();source.states[0]!.rules=[{id:'fire',when:b(true),intent:{...drive(c(800)),modules:[{moduleId:'bladeFront',action:'activate',aimOffset:c(aim),priority:0}]}}];
    const result=run(source);expect(result.fault).toBeNull();expect(result.intent.modules).toHaveLength(aim===0?1:0);expect(result.intent.thrust.forward).toBe(800);
  });
});
describe('bounded compiler and hygienic skills',()=>{
  it('inline skill lowers identically and sourceMap preserves caller/definition',()=>{
    const direct=brain(b(true),c(500)),source=brain();source.skills=[{id:'move',parameters:[{id:'speed',type:'int'}],body:{when:b(true),intent:drive({kind:'param',id:'speed'})}}];source.states[0]!.rules=[{id:'first',useSkill:'move',args:{speed:c(500)}}];
    const compiled=compile(source,modules());expect(compiled.normalizedIR).toEqual(compile(direct,modules()).normalizedIR);expect(run(source).intent).toEqual(run(direct).intent);expect(compiled.sourceMap['s0/r0/skill']).toBe('/brain/skills/0/body');
  });
  it('state references are explicit parameters and nested forwarding substitutes within typed expressions',()=>{
    const source=brain();source.states.push({id:'next',rules:[]});
    source.skills=[{id:'inner',parameters:[{id:'speed',type:'int'},{id:'target',type:'state'}],body:{when:b(true),intent:drive({kind:'param',id:'speed'}),nextState:{parameter:'target'}}},{id:'outer',parameters:[{id:'p',type:'int'},{id:'s',type:'state'}],body:{useSkill:'inner',args:{speed:{kind:'op',op:'add',left:{kind:'param',id:'p'},right:c(100)},target:{kind:'param',id:'s'}}}}];
    source.states[0]!.rules=[{id:'first',useSkill:'outer',args:{p:c(500),s:'next'}}];expect(run(source).intent.thrust.forward).toBe(600);expect(run(source).state.stateId).toBe('s1');
  });
  it.each([
    ['TYPE_MISMATCH',(s:BrainSource)=>{s.states[0]!.rules=[{id:'first',when:c(1),intent:drive()}];}],
    ['DUPLICATE_ID',(s:BrainSource)=>{s.states.push({...s.states[0]!});}],
    ['STATE_REFERENCE',(s:BrainSource)=>{s.initialState='missing';}],
    ['VARIABLE_REFERENCE',(s:BrainSource)=>{s.states[0]!.rules=[{id:'first',when:b(true),intent:drive({kind:'var',id:'missing'})}];}],
    ['DUPLICATE_WRITE',(s:BrainSource)=>{s.variables=[{id:'x',type:'int',initial:0}];s.states[0]!.rules=[{id:'first',when:b(true),intent:drive(),set:[{variable:'x',value:c(1)},{variable:'x',value:c(2)}]}];}],
    ['DUPLICATE_INTENT',(s:BrainSource)=>{s.states[0]!.rules=[{id:'first',when:b(true),intent:{...drive(),modules:[{moduleId:'shieldMain',action:'shieldOn',priority:0},{moduleId:'shieldMain',action:'shieldOff',priority:1}]}}];}],
    ['ACTION_MODULE_TYPE',(s:BrainSource)=>{s.states[0]!.rules=[{id:'first',when:b(true),intent:{...drive(),modules:[{moduleId:'coreMain',action:'activate',aimOffset:c(0),priority:0}]}}];}],
    ['SKILL_CYCLE',(s:BrainSource)=>{s.skills=[{id:'recursive',parameters:[],body:{useSkill:'recursive',args:{}}}];}],
    ['SKILL_REFERENCE',(s:BrainSource)=>{s.states[0]!.rules=[{id:'first',useSkill:'missing',args:{}}];}]
  ])('rejects %s',(code,mutate)=>{const source=brain();mutate(source);expect(()=>compile(source,modules())).toThrowError(expect.objectContaining({code}));});
  it('enforces expanded call depth four and expression depth sixteen',()=>{
    const source=brain();source.skills=Array.from({length:5},(_,i)=>({id:`skill${i}`,parameters:[],body:i===4?{when:b(true),intent:drive()}:{useSkill:`skill${i+1}`,args:{}}}));expect(()=>compile(source,modules())).toThrowError(expect.objectContaining({code:'SKILL_DEPTH'}));
    let value=b(true);for(let i=0;i<15;i++)value={kind:'not',value};expect(()=>compile(brain(value),modules())).not.toThrow();value={kind:'not',value};expect(()=>compile(brain(value),modules())).toThrowError(expect.objectContaining({code:'EXPR_DEPTH'}));
  });
  it('bounds source node count, expanded IR and skill edges before allocating a huge result',()=>{
    const source=brain();const expr:Expr={kind:'all',args:Array.from({length:16},()=>({kind:'all',args:Array.from({length:16},()=>b(true))}))};
    source.skills=[{id:'expand',parameters:[{id:'p',type:'bool'}],body:{when:{kind:'all',args:Array.from({length:16},()=>({kind:'param',id:'p'}))},intent:drive()}}];source.states[0]!.rules=[{id:'first',useSkill:'expand',args:{p:expr}}];expect(()=>compile(source,modules())).toThrowError(expect.objectContaining({code:'IR_NODE_CAP'}));
    const huge=brain();huge.states=Array.from({length:32},(_,si)=>({id:`s${si}`,rules:Array.from({length:32},(_,ri)=>({id:`r${ri}`,when:b(true),intent:drive()}))}));huge.initialState='s0';expect(()=>compile(huge,modules())).toThrowError(expect.objectContaining({code:'SOURCE_NODE_CAP'}));
    const edges=brain();edges.skills=[{id:'simple',parameters:[],body:{when:b(true),intent:drive()}}];edges.states=Array.from({length:3},(_,si)=>({id:`s${si}`,rules:Array.from({length:22},(_,ri)=>({id:`r${ri}`,useSkill:'simple',args:{}}))}));edges.initialState='s0';expect(()=>compile(edges,modules())).toThrowError(expect.objectContaining({code:'SKILL_EDGE_CAP'}));
  });
  it('invalid unused skills fail, and poison cannot exploit dictionary lookup',()=>{
    const source=brain();source.skills=[{id:'unused',parameters:[],body:{when:b(true),intent:drive({kind:'sensor',name:'enemy.energy'})}}];expect(()=>compile(source,modules())).toThrow();
    expect(()=>compile(JSON.parse(JSON.stringify(brain()).replaceAll('idle','constructor')) as BrainSource,modules())).toThrow();
  });
  it('compiler errors include a diagnostic pointer and never execute host code',()=>{
    try{compile(brain(b(true),{kind:'sensor',name:'eval'}),modules());throw new Error('accepted');}catch(error){expect(error).toBeInstanceOf(ContractError);expect((error as ContractError).pointer).toBe('/brain/states/0/rules/0');}
  });
});
