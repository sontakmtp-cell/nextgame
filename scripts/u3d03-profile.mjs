import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import os from 'node:os';
import { evidence, save } from './u3d03-evidence.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE ?? resolve(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const channel = process.env.U3D_BROWSER ?? 'chrome', root = `${evidence}/profile/${channel}`, url = 'http://127.0.0.1:5200';
const server = spawn(process.execPath, [resolve('apps/web/node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '5200', '--strictPort'], { cwd: 'apps/web', stdio: ['ignore', 'pipe', 'pipe'] });
let output = '', browser; server.stdout.on('data', d => output += d); server.stderr.on('data', d => output += d);
const report = { command: 'node scripts/u3d03-profile.mjs', channel, at: new Date().toISOString(), status: 'running', cpu: os.cpus()[0]?.model, gpu: null, assets: [], errors: [], instrumentationNotes: [], frames: [], memory: {}, budgets: {}, note: '10-second Workshop rAF interval samples, six-module default draft; not 120-second/48-module Arena stress, GPU completion or Android results.' };
try {
  let serving = false;
  for (let i = 0; i < 100; i++) { if (server.exitCode !== null) throw Error(output); try { if ((await fetch(url)).ok) { serving = true; break; } } catch {} await new Promise(r => setTimeout(r, 100)); }
  assert(serving); browser = await chromium.launch({ channel, headless: true }); report.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
  const page = await context.newPage(), pending = [];
  const response = response => { if (/\.(glb|ktx2|woff2|wasm|webp|png)(\?|$)|basis_transcoder\.js/.test(response.url())) pending.push(response.body().then(bytes => report.assets.push({ url: response.url().replace(url, ''), bytes: bytes.length, status: response.status(), measurement: 'decoded response body bytes' })).catch(e => { const length = Number(response.headers()['content-length']); if (!Number.isFinite(length) || length <= 0) { report.errors.push(String(e)); return; } report.assets.push({ url: response.url().replace(url, ''), bytes: length, status: response.status(), measurement: 'HTTP Content-Length (plain local Vite response)' }); report.instrumentationNotes.push({ url: response.url(), reason: String(e), resolution: 'Worker response body unavailable via CDP; retained measured HTTP Content-Length.' }); })); };
  page.on('pageerror', e => report.errors.push(e.message)); page.on('response', response);
  const start = performance.now(); await page.goto(`${url}/?presentation=3d`); await page.locator('.ui3d-stage [data-graphics="ready"]').waitFor({ timeout: 120000 });
  report.highReadyRoundTripMs = performance.now() - start; page.off('response', response); await Promise.all(pending);
  report.gpu = await page.locator('canvas').evaluate(c => { const gl = c.getContext('webgl2'), ext = gl.getExtension('WEBGL_debug_renderer_info'); return { renderer: gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER), vendor: gl.getParameter(ext?.UNMASKED_VENDOR_WEBGL ?? gl.VENDOR), dpr: devicePixelRatio, viewport: [innerWidth, innerHeight] }; });
  const assets = Array.from(new Map(report.assets.map(a => [a.url, a])).values());
  report.budgets.initialAssetsExcludingHighBytes = assets.filter(a => !a.url.includes('/high/')).reduce((s, a) => s + a.bytes, 0);
  report.budgets.highAdditionalBytes = assets.filter(a => a.url.includes('/high/')).reduce((s, a) => s + a.bytes, 0);
  report.budgets.totalColdAssetsBytes = assets.reduce((s, a) => s + a.bytes, 0);
  const html = await readFile('apps/web/dist/index.html', 'utf8');
  const shellFiles = ['index.html', ...Array.from(html.matchAll(/(?:src|href)="(\/assets\/[^"?]+\.(?:js|css))"/g), m => m[1].slice(1))];
  const visited = new Set();
  const collect = async path => { if (visited.has(path)) return; visited.add(path); const bytes = await readFile(`apps/web/dist/${path}`); if (path.endsWith('.js')) for (const match of bytes.toString().matchAll(/(?:^|;)import[^;]*?from"\.\/([^";]+)"/g)) await collect(`assets/${match[1]}`); };
  for (const file of shellFiles) await collect(file);
  report.budgets.shell = []; for (const file of visited) { const bytes = await readFile(`apps/web/dist/${file}`); report.budgets.shell.push({ file, bytes: bytes.length, gzipBytes: gzipSync(bytes).length }); }
  report.budgets.shellGzipBytes = report.budgets.shell.reduce((s, a) => s + a.gzipBytes, 0);
  report.budgets.shellNote = 'HTML, CSS, entry JS and static imports; excludes lazy 3D, Arena, worker and runtime assets.';
  await page.locator('.ui3d-display > summary').click();
  for (const quality of ['high', 'medium', 'low']) {
    await page.getByLabel('Chất lượng 3D').selectOption(quality); await page.locator('.ui3d-stage [data-graphics="ready"]').waitFor();
    const sample = await page.evaluate(async () => { const intervals = [], start = performance.now(); let last = start; await new Promise(resolve => { const tick = time => { intervals.push(time - last); last = time; if (time - start < 10000) requestAnimationFrame(tick); else resolve(); }; requestAnimationFrame(tick); }); intervals.shift(); intervals.sort((a, b) => a - b); return { samples: intervals.length, durationMs: last - start, p50Ms: intervals[Math.floor(intervals.length * .5)], p95Ms: intervals[Math.floor(intervals.length * .95)], p99Ms: intervals[Math.floor(intervals.length * .99)], maxMs: intervals.at(-1) }; });
    report.frames.push({ quality, reducedMotion: false, ...sample }); console.log(`${quality}: ${JSON.stringify(sample)}`);
  }
  await page.getByLabel('Chất lượng 3D').selectOption('high'); await page.locator('.ui3d-stage [data-graphics="ready"]').waitFor();
  const cdp = await context.newCDPSession(page); await cdp.send('HeapProfiler.collectGarbage'); const before = await cdp.send('Runtime.getHeapUsage');
  const cycles = [];
  for (let n = 0; n < 10; n++) { await page.getByRole('button', { name: 'Brain Lab', exact: true }).click(); assert.equal(await page.locator('canvas').count(), 0); await page.getByRole('button', { name: 'Workshop', exact: true }).click(); await page.locator('.ui3d-stage [data-graphics="ready"]').waitFor({ timeout: 120000 }); cycles.push(await cdp.send('Runtime.getHeapUsage')); }
  await cdp.send('HeapProfiler.collectGarbage'); const after = await cdp.send('Runtime.getHeapUsage');
  report.memory = { kind: 'CDP Runtime.getHeapUsage usedSize (JS heap), same explicit GC before/after; not GPU/VRAM/process RSS', before, after, cycles, driftBytes: after.usedSize - before.usedSize };
  assert.deepEqual(report.errors, []); report.status = 'measured';
} catch (error) { report.status = 'failed'; report.failure = error.stack; process.exitCode = 1; }
finally { if (browser) await browser.close(); server.kill(); await save(`${root}/profile.json`, report); }
console.log(JSON.stringify({ status: report.status, budgets: report.budgets, driftBytes: report.memory.driftBytes, failure: report.failure }));
