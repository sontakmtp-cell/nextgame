import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { save, sha, evidence } from './u3d04-evidence.mjs';
const manifest=JSON.parse(await readFile('apps/web/public/assets/ui3d/u3d01/manifest.json'));
const output={manifestRevision:manifest.assetRevision,files:[],shell:{},missing:[],note:'existing U3D-01 LOD/KTX2 and U3D-02 floor reused; combat geometry authored in TSX; no new source GLB copies'};
for(const module of manifest.modules)for(const [quality,level]of Object.entries(module.levels)){
 const path='apps/web/public'+level.modelUrl,bytes=await readFile(path);if(sha(bytes)!==level.modelSha256||bytes.length!==level.bytes)throw Error(path);output.files.push({path,quality,bytes:bytes.length,triangles:level.triangles,sha256:sha(bytes)});
}
for(const d of manifest.decoders){const path='apps/web/public'+d.url,bytes=await readFile(path);if(sha(bytes)!==d.sha256)throw Error(path);}
const floor=await readFile('apps/web/public/assets/ui3d/u3d02/floor.webp');output.floor={bytes:floor.length,sha256:sha(floor)};
const html=await readFile('apps/web/dist/index.html','utf8'),starts=[...html.matchAll(/(?:src|href)="(\/assets\/[^" ]+\.(?:js|css))"/g)].map(m=>m[1]);
const seen=new Set();async function walk(url){if(seen.has(url))return;seen.add(url);const bytes=await readFile('apps/web/dist'+url),text=bytes.toString();if(url.endsWith('.js'))for(const m of text.matchAll(/(?:from|import)\s*"(\.[^" ]+\.js)"/g)){const next='/assets/'+m[1].replace(/^\.\//,'');await walk(next);}}
for(const url of starts)await walk(url);
const shellFiles=[];for(const url of seen){const b=await readFile('apps/web/dist'+url);shellFiles.push({url,bytes:b.length,gzip:gzipSync(b).length});}
output.shell={files:shellFiles,gzipBytes:shellFiles.reduce((sum,f)=>sum+f.gzip,0),limit:400*1024,scope:'static entry JS/CSS/preload closure; 3D lazy chunks and worker excluded and separately loaded'};
output.cold=JSON.parse(await readFile(`${evidence}/faults/faults.json`)).cold;
output.beforeHighAssetBytes=[...new Map(output.cold.assets.filter(a=>!a.url.includes('/high/')).map(a=>[a.url,a])).values()].reduce((sum,a)=>sum+a.bytes,0);
const before=sha(await readFile('.local/u3d04/fixture.json'));output.reproduction={fixtureSha256:before,kind:'compare this SHA after node scripts/u3d04-fixture.mjs; engine public frames plus procedural stress, fixed seeds'};
await save(`${evidence}/assets.json`,output);console.log(JSON.stringify({shellGzip:output.shell.gzipBytes,coldUniqueAssetBytes:output.cold.totalUniqueAssetBytes,revision:manifest.assetRevision}));
