import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { canonical, ContractError, decodeJson, digest, parseBot, schemas, sha256, validateBody, validateSchema } from '../packages/contracts/dist/index.js';
import { compile, freezeBot } from '../packages/brain/dist/index.js';
import { arenaPresets, buildSuite, catalog, contentManifest, COS, referenceKits, scenarioForSeed, SIN } from '../packages/content/dist/index.js';
import { sample } from './helpers.js';
describe('bounded JSON and schema boundaries',()=>{
  it('validates the original documented fixture with no silent corrections',()=>{const bot=sample();expect(validateBody(bot.body,catalog,true).cost).toBe(72);expect(compile(bot.brain,bot.body.modules).nodeCount).toBeGreaterThan(0);});
  it.each([
    ['{"a":1,"a":2}','DUPLICATE_KEY'],['{"a":{"b":1,"b":2}}','DUPLICATE_KEY'],
    ['{"__proto__":1}','POISON_KEY'],['{"constructor":1}','POISON_KEY'],['{"prototype":1}','POISON_KEY'],
    ['{"a":1.5}','INTEGER_REQUIRED'],['{"a":1.0}','INTEGER_REQUIRED'],['{"a":1e0}','INTEGER_REQUIRED'],['{"a":9007199254740992}','INTEGER_REQUIRED'],['{"a":NaN}','JSON_SYNTAX'],
    ['{"a":1,}','JSON_SYNTAX'],['[1,]','JSON_SYNTAX'],['{}x','JSON_SYNTAX'],['"unfinished','JSON_SYNTAX']
  ])('rejects %s with %s',(text,code)=>{try{decodeJson(text);throw new Error('accepted');}catch(error){expect(error).toBeInstanceOf(ContractError);expect((error as ContractError).code).toBe(code);}});
  it('detects escaped duplicate keys and exact pointers',()=>{expect(()=>decodeJson('{"a":1,"\\u0061":2}')).toThrowError(expect.objectContaining({pointer:'/a',code:'DUPLICATE_KEY'}));});
  it('bounds bytes, nesting, and source before recursive schema validation',()=>{
    expect(()=>decodeJson(' '.repeat(262145))).toThrowError(expect.objectContaining({code:'BYTE_CAP'}));
    expect(()=>decodeJson('"'+'ứ'.repeat(90000)+'"')).toThrowError(expect.objectContaining({code:'BYTE_CAP'}));
    expect(()=>decodeJson('['.repeat(33)+'0'+']'.repeat(33))).toThrowError(expect.objectContaining({code:'NESTING_CAP'}));
    expect(()=>decodeJson('['.repeat(32)+'0'+']'.repeat(32))).not.toThrow();
  });
  it.each([
    (bot:ReturnType<typeof sample>)=>{Object.assign(bot,{extra:true});},
    (bot:ReturnType<typeof sample>)=>{bot.body.modules[0]!.cell.x=1.5;},
    (bot:ReturnType<typeof sample>)=>{bot.body.modules[0]!.id='constructor';},
    (bot:ReturnType<typeof sample>)=>{bot.brain.states[0]!.id='État';},
    (bot:ReturnType<typeof sample>)=>{bot.name='x'.repeat(65);},
    (bot:ReturnType<typeof sample>)=>{bot.brain.variables=[{id:'x',type:'int',initial:2147483648}];},
    (bot:ReturnType<typeof sample>)=>{bot.brain.variables=[{id:'x',type:'bool',initial:1}];}
  ])('rejects invalid bot schema %#',mutate=>{const bot=sample();mutate(bot);expect(()=>parseBot(JSON.stringify(bot))).toThrow();});
  it('rejects unknown nested fields',()=>{const bot=sample();Object.assign(bot.body.modules[0]!.cell,{z:1});expect(()=>validateSchema('bot-definition',bot)).toThrow();});
});
describe('body geometry/caps',()=>{
  it.each([
    ['OVERLAP',(bot:ReturnType<typeof sample>)=>{bot.body.modules[1]!.cell={x:5,y:5};}],
    ['DISCONNECTED',(bot:ReturnType<typeof sample>)=>{bot.body.modules[1]!.cell={x:0,y:0};}],
    ['DUPLICATE_ID',(bot:ReturnType<typeof sample>)=>{bot.body.modules[1]!.id='coreMain';}],
    ['CORE_REQUIRED',(bot:ReturnType<typeof sample>)=>{bot.body.modules=bot.body.modules.filter(m=>m.catalogId!=='core');}],
    ['GRID_BOUNDS',(bot:ReturnType<typeof sample>)=>{bot.body.modules[0]!.cell={x:11,y:11};}],
    ['CATALOG_DISABLED',(bot:ReturnType<typeof sample>)=>{bot.body.modules[3]!.catalogId='lance';}],
    ['CATALOG_DISABLED',(bot:ReturnType<typeof sample>)=>{bot.body.modules[3]!.catalogId='unknown';}],
    ['CATALOG_CAP',(bot:ReturnType<typeof sample>)=>{bot.body.modules[1]!.catalogId='core';}],
    ['RANKED_BODY',(bot:ReturnType<typeof sample>)=>{bot.body.modules=bot.body.modules.filter(m=>m.catalogId!=='thruster');}]
  ])('rejects %s',(code,mutate)=>{const bot=sample();mutate(bot);expect(()=>validateBody(bot.body,catalog,true)).toThrowError(expect.objectContaining({code}));});
  it('rejects point budget and radius independently',()=>{
    const bot=sample();bot.body.modules.push({id:'extra1',catalogId:'burst',cell:{x:7,y:7},orientation:0},{id:'extra2',catalogId:'burst',cell:{x:8,y:7},orientation:0});expect(()=>validateBody(bot.body,catalog)).toThrowError(expect.objectContaining({code:'BUILD_BUDGET'}));
    bot.body.modules=[{id:'core',catalogId:'core',cell:{x:0,y:0},orientation:0},...Array.from({length:8},(_,i)=>({id:`a${i}`,catalogId:'armor',cell:{x:i+2,y:0},orientation:0 as const}))];expect(()=>validateBody(bot.body,catalog)).toThrowError(expect.objectContaining({code:'RADIUS_CAP'}));
  });
  it('six planned kits are valid with the full catalog; disabled kits cannot enter the slice',()=>{
    expect(referenceKits).toHaveLength(6);
    for(const kit of referenceKits){validateSchema('bot-definition',kit);expect(validateBody(kit.body,catalog.map(c=>({...c,enabled:true})),true).cost).toBeLessThanOrEqual(100);}
    for(const name of ['Bastion','Ram','Wisp'])expect(()=>validateBody(referenceKits.find(k=>k.name===name)!.body,catalog)).toThrow();
  });
});
describe('canonical bytes / binding / parity vectors',()=>{
  it('uses sorted keys, NFC, integer decimal, ordered arrays, and no poison/float/undefined',async()=>{
    expect(canonical({z:1,a:'e\u0301',list:[2,1]})).toBe('{"a":"é","list":[2,1],"z":1}');
    expect(canonical({'e\u0301':1,z:2})).toBe('{"z":2,"é":1}');
    expect(()=>canonical(new Map())).toThrow();
    expect(()=>canonical({'e\u0301':1,'é':2})).toThrow();
    const bot=sample();bot.name='e\u0301';expect(()=>validateSchema('bot-definition',bot)).toThrowError(expect.objectContaining({code:'NAME_NFC'}));
    for(const value of [NaN,Infinity,0.1,undefined,{constructor:1}])expect(()=>canonical(value)).toThrow();
    expect(canonical(-0)).toBe('0');expect(await sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('ignores module order and consistently remaps module/state/variable/rule/skill names',async()=>{
    const bot=sample(),baseline=await freezeBot(bot,catalog,contentManifest.catalogDigest,contentManifest.capabilityDigest);
    const changed=sample(),renames=new Map(changed.body.modules.map((m,i)=>[m.id,`renamed${i}`]));
    let text=JSON.stringify(changed);for(const [old,name] of renames)text=text.replaceAll(`"${old}"`,`"${name}"`).replaceAll(`.${old}"`,`.${name}"`);
    text=text.replaceAll('engage','newState').replaceAll('recover','otherState').replaceAll('evadeWindup','differentRule');
    const renamed=parseBot(text);renamed.body.modules.reverse();
    expect((await freezeBot(renamed,catalog,contentManifest.catalogDigest,contentManifest.capabilityDigest)).packageHash).toBe(baseline.packageHash);
  });
  it('presentation changes separately; gameplay/order/digest changes invalidate the package',async()=>{
    const bot=sample(),base=await freezeBot(bot,catalog,contentManifest.catalogDigest,contentManifest.capabilityDigest);
    bot.name='New presentation';bot.cosmetic.paletteId='new-palette';
    const cosmetic=await freezeBot(bot,catalog,contentManifest.catalogDigest,contentManifest.capabilityDigest);expect(cosmetic.packageHash).toBe(base.packageHash);expect(cosmetic.presentationHash).not.toBe(base.presentationHash);
    bot.brain.states[0]!.rules.reverse();expect((await freezeBot(bot,catalog,contentManifest.catalogDigest,contentManifest.capabilityDigest)).packageHash).not.toBe(base.packageHash);
    validateSchema('bot-package',base);
  });
  it('verifies frozen schemas, LUT, arena, catalog, and suite digests',async()=>{
    for(const [name,schema] of Object.entries(schemas)){expect(await digest(schema)).toBe(contentManifest.schemaDigests[name as keyof typeof contentManifest.schemaDigests]);expect(JSON.parse(readFileSync(`packages/contracts/schemas/${name}.json`,'utf8'))).toEqual(schema);}
    expect(await digest(catalog)).toBe(contentManifest.catalogDigest);expect(await digest(arenaPresets)).toBe(contentManifest.arenaInitDigest);
    expect(await digest({SIN,COS})).toBe(contentManifest.lutDigest);expect([SIN[0],SIN[1024],SIN[2048],COS[0],COS[1024]]).toEqual([0,1000000,0,1000000,0]);
  });
});
describe('scenario mapping',()=>{
  it('has exactly 1225 lexicographic presets and 100/200 disjoint sample units',async()=>{
    expect(arenaPresets).toHaveLength(1225);expect(arenaPresets[0]).toEqual({yLeft:-3000,yRight:-3000,jitterLeft:-128,jitterRight:-128});
    const suite=await buildSuite();expect(suite.tuning).toHaveLength(100);expect(suite.holdout).toHaveLength(200);expect(new Set([...suite.tuning,...suite.holdout].map(s=>s.scenarioId)).size).toBe(300);
    for(const row of [...suite.tuning,...suite.holdout])expect((await scenarioForSeed(row.seed)).scenarioId).toBe(row.scenarioId);
    expect(suite).toEqual(JSON.parse(readFileSync('packages/content/data/suite.json','utf8')));
  });
  it('maps 128bit seeds independently using Node SHA256/little endian',async()=>{
    const {createHash}=await import('node:crypto');const seed='ffffffffffffffffffffffffffffffff',bytes=Buffer.concat([Buffer.alloc(16,255),Buffer.from('open-alpha-init-v1')]);
    expect((await scenarioForSeed(seed)).scenarioId).toBe(createHash('sha256').update(bytes).digest().readUInt32LE(0)%1225);
    await expect(scenarioForSeed('1')).rejects.toThrow();await expect(buildSuite(100,1200)).rejects.toThrow();
  });
});
