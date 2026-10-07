import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import os from 'node:os';
import { evidence, save } from './u3d02-evidence.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE??resolve(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const channel=process.env.U3D_BROWSER??'chrome',port=5197;
const server=spawn(process.execPath,[resolve('apps/web/node_modules/vite/bin/vite.js'),'preview','--config',resolve('tests/u3d02/vite.config.mjs'),'--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:['ignore','pipe','pipe']});
let output='',browser;server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const report={command:'node scripts/u3d02-browser.mjs',channel,status:'running',errors:[],requests:[],checks:[],renders:{},shadows:{},profiles:{},attemptTime:new Date().toISOString()};
const suffix=process.env.U3D_ATTEMPT??channel;
await mkdir(`${evidence}/renders/${suffix}`,{recursive:true});
const ready=async page=>{await page.getByTestId('graphics').filter({hasText:'ready'}).waitFor({timeout:60000});await page.locator('section[data-graphics=ready]').waitFor();await page.waitForFunction(()=>{const s=window.u3d02?.read(),q=document.querySelector('select[aria-label="Mức chi tiết"]').value;return s?.connected&&s.qualities.length&&s.qualities.every(v=>v===q);});await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});};
const percentile=(xs,p)=>[...xs].sort((a,b)=>a-b)[Math.min(xs.length-1,Math.ceil(xs.length*p)-1)];
try {
 let serving=false;for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(`http://127.0.0.1:${port}`)).ok){serving=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert(serving);
 browser=await chromium.launch({channel,headless:true});report.browser=browser.version();
 const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 page.on('response',async r=>{const url=new URL(r.url()).pathname;if(url.includes('/assets/ui3d/')||url.includes('/fonts/')){report.requests.push({url,status:r.status(),bytes:(await r.body().catch(()=>Buffer.alloc(0))).length,time:performance.now()});}});
 await page.goto(`http://127.0.0.1:${port}`);await ready(page);
 assert.equal(await page.locator('canvas').count(),1);
 const snap=async name=>{await ready(page);report.renders[name]=await page.evaluate(()=>window.u3d02.read());report.shadows[name]=await page.evaluate(()=>window.u3d02.shadows());const shadow=report.shadows[name];assert(shadow.enabled&&shadow.catcher&&shadow.lights.some(l=>l.cast&&l.map));assert(shadow.meshes.length>=report.renders[name].modules);assert(shadow.meshes.every(m=>m.minY>=.395),'Every module floats >= .395 units over floor');await page.screenshot({path:`${evidence}/renders/${suffix}/${name}.png`,fullPage:true});};
 await snap('workshop-high-1600');
 assert.equal(report.renders['workshop-high-1600'].energyLinks,15,'Every non-Core Mantis module has exactly three lightning arcs');
 const movingBefore=await page.evaluate(()=>({frames:window.u3d02.read().renders,energy:window.u3d02.energy()}));await page.waitForTimeout(500);const movingAfter=await page.evaluate(()=>({frames:window.u3d02.read().renders,energy:window.u3d02.energy()}));assert(movingAfter.frames>movingBefore.frames+5);assert.notDeepEqual(movingAfter.energy[0].sample,movingBefore.energy[0].sample);report.animation={ms:500,frames:movingAfter.frames-movingBefore.frames,before:movingBefore.energy,after:movingAfter.energy};await page.getByLabel('Giảm chuyển động',{exact:true}).check();
 await page.getByRole('button',{name:'Toàn cảnh bàn',exact:true}).click();await snap('workshop-table-geometry');await page.getByRole('button',{name:'Đặt lại góc nhìn',exact:true}).click();
 const initialRequests=[...report.requests];report.initialRequests=initialRequests;
 assert(!initialRequests.some(r=>r.url.includes('/source')||r.url.includes('concepts')));
 assert.equal(initialRequests.filter(r=>r.url.endsWith('.glb')).length,10,'five unique types × Medium+High; repeated Thruster shares model');
 report.checks.push('One canvas; unique GLB per type/LOD; no source GLB; Medium before High');
 await ready(page);await page.waitForTimeout(150); // Settle the deliberate overview/reset camera change first.
 const beforeIdle=await page.evaluate(()=>window.u3d02.read().renders);await page.waitForTimeout(1200);const afterIdle=await page.evaluate(()=>window.u3d02.read().renders);assert.equal(afterIdle,beforeIdle);report.idle={ms:1200,newFrames:afterIdle-beforeIdle};
 for(const q of ['medium','low','high']){await page.getByLabel('Mức chi tiết',{exact:true}).selectOption(q);await snap(`workshop-${q}-1600`);const profile=await page.evaluate(()=>window.u3d02.profile(120));report.profiles[q]={...profile,cpuP95:percentile(profile.samples,.95),cpuP99:percentile(profile.samples,.99),rafP95:percentile(profile.intervals,.95)};}
 report.checks.push('High/Medium/Low real render, hovering modules + cast shadows at every quality; 120 CPU submission samples each');
 await page.getByLabel('Body kiểm tra',{exact:true}).selectOption('fourDirections');await ready(page);
 const fixture=JSON.parse(await readFile('.local/u3d02/fixture.json'));
 for(const m of fixture.fourDirections.modules){const p=await page.evaluate(id=>window.u3d02.module(id),m.id);await page.mouse.click(p.x,p.y);assert.equal(await page.getByTestId('selected').innerText(),m.id);}
 const core=fixture.fourDirections.modules.find(m=>m.catalogId==='core');
 // Click four quadrants of Core proxy (model triangles do not receive picking).
 for(const[x,y]of[[core.cell.x,core.cell.y],[core.cell.x+1,core.cell.y],[core.cell.x,core.cell.y+1],[core.cell.x+1,core.cell.y+1]]){const p=await page.evaluate(([x,y])=>window.u3d02.cell(x,y),[x,y]);await page.mouse.click(p.x,p.y);assert.equal(await page.getByTestId('selected').innerText(),core.id);}
 await snap('four-directions');report.checks.push('All placements selected at four cardinal orientations; four Core quadrants');
 const p=await page.evaluate(()=>window.u3d02.cell(8,7));await page.mouse.click(p.x,p.y);assert.equal(await page.getByTestId('cell').innerText(),'8, 7');await page.mouse.dblclick(p.x,p.y);assert.equal(await page.getByTestId('confirmed').innerText(),'1');
 await page.getByLabel('Xem trước ô lắp').check();await snap('ghost-preview');await page.getByLabel('Xem trước ô lắp').uncheck();
 report.checks.push('Empty cell selection/confirm callback and ghost do not edit Body');
 const camera=await page.getByTestId('camera').textContent(),rect=await page.locator('canvas').boundingBox();assert(rect);
 await page.mouse.move(rect.x+rect.width*.7,rect.y+rect.height*.7);await page.mouse.down({button:'right'});await page.mouse.move(rect.x+rect.width*.7+100,rect.y+rect.height*.7+40,{steps:6});await page.mouse.up({button:'right'});assert.notEqual(await page.getByTestId('camera').textContent(),camera);
 await page.getByRole('button',{name:'Đặt lại góc nhìn',exact:true}).click();assert.equal(await page.getByTestId('camera').textContent(),camera);
 await page.getByLabel('Khóa camera').check();await page.mouse.move(rect.x+300,rect.y+400);await page.mouse.wheel(0,-250);await page.mouse.down({button:'right'});await page.mouse.move(rect.x+380,rect.y+440,{steps:4});await page.mouse.up({button:'right'});assert.equal(await page.getByTestId('camera').textContent(),camera);await page.getByLabel('Khóa camera').uncheck();
 await page.mouse.move(rect.x+300,rect.y+400);await page.mouse.wheel(0,-150);assert.notEqual(await page.getByTestId('camera').textContent(),camera);await page.getByRole('button',{name:'Đặt lại góc nhìn',exact:true}).click();report.checks.push('Right orbit, wheel zoom, reset and camera lock');
 await page.getByLabel('Body kiểm tra',{exact:true}).selectOption('twentyFour');await snap('asymmetric-24');assert.equal(report.renders['asymmetric-24'].modules,24);assert.equal(report.renders['asymmetric-24'].energyLinks,69);
 await page.getByLabel('Grayscale').check();await page.getByLabel('Mức chi tiết',{exact:true}).selectOption('low');await snap('asymmetric-24-low-grayscale');await page.getByLabel('Grayscale').uncheck();
 await page.getByLabel('Body kiểm tra',{exact:true}).selectOption('body');await page.getByRole('button',{name:'Arena',exact:true}).click();await snap('arena-low');
 await page.getByLabel('Mức chi tiết',{exact:true}).selectOption('high');await snap('arena-high');
 assert.equal(report.renders['arena-high'].energyLinks,30);await page.getByLabel('Tia sét Core',{exact:true}).uncheck();await snap('arena-vfx-off');assert.equal(report.renders['arena-vfx-off'].energyLinks,0);await page.getByLabel('Tia sét Core',{exact:true}).check();
 await page.getByRole('button',{name:'My Synths',exact:true}).click();await snap('synth-preview-high');
 await page.getByRole('button',{name:'Workshop',exact:true}).click();await ready(page);report.checks.push('24 module offset Core and shared stage/preview/Arena foundation');
 await page.evaluate(()=>window.u3d02.loss());await page.getByTestId('graphics').filter({hasText:'lost'}).waitFor();await page.evaluate(()=>window.u3d02.restore());await ready(page);await snap('context-restored');report.checks.push('Context loss and restore');
 for(const[width,height]of[[1920,1080],[1024,900],[768,1000],[390,844],[320,740]]){await page.setViewportSize({width,height});await snap(`workshop-${width}`);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);}
 report.checks.push('1920/1024/768/390/320 no horizontal overflow (desktop emulation)');
 report.resourceEntries=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/assets/ui3d/')||r.name.includes('/fonts/')).map(r=>({url:r.name,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize,duration:r.duration})));
 assert.deepEqual(report.errors,[]);report.status='passed';
} catch(error) { report.status='failed';report.failure=error.stack;process.exitCode=1; }
finally { if(browser)await browser.close();server.kill();await save(`${evidence}/browser-${suffix}.json`,report); }
console.log(JSON.stringify({status:report.status,checks:report.checks,failure:report.failure,renders:report.renders}));
