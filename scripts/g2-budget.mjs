import assert from 'node:assert/strict';
import { readFile,readdir,writeFile,mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
const root='apps/web/dist',html=await readFile(`${root}/index.html`,'utf8'),main=html.match(/src="(\/assets\/index-[^"]+\.js)"/)[1];
const assets=await readdir(`${root}/assets`),shell=[main.slice(1),...assets.filter(f=>/^(?:index-.*\.css|rolldown-runtime-.*\.js|local\.worker-.*\.js)$/.test(f)).map(f=>`assets/${f}`),'index.html'];
const shellFiles=[];for(const file of shell){const data=await readFile(`${root}/${file}`);shellFiles.push({file,bytes:data.length,gzipBytes:gzipSync(data).length});}
const mainCode=await readFile(`${root}${main}`,'utf8');assert(!mainCode.includes('GAS_EXHAUSTED'));assert(!mainCode.includes('MATCH_TERMINAL'));
const atlas=JSON.parse(await readFile('assets/generated/manifest.json','utf8')),fonts=JSON.parse(await readFile('apps/web/public/fonts/manifest.json','utf8'));
const shellGzipBytes=shellFiles.reduce((sum,f)=>sum+f.gzipBytes,0),assetBytes=Object.values(atlas.files).reduce((sum,f)=>sum+f.bytes,0)+Object.values(fonts).reduce((sum,f)=>sum+f.bytes,0);
assert(shellGzipBytes<=409600);assert(assetBytes<=8388608);assert(atlas.atlas.width<=2048&&atlas.atlas.height<=2048);
const audio=[];for(const filename of Object.values(atlas.audio)){const data=await readFile(`assets/generated/${filename}`);let peak=0;for(let i=44;i<data.length;i+=2)peak=Math.max(peak,Math.abs(data.readInt16LE(i)));const peakDbfs=20*Math.log10(peak/32768);assert(peakDbfs<=-3);audio.push({filename,peakDbfs});}
const report={status:'passed',timestamp:new Date().toISOString(),shellFiles,shellGzipBytes,initialAssetUpperBoundBytes:assetBytes,atlas:{width:atlas.atlas.width,height:atlas.atlas.height},mainThreadEngineAbsent:true,audio,fonts:Object.keys(fonts),note:'Shell includes UI + worker + CSS + runtime + HTML; asset bound includes all art/audio/fonts. Lazy viewer chunks measured separately by browser QA.'};
await mkdir('.local/g2',{recursive:true});await writeFile('.local/g2/budget.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
