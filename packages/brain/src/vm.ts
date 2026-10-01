import { ContractError } from '@prompt-chien/contracts';
import type { CompiledBrain, ControlIntent, Diagnostic, Expr, Placement } from '@prompt-chien/contracts';
export class GasMeter {
  used=0;
  constructor(readonly limit=4096) { if(!Number.isInteger(limit)||limit<1||limit>4096)throw new ContractError('GAS_LIMIT',''); }
  consume():void { if(++this.used>this.limit)throw new ContractError('GAS_EXHAUSTED',''); }
}
export interface VMState { stateId:string; stateAge:number; decision:number; variables:Map<string,number|boolean>; faultStreak:number; held:{thrust:{forward:number;strafe:number};turn:number} }
export interface Decision { intent:ControlIntent; gas:number; state:VMState; fault:string|null; brainBudgetLoss:boolean; ruleId:string|null; observationsUsed:Record<string,number>; varDiff:Record<string,number|boolean>; rejections:Diagnostic[] }
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n));
const sat=(n:bigint)=>Number(n< -2147483648n?-2147483648n:n>2147483647n?2147483647n:n);
export function evaluate(expr:Expr,variables:ReadonlyMap<string,number|boolean>,sensors:ReadonlyMap<string,number>,gas:GasMeter,used:Map<string,number>=new Map()):number|boolean {
  gas.consume();
  const child=(value:Expr)=>evaluate(value,variables,sensors,gas,used);
  const integer=(value:Expr):number=>{const result=child(value);if(typeof result!=='number')throw new ContractError('VM_TYPE','');return result;};
  switch(expr.kind) {
    case 'const':case 'bool':return expr.value;
    case 'var':{const value=variables.get(expr.id);if(value===undefined)throw new ContractError('VM_VARIABLE','');return value;}
    case 'param':throw new ContractError('UNLOWERED_PARAM','');
    case 'sensor':{const value=sensors.get(expr.name);if(value===undefined||!Number.isInteger(value)||value< -2147483648||value>2147483647)throw new ContractError('OBSERVATION_INVALID','',expr.name);used.set(expr.name,value);return value;}
    case 'op':{
      const a=BigInt(integer(expr.left)),b=BigInt(integer(expr.right));
      switch(expr.op){case 'add':return sat(a+b);case 'sub':return sat(a-b);case 'mul':return sat(a*b);case 'div':if(b===0n)throw new ContractError('DIV_ZERO','');return sat(a/b);case 'min':return Number(a<b?a:b);case 'max':return Number(a>b?a:b);}
    }
    case 'clamp':{const value=integer(expr.value),min=integer(expr.min),max=integer(expr.max);if(min>max)throw new ContractError('CLAMP_FAULT','');return clamp(value,min,max);}
    case 'not':return !child(expr.value);
    case 'all':for(const item of expr.args)if(!child(item))return false;return true;
    case 'any':for(const item of expr.args)if(child(item))return true;return false;
    case 'compare':{
      const a=child(expr.left),b=child(expr.right);
      switch(expr.op){case 'eq':return a===b;case 'ne':return a!==b;case 'lt':return a<b;case 'lte':return a<=b;case 'gt':return a>b;case 'gte':return a>=b;}
    }
  }
}
export function initialVM(compiled:CompiledBrain):VMState {
  return {stateId:compiled.normalizedIR.initialState,stateAge:0,decision:0,variables:new Map(compiled.normalizedIR.variables.map(v=>[v.id,v.initial])),faultStreak:0,held:{thrust:{forward:0,strafe:0},turn:0}};
}
export function decide(compiled:CompiledBrain,previous:VMState,observations:ReadonlyMap<string,number>,modules:readonly Placement[],gasLimit=4096):Decision {
  if(previous.variables.size>64||observations.size>80||modules.length>24)throw new ContractError('VM_INPUT_CAP','');
  const gas=new GasMeter(gasLimit),used=new Map<string,number>(),variables=new Map(previous.variables),diff:Record<string,number|boolean>=Object.create(null) as Record<string,number|boolean>;
  const rejections:Diagnostic[]=[],idle:ControlIntent={thrust:{forward:0,strafe:0},turn:0,modules:[]};
  let ruleId:string|null=null;
  const state:VMState={...previous,variables,held:previous.held,decision:previous.decision+1};
  const sensors=new Map(observations);sensors.set('clock.decision',previous.decision);sensors.set('clock.stateAge',previous.stateAge);
  try {
    const active=compiled.normalizedIR.states.find(s=>s.id===previous.stateId);
    if(!active)throw new ContractError('VM_STATE','');
    let intent=idle;
    for(const rule of active.rules) {
      gas.consume();
      if(!evaluate(rule.when,previous.variables,sensors,gas,used))continue;
      ruleId=rule.id;
      const number=(expr:Expr)=>{const value=evaluate(expr,previous.variables,sensors,gas,used);if(typeof value!=='number')throw new ContractError('VM_TYPE','');return value;};
      let forward=clamp(number(rule.intent.thrust.forward),-1000,1000),strafe=clamp(number(rule.intent.thrust.strafe),-1000,1000);
      const length=isqrt(BigInt(forward)**2n+BigInt(strafe)**2n);
      if(length>1000n){forward=Number(BigInt(forward)*1000n/length);strafe=Number(BigInt(strafe)*1000n/length);}
      intent={thrust:{forward,strafe},turn:clamp(number(rule.intent.turn),-1000,1000),modules:[]};
      for(const event of rule.intent.modules) {
        gas.consume();const moduleOrdinal=Number(event.moduleId.slice(1));
        if(event.action==='activate') {
          const requested=number(event.aimOffset),module=modules[moduleOrdinal];
          if(!module)throw new ContractError('VM_MODULE','');
          if(['blade','lance'].includes(module.catalogId)&&requested!==0){rejections.push({code:'AIM_NOT_SUPPORTED',pointer:compiled.sourceMap[`${active.id}/${rule.id}`]??'',message:`module ${moduleOrdinal}`});continue;}
          const aimOffset=clamp(requested,-256,256);
          if(aimOffset!==requested)rejections.push({code:'aimClamped',pointer:compiled.sourceMap[`${active.id}/${rule.id}`]??'',message:`module ${moduleOrdinal}`});
          intent.modules.push({moduleOrdinal,action:'activate',aimOffset,priority:event.priority});
        } else intent.modules.push({moduleOrdinal,action:event.action,priority:event.priority});
      }
      intent.modules.sort((a,b)=>a.priority-b.priority||a.moduleOrdinal-b.moduleOrdinal);
      for(const assignment of rule.set??[]) {
        gas.consume();const value=evaluate(assignment.value,previous.variables,sensors,gas,used);
        variables.set(assignment.variable,value);if(value!==previous.variables.get(assignment.variable))diff[assignment.variable]=value;
      }
      if(rule.nextState!==undefined) {
        gas.consume();if(typeof rule.nextState!=='string')throw new ContractError('UNLOWERED_STATE','');
        state.stateId=rule.nextState;
      }
      break;
    }
    state.stateAge=state.stateId===previous.stateId?previous.stateAge+1:0;
    state.faultStreak=0;state.held={thrust:{...intent.thrust},turn:intent.turn};
    return {intent,state,gas:gas.used,fault:null,brainBudgetLoss:false,ruleId,observationsUsed:Object.fromEntries(used),varDiff:diff,rejections};
  } catch(error) {
    if(!(error instanceof ContractError))throw error;
    const faultState:VMState={...previous,stateAge:previous.stateAge+1,decision:previous.decision+1,faultStreak:previous.faultStreak+1,held:{thrust:{forward:0,strafe:0},turn:0}};
    return {intent:idle,state:faultState,gas:gas.used,fault:error.code,brainBudgetLoss:faultState.faultStreak>=10,ruleId,observationsUsed:Object.fromEntries(used),varDiff:{},rejections:[]};
  }
}
export function isqrt(value:bigint):bigint {
  if(value<0n)throw new ContractError('SQRT_NEGATIVE','');
  if(value<2n)return value;
  let x=value,y=(x+1n)/2n;
  while(y<x){x=y;y=(x+value/x)/2n;}
  return x;
}
/** At non-decision ticks only movement is held; activation/toggle events are never repeated. */
export function heldIntent(state:VMState):ControlIntent{return {thrust:{...state.held.thrust},turn:state.held.turn,modules:[]};}
