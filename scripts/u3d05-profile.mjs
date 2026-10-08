import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import os from 'node:os';
import { save, evidence } from './u3d05-evidence.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE ?? resolve(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const url = 'http://127.0.0.1:5205', root = `${evidence}/profile`, seconds = Number(process.env.U3D_STRESS_SECONDS ?? 120);
const report = { status: 'running', at: new Date().toISOString(), command: 'node scripts/u3d05-profile.mjs', cpu: os.cpus()[0].model, samples: [], note: '24-module render-only Body in isolated IndexedDB fixture. Exceeds gameplay budget intentionally; never advertised as a valid gameplay bot. rAF cadence and actual WebGL draws, not GPU completion timing.' };
const server = spawn(process.execPath, [resolve('apps/web/node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '5205', '--strictPort'], { cwd: 'apps/web', stdio: ['ignore', 'pipe', 'pipe'] });
let browser, output = ''; server.stdout.on('data', d => output += d); server.stderr.on('data', d => output += d);
try {
  for (let i = 0; i < 100; i++) { if (server.exitCode !== null) throw Error(output); try { if ((await fetch(url)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch({ channel: 'chrome', headless: true }); report.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  await context.addInitScript(() => {
    const NativeWorker = window.Worker; window.Worker = class extends NativeWorker { constructor(url, options) { super(url, options); this.addEventListener('message', e => { if (e.data.kind === 'init') window.__init = e.data; }); } };
    window.__draws = { calls: 0, triangles: 0 };
    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
      const original = WebGL2RenderingContext.prototype[name];
      WebGL2RenderingContext.prototype[name] = function (...args) {
        if (this.canvas.closest('.ui3d-synth-preview')) { const mode = args[0], count = name.includes('Elements') ? args[1] : args[2], instances = name.includes('Instanced') ? args.at(-1) : 1; window.__draws.calls++; window.__draws.triangles += (mode === this.TRIANGLES ? count / 3 : mode === this.TRIANGLE_STRIP || mode === this.TRIANGLE_FAN ? Math.max(0, count - 2) : 0) * instances; }
        return original.apply(this, args);
      };
    }
  });
  const page = await context.newPage(); await page.goto(url); await page.locator('#synth-name').waitFor();
  const fixture = await page.evaluate(() => { const definition = structuredClone(window.__init.templates[0]); definition.name = 'Render stress 24 · không hợp lệ gameplay'; definition.body.modules = [{ id: 'core', catalogId: 'core', cell: { x: 5, y: 5 }, orientation: 0 }]; const types = ['armor', 'thruster', 'blade', 'burst', 'shield', 'radiator', 'capacitor']; for (let y = 3; y < 9 && definition.body.modules.length < 24; y++) for (let x = 3; x < 9 && definition.body.modules.length < 24; x++) { if (x >= 5 && x <= 6 && y >= 5 && y <= 6) continue; const index = definition.body.modules.length; definition.body.modules.push({ id: `stress${index}`, catalogId: types[(index - 1) % types.length], cell: { x, y }, orientation: index % 4 }); } return { id: 'u3d05-stress24', revision: 1, definition, hypothesis: 'Render-only; no validation or simulation claim', weakness: '', parentHash: null, savedAt: '2026-10-08T00:00:00.000Z' }; });
  await save(`${root}/fixture.json`, fixture);
  await page.evaluate(async row => { const db = await new Promise((resolve, reject) => { const r = indexedDB.open('prompt-chien-local', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); await new Promise((resolve, reject) => { const tx = db.transaction(['heads', 'revisions'], 'readwrite'); tx.objectStore('heads').put(row); tx.objectStore('revisions').add(row); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); db.close(); }, fixture);
  await page.reload(); await page.locator('#synth-name').waitFor(); await page.getByRole('button', { name: 'My Synths', exact: true }).click(); await page.getByLabel('Chế độ trình bày', { exact: true }).selectOption('3d');
  const ready = () => page.locator('.ui3d-synth-preview [data-graphics="ready"]').waitFor({ timeout: 45000 }); await ready(); await page.locator('.ui3d-synth-library img').waitFor({ timeout: 45000 });
  assert.equal(JSON.parse(await page.locator('.ui3d-synth-preview').getAttribute('data-preview-body')).modules.length, 24);
  report.gpu = await page.locator('.ui3d-synth-preview canvas').evaluate(c => { const gl = c.getContext('webgl2'), ext = gl.getExtension('WEBGL_debug_renderer_info'); return { renderer: gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER), version: gl.getParameter(gl.VERSION), viewport: [innerWidth, innerHeight], dpr: devicePixelRatio }; });
  for (const quality of ['high', 'medium', 'low']) {
    await page.getByLabel('Chất lượng Synth 3D', { exact: true }).selectOption(quality); await ready();
    await page.screenshot({ path: `${root}/stress-${quality}.png`, fullPage: true });
    const durationMs = (quality === 'high' ? seconds : 10) * 1000;
    console.log(`Measuring ${quality}, ${durationMs / 1000}s`);
    const sample = await page.evaluate(async durationMs => {
      const values = [], draws = [], start = performance.now(), initial = { ...window.__draws }; let last = start, previous = initial;
      await new Promise(resolve => { const tick = time => { const current = { ...window.__draws }; values.push(time - last); draws.push({ calls: current.calls - previous.calls, triangles: current.triangles - previous.triangles }); previous = current; last = time; if (time - start < durationMs) requestAnimationFrame(tick); else resolve(); }; requestAnimationFrame(tick); });
      values.shift(); draws.shift(); const sorted = [...values].sort((a, b) => a - b); return { durationMs: last - start, samples: values.length, p95Ms: sorted[Math.floor(sorted.length * .95)], p99Ms: sorted[Math.floor(sorted.length * .99)], maxMs: sorted.at(-1), sampleDraw: draws.find(d => d.calls > 0), drawsTotal: window.__draws.calls - initial.calls, intervals: values };
    }, durationMs);
    report.samples.push({ quality, moduleCount: 24, reducedMotion: false, ...sample }); await save(`${root}/profile.json`, report);
  }
  const high = report.samples[0]; report.strictDesktopGate = { p95LimitMs: 16.7, p99LimitMs: 33.3, passed: high.p95Ms <= 16.7 && high.p99Ms <= 33.3 && high.durationMs >= 120000 };
  report.status = 'measured';
} catch (e) { report.status = 'failed'; report.failure = e.stack; process.exitCode = 1; }
finally { await save(`${root}/profile.json`, report); await browser?.close(); server.kill(); console.log(JSON.stringify({ status: report.status, gate: report.strictDesktopGate, failure: report.failure })); }
