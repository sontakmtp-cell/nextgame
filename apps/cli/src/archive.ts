import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { ContractError, canonical, decodeJson, digest, parseBot, sha256, validateSchema } from '@prompt-chien/contracts';
import type { BotDefinition, ReplayManifest } from '@prompt-chien/contracts';
import { assertBinding, checkpoint, checkpointState, createWorld, restore, simulate, simulationHash, step } from '@prompt-chien/engine';
import type { RecordedMatch } from '@prompt-chien/engine';
import { encodeReplay, verifyPublic } from '@prompt-chien/replay';
import type { PublicReplay } from '@prompt-chien/replay';
const error=(code:string):never=>{throw new ContractError(code,'/archive');};
async function boundedRead(path:string,max=262144):Promise<Buffer> {const size=(await stat(path)).size;if(size>max)error('ARCHIVE_BYTE_CAP');const bytes=await readFile(path);if(bytes.length>max)error('ARCHIVE_BYTE_CAP');return bytes;}
export async function readBot(path:string):Promise<BotDefinition> {return parseBot((await boundedRead(path)).toString('utf8'));}
interface Entry {boundary:number;hash:string;bytes:number}
interface PrivateManifest {version:'G1-local-v1';manifestDigest:string;simulationHash:string;privateTraceHash:string;checkpoints:Entry[];traces:Entry[];local:'unofficial'}
export async function writeArchive(path:string,a:BotDefinition,b:BotDefinition,record:RecordedMatch):Promise<ReplayManifest> {
  const replay=await encodeReplay(record.manifest,record.frames,record.result),directory=resolve(path);
  // A fresh directory is required: a failed/repeated command cannot overwrite another result.
  await mkdir(dirname(directory),{recursive:true});await mkdir(directory);await mkdir(`${directory}/private`,{mode:0o700});
  await writeFile(`${directory}/manifest.json`,canonical(replay.manifest)+'\n',{flag:'wx'});
  for(let i=0;i<replay.chunks.length;i++)await writeFile(`${directory}/chunk-${i}.bin.gz`,gzipSync(replay.chunks[i]!),{flag:'wx'});
  let privateBytes=0;
  const writePrivate=async(name:string,value:unknown):Promise<{hash:string;bytes:number}>=>{
    const text=canonical(value)+'\n',bytes=new TextEncoder().encode(text);if(bytes.length>262144||(privateBytes+=bytes.length)>16777216)error('PRIVATE_ARTIFACT_CAP');
    await writeFile(`${directory}/private/${name}`,bytes,{flag:'wx',mode:0o600});return {hash:await sha256(bytes),bytes:bytes.length};
  };
  await writePrivate('A.bot.json',a);await writePrivate('B.bot.json',b);
  const checkpoints:Entry[]=[],traces:Entry[]=[];
  for(const cp of record.checkpoints)checkpoints.push({boundary:cp.tick,...await writePrivate(`checkpoint-${cp.tick}.json`,checkpointState(cp))});
  for(let tick=0;tick<record.result.elapsedTicks;tick+=60)traces.push({boundary:tick,...await writePrivate(`trace-${tick}.json`,record.traces.filter(t=>t.tick>=tick&&t.tick<tick+60))});
  const privateManifest:PrivateManifest={version:'G1-local-v1',manifestDigest:await digest(record.manifest),simulationHash:record.simulationHash,privateTraceHash:record.privateTraceHash,checkpoints,traces,local:'unofficial'};
  await writePrivate('manifest.json',privateManifest);
  await writeFile(`${directory}/LOCAL_UNOFFICIAL.txt`,'Local combat proof; unsigned. private/ contains both authorized Bot sources, resources and Brain trace. Publish only manifest.json and chunk-*.bin.gz.\n',{flag:'wx'});
  return replay.manifest;
}
export async function readReplay(path:string):Promise<PublicReplay> {
  const directory=resolve(path),value=decodeJson((await boundedRead(`${directory}/manifest.json`)).toString('utf8'));validateSchema('replay',value);
  const manifest=value as ReplayManifest,chunks:Uint8Array[]=[];let total=0;
  for(let i=0;i<manifest.chunks.length;i++){
    const compressed=await boundedRead(`${directory}/chunk-${i}.bin.gz`,1048576),bytes=gunzipSync(compressed,{maxOutputLength:1048576});
    total+=bytes.length;if(total>8388608)error('PUBLIC_REPLAY_CAP');chunks.push(new Uint8Array(bytes));
  }
  const replay={manifest,chunks};await verifyPublic(replay);return replay;
}
function privateManifest(value:unknown):PrivateManifest {
  if(!value||typeof value!=='object'||Array.isArray(value))error('PRIVATE_MANIFEST');
  const v=value as Record<string,unknown>,keys=['version','manifestDigest','simulationHash','privateTraceHash','checkpoints','traces','local'];
  if(Object.keys(v).some(key=>!keys.includes(key))||keys.some(key=>!(key in v))||v.version!=='G1-local-v1'||v.local!=='unofficial')error('PRIVATE_MANIFEST');
  for(const key of ['manifestDigest','simulationHash','privateTraceHash'])if(typeof v[key]!=='string'||!/^[a-f0-9]{64}$/.test(v[key] as string))error('PRIVATE_MANIFEST');
  for(const key of ['checkpoints','traces']){const entries=v[key];if(!Array.isArray(entries)||entries.length<1||entries.length>91)error('PRIVATE_MANIFEST');
    let last=-1;for(const e of entries as unknown[]){if(!e||typeof e!=='object'||Array.isArray(e))error('PRIVATE_MANIFEST');const entry=e as Record<string,unknown>;
      if(Object.keys(entry).sort().join(',')!=='boundary,bytes,hash'||typeof entry.boundary!=='number'||!Number.isInteger(entry.boundary)||entry.boundary<=last||entry.boundary>5400||typeof entry.bytes!=='number'||!Number.isInteger(entry.bytes)||entry.bytes<1||entry.bytes>262144||typeof entry.hash!=='string'||!/^[a-f0-9]{64}$/.test(entry.hash))error('PRIVATE_MANIFEST');last=Number(entry.boundary);}
  }return value as PrivateManifest;
}
export async function verifyArchive(path:string,full=false):Promise<Record<string,unknown>> {
  const replay=await readReplay(path),publicIndex=await verifyPublic(replay),directory=resolve(path);
  if(!full)return {status:'passed',scope:'public integrity only',local:'unofficial',frames:publicIndex.frameCount,publicReplayHash:replay.manifest.publicReplayHash,signature:'unsigned'};
  const metaBytes=await boundedRead(`${directory}/private/manifest.json`),meta=privateManifest(decodeJson(metaBytes.toString('utf8')));
  if(await digest(replay.manifest.match)!==meta.manifestDigest)error('PRIVATE_BINDING');
  if(meta.checkpoints[0]!.boundary!==0||meta.checkpoints.at(-1)!.boundary!==replay.manifest.result.elapsedTicks||meta.checkpoints.some((e,i)=>i>0&&e.boundary!==Math.min(meta.checkpoints[i-1]!.boundary+60,replay.manifest.result.elapsedTicks)))error('CHECKPOINT_INDEX');
  if(meta.traces.length!==Math.ceil(replay.manifest.result.elapsedTicks/60)||meta.traces.some((e,i)=>e.boundary!==i*60))error('TRACE_INDEX');
  const aBytes=await boundedRead(`${directory}/private/A.bot.json`),bBytes=await boundedRead(`${directory}/private/B.bot.json`),a=parseBot(aBytes.toString('utf8')),b=parseBot(bBytes.toString('utf8'));await assertBinding(replay.manifest.match,a,b);
  const generated=await simulate(await createWorld(a,b,replay.manifest.match.seed,replay.manifest.match.spawnSlotAssignment.A==='right'));
  if(generated.simulationHash!==meta.simulationHash||generated.privateTraceHash!==meta.privateTraceHash||await digest(generated.result)!==await digest(replay.manifest.result))error('SIMULATION_HASH');
  const rebuilt=await encodeReplay(generated.manifest,generated.frames,generated.result);if(rebuilt.manifest.publicReplayHash!==replay.manifest.publicReplayHash)error('SIMULATION_PUBLIC_HASH');
  let privateBytes=metaBytes.length+aBytes.length+bBytes.length;
  for(const entry of meta.checkpoints){const bytes=await boundedRead(`${directory}/private/checkpoint-${entry.boundary}.json`);privateBytes+=bytes.length;
    if(bytes.length!==entry.bytes||await sha256(bytes)!==entry.hash)error('CHECKPOINT_HASH');const cp=decodeJson(bytes.toString('utf8')),expected=generated.checkpoints.find(cp=>cp.tick===entry.boundary)!;
    if(await digest(cp)!==await digest(checkpointState(expected)))error('CHECKPOINT_STATE');
    // Restore only after equality with trusted resimulation, never execute untrusted VM data.
    const resumed=restore(expected),next=meta.checkpoints.find(e=>e.boundary>entry.boundary);
    if(next){while(resumed.tick<next.boundary&&!resumed.result)step(resumed);if(await digest(checkpointState(checkpoint(resumed)))!==await digest(checkpointState(generated.checkpoints.find(c=>c.tick===next.boundary)!)))error('CHECKPOINT_RESTORE');}
    else if(await simulationHash(resumed)!==meta.simulationHash)error('CHECKPOINT_RESTORE');
  }
  for(const entry of meta.traces){const bytes=await boundedRead(`${directory}/private/trace-${entry.boundary}.json`);privateBytes+=bytes.length;if(bytes.length!==entry.bytes||await sha256(bytes)!==entry.hash)error('TRACE_HASH');
    const traces=decodeJson(bytes.toString('utf8'));if(await digest(traces)!==await digest(generated.traces.filter(t=>t.tick>=entry.boundary&&t.tick<entry.boundary+60)))error('TRACE_STATE');}
  if(privateBytes>16777216)error('PRIVATE_ARTIFACT_CAP');
  return {status:'passed',scope:'authorized full simulation + every checkpoint interval',local:'unofficial',simulationHash:meta.simulationHash,publicReplayHash:replay.manifest.publicReplayHash,privateTraceHash:meta.privateTraceHash,checkpoints:meta.checkpoints.length,signature:'unsigned'};
}
