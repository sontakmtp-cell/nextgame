import assert from 'node:assert/strict';
import { writeFile,mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { join,resolve } from 'node:path';
import os from 'node:os';
import { referenceKits } from '../packages/content/dist/index.js';
import { createWorld,step,publicFrame } from '../packages/engine/dist/index.js';
const require=createRequire(import.meta.url);let playwright;try{playwright=require('playwright');}catch{playwright=require(process.env.PLAYWRIGHT_MODULE??join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
await mkdir('.local/g2',{recursive:true});const bot=structuredClone(referenceKits[0]);bot.body.modules=bot.body.modules.filter(m=>m.catalogId==='core');bot.brain={abiVersion:'2.0',initialState:'idle',variables:[],skills:[],states:[{id:'idle',rules:[]}]};
for(let y=3;y<=8&&bot.body.modules.length<21;y++)for(let x=3;x<=8&&bot.body.modules.length<21;x++){if((x===5||x===6)&&(y===5||y===6))continue;bot.body.modules.push({id:`armor${x}_${y}`,catalogId:'armor',cell:{x,y},orientation:0});}
const world=await createWorld(bot,bot),frames=[];for(let tick=0;tick<120;tick++){step(world);const frame=publicFrame(world);
  // Synthetic presentation stress only, never fed back into engine or presented as match results.
  frame.projectiles=Array.from({length:128},(_,ordinal)=>({ordinal,owner:ordinal%2?'A':'B',x:-18000+(ordinal*997+tick*300)%36000,y:-12000+(ordinal*673)%24000,heading:(ordinal*137)%4096}));
  frame.events=Array.from({length:256},(_,key)=>({tick,kind:key%3?'hit':'destroyed',actor:key%2?'A':'B',module:key%21,target:key%21,value:1,key}));frames.push(frame);
}await writeFile('.local/g2/renderer-fixture.json',JSON.stringify(frames));
const server=spawn(process.execPath,[resolve('apps/web/node_modules/vite/bin/vite.js'),'--config','tests/g2-viewer/vite.config.ts'],{stdio:['ignore','pipe','pipe']});let serverOutput='';server.stdout.on('data',d=>serverOutput+=d);server.stderr.on('data',d=>serverOutput+=d);
const report={status:'running',fixture:'Synthetic render-only stress on 21-module point-budget bodies (not ranked eligible); 128 projectiles + 256 events/tick',startedAt:new Date().toISOString(),cpu:os.cpus()[0]?.model,platform:process.platform,runtime:process.version,unrun:['Actual integrated GPU reference host','Actual Android mobile hardware','GPU memory drift proof','Production replay network seek']};let browser;
const percent=(values,p)=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor((sorted.length-1)*p)];};
try{
  for(let i=0;i<100;i++){if(server.exitCode!==null)throw new Error(serverOutput);try{if((await fetch('http://127.0.0.1:5188')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await playwright.chromium.launch({channel:process.env.G2_BROWSER??'chrome',headless:true,args:['--js-flags=--expose-gc']});report.browser=browser.version();
  const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5188');await page.getByText('READY',{exact:false}).waitFor({timeout:30000});
  report.gpu=await page.locator('canvas').evaluate(c=>{const gl=c.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL??gl.RENDERER);});
  await page.evaluate(()=>window.g2Bench.start());console.log('Renderer stress: started actual 120-second desktop recording.');await page.waitForTimeout(120000);const result=await page.evaluate(()=>window.g2Bench.stop());assert(result.elapsedMs>=120000);
  report.desktop={elapsedMs:result.elapsedMs,frames:result.frameIntervals.length,drawP95Ms:percent(result.drawTimes,.95),drawP99Ms:percent(result.drawTimes,.99),frameP95Ms:percent(result.frameIntervals,.95),frameP99Ms:percent(result.frameIntervals,.99),viewport:{width:1600,height:1100},dpr:1,tier:'high'};
  report.desktop.targetMet=report.desktop.frameP95Ms<=16.7&&report.desktop.frameP99Ms<=33.3;
  await page.screenshot({path:'.local/g2/renderer-stress.png'});
  const cdp=await page.context().newCDPSession(page),heap=[];await cdp.send('HeapProfiler.collectGarbage');heap.push((await cdp.send('Runtime.getHeapUsage')).usedSize);for(let n=0;n<10;n++){await page.evaluate(()=>window.g2Bench.rebuild());await cdp.send('HeapProfiler.collectGarbage');heap.push((await cdp.send('Runtime.getHeapUsage')).usedSize);}report.heap={bytes:heap,driftBytes:heap.at(-1)-heap[0],targetMet:heap.at(-1)-heap[0]<=10485760};assert(report.heap.targetMet);
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{window.g2Bench.quality('low');window.g2Bench.start();});await page.waitForTimeout(15000);const low=await page.evaluate(()=>window.g2Bench.stop());report.desktopMobileEmulation={elapsedMs:low.elapsedMs,frameP95Ms:percent(low.frameIntervals,.95),viewport:{width:390,height:844},tier:'low',actualMobile:false};assert.equal(errors.length,0);report.pageErrors=errors;report.status=report.desktop.targetMet?'passed-on-recorded-host':'desktop-frame-target-failed';process.exitCode=report.desktop.targetMet?0:1;
}catch(error){report.status='failed';report.error=String(error);throw error;}finally{report.finishedAt=new Date().toISOString();await writeFile('.local/g2/profile.json',JSON.stringify(report,null,2)+'\n');await browser?.close();if(server.exitCode===null)server.kill();console.log(JSON.stringify(report,null,2));}
