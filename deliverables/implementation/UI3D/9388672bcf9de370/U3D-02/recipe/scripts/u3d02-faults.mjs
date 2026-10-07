import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import os from 'node:os';
import { evidence, save } from './u3d02-evidence.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE??resolve(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const server=spawn(process.execPath,[resolve('apps/web/node_modules/vite/bin/vite.js'),'preview','--config',resolve('tests/u3d02/vite.config.mjs'),'--host','127.0.0.1','--port','5199','--strictPort'],{stdio:['ignore','pipe','pipe']});
let output='',browser;server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const report={command:'node scripts/u3d02-faults.mjs',status:'running',cases:[]};
const ready=async page=>{await page.locator('section[data-graphics=ready]').waitFor({timeout:60000});await page.waitForFunction(()=>{const r=window.u3d02?.read();return r?.connected&&r.qualities.every(v=>v==='high');});await page.evaluate(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});};
try {
 let serving=false;for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(output);try{if((await fetch('http://127.0.0.1:5199')).ok){serving=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert(serving);
 browser=await chromium.launch({channel:'chrome',headless:true});report.browser=browser.version();
 for(const kind of ['delayed-high','missing-model','missing-transcoder','corrupt-model']) {
  const context=await browser.newContext({viewport:{width:1600,height:1100}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/*',async route=>{const url=route.request().url();
   if(kind==='delayed-high'&&url.includes('/high/model.glb')) {await new Promise(r=>setTimeout(r,1500));await route.continue();}
   else if(kind==='missing-model'&&url.includes('/core/medium/model.glb'))await route.fulfill({status:404,body:'Missing test fixture'});
   else if(kind==='missing-transcoder'&&url.endsWith('basis_transcoder.wasm'))await route.fulfill({status:404,body:'Missing test transcoder'});
   else if(kind==='corrupt-model'&&url.includes('/core/medium/model.glb'))await route.fulfill({status:200,body:Buffer.from('tampered GLB'),contentType:'model/gltf-binary'});
   else await route.continue();
  });
  await page.goto('http://127.0.0.1:5199');
  if(kind==='delayed-high') {
   await page.waitForFunction(()=>window.u3d02?.read().qualities.includes('medium'));
   await page.evaluate(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
   const intermediate=await page.evaluate(()=>window.u3d02.read());assert.deepEqual(intermediate.qualities,['medium']);assert(intermediate.triangles>50000);
   await page.screenshot({path:`${evidence}/renders/delayed-medium.png`});await ready(page);assert.deepEqual(errors,[]);report.cases.push({kind,passed:true,intermediate});
  } else {
   await page.locator('section[data-graphics=unavailable]').waitFor({timeout:30000});
   const messages=await page.getByRole('alert').allTextContents();assert(messages.some(m=>m.includes(kind==='corrupt-model'?'manifest':kind==='missing-model'?'model':'404')));
   await page.getByRole('button',{name:'Chuyển 2D',exact:true}).click();await page.getByRole('alert').filter({hasText:'2D fallback requested'}).waitFor();
   await page.screenshot({path:`${evidence}/renders/${kind}.png`});report.cases.push({kind,passed:true,messages,expectedErrors:errors});
  }
  await context.close();console.log(kind+' passed');
 }
 const page=await browser.newPage({viewport:{width:1600,height:1100}});await page.goto('http://127.0.0.1:5199');await ready(page);
 const cdp=await page.context().newCDPSession(page);await cdp.send('HeapProfiler.enable');await cdp.send('HeapProfiler.collectGarbage');const before=await cdp.send('Runtime.getHeapUsage');
 for(let i=0;i<10;i++){for(const name of ['Arena','My Synths','Workshop']){await page.getByRole('button',{name,exact:true}).click();await ready(page);assert.equal(await page.locator('canvas').count(),1);}}
 // R3F releases an old root asynchronously; let its documented unmount settle.
 await page.waitForTimeout(1000);await cdp.send('HeapProfiler.collectGarbage');const after=await cdp.send('Runtime.getHeapUsage');
 report.memory={kind:'Chrome Runtime.getHeapUsage.usedSize after forced GC; JS heap only, not GPU memory',cycles:10,before,after,driftBytes:after.usedSize-before.usedSize};assert(report.memory.driftBytes<=10*1048576);
 report.cases.push({kind:'10 scene cycles',passed:true,canvas:1});report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;process.exitCode=1;}
finally{if(browser)await browser.close();server.kill();await save(`${evidence}/faults.json`,report);}
console.log(JSON.stringify(report));
