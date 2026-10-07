import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { sha, save, evidence } from './u3d02-evidence.mjs';
const sharp=createRequire(resolve('tools/u3d01/package.json'))('sharp');
const source='assets/arena/tiles/floor-02.png', out='apps/web/public/assets/ui3d/u3d02';
await mkdir(out,{recursive:true});
// The atlas cutout includes a transparent border and a dark, bevelled 2D frame.
// Keep the interior surface; the real bevel/frame is built as 3D geometry.
const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
let left=info.width,top=info.height,right=0,bottom=0;
for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>64){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
const crop={left:left+12,top:top+12,width:right-left+1-24,height:bottom-top+1-24};
const {data:rgb,info:ci}=await sharp(source).extract(crop).flatten({background:'#c4c1b9'}).removeAlpha().raw().toBuffer({resolveWithObject:true});
// Mirror-blend a 4px seam band: opposing edges are identical, preserving center
// markings and weathering rather than adding a second fake objective ring.
for(let y=0;y<ci.height;y++)for(let k=0;k<4;k++)for(let c=0;c<3;c++){const a=(y*ci.width+k)*3+c,b=(y*ci.width+ci.width-1-k)*3+c;const avg=Math.round((rgb[a]+rgb[b])/2);rgb[a]=rgb[b]=avg;}
for(let x=0;x<ci.width;x++)for(let k=0;k<4;k++)for(let c=0;c<3;c++){const a=(k*ci.width+x)*3+c,b=((ci.height-1-k)*ci.width+x)*3+c;const avg=Math.round((rgb[a]+rgb[b])/2);rgb[a]=rgb[b]=avg;}
const resized=await sharp(rgb,{raw:{width:ci.width,height:ci.height,channels:3}}).resize(256,256,{fit:'fill'}).raw().toBuffer();
for(let y=0;y<256;y++)for(let k=0;k<4;k++)for(let c=0;c<3;c++){const a=(y*256+k)*3+c,b=(y*256+255-k)*3+c;const avg=Math.round((resized[a]+resized[b])/2);resized[a]=resized[b]=avg;}
for(let x=0;x<256;x++)for(let k=0;k<4;k++)for(let c=0;c<3;c++){const a=(k*256+x)*3+c,b=((255-k)*256+x)*3+c;const avg=Math.round((resized[a]+resized[b])/2);resized[a]=resized[b]=avg;}
await sharp(resized,{raw:{width:256,height:256,channels:3}}).webp({lossless:true,effort:6}).toFile(`${out}/floor.webp`);
const bytes=await readFile(`${out}/floor.webp`),meta=await sharp(bytes).metadata();assert.equal(meta.hasAlpha,false);
const decoded=await sharp(bytes).removeAlpha().raw().toBuffer();let maxEdgeDelta=0;
for(let i=0;i<256;i++)for(let c=0;c<3;c++){maxEdgeDelta=Math.max(maxEdgeDelta,Math.abs(decoded[(i*256)*3+c]-decoded[(i*256+255)*3+c]),Math.abs(decoded[i*3+c]-decoded[(255*256+i)*3+c]));}
assert.equal(maxEdgeDelta,0);
const report={source,sourceSha256:sha(await readFile(source)),crop,seam:'4px mirror average before and after resize fill; lossless WebP',tool:`sharp ${sharp.versions.sharp}`,output:`${out}/floor.webp`,sha256:sha(bytes),bytes:bytes.length,width:meta.width,height:meta.height,hasAlpha:meta.hasAlpha,maxEdgeDelta,objectiveBaked:false};
await save(`${out}/recipe.json`,report);await save(`${evidence}/assets.json`,report);console.log(JSON.stringify(report));
