import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { ids, json, save, sha, io, out, evidence, levels, functions as f, triangles, requireTool } from './u3d01-lib.mjs';
const validator=requireTool('gltf-validator');
const manifest=await json(`${out}/manifest.json`),rows=[];
assert.equal(manifest.version,'ui3d-v1');assert.equal(manifest.unitsPerCell,1);assert.equal(manifest.axes,'X-forward,Y-up,-Z-left');assert.deepEqual(manifest.modules.map(m=>m.catalogId),ids);
const file=url=>{assert(url.startsWith('/assets/ui3d/u3d01/')&&!url.includes('..'));return 'apps/web/public'+url;};
for(const m of manifest.modules){assert.equal(sha(await readFile(m.source.path)),m.source.sha256);const thumb=await readFile(file(m.thumbnail.url));assert.equal(sha(thumb),m.thumbnail.sha256);assert.equal(thumb.length,m.thumbnail.bytes);assert.equal(m.normalization.uniformScale>0,true);assert.equal(m.normalization.front,'+X');assert.deepEqual(m.normalization.pivot,[0,0,0]);
 for(const[q,l]of Object.entries(m.levels)){const b=await readFile(file(l.modelUrl));assert.equal(b.length,l.bytes);assert.equal(sha(b),l.modelSha256);const doc=await io.readBinary(b);assert.equal(triangles(doc),l.triangles);assert(l.triangles<=levels[q].triangles);assert(l.bytes<=levels[q].bytes,`${m.catalogId}/${q}: byte budget exceeded`);
  const gltf=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());assert(gltf.extensionsRequired.includes('EXT_meshopt_compression'));assert(gltf.extensionsRequired.includes('KHR_texture_basisu'));assert.equal(doc.getRoot().listAnimations().length,0);assert.equal(l.textures.length,3);
  const embedded=doc.getRoot().listTextures().map(t=>sha(t.getImage()));
  const ktxValidation=[];
  for(const t of l.textures){const bytes=await readFile(file(t.url));assert.equal(sha(bytes),t.sha256);assert.equal(bytes.length,t.bytes);assert(embedded.includes(t.sha256));assert.equal(bytes.readUInt32LE(20),t.width);assert.equal(bytes.readUInt32LE(24),t.height);assert.equal(bytes.readUInt32LE(12),0,'Basis vkFormat');assert(t.width<=levels[q].texture&&t.height<=levels[q].texture);assert(bytes.readUInt32LE(40)>1,'Mip chain');assert.equal(doc.getRoot().listTextures().find(tt=>sha(tt.getImage())===t.sha256).getMimeType(),'image/ktx2');const r=spawnSync(resolve('.local/u3d01/ktx/bin/ktx.exe'),['validate','--gltf-basisu','--format','mini-json',file(t.url)],{encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);ktxValidation.push({url:t.url,exitCode:r.status,stdout:r.stdout,stderr:r.stderr});}
  const validation=await validator.validateBytes(new Uint8Array(b),{uri:l.modelUrl,maxIssues:100});
  // Khronos validator cannot decode Meshopt; validate a decoded, dequantized inspection copy too.
  for(const ext of doc.getRoot().listExtensionsUsed())if(ext.extensionName==='EXT_meshopt_compression')ext.dispose();
  await doc.transform(f.dequantize());
  const decodedValidation=await validator.validateBytes(await io.writeBinary(doc),{maxIssues:100});
  assert.equal(validation.issues.numErrors,0,`${m.catalogId}/${q}: compressed validation`);assert.equal(decodedValidation.issues.numErrors,0,`${m.catalogId}/${q}: decoded validation`);
  const bounds=f.getBounds(doc.getRoot().listScenes()[0]);assert(Math.abs(bounds.min[1])<.00001,`${m.catalogId}/${q}: base alignment`);
  rows.push({id:m.catalogId,quality:q,bytes:b.length,triangles:l.triangles,textureDimension:Math.max(...l.textures.map(t=>t.width)),bounds,ktxValidation,compressedValidation:validation.issues,decodedValidation:decodedValidation.issues});
 }
}
for(const decoder of manifest.decoders){const b=await readFile(file(decoder.url));assert.equal(b.length,decoder.bytes);assert.equal(sha(b),decoder.sha256);}
await save(`${evidence}/verification.json`,{command:'node scripts/u3d01-verify.mjs',status:'passed',assetRevision:manifest.assetRevision,rows,decoderBytes:manifest.decoders.reduce((n,d)=>n+d.bytes,0),note:'Numeric validation is not independent art signoff. Runtime request/decode evidence in render report.'});
console.log(JSON.stringify({status:'passed',models:rows.length,maximumBytes:Math.max(...rows.map(r=>r.bytes)),decoderBytes:manifest.decoders.reduce((n,d)=>n+d.bytes,0)}));
