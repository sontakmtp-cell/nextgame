import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import os from 'node:os';
import { save, evidence } from './u3d04-evidence.mjs';
const { chromium }=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE??resolve(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const url='http://127.0.0.1:5205',root=`${evidence}/faults`,report={status:'running',checks:[],scenarios:[]};
const server=spawn(process.execPath,[resolve('apps/web/node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5205','--strictPort'],{cwd:'apps/web',stdio:['ignore','pipe','pipe']});let browser,output='';server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
try{
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const scenario of ['cold-audio','missing-model','missing-decoder','no-webgl']){
  const context=await browser.newContext({viewport:{width:1600,height:1100},deviceScaleFactor:1}),page=await context.newPage(),errors=[],assets=[],scripts=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(/\.(glb|wasm|woff2|webp)(\?|$)/.test(r.url()))assets.push({url:r.url().replace(url,''),status:r.status(),bytes:Number(r.headers()['content-length']??0)});if(r.url().endsWith('.js'))scripts.push(r.body().then(b=>({url:r.url().replace(url,''),pixi:/PixiJS|pixi\.js/.test(b.toString())})).catch(()=>null));});
  await context.addInitScript(()=>{const NativeWorker=window.Worker;window.Worker=class extends NativeWorker{constructor(url,options){super(url,options);this.addEventListener('message',e=>{if(e.data.kind==='match')window.__replay=e.data.replay;});}};window.__sounds=0;const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){window.__sounds++;return start.apply(this,args);};});
  if(scenario==='no-webgl')await context.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){if(String(kind).includes('webgl'))return null;return get.call(this,kind,...args);};});
  if(scenario==='missing-model')await page.route('**/modules/**/model.glb',route=>route.fulfill({status:404,body:'missing fixture'}));
  if(scenario==='missing-decoder')await page.route('**/decoders/basis_transcoder.wasm',route=>route.fulfill({status:404,body:'missing fixture'}));
  await page.goto(`${url}/?presentation=3d`);await page.getByRole('button',{name:'Thử trận',exact:true}).waitFor();await page.getByRole('button',{name:'Thử trận',exact:true}).click();await page.locator('#timeline').waitFor({timeout:180000});
  const seek=async tick=>{await page.locator('#timeline').evaluate((e,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,String(value));e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},tick);await page.waitForTimeout(150);};
  if(scenario==='cold-audio'){
   await page.locator('.ui3d-arena [data-graphics="ready"]').waitFor({timeout:60000});await page.getByRole('button',{name:'Bật âm thanh',exact:true}).click();await page.getByRole('button',{name:'Tắt âm thanh',exact:true}).waitFor();
   const activation=await page.evaluate(()=>window.__replay.frames.flatMap(f=>f.events).find(e=>e.kind==='activation').tick);
   await seek(activation);assert.equal(await page.evaluate(()=>window.__sounds),0);await page.getByRole('button',{name:'Phát',exact:true}).click();await page.waitForTimeout(800);await page.getByRole('button',{name:'Dừng',exact:true}).click();const sounds=await page.evaluate(()=>window.__sounds);assert(sounds>0);
   await seek(2500);await seek(activation+1);assert.equal(await page.evaluate(()=>window.__sounds),sounds);
   await page.getByLabel('Tốc độ',{exact:true}).selectOption('2');await page.getByRole('button',{name:'Phát',exact:true}).click();await page.waitForTimeout(500);await page.getByRole('button',{name:'Dừng',exact:true}).click();assert.equal(await page.evaluate(()=>window.__sounds),sounds);
   const chunks=(await Promise.all(scripts)).filter(Boolean);assert(!chunks.some(s=>s.pixi),'Pixi loaded in cold 3D route');assert(assets.every(a=>!a.url.includes('/assets/3d/')&&!a.url.includes('source')));assert.deepEqual(errors,[]);
   report.checks.push('Cold 3D route loads no Pixi chunks and only optimized runtime GLB; real WebAudio sounds only during playback, not seek or 2x');
   report.cold={assets,chunks,sounds,totalUniqueAssetBytes:[...new Map(assets.map(a=>[a.url,a])).values()].reduce((sum,a)=>sum+a.bytes,0)};
  }else{
   await page.locator('.ui3d-arena [data-graphics="unavailable"]').waitFor({timeout:60000});assert(await page.getByRole('button',{name:'Phát',exact:true}).isDisabled());await seek(150);assert((await page.locator('.timeline-label').textContent()).includes('tick 150'));
   await page.getByRole('button',{name:'Brain trace',exact:true}).click();assert((await page.locator('.telemetry').innerText()).includes('Chỉ Brain A'));await page.screenshot({path:`${root}/${scenario}.png`,fullPage:true});
   await page.getByRole('button',{name:'Chuyển 2D',exact:true}).last().click();assert.equal(await page.getByLabel('Chế độ trình bày',{exact:true}).inputValue(),'2d');assert((await page.locator('.timeline-label').textContent()).includes('tick 150'));
   if(scenario!=='no-webgl')await page.locator('.arena-host canvas').waitFor();
   report.checks.push(`${scenario}: result/timeline/private-A DOM remain usable at retained tick; 2D fallback available`);
  }
  report.scenarios.push({scenario,errors,assets});await context.close();
 }
 report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;process.exitCode=1;}finally{await save(`${root}/faults.json`,report);await browser?.close();server.kill();console.log(JSON.stringify({status:report.status,failure:report.failure}));}
