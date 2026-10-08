import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import os from 'node:os';
import { evidence, save, sha } from './u3d04-evidence.mjs';
import { fitPreviewCamera } from '../packages/renderer3d/dist/geometry.js';
import { workshopCamera } from '../packages/renderer3d/dist/SceneViewport.js';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE ?? resolve(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const phase = process.argv[2] ?? 'final';
const channel = process.env.U3D_BROWSER ?? 'chrome';
const root = `${evidence}/${phase}/${channel}`;
const url = 'http://127.0.0.1:5199';
const server = spawn(process.execPath, [resolve('apps/web/node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '5199', '--strictPort'], { cwd: 'apps/web', stdio: ['ignore', 'pipe', 'pipe'] });
let output = '', browser;
server.stdout.on('data', d => output += d); server.stderr.on('data', d => output += d);
const report = { command: `node scripts/u3d04-browser.mjs ${phase}`, phase, channel, startedAt: new Date().toISOString(), status: 'running', checks: [], errors: [], assets: [], measurements: {} };
await save(`${root}/browser.json`, report);
try {
  let ready = false;
  for (let i = 0; i < 100; i++) { if (server.exitCode !== null) throw Error(output); try { if ((await fetch(url)).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 100)); }
  assert(ready);
  browser = await chromium.launch({ channel, headless: true }); report.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => { const NativeWorker = window.Worker; window.Worker = class extends NativeWorker { constructor(url, options) { super(url, options); this.addEventListener('message', e => { if (e.data.kind === 'init') window.__init = e.data; if (e.data.kind === 'match') window.__match = e.data; if (e.data.kind === 'validate' || e.data.kind === 'error') window.__validation = e.data; }); } }; });
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  page.on('response', async r => { if (/\.(glb|ktx2|woff2|wasm|webp)(\?|$)/.test(r.url())) report.assets.push({ url: r.url().replace(url, ''), bytes: (await r.body().catch(() => Buffer.alloc(0))).length, status: r.status() }); });
  const button = name => page.getByRole('button', { name, exact: true });
  const settle = async () => { await page.evaluate(() => document.fonts.ready); await page.evaluate(async () => { scrollTo(0, 0); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }); };
  const capture = async name => { await settle(); await page.screenshot({ path: `${root}/${name}.png`, fullPage: true, animations: 'disabled' }); };
  await page.goto(url); await page.locator('#synth-name').waitFor();
  await button('Brain Lab').click();
  for (const [width, height] of [[1600, 1100], [1920, 1080]]) {
    await page.setViewportSize({ width, height }); await capture(`brain-${width}`);
    if(width===1600) await page.locator('.brain-layout').screenshot({path:`${root}/brain-panel-before-arena.png`,animations:'disabled'});
    if (phase === 'final' && channel === 'chrome') assert((await readFile(`${root}/brain-${width}.png`)).equals(await readFile(`${evidence}/baseline/chrome/brain-${width}.png`)), `Brain ${width} pixels changed`);
  }
  assert.equal(await page.locator('canvas').count(), 0);
  report.checks.push('Brain Lab 2D pixel render at 1600/1920' + (phase === 'final' && channel === 'chrome' ? ' byte-identical to checkout baseline' : phase === 'final' ? ' captured without canvas; same-browser pre-edit Edge pixel baseline unavailable' : ' baseline captured'));
  await page.setViewportSize({ width: 1600, height: 1100 }); await button('Workshop').click();
  await button('Thử trận').click(); await page.locator('#timeline').waitFor({ timeout: 180000 });
  const replay = await page.evaluate(() => window.__match.replay);
  report.match = { manifest: replay.manifest, result: replay.result, simulationHash: replay.simulationHash, publicReplayHash: replay.publicReplayHash, orderedEventsHash: sha(JSON.stringify(replay.frames.flatMap(f => f.events))), publicFramesHash: sha(JSON.stringify(replay.frames)), frameCount: replay.frames.length };
  if (phase === 'final') assert.deepEqual(report.match, JSON.parse(await readFile(`${evidence}/baseline/chrome/browser.json`)).match);
  report.checks.push('Default practice simulation/replay/events/results' + (phase === 'final' ? ' exact baseline parity' : ' baseline recorded'));
  await page.getByLabel('Chế độ trình bày', { exact: true }).selectOption('3d');
  const sceneReady = async () => { try { await page.locator('.ui3d-arena [data-graphics="ready"]').waitFor({ timeout: 40000 }); } catch(e) { await capture('failure-scene'); console.log(await page.locator('.ui3d-arena').innerText()); throw e; } await settle(); };
  await sceneReady(); assert.equal(await page.locator('canvas').count(), 1);
  const seek = async tick => { await page.locator('#timeline').evaluate((e, value) => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(e, String(value)); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, tick); await page.waitForFunction(t => document.querySelector('.timeline-label').textContent.includes(`tick ${t} ·`), tick); await settle(); await page.evaluate(async () => { for (let i = 0; i < 4; i++) await new Promise(r => requestAnimationFrame(r)); }); };
  const event = kind => replay.frames.flatMap(f => f.events).find(e => e.kind === kind);
  for (const kind of ['activation', 'hit', 'destroyed', 'detached']) { if (!event(kind)) continue; await seek(event(kind).tick + 1); await capture(`arena-${kind}-high-1600`); }
  await seek(event('activation').tick + 3);
  for (const [width, height] of [[1600,1100],[1920,1080]]) { await page.setViewportSize({width,height}); await capture(`arena-high-${width}`); }
  await page.setViewportSize({width:1600,height:1100});
  await page.getByLabel('VFX', {exact:true}).uncheck(); await capture('arena-vfx-off');
  await page.getByLabel('Chất lượng', {exact:true}).selectOption('low'); await sceneReady();
  await page.getByLabel('Thang xám', {exact:true}).check(); await page.getByLabel('Giảm chuyển động', {exact:true}).check(); await capture('arena-low-gray-reduced');
  await page.getByLabel('Giảm chuyển động', {exact:true}).uncheck(); await page.getByLabel('Thang xám', {exact:true}).uncheck(); await page.getByLabel('VFX', {exact:true}).check(); await page.getByLabel('Chất lượng', {exact:true}).selectOption('medium'); await sceneReady();
  const target = event('hit').tick + 1; await seek(target);
  const reference = await page.locator('.ui3d-arena canvas').screenshot();
  const seeks=[];
  for(let i=0;i<100;i++) { const random=(i*3571+433)%replay.frames.length; const start=performance.now(); await seek(random); const randomMs=performance.now()-start; await seek(target); const bytes=await page.locator('.ui3d-arena canvas').screenshot(); assert.equal(sha(bytes),sha(reference),`visual seek ${i}`); seeks.push(randomMs); }
  report.measurements.randomSeek100 = { samples: seeks, p95Ms: [...seeks].sort((a,b)=>a-b)[94], unit:'host round trip including HUD wait + six rAF settles, not decode timing', target, canvasSha256:sha(reference) };
  report.checks.push('100 random seek orders: same tick/camera/options produced byte-identical real canvas PNG');
  await page.getByLabel('Giảm chuyển động', {exact:true}).uncheck(); await page.getByLabel('Thang xám', {exact:true}).uncheck(); await page.getByLabel('VFX', {exact:true}).check(); await page.getByLabel('Chất lượng', {exact:true}).selectOption('high'); await sceneReady();
  await seek(target); await page.getByLabel('Chế độ trình bày', {exact:true}).selectOption('2d'); await page.locator('.arena-host canvas').waitFor(); assert((await page.locator('.timeline-label').textContent()).includes(`tick ${target}`)); await capture('arena-2d-same-tick');
  await page.getByLabel('Chế độ trình bày', {exact:true}).selectOption('3d'); await sceneReady(); assert((await page.locator('.timeline-label').textContent()).includes(`tick ${target}`));
  report.checks.push('2D/3D switch retains playhead, result and traces');
  await button('Brain trace').click(); assert((await page.locator('.telemetry').innerText()).includes('Chỉ Brain A')); await capture('arena-private-a-dom');
  await button('Sự kiện').click();
  await button('Phát').click(); await page.waitForTimeout(250); await page.locator('canvas').evaluate(c => { window.__loss = c.getContext('webgl2').getExtension('WEBGL_lose_context'); window.__loss.loseContext(); });
  await page.locator('[data-graphics="lost"]').waitFor(); const kept = await page.locator('#timeline').inputValue(); await page.waitForTimeout(250); assert.equal(await page.locator('#timeline').inputValue(),kept); assert(await button('Phát').isDisabled());
  await capture('arena-context-lost'); await page.evaluate(()=>window.__loss.restoreContext()); await sceneReady(); assert.equal(await page.locator('#timeline').inputValue(),kept); await capture('arena-context-restored');
  report.checks.push('Real WEBGL_lose_context pauses at retained tick, reloads viewport/cache after restore');
  for(const width of [1024,768,390,320]) { await page.setViewportSize({width,height:900}); await capture(`arena-responsive-${width}`); const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth); assert(overflow<=1,`overflow ${width}: ${overflow}`); }
  await page.setViewportSize({width:1600,height:1100}); await button('Brain Lab').click(); assert.equal(await page.locator('canvas').count(),0); await capture('brain-after-arena');
  const panelAfter=await page.locator('.brain-layout').screenshot({path:`${root}/brain-panel-after-arena.png`,animations:'disabled'}); assert(panelAfter.equals(await readFile(`${root}/brain-panel-before-arena.png`)), 'Brain panel after Arena pixels changed');
  report.checks.push('Brain Lab returns to 2D with no canvas; responsive 1024/768/390/320 no horizontal overflow');
  assert.deepEqual(report.errors,[]);
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; process.exitCode = 1; }
finally { await save(`${root}/browser.json`, report); await browser?.close(); server.kill(); console.log(JSON.stringify({status:report.status,failure:report.failure})); }
