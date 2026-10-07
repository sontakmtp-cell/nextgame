import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import os from 'node:os';
import { evidence, save } from './u3d02-evidence.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE??resolve(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const server=spawn(process.execPath,[resolve('apps/web/node_modules/vite/bin/vite.js'),'preview','--config',resolve('tests/u3d02/vite.config.mjs'),'--host','127.0.0.1','--port','5201','--strictPort'],{stdio:['ignore','pipe','pipe']});
let output='',browser;server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);const report={command:'node scripts/u3d02-profile-live.mjs',status:'running',kind:'120 observed render/RAF intervals with lightning active; no manual render, not GPU timestamps or 120-second/48-module acceptance',runs:[]};
const percentile=(xs,p)=>[...xs].sort((a,b)=>a-b)[Math.min(xs.length-1,Math.ceil(xs.length*p)-1)];
try{
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(output);try{if((await fetch('http://127.0.0.1:5201')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 for(const channel of ['chrome','msedge']){
  browser=await chromium.launch({channel,headless:true});const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.goto('http://127.0.0.1:5201');
  for(const body of ['body','twentyFour'])for(const quality of ['high','medium','low']){
   await page.getByLabel('Body kiểm tra',{exact:true}).selectOption(body);await page.getByLabel('Mức chi tiết',{exact:true}).selectOption(quality);await page.locator('section[data-graphics=ready]').waitFor({timeout:60000});await page.waitForFunction(q=>window.u3d02?.read().qualities.every(v=>v===q),quality);await page.waitForTimeout(150);
   const measured=await page.evaluate(async()=>{const intervals=[],start=performance.now();let previous=window.u3d02.read().renders,last=performance.now();while(intervals.length<120){await new Promise(r=>requestAnimationFrame(r));const now=performance.now(),count=window.u3d02.read().renders;if(count!==previous){intervals.push(now-last);last=now;previous=count;}if(now-start>15000)throw Error('Live effect stopped during profile');}return{intervals,durationMs:performance.now()-start,render:window.u3d02.read()};});
   report.runs.push({channel,browser:browser.version(),body,quality,...measured,p95:percentile(measured.intervals,.95),p99:percentile(measured.intervals,.99)});console.log(`${channel} ${body} ${quality}: p95 ${report.runs.at(-1).p95.toFixed(2)}ms`);
  }
  assert.deepEqual(errors,[]);await browser.close();browser=null;
 }
 report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;process.exitCode=1;}finally{if(browser)await browser.close();server.kill();await save(`${evidence}/live-profile.json`,report);}console.log(JSON.stringify({status:report.status,failure:report.failure}));
