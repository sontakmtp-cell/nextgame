import { ContractError, digest, sha256 } from '@prompt-chien/contracts';
import type { CatalogEntry, BotDefinition, PresetValues } from '@prompt-chien/contracts';
export { SIN, COS } from './lut.js';
export { contentManifest } from './manifest.js';
export const catalog: readonly CatalogEntry[] = [
  {id:'core',cost:20,mass:12,hp:800,enabled:true,damage:false,max:1,footprint:2},
  {id:'thruster',cost:6,mass:3,hp:180,enabled:true,damage:false,max:6,footprint:1},
  {id:'armor',cost:4,mass:4,hp:300,enabled:true,damage:false,max:24,footprint:1},
  {id:'blade',cost:14,mass:5,hp:220,enabled:true,damage:true,max:3,footprint:1},
  {id:'lance',cost:18,mass:6,hp:200,enabled:false,damage:true,max:3,footprint:1},
  {id:'burst',cost:16,mass:5,hp:180,enabled:true,damage:true,max:3,footprint:1},
  {id:'shield',cost:12,mass:4,hp:260,enabled:true,damage:false,max:1,footprint:1},
  {id:'breaker',cost:12,mass:4,hp:180,enabled:false,damage:true,max:3,footprint:1},
  {id:'capacitor',cost:8,mass:2,hp:160,enabled:true,damage:false,max:2,footprint:1},
  {id:'radiator',cost:6,mass:2,hp:160,enabled:true,damage:false,max:2,footprint:1}
];
export const ruleset = {
  version:'alpha-0', numericalAbiVersion:'milli-v1',tickHz:60,decisionEvery:6,maxTicks:5400,
  grid:12,moduleCap:24,costCap:100,radiusCap:6500,
  units:{position:'milli-unit',velocity:'milli-unit/s',angleCircle:4096,trigScale:1000000,multiplierScale:1000},
  movement:{driveFactor:8,vMax:6000,accel:12000,damping:6000,leverCap:4000,angularSpeed:1024,angularAccel:2048,solverIterations:4},
  resources:{energy:1000,regen:2,heatCap:1000,cooling:1,overheatClear:600,capacitorCapacity:250,radiatorCooling:1},
  weapons:{blade:{damage:90,reach:1500,windup:18,active:6,recovery:30,energy:140,heat:180},lance:{damage:140,reach:3000,width:400,windup:30,active:1,recovery:59,energy:220,heat:280},burst:{damage:32,range:12000,speed:18000,offsets:[0,4,8],windup:18,active:9,recovery:45,energy:180,heat:220},breaker:{damage:60,targetHeat:180,range:6000,speed:14000,radius:100,windup:24,active:1,recovery:65,energy:160,heat:140}},
  shield:{arc:1024,extraRadius:250,energy:40,heat:20,upkeep:1,resetTicks:30,blockPermille:700,damagePerEnergy:2},
  armorKineticPermille:700,projectileCap:128,
  arena:{width:40000,height:28000,leftX:-12000,rightX:12000,controlRadius:3000,controlStart:600,controlOpportunities:4800,ringNotice:3480,ringStart:3600,ringInitialRadius:25000,ringFinalRadius:6000,ringDamagePermillePerSecond:50},
  timeout:{controlWeight:5,damageWeight:3,hpWeight:2,drawGap:100}
} as const;
const yValues=[-3000,-2000,-1000,0,1000,2000,3000],jitters=[-128,-64,0,64,128];
export const arenaPresets: readonly PresetValues[] = yValues.flatMap(yLeft=>yValues.flatMap(yRight=>jitters.flatMap(jitterLeft=>jitters.map(jitterRight=>({yLeft,yRight,jitterLeft,jitterRight})))));
export async function scenarioForSeed(seed: string): Promise<{scenarioId:number;presetValues:PresetValues}> {
  if(!/^[a-f0-9]{32}$/.test(seed)) throw new ContractError('SEED128','/seed');
  let value=BigInt(`0x${seed}`);
  const suffix=new TextEncoder().encode('open-alpha-init-v1'),bytes=new Uint8Array(16+suffix.length);
  for(let i=0;i<16;i++){bytes[i]=Number(value&255n);value>>=8n;}
  bytes.set(suffix,16);
  const hex=await sha256(bytes);
  const first=Uint8Array.from(hex.slice(0,8).match(/../g)!,x=>parseInt(x,16));
  const scenarioId=new DataView(first.buffer).getUint32(0,true)%1225;
  return {scenarioId,presetValues:arenaPresets[scenarioId]!};
}
export async function buildSuite(tuningCount=100,holdoutCount=200): Promise<{version:string;tuning:{scenarioId:number;seed:string}[];holdout:{scenarioId:number;seed:string}[];seedSetDigest:string}> {
  if(!Number.isInteger(tuningCount)||!Number.isInteger(holdoutCount)||tuningCount<1||holdoutCount<1||tuningCount+holdoutCount>1225)throw new ContractError('SUITE_CAP','');
  const seeds=new Map<number,string>();
  // ponytail: linear seed search over 1,225 presets; cache an approved manifest if larger suites become frequent.
  for(let seed=0n;seeds.size<tuningCount+holdoutCount;seed++) {
    const text=seed.toString(16).padStart(32,'0'),{scenarioId}=await scenarioForSeed(text);
    if(scenarioId<tuningCount+holdoutCount&&!seeds.has(scenarioId))seeds.set(scenarioId,text);
  }
  const rows=Array.from({length:tuningCount+holdoutCount},(_,scenarioId)=>({scenarioId,seed:seeds.get(scenarioId)!}));
  const manifest={version:'open-alpha-suite-v1',tuning:rows.slice(0,tuningCount),holdout:rows.slice(tuningCount)};
  return {...manifest,seedSetDigest:await digest(manifest)};
}
const constant=(value:number)=>({kind:'const' as const,value});
const definitions=[
  {name:'Mantis',cells:[['blade',7,5],['radiator',5,4],['armor',6,4]]},
  {name:'Bastion',cells:[['lance',7,5],['shield',7,6],['armor',6,4]]},
  {name:'Kestrel',cells:[['burst',7,5],['capacitor',5,4]]},
  {name:'Ram',cells:[['lance',7,5],['armor',8,5],['armor',6,4]]},
  {name:'Wisp',cells:[['breaker',7,6],['radiator',5,4]]},
  {name:'Chimera',cells:[['blade',7,5],['burst',7,6],['radiator',5,4]]}
] as const;
/** Planned body kits; Bastion/Ram/Wisp intentionally require the T13 catalog. Brains are idle syntax fixtures. */
export const referenceKits: readonly BotDefinition[] = definitions.map(({name,cells})=>({
  schemaVersion:'2.0',name,
  body:{grid:'square-12-v1',modules:[
    {id:'coreMain',catalogId:'core',cell:{x:5,y:5},orientation:0},
    {id:'driveTop',catalogId:'thruster',cell:{x:4,y:5},orientation:0},
    {id:'driveBottom',catalogId:'thruster',cell:{x:4,y:6},orientation:0},
    ...cells.map(([catalogId,x,y],i)=>({id:`part${i}`,catalogId,cell:{x,y},orientation:0 as const}))
  ]},
  brain:{abiVersion:'2.0',initialState:'idle',variables:[],skills:[],states:[{id:'idle',rules:[{id:'wait',when:{kind:'bool',value:true},intent:{thrust:{forward:constant(0),strafe:constant(0)},turn:constant(0),modules:[]}}]}]},
  cosmetic:{skinId:'ceramic-default',paletteId:'team-auto'}
}));
