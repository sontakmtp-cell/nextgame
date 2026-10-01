import { Ajv2020 } from 'ajv/dist/2020.js';
import { ContractError, canonical, decodeJson } from './json.js';
import type { BotDefinition, BrainSource } from './types.js';
import { SENSORS } from './sensors.js';
type Schema = Record<string, unknown>;
const int = (minimum = -2147483648, maximum = 2147483647): Schema => ({ type: 'integer', minimum, maximum });
const string: Schema = { type: 'string', minLength: 1, maxLength: 48 };
const id: Schema = { ...string, pattern: '^[A-Za-z][A-Za-z0-9_-]{0,47}$', not: { enum: ['constructor', 'prototype', '__proto__'] } };
const hash: Schema = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const handle: Schema = { type:'string',minLength:1,maxLength:128,pattern:'^[\\x21-\\x7e]+$' };
const literal = (value: string | number): Schema => ({ const: value });
const enumeration = (...values: string[]): Schema => ({ enum: values });
const array = (items: Schema, maxItems: number, minItems = 0): Schema => ({ type: 'array', items, maxItems, minItems });
const object = (properties: Record<string, Schema>, optional: string[] = []): Schema => ({ type: 'object', properties, required: Object.keys(properties).filter(key => !optional.includes(key)), additionalProperties: false });
const expr: Schema = { $ref: '#/$defs/expr' };
const moduleIntent: Schema = { oneOf: [object({ moduleId: id, action: literal('activate'), aimOffset: expr, priority: int(0, 15) }), object({ moduleId: id, action: enumeration('shieldOn', 'shieldOff'), priority: int(0, 15) })] };
const intent = object({ thrust: object({ forward: expr, strafe: expr }), turn: expr, modules: array(moduleIntent, 3) });
const nextState: Schema = { oneOf: [id, object({ parameter: id })] };
const inline = { when: expr, intent, set: array(object({ variable: id, value: expr }), 64), nextState };
const call = { useSkill: id, args: { type: 'object', maxProperties: 16, propertyNames: id, additionalProperties: { oneOf: [expr, id] } } };
const defs = {
  expr: { oneOf: [
    object({ kind: literal('const'), value: int() }), object({ kind: literal('bool'), value: { type: 'boolean' } }),
    object({ kind: enumeration('var', 'param'), id }), object({ kind: literal('sensor'), name: { type: 'string', minLength: 1, maxLength: 80 } }),
    object({ kind: literal('op'), op: enumeration('add', 'sub', 'mul', 'div', 'min', 'max'), left: expr, right: expr }),
    object({ kind: literal('compare'), op: enumeration('eq', 'ne', 'lt', 'lte', 'gt', 'gte'), left: expr, right: expr }),
    object({ kind: literal('clamp'), value: expr, min: expr, max: expr }),
    object({ kind: enumeration('all', 'any'), args: array(expr, 16, 1) }), object({ kind: literal('not'), value: expr })
  ] }
};
const body = object({ grid: literal('square-12-v1'), modules: array(object({ id, catalogId: id, cell: object({ x: int(0, 11), y: int(0, 11) }), orientation: int(0, 3) }), 24, 1) });
const brain = object({ abiVersion: literal('2.0'), initialState: id,
  variables: array({ oneOf: [object({ id, type: literal('int'), initial: int() }), object({ id, type: literal('bool'), initial: { type: 'boolean' } })] }, 64),
  skills: array(object({ id, parameters: array(object({ id, type: enumeration('int', 'bool', 'state') }), 16), body: { oneOf: [object({...inline,nextState:object({parameter:id})}, ['set', 'nextState']), object(call)] } }), 16),
  states: array(object({ id, rules: array({ oneOf: [object({ id, ...inline,nextState:id }, ['set', 'nextState']), object({ id, ...call })] }, 32) }), 32, 1)
});
const diagnostic = object({ code: string, pointer: { type: 'string', maxLength: 512 }, message: { type: 'string', maxLength: 1024 } });
const experimentSpec = object({ baselineHash: hash, candidateHash: hash, opponentHashes: array(hash, 16, 1), seedSetDigest: hash, engineDigest: hash, rulesetDigest: hash, phase: enumeration('exploration', 'holdout') });
const preset = object({ yLeft: { enum: [-3000,-2000,-1000,0,1000,2000,3000] }, yRight: { enum: [-3000,-2000,-1000,0,1000,2000,3000] }, jitterLeft: { enum: [-128,-64,0,64,128] }, jitterRight: { enum: [-128,-64,0,64,128] } });
const match = object({ engineDigest: hash, rulesetDigest: hash, catalogDigest: hash, compilerDigest: hash, brainAbiVersion: literal('2.0'), packageHashes: object({ A: hash, B: hash }), seed: { type: 'string', pattern: '^[a-f0-9]{32}$' }, arenaDigest: hash, arenaInitDigest: hash, scenarioId: int(0,1224), presetValues: preset, spawnSlotAssignment: { oneOf: [object({ A: literal('left'), B: literal('right') }), object({ A: literal('right'), B: literal('left') })] }, maxTicks: literal(5400), numericalAbiVersion: literal('milli-v1') });
const result = object({ winner: enumeration('A','B','draw'), cause: enumeration('core','coreDouble','brainBudget','timeout'), elapsedTicks: int(1,5400), scores: object({ A: int(0,10000), B: int(0,10000) }) });
const irRule = object({ id, ...inline,nextState:id }, ['set','nextState']);
const ir = object({ abiVersion: literal('2.0'), initialState: id, variables: (brain['properties'] as Record<string, Schema>)['variables']!, states: array(object({ id, rules: array(irRule,32) }),32,1) });
const gameplay = object({ schemaVersion: literal('2.0'), brainAbiVersion: literal('2.0'), compilerDigest: hash, catalogDigest: hash, body: object({ grid: literal('square-12-v1'), modules: array(object({ catalogId:id, cell:object({x:int(0,11),y:int(0,11)}), orientation:int(0,3) }),24,1) }), brain: ir });
const definitions: Record<string, Schema> = {
  'bot-definition': object({ schemaVersion: literal('2.0'), name: { type:'string',minLength:1,maxLength:64 }, body, brain, cosmetic: object({ skinId:id,paletteId:id }) }),
  body, brain, ir,
  'compiled-brain': object({ brainAbiVersion:literal('2.0'),compilerDigest:hash,normalizedIR:ir,sourceMap:{type:'object',additionalProperties:{type:'string',maxLength:512}},symbolMap:object({modules:array(id,24),states:array(id,32),variables:array(id,64)}),nodeCount:int(0,2048) }),
  'bot-package': object({canonicalGameplay:gameplay,packageHash:hash,presentationHash:hash,capabilityDigest:hash}),
  intent: object({thrust:object({forward:int(-1000,1000),strafe:int(-1000,1000)}),turn:int(-1000,1000),modules:array({oneOf:[object({moduleOrdinal:int(0,23),action:literal('activate'),aimOffset:int(-256,256),priority:int(0,15)}),object({moduleOrdinal:int(0,23),action:enumeration('shieldOn','shieldOff'),priority:int(0,15)})]},3)}),
  observation: object({tick:int(0,5399),sensors:object(Object.fromEntries([...SENSORS,...Array.from({length:24},(_,i)=>[`self.weaponReady.m${i}`,`self.moduleAlive.m${i}`]).flat()].map(name=>[name,int()])),[...SENSORS,...Array.from({length:24},(_,i)=>[`self.weaponReady.m${i}`,`self.moduleAlive.m${i}`]).flat()])}),
  validation: object({packageHash:hash,engineDigest:hash,rulesetDigest:hash,suiteDigest:hash,status:enumeration('passed','failed'),diagnostics:array(diagnostic,256)}),
  'experiment-spec': experimentSpec,
  experiment: object({manifestDigest:hash,spec:experimentSpec,status:enumeration('queued','running','completed','failed','cancelled'),pairedResults:array(object({scenarioId:int(0,1224),baseline:int(0,1000),candidate:int(0,1000)}),1225),confidence:{oneOf:[{type:'null'},object({meanDeltaMillionths:int(-1000000,1000000),lower95Millionths:int(-1000000,1000000),upper95Millionths:int(-1000000,1000000),resamples:literal(10000)})]},cost:int(0)}),
  match, 'match-result': result,
  replay: object({version:literal('2.0'),match,publicReplayHash:hash,chunks:array(object({firstBoundary:int(0,5400),lastBoundary:int(0,5400),hash,bytes:int(0,8388608)}),90,1),result}),
  ratings: object({userId:handle,seasonId:handle,runId:handle,rating:int(),played:int(0),wins:int(0),draws:int(0),revision:int(1)})
};
const irDefs={expr:{oneOf:defs.expr.oneOf.map(variant=>{
  const properties=variant['properties'] as Record<string,Schema>;
  return Array.isArray(properties['kind']?.['enum'])&&properties['kind']['enum'].includes('param')?object({...properties,kind:literal('var')}):variant;
})}};
// Source and IR share the grammar except that normalized IR cannot contain unresolved parameters.
export const schemas: Record<string, Schema> = Object.fromEntries(Object.entries(definitions).map(([name,schema])=>[name,{$schema:'https://json-schema.org/draft/2020-12/schema',$id:`https://promptchien.invalid/schemas/v2/${name}.json`,...schema,$defs:['ir','compiled-brain','bot-package'].includes(name)?irDefs:defs}]));
const ajv = new Ajv2020({ strict: true, allErrors: false });
const validators = new Map(Object.entries(schemas).map(([name,schema])=>[name,ajv.compile(schema)]));
export function validateSchema(name: string, value: unknown): void {
  canonical(value); // bounded, integer, poison and Unicode check before recursive validator
  const validate = validators.get(name);
  if (!validate) throw new ContractError('UNKNOWN_SCHEMA','',name);
  if (!validate(value)) {
    const error = validate.errors?.[0];
    throw new ContractError('SCHEMA',error?.instancePath ?? '',error?.message ?? 'invalid schema');
  }
  if(name==='bot-definition') {
    const bot=value as BotDefinition;
    if(bot.name!==bot.name.normalize('NFC'))throw new ContractError('NAME_NFC','/name');
  }
}
export function parseBot(text: string): BotDefinition { const value = decodeJson(text); validateSchema('bot-definition',value); return value as BotDefinition; }
export function assertBrain(value: unknown): asserts value is BrainSource { validateSchema('brain',value); }
