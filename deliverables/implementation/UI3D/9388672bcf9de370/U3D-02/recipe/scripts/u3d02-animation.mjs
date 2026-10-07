import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import os from 'node:os';
import { evidence, save, sha } from './u3d02-evidence.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE??resolve(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const server=spawn(process.execPath,[resolve('apps/web/node_modules/vite/bin/vite.js'),'preview','--config',resolve('tests/u3d02/vite.config.mjs'),'--host','127.0.0.1','--port','5200','--strictPort'],{stdio:['ignore','pipe','pipe']});
let output='',browser;server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const dir=`${evidence}/renders/animation`,report={command:'node scripts/u3d02-animation.mjs',status:'running',kind:'Live production browser capture; not a concept render'};await mkdir(`${dir}/raw`,{recursive:true});
try{
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(output);try{if((await fetch('http://127.0.0.1:5200')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1600,height:1100},recordVideo:{dir:resolve(`${dir}/raw`),size:{width:1600,height:1100}}}),page=await context.newPage();
 const started=performance.now();await page.goto('http://127.0.0.1:5200');await page.locator('section[data-graphics=ready]').waitFor({timeout:60000});await page.waitForFunction(()=>window.u3d02?.read().qualities.every(q=>q==='high'));
 await page.waitForTimeout(300);const readyMs=performance.now()-started,before=await page.evaluate(()=>({render:window.u3d02.read(),energy:window.u3d02.energy()}));assert.equal(before.render.energyLinks,15);
 await page.screenshot({path:`${dir}/gap-three-a.png`});await page.waitForTimeout(4000);await page.screenshot({path:`${dir}/gap-three-b.png`});const after=await page.evaluate(()=>({render:window.u3d02.read(),energy:window.u3d02.energy()}));assert(after.render.renders>before.render.renders+20);assert.notDeepEqual(before.energy[0].sample,after.energy[0].sample);
 const video=page.video();await context.close();const raw=await video.path();report.raw=raw;report.readyMs=readyMs;report.before=before;report.after=after;report.browser=browser.version();
 const mp4=`${dir}/core-three-live.mp4`,args=['-y','-ss',String((readyMs+250)/1000),'-i',raw,'-t','3','-an','-c:v','libx264','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',mp4];
 const result=spawnSync(process.env.FFMPEG??'ffmpeg',args,{encoding:'utf8'});report.ffmpeg={command:['ffmpeg',...args],exit:result.status,stderr:result.stderr};assert.equal(result.status,0);
 const probe=spawnSync(process.env.FFPROBE??'ffprobe',['-v','error','-show_entries','format=duration:stream=width,height,avg_frame_rate','-of','json',mp4],{encoding:'utf8'});assert.equal(probe.status,0);report.video={path:mp4,bytes:(await readFile(mp4)).length,sha256:sha(await readFile(mp4)),metadata:JSON.parse(probe.stdout)};report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;process.exitCode=1;}finally{if(browser)await browser.close();server.kill();await save(`${evidence}/animation.json`,report);}console.log(JSON.stringify({status:report.status,video:report.video,failure:report.failure}));
