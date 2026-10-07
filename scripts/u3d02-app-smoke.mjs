import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import os from 'node:os';
import { evidence, save, sha } from './u3d02-evidence.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE??resolve(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const server=spawn(process.execPath,[resolve('apps/web/node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5198','--strictPort'],{cwd:'apps/web',stdio:['ignore','pipe','pipe']});
let output='',browser;server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const report={command:'node scripts/u3d02-app-smoke.mjs',status:'running',errors:[],glbRequests:[],brain:[],checks:[]};
await mkdir(`${evidence}/app`,{recursive:true});
try {
 let serving=false;for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(output);try{if((await fetch('http://127.0.0.1:5198')).ok){serving=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert(serving);
 browser=await chromium.launch({channel:'chrome',headless:true});report.browser=browser.version();
 const context=await browser.newContext({viewport:{width:1600,height:1100},deviceScaleFactor:1});
 await context.addInitScript(()=>{const NativeWorker=window.Worker;window.Worker=class extends NativeWorker{constructor(url,opts){super(url,opts);this.addEventListener('message',event=>{if(event.data.kind==='match')window.__u3dMatch=event.data;});}};});
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('request',r=>{if(r.url().endsWith('.glb'))report.glbRequests.push(r.url());});
 const button=name=>page.getByRole('button',{name,exact:true});
 await page.goto('http://127.0.0.1:5198');await page.locator('#synth-name').waitFor();await button('Brain Lab').click();
 for(const[width,height]of[[1600,1100],[1920,1080]]){await page.setViewportSize({width,height});await page.evaluate(()=>document.fonts.ready);await page.evaluate(async()=>{scrollTo(0,0);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});const path=`${evidence}/app/brain-lab-${width}.png`;await page.screenshot({path,fullPage:true,animations:'disabled'});const before=await readFile(`deliverables/implementation/UI3D/U3D-00/baseline-stable/screenshots/brain-lab-${width}.png`),after=await readFile(path);assert(after.equals(before),`Brain ${width} pixel change`);report.brain.push({width,identical:true,sha256:sha(after)});}
 assert.equal(await page.locator('canvas').count(),0);report.checks.push('Brain Lab screenshots equal original baseline at 1600/1920; no canvas');
 await button('Workshop').click();await button('Lưu revision').click();await page.getByRole('status').filter({hasText:'Đã lưu revision 1'}).waitFor();await page.reload();await page.locator('#synth-name').waitFor();
 report.database=await page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('prompt-chien-local');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const result={version:db.version,stores:Array.from(db.objectStoreNames)};db.close();return result;});assert.deepEqual(report.database,{version:1,stores:['heads','revisions']});report.checks.push('Revision 1 reload in isolated browser context; IndexedDB v1 heads/revisions preserved');
 await button('Thử trận').click();await page.locator('#timeline').waitFor({timeout:60000});await button('Về đầu').click();
 const replay=await page.evaluate(()=>window.__u3dMatch.replay);report.match={manifest:replay.manifest,result:replay.result,simulationHash:replay.simulationHash,publicReplayHash:replay.publicReplayHash,orderedEventsHash:sha(JSON.stringify(replay.frames.flatMap(f=>f.events))),publicFramesHash:sha(JSON.stringify(replay.frames)),frameCount:replay.frames.length};
 const baseline=JSON.parse(await readFile('deliverables/implementation/UI3D/U3D-00/baseline/browser.json'));assert.deepEqual(report.match,baseline.match);report.checks.push('Default practice manifest/result/simulation/replay/frames/event order exact parity');
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.glbRequests,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;process.exitCode=1;}
finally{if(browser)await browser.close();server.kill();await save(`${evidence}/app-smoke.json`,report);}
console.log(JSON.stringify(report));
