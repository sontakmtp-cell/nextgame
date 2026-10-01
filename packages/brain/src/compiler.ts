import { assertBrain, canonical, ContractError, geometryOrder, SENSORS, validateSchema } from '@prompt-chien/contracts';
import type { BrainSource, CompiledBrain, Expr, InlineRule, ModuleIntent, Placement, SkillCall, ValueType } from '@prompt-chien/contracts';
import { COMPILER_DIGEST } from './identity.js';
export { SENSORS } from '@prompt-chien/contracts';
export function compile(source: BrainSource, placements: readonly Placement[]): CompiledBrain {
  // Preflight the entire in-memory input before AJV or expansion allocation.
  let sourceNodes=0;
  const pending: {value:unknown;exprDepth:number}[]=[{value:source,exprDepth:0}];
  while(pending.length) {
    const {value,exprDepth}=pending.pop()!;
    if(value!==null&&typeof value==='object') {
      if(++sourceNodes>4096)throw new ContractError('SOURCE_NODE_CAP','/brain');
      const depth='kind' in value?exprDepth+1:Array.isArray(value)?exprDepth:0;
      if(depth>16)throw new ContractError('EXPR_DEPTH','/brain');
      for(const child of Object.values(value))pending.push({value:child,exprDepth:depth});
    }
  }
  canonical(source);
  assertBrain(source);
  validateSchema('body',{grid:'square-12-v1',modules:placements});
  let work=0,nodes=0;
  const spend=()=>{if(++work>50000)throw new ContractError('COMPILER_WORK_CAP','/brain');};
  const emit=()=>{spend();if(++nodes>2048)throw new ContractError('IR_NODE_CAP','/brain');};
  const fail: (code:string,pointer:string)=>never = (code,pointer)=>{throw new ContractError(code,pointer);};
  const unique=<T extends {id:string}>(rows:readonly T[],pointer:string):Map<string,T>=>{
    const map=new Map<string,T>();
    for(const row of rows){if(map.has(row.id))fail('DUPLICATE_ID',pointer);map.set(row.id,row);}
    return map;
  };
  const modules=[...placements].sort(geometryOrder);
  const moduleMap=unique(modules,'/body/modules');
  const variableMap=unique(source.variables,'/brain/variables'),stateMap=unique(source.states,'/brain/states'),skills=unique(source.skills,'/brain/skills');
  if(!stateMap.has(source.initialState))fail('STATE_REFERENCE','/brain/initialState');
  const vars=new Map(source.variables.map((v,i)=>[v.id,`v${i}`])),states=new Map(source.states.map((s,i)=>[s.id,`s${i}`])),moduleIds=new Map(modules.map((m,i)=>[m.id,`m${i}`]));
  let edges=0;
  const walkSkill=(id:string,path:Set<string>,depth:number):void=>{
    spend();
    if(depth>4)fail('SKILL_DEPTH','/brain/skills');
    if(path.has(id))fail('SKILL_CYCLE','/brain/skills');
    const skill=skills.get(id);if(!skill)fail('SKILL_REFERENCE','/brain/skills');
    if('useSkill' in skill.body){path.add(id);walkSkill(skill.body.useSkill,path,depth+1);path.delete(id);}
  };
  for(const skill of source.skills) {
    unique(skill.parameters,'/brain/skills/parameters');
    if(!('useSkill' in skill.body)&&typeof skill.body.nextState==='string')fail('STATE_PARAMETER','/brain/skills');
    if('useSkill' in skill.body)edges++;
    walkSkill(skill.id,new Set(),1);
  }
  for(const state of source.states){unique(state.rules,'/brain/states/rules');for(const rule of state.rules)if('useSkill' in rule)edges++;}
  if(edges>64)fail('SKILL_EDGE_CAP','/brain/skills');
  type Environment=Map<string,Expr|string>;
  const substitute=(expr:Expr,env:Environment,pointer:string,depth=1,counter={nodes:0}):Expr=>{
    spend();if(depth>16)fail('EXPR_DEPTH',pointer);
    if(++counter.nodes>2048)fail('IR_NODE_CAP',pointer);
    if(expr.kind==='param') {
      const value=env.get(expr.id);if(!value||typeof value==='string')fail('PARAM_REFERENCE',pointer);
      return substitute(value,new Map(),pointer,depth,counter);
    }
    const child=(value:Expr)=>substitute(value,env,pointer,depth+1,counter);
    switch(expr.kind){
      case 'op':case 'compare':return {...expr,left:child(expr.left),right:child(expr.right)};
      case 'clamp':return {...expr,value:child(expr.value),min:child(expr.min),max:child(expr.max)};
      case 'all':case 'any':return {...expr,args:expr.args.map(child)};
      case 'not':return {...expr,value:child(expr.value)};
      default:return {...expr};
    }
  };
  const expression=(expr:Expr,environment:Environment,pointer:string,depth=1):{expr:Expr;type:ValueType}=>{
    spend();if(depth>16)fail('EXPR_DEPTH',pointer);
    if(expr.kind==='param') {
      const value=environment.get(expr.id);
      if(!value||typeof value==='string')fail('PARAM_REFERENCE',pointer);
      return expression(value,new Map(),pointer,depth);
    }
    emit();
    const child=(e:Expr)=>expression(e,environment,pointer,depth+1);
    const expect=(e:Expr,type:ValueType):Expr=>{const result=child(e);if(result.type!==type)fail('TYPE_MISMATCH',pointer);return result.expr;};
    switch(expr.kind) {
      case 'const':return {expr:{...expr},type:'int'};
      case 'bool':return {expr:{...expr},type:'bool'};
      case 'var':{
        const variable=variableMap.get(expr.id);if(!variable)fail('VARIABLE_REFERENCE',pointer);
        return {expr:{kind:'var',id:vars.get(expr.id)!},type:variable.type};
      }
      case 'sensor':{
        let name=expr.name;
        const match=/^self\.(weaponReady|moduleAlive)\.(.+)$/.exec(name);
        if(match) {
          const module=moduleMap.get(match[2]!);if(!module)fail('MODULE_REFERENCE',pointer);
          if(match[1]==='weaponReady'&&!['blade','lance','burst','breaker'].includes(module.catalogId))fail('SENSOR_MODULE_TYPE',pointer);
          name=`self.${match[1]}.${moduleIds.get(module.id)!}`;
        } else if(!(SENSORS as readonly string[]).includes(name))fail('UNKNOWN_SENSOR',pointer);
        return {expr:{kind:'sensor',name},type:'int'};
      }
      case 'op':return {expr:{...expr,left:expect(expr.left,'int'),right:expect(expr.right,'int')},type:'int'};
      case 'clamp':return {expr:{...expr,value:expect(expr.value,'int'),min:expect(expr.min,'int'),max:expect(expr.max,'int')},type:'int'};
      case 'not':return {expr:{kind:'not',value:expect(expr.value,'bool')},type:'bool'};
      case 'all':case 'any':return {expr:{...expr,args:expr.args.map(e=>expect(e,'bool'))},type:'bool'};
      case 'compare':{
        const left=child(expr.left),right=child(expr.right);
        if(left.type!==right.type || (left.type==='bool'&&!['eq','ne'].includes(expr.op)))fail('TYPE_MISMATCH',pointer);
        return {expr:{...expr,left:left.expr,right:right.expr},type:'bool'};
      }
    }
  };
  const resolve=(rule:InlineRule|SkillCall,env:Environment,pointer:string,depth=0):{rule:InlineRule;env:Environment}=>{
    spend();if(depth>4)fail('SKILL_DEPTH',pointer);
    if(!('useSkill' in rule))return {rule,env};
    const skill=skills.get(rule.useSkill);if(!skill)fail('SKILL_REFERENCE',pointer);
    if(Object.keys(rule.args).length!==skill.parameters.length)fail('SKILL_ARGS',pointer);
    const next:Environment=new Map();
    for(const parameter of skill.parameters) {
      const arg=rule.args[parameter.id];if(arg===undefined)fail('SKILL_ARGS',pointer);
      if(parameter.type==='state') {
        const state=typeof arg==='string'?arg:arg.kind==='param'?env.get(arg.id):undefined;
        if(typeof state!=='string'||!stateMap.has(state))fail('STATE_PARAMETER',pointer);
        next.set(parameter.id,state);
      } else {
        if(typeof arg==='string')fail('TYPE_MISMATCH',pointer);
        // Typecheck now, but keep source identifiers for hygienic substitution in the body.
        const value=substitute(arg,env,pointer);
        const before=nodes,result=expression(value,new Map(),pointer);nodes=before;
        if(result.type!==parameter.type)fail('TYPE_MISMATCH',pointer);
        next.set(parameter.id,value);
      }
    }
    return resolve(skill.body,next,pointer,depth+1);
  };
  const lower=(raw:InlineRule|SkillCall,env:Environment,pointer:string):InlineRule=>{
    const resolved=resolve(raw,env,pointer),rule=resolved.rule;
    const typed=(expr:Expr,type:ValueType):Expr=>{const value=expression(expr,resolved.env,pointer);if(value.type!==type)fail('TYPE_MISMATCH',pointer);return value.expr;};
    emit();
    const seen=new Set<string>();
    const intents:ModuleIntent[]=rule.intent.modules.map(intent=>{
      emit();const module=moduleMap.get(intent.moduleId);
      if(!module)fail('MODULE_REFERENCE',pointer);
      if(seen.has(module.id))fail('DUPLICATE_INTENT',pointer);seen.add(module.id);
      if(intent.action==='activate') {
        if(!['blade','lance','burst','breaker'].includes(module.catalogId))fail('ACTION_MODULE_TYPE',pointer);
        return {...intent,moduleId:moduleIds.get(module.id)!,aimOffset:typed(intent.aimOffset,'int')};
      }
      if(module.catalogId!=='shield')fail('ACTION_MODULE_TYPE',pointer);
      return {...intent,moduleId:moduleIds.get(module.id)!};
    });
    const result:InlineRule={when:typed(rule.when,'bool'),intent:{thrust:{forward:typed(rule.intent.thrust.forward,'int'),strafe:typed(rule.intent.thrust.strafe,'int')},turn:typed(rule.intent.turn,'int'),modules:intents}};
    if(rule.set) {
      const written=new Set<string>();
      result.set=rule.set.map(assignment=>{
        emit();const variable=variableMap.get(assignment.variable);if(!variable)fail('VARIABLE_REFERENCE',pointer);
        if(written.has(variable.id))fail('DUPLICATE_WRITE',pointer);written.add(variable.id);
        return {variable:vars.get(variable.id)!,value:typed(assignment.value,variable.type)};
      });
    }
    if(rule.nextState!==undefined) {
      const target=typeof rule.nextState==='string'?rule.nextState:resolved.env.get(rule.nextState.parameter);
      if(typeof target!=='string'||!states.has(target))fail('STATE_REFERENCE',pointer);
      result.nextState=states.get(target)!;
    }
    return result;
  };
  // Unused skill definitions must be valid too; their emitted nodes do not belong to the IR.
  for(const [index,skill] of source.skills.entries()) {
    const env:Environment=new Map(skill.parameters.map(p=>[p.id,p.type==='state'?source.initialState:p.type==='int'?{kind:'const',value:0}:{kind:'bool',value:false}]));
    const before=nodes;lower(skill.body,env,`/brain/skills/${index}/body`);nodes=before;
  }
  const sourceMap:Record<string,string>=Object.create(null) as Record<string,string>;
  const normalizedIR={abiVersion:'2.0' as const,initialState:states.get(source.initialState)!,variables:source.variables.map((v,i)=>({...v,id:`v${i}`})),states:source.states.map((state,si)=>({id:`s${si}`,rules:state.rules.map((rule,ri)=>{
    const key=`s${si}/r${ri}`,pointer=`/brain/states/${si}/rules/${ri}`;sourceMap[key]=pointer;
    if('useSkill' in rule) sourceMap[`${key}/skill`]=`/brain/skills/${source.skills.findIndex(s=>s.id===rule.useSkill)}/body`;
    return {id:`r${ri}`,...lower(rule,new Map(),pointer)};
  })}))};
  return {brainAbiVersion:'2.0',compilerDigest:COMPILER_DIGEST,normalizedIR,sourceMap,symbolMap:{modules:modules.map(m=>m.id),states:source.states.map(s=>s.id),variables:source.variables.map(v=>v.id)},nodeCount:nodes};
}
