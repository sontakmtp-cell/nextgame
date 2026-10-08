import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import os from 'node:os';
import { save, evidence } from './u3d05-evidence.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE ?? resolve(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const url = 'http://127.0.0.1:5205', root = `${evidence}/faults`, report = { status: 'running', scenarios: [] };
const server = spawn(process.execPath, [resolve('apps/web/node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '5205', '--strictPort'], { cwd: 'apps/web', stdio: ['ignore', 'pipe', 'pipe'] });
let browser, output = ''; server.stdout.on('data', d => output += d); server.stderr.on('data', d => output += d);
try {
  for (let i = 0; i < 100; i++) { if (server.exitCode !== null) throw Error(output); try { if ((await fetch(url)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const scenario of ['cold', 'cache-denied', 'missing-manifest', 'missing-model', 'missing-decoder', 'no-webgl']) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
    if (scenario === 'cache-denied') await context.addInitScript(() => { Object.defineProperty(window, 'caches', { get() { throw Error('CACHE_DENIED_TEST'); } }); });
    if (scenario === 'no-webgl') await context.addInitScript(() => { const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (kind, ...args) { if (String(kind).includes('webgl')) return null; return get.call(this, kind, ...args); }; });
    const page = await context.newPage(), assets = [], chunks = [], errors = [], responses = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => {
      if (/\.(glb|ktx2|woff2|wasm|webp)(\?|$)|basis_transcoder\.js/.test(r.url())) responses.push(r.body().then(b => assets.push({ url: r.url().replace(url, ''), bytes: b.length, status: r.status() })).catch(() => { const bytes = Number(r.headers()['content-length']); if (bytes > 0) assets.push({ url: r.url().replace(url, ''), bytes, status: r.status(), note: 'HTTP Content-Length fallback' }); }));
      if (r.url().endsWith('.js')) responses.push(r.body().then(b => chunks.push({ url: r.url().replace(url, ''), pixi: /PixiJS|pixi\.js/.test(b.toString()) })).catch(() => {}));
    });
    const button = name => page.getByRole('button', { name, exact: true });
    await page.goto(url); await page.locator('#synth-name').waitFor(); await button('Lưu revision').click(); await page.locator('.status-strip').filter({ hasText: 'Đã lưu revision 1' }).waitFor();
    if (scenario === 'missing-manifest') await page.route('**/ui3d/u3d01/manifest.json', r => r.fulfill({ status: 404, body: 'missing fixture' }));
    if (scenario === 'missing-model') await page.route('**/modules/**/model.glb', r => r.fulfill({ status: 404, body: 'missing fixture' }));
    if (scenario === 'missing-decoder') await page.route('**/decoders/basis_transcoder.wasm', r => r.fulfill({ status: 404, body: 'missing fixture' }));
    await button('My Synths').click(); await page.getByLabel('Chế độ trình bày', { exact: true }).selectOption('3d');
    if (scenario === 'cold' || scenario === 'cache-denied') {
      await page.locator('.ui3d-synth-preview [data-graphics="ready"]').waitFor({ timeout: 45000 }); await page.locator('.ui3d-synth-library img').waitFor({ timeout: 45000 });
      await button('Xem Synth Mantis').click(); await page.locator('.ui3d-synth-history img').waitFor();
      await Promise.all(responses); assert(chunks.every(c => !c.pixi)); assert(assets.every(a => !a.url.includes('/concepts/') && !a.url.includes('/assets/3d/'))); assert.deepEqual(errors, []);
      if (scenario === 'cold') report.cold = { assets, chunks, uniqueBytes: [...new Map(assets.map(a => [a.url, a])).values()].reduce((sum, a) => sum + a.bytes, 0), excludingHighBytes: [...new Map(assets.filter(a => !a.url.includes('/high/')).map(a => [a.url, a])).values()].reduce((sum, a) => sum + a.bytes, 0), note: 'Unique decoded response bodies for fonts, Medium, High, floor and decoders through scene+thumbnail readiness; excludingHigh is a URL-filtered size budget, not exact first-frame timing.' };
    } else {
      await page.getByRole('button', { name: 'Chuyển 2D', exact: true }).first().waitFor({ timeout: 45000 });
      await button('Xem Synth Mantis').click(); await button('Xem revision 1').waitFor(); assert(await button('Mở trong Workshop').isEnabled());
    }
    await page.screenshot({ path: `${root}/${scenario}.png`, fullPage: true });
    await button('Lưu revision').click(); await page.locator('.status-strip').filter({ hasText: 'Đã lưu revision 2' }).waitFor();
    if (scenario !== 'cold' && scenario !== 'cache-denied') { await page.getByRole('button', { name: 'Chuyển 2D', exact: true }).first().click(); assert.equal(await page.getByLabel('Chế độ trình bày', { exact: true }).inputValue(), '2d'); assert(await page.getByRole('heading', { name: 'Những phiên bản trên máy này', exact: true }).isVisible()); }
    report.scenarios.push({ scenario, status: 'passed', errors, note: 'Graphics/cache failure does not remove archive/history/save; fallback changes only presentation mode. Fault errors are expected and recorded.' });
    await context.close();
  }
  report.status = 'passed';
} catch (e) { report.status = 'failed'; report.failure = e.stack; process.exitCode = 1; }
finally { await save(`${root}/faults.json`, report); await browser?.close(); server.kill(); console.log(JSON.stringify({ status: report.status, failure: report.failure })); }
