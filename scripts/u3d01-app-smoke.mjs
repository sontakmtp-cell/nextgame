import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import os from 'node:os';
import { save, evidence, sha } from './u3d01-lib.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE??resolve(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const server=spawn(process.execPath,[resolve('apps/web/node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5195','--strictPort'],{cwd:'apps/web',stdio:['ignore','pipe','pipe']});
let output='',browser;server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const report={command:'node scripts/u3d01-app-smoke.mjs',status:'running',errors:[],glbRequests:[],brain:[]};
try{
 let ready=false;for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(output);try{if((await fetch('http://127.0.0.1:5195')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert(ready);
 browser=await chromium.launch({channel:process.env.U3D_BROWSER??'chrome',headless:true});report.browser=browser.version();
 const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('request',r=>{if(/\.glb(?:\?|$)/.test(r.url()))report.glbRequests.push(r.url());});
 await page.goto('http://127.0.0.1:5195');await page.locator('#synth-name').waitFor();await page.getByRole('button',{name:'Brain Lab',exact:true}).click();
 await mkdir(`${evidence}/app`,{recursive:true});
 for(const[width,height]of[[1600,1100],[1920,1080]]){await page.setViewportSize({width,height});await page.evaluate(()=>document.fonts.ready);await page.evaluate(async()=>{scrollTo(0,0);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});const path=`${evidence}/app/brain-lab-${width}.png`;await page.screenshot({path,fullPage:true,animations:'disabled'});const after=await readFile(path),before=await readFile(`deliverables/implementation/UI3D/U3D-00/baseline-stable/screenshots/brain-lab-${width}.png`);assert(after.equals(before),`Brain ${width} image changed`);report.brain.push({width,sha256:sha(after),identical:true});}
 assert.equal(await page.locator('canvas').count(),0);assert.deepEqual(report.glbRequests,[]);assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;process.exitCode=1;}
finally{if(browser)await browser.close();server.kill();await save(`${evidence}/app-smoke.json`,report);}
console.log(JSON.stringify(report));
