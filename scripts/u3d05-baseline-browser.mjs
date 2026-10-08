import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import os from 'node:os';
import { evidence, save, sha } from './u3d05-evidence.mjs';
import { fitPreviewCamera } from '../packages/renderer3d/dist/geometry.js';
import { workshopCamera } from '../packages/renderer3d/dist/SceneViewport.js';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE ?? resolve(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const phase = process.argv[2] ?? 'baseline';
const channel = process.env.U3D_BROWSER ?? 'chrome';
const root = `${evidence}/${phase}/${channel}`;
if (phase === 'baseline') { try { await readFile(`${root}/browser.json`); throw Error('Baseline browser evidence exists; refusing overwrite'); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
const url = 'http://127.0.0.1:5205';
const server = spawn(process.execPath, [resolve('apps/web/node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '5205', '--strictPort'], { cwd: 'apps/web', stdio: ['ignore', 'pipe', 'pipe'] });
let output = '', browser;
server.stdout.on('data', d => output += d); server.stderr.on('data', d => output += d);
const report = { command: `node scripts/u3d05-browser.mjs ${phase}`, phase, channel, startedAt: new Date().toISOString(), status: 'running', checks: [], errors: [], assets: [], measurements: {} };
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
  await capture('arena-2d');
  await save(`${root}/replay.json`, replay);
  await save(`${root}/catalog.json`, await page.evaluate(() => window.__init.catalog));
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = String(error); process.exitCode = 1; }
finally { await save(`${root}/browser.json`, report); await browser?.close(); server.kill(); }

