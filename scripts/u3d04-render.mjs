import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import os from 'node:os';
import { evidence, save, sha } from './u3d04-evidence.mjs';
const {chromium} = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE ?? resolve(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const fixture=JSON.parse(await readFile('.local/u3d04/fixture.json'));
const server=spawn(process.execPath,[resolve('apps/web/node_modules/vite/bin/vite.js'),'preview','--config',resolve('tests/u3d04/vite.config.mjs'),'--host','127.0.0.1','--port','5204','--strictPort'],{stdio:['ignore','pipe','pipe']});
const channel=process.env.U3D_BROWSER??'chrome',root=`${evidence}/render/${channel}`,report={status:'running',checks:[],metrics:[],errors:[],assets:[]};let browser,output='';server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const percentile=(xs,p)=>[...xs].sort((a,b)=>a-b)[Math.ceil(xs.length*p)-1];
try{
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(output);try{if((await fetch('http://127.0.0.1:5204')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel,headless:true}); report.browser=browser.version();report.cpu=os.cpus()[0].model;
 const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://127.0.0.1:5204');
 const ready=async()=>{await page.locator('[data-graphics="ready"]').waitFor({timeout:45000});await page.waitForFunction(()=>window.u3d04?.read().qualities.every(q=>q===document.querySelector('select:nth-of-type(1)')?.value||q==='high'));};
 const settle=async()=>page.evaluate(async()=>{for(let i=0;i<8;i++)await new Promise(r=>requestAnimationFrame(r));});
 const capture=async name=>{await settle();await page.screenshot({path:`${root}/${name}.png`});};
 await ready();
 const position=async tick=>{await page.getByLabel('Position',{exact:true}).fill(String(tick));await page.getByLabel('Position',{exact:true}).press('Tab');await settle();};
 const checks=[['activation','telegraph-'],['shot','projectile-'],['shieldOn','shield-'],['destroyed','effect-'],['detached','effect-']];
 for(const [kind,prefix]of checks){const event=fixture.fixtures.ranged.flatMap(f=>f.events).find(e=>e.kind===kind);assert(event,kind);await position(event.tick+1);const data=await page.evaluate(()=>window.u3d04.read());assert(data.objects.some(o=>o.name.startsWith(prefix)),`${kind} scene object`);await capture(`ranged-${kind}`);await save(`${root}/state-${kind}.json`,data);}
 const windup=fixture.fixtures.ranged.flatMap(f=>f.events).find(e=>e.kind==='activation');await position(windup.tick+4);await page.getByLabel('VFX',{exact:true}).uncheck();assert((await page.evaluate(()=>window.u3d04.read())).objects.some(o=>o.name.startsWith('telegraph-')));await capture('windup-vfx-off');report.checks.push('real engine phases/projectiles/shield/destroyed/detached render; telegraph visible with VFX off');
 await page.getByLabel('VFX',{exact:true}).check();
 await page.getByLabel('Fixture',{exact:true}).selectOption('ring'); await ready();
 const notice=fixture.fixtures.ring.flatMap(f=>f.events).find(e=>e.kind==='ringNotice');assert(notice);await position(notice.tick+1);await capture('ring-notice');await position(4000);await capture('ring-damage-objective');await position(fixture.fixtures.ring.length-1);await capture('ring-result');
 report.checks.push('real engine passive replay ring notice/shrink/damage/result and objective');
 await page.getByLabel('Fixture',{exact:true}).selectOption('stress');await ready();await page.getByLabel('Reduced',{exact:true}).uncheck();
 for(const quality of ['high','medium','low']){
  await page.getByLabel('Quality',{exact:true}).selectOption(quality);await page.locator('[data-graphics="ready"]').waitFor({timeout:60000});await page.waitForFunction(q=>window.u3d04.read().qualities.every(v=>v===q),quality);await capture(`stress-${quality}`);
  await page.getByRole('button',{name:'Play',exact:true}).click();await page.evaluate(()=>window.u3d04.reset());const seconds=quality==='high'?Number(process.env.U3D_STRESS_SECONDS??10):10; for(let n=0;n<seconds;n+=10){await page.waitForTimeout(Math.min(10,seconds-n)*1000);console.log(`${quality}: ${Math.min(n+10,seconds)}/${seconds}s`);}await page.getByRole('button',{name:'Pause',exact:true}).click();const measured=await page.evaluate(()=>({intervals:window.u3d04.samples(),render:window.u3d04.read()}));report.metrics.push({quality,...measured,p95:percentile(measured.intervals,.95),p99:percentile(measured.intervals,.99),seconds,kind:'actual renderer callback cadence; synthetic 48 modules/128 projectiles/256 events per boundary; not GPU timing or real-device Mobile gate'});console.log(quality,report.metrics.at(-1).p95);
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;process.exitCode=1;}finally{await save(`${root}/render.json`,report);await browser?.close();server.kill();console.log(JSON.stringify({status:report.status,failure:report.failure}));}
