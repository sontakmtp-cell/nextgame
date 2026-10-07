import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import os from 'node:os';
import { ids, out, evidence, save, sharp, sha, sourcePath } from './u3d01-lib.mjs';
const selected=process.argv.slice(2).length?process.argv.slice(2):ids;
assert(selected.every(id=>ids.includes(id)));
const server=createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://localhost').pathname;
  let file;
  if(path==='/')file='scripts/u3d01-preview.html';
  else if(path==='/settings')file='scripts/u3d01-settings.json';
  else if(/^\/normalization\/[a-z]+\.json$/.test(path)){const id=path.split('/').at(-1).split('.')[0];assert(ids.includes(id));file=`.local/u3d01/build/${id}-normalization.json`;}
  else if(/^\/source\/[a-z]+\.glb$/.test(path)){const id=path.split('/').at(-1).split('.')[0];assert(ids.includes(id));file=`assets/concepts/modules/${id}-image-to-3d-v1.glb`;}
  else {const routes=[['/three/','tools/u3d01/node_modules/three/'],['/assets/ui3d/u3d01/',out+'/']];const route=routes.find(([prefix])=>path.startsWith(prefix));assert(route);const base=resolve(route[1]);file=resolve(base,path.slice(route[0].length));assert(file.startsWith(base+sep));}
  const data=await readFile(file);const ext=file.split('.').at(-1);res.setHeader('Content-Length',data.length);res.setHeader('Content-Type',({js:'text/javascript',mjs:'text/javascript',html:'text/html',wasm:'application/wasm',json:'application/json',png:'image/png',glb:'model/gltf-binary'})[ext]??'application/octet-stream');res.end(data);
 }catch(e){res.writeHead(404);res.end(String(e));}
});
await new Promise(r=>server.listen(5194,'127.0.0.1',r));
const require=createRequire(import.meta.url);const {chromium}=require(process.env.PLAYWRIGHT_MODULE??resolve(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
let browser;
const report={command:`node scripts/u3d01-render.mjs ${process.argv.slice(2).join(' ')}`,status:'running',errors:[],requests:[],rows:[]};
try{
 browser=await chromium.launch({channel:process.env.U3D_BROWSER??'chrome',headless:true});report.browser=browser.version();
 const page=await browser.newPage({viewport:{width:400,height:400},deviceScaleFactor:1});page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('requestfinished',async r=>{try{const response=await r.response();report.requests.push({url:r.url(),status:response.status(),bytes:Number(response.headers()['content-length']??0)});}catch(e){report.errors.push(e.message);}});
 await page.goto('http://127.0.0.1:5194');await page.waitForFunction(()=>window.assetReady);
 report.environment=await page.evaluate(()=>window.environment);
 await mkdir(`${evidence}/renders`,{recursive:true});
 for(const id of selected){const masks={};
  for(const view of ['hero','opposite','top']){
   masks[view]={};
   for(const quality of ['source','high','medium','low']){
    const metric=await page.evaluate(async([id,q,v])=>window.renderAsset(id,q,v,false),[id,quality,view]);
    const screenshot=await page.screenshot();await writeFile(`${evidence}/renders/${id}-${quality}-${view}.png`,screenshot);
    if(view==='hero'&&quality==='high'){await mkdir(`${out}/thumbnails`,{recursive:true});await sharp(screenshot).resize(256,256).png().toFile(`${out}/thumbnails/${id}.png`);}
    await page.evaluate(async([id,q,v])=>window.renderAsset(id,q,v,true),[id,quality,view]);
    const pixels=await sharp(await page.screenshot()).removeAlpha().raw().toBuffer();masks[view][quality]=pixels;
    const modelSha256=sha(await readFile(quality==='source'?sourcePath(id):`${out}/modules/${id}/${quality}/model.glb`));
    report.rows.push({id,quality,view,modelSha256,...metric});
   }
   for(const quality of ['high','medium','low']){let intersection=0,union=0;const a=masks[view].source,b=masks[view][quality];for(let i=0;i<a.length;i+=3){const aa=a[i]<128,bb=b[i]<128;if(aa&&bb)intersection++;if(aa||bb)union++;}report.rows.find(r=>r.id===id&&r.quality===quality&&r.view===view).silhouetteIoU=intersection/union;}
  }
  const header=Buffer.from(`<svg width="1600" height="48"><rect width="100%" height="100%" fill="#212b32"/><g fill="#fff" font-family="sans-serif" font-size="22"><text x="16" y="32">${id}: source (500k)</text><text x="416" y="32">High (30k cap)</text><text x="816" y="32">Medium (8k cap)</text><text x="1216" y="32">Low (2k cap)</text></g></svg>`);
  const images=[{input:header,left:0,top:0}];for(let v=0;v<3;v++)for(let q=0;q<4;q++)images.push({input:`${evidence}/renders/${id}-${['source','high','medium','low'][q]}-${['hero','opposite','top'][v]}.png`,left:q*400,top:48+v*400});
  await sharp({create:{width:1600,height:1248,channels:3,background:'#eee8df'}}).composite(images).png().toFile(`${evidence}/renders/${id}-comparison.png`);
  console.log(`${id}: rendered source and 3 LODs, 3 views`);
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;process.exitCode=1;}
finally{if(browser)await browser.close();await new Promise(r=>server.close(r));await save(`${evidence}/render-${selected.join('-')}.json`,report);}
console.log(JSON.stringify({status:report.status,errors:report.errors,failure:report.failure,environment:report.environment}));
