import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import os from 'node:os';

const phase = process.argv[2] ?? 'baseline';
assert(['baseline', 'baseline-stable', 'final'].includes(phase));
const root = `deliverables/implementation/UI3D/U3D-00/${phase}`;
await mkdir(`${root}/screenshots`, { recursive: true });
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(process.env.PLAYWRIGHT_MODULE ?? join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const sha = value => createHash('sha256').update(value).digest('hex');
const port = 5193, url = `http://127.0.0.1:${port}`;
const webRoot = phase === 'baseline-stable' ? '.local/u3d00/baseline-web' : 'apps/web';
const server = spawn(process.execPath, [resolve('apps/web/node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: webRoot, stdio: ['ignore', 'pipe', 'pipe'] });
let serverOutput = '', browser;
server.stdout.on('data', d => serverOutput += d); server.stderr.on('data', d => serverOutput += d);
const report = { phase, command: `node scripts/u3d00-browser.mjs ${phase}`, startedAt: new Date().toISOString(), status: 'running', checks: [], pageErrors: [], consoleErrors: [], networkFailures: [] };
try {
  let ready = false;
  for (let n = 0; n < 100; n++) {
    if (server.exitCode !== null) throw new Error(serverOutput);
    try { if ((await fetch(url)).ok) { ready = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  assert(ready, 'Preview ready');
  browser = await playwright.chromium.launch({ channel: process.env.U3D_BROWSER ?? 'chrome', headless: true });
  report.browser = browser.version(); report.browserChannel = process.env.U3D_BROWSER ?? 'chrome';
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
  // Isolated temporary context: never connect to the user's existing IndexedDB/profile.
  await context.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url, options) { super(url, options); this.addEventListener('message', e => {
        if (e.data.kind === 'init') window.__u3dInit = e.data;
        if (e.data.kind === 'match') window.__u3dMatch = e.data;
        if (e.data.kind === 'validate') window.__u3dValidation = e.data;
      }); }
    };
  });
  const page = await context.newPage();
  page.on('pageerror', e => report.pageErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
  page.on('requestfailed', r => report.networkFailures.push({ url: r.url(), failure: r.failure() }));
  const button = name => page.getByRole('button', { name, exact: true });
  const capture = async name => {
    await page.evaluate(() => document.fonts.ready);
    const settle = () => page.evaluate(async () => { scrollTo(0, 0); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); });
    await settle();
    await page.screenshot({ path: `${root}/screenshots/${name}-1600.png`, fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await settle();
    await page.screenshot({ path: `${root}/screenshots/${name}-1920.png`, fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 1600, height: 1100 });
    await settle();
  };
  await page.goto(url); await page.locator('#synth-name').waitFor();
  const sample = await page.evaluate(() => window.__u3dInit);
  await writeFile(`${root}/sample-init.json`, JSON.stringify(sample, null, 2) + '\n');
  report.sampleInitHash = sha(JSON.stringify(sample));
  await capture('workshop');
  await button('Brain Lab').click(); await capture('brain-lab');
  if (phase === 'final') {
    for (const width of [1600, 1920]) {
      const before = await readFile(`deliverables/implementation/UI3D/U3D-00/baseline-stable/screenshots/brain-lab-${width}.png`);
      const after = await readFile(`${root}/screenshots/brain-lab-${width}.png`);
      assert(before.equals(after), `Brain Lab ${width} baseline pixels unchanged`);
    }
    report.checks.push('Brain Lab 1600 and 1920 screenshot bytes equal to hash-verified original UI after settled capture');
  }
  await button('Workshop').click(); await button('Lưu revision').click();
  await page.getByRole('status').filter({ hasText: 'Đã lưu revision 1' }).waitFor();
  await button('My Synths').click(); await capture('my-synths');
  await button('Thử trận').click(); await page.locator('#timeline').waitFor({ timeout: 180000 }); await page.locator('canvas').waitFor();
  await button('Về đầu').click(); await capture('arena');
  const replay = await page.evaluate(() => window.__u3dMatch.replay);
  report.match = { manifest: replay.manifest, result: replay.result, simulationHash: replay.simulationHash, publicReplayHash: replay.publicReplayHash, orderedEventsHash: sha(JSON.stringify(replay.frames.flatMap(f => f.events))), publicFramesHash: sha(JSON.stringify(replay.frames)), frameCount: replay.frames.length };
  await writeFile(`${root}/sample-public-frames.json`, JSON.stringify([replay.frames[0], replay.frames.find(f => Object.values(f.actors).some(a => a.modules.some(m => m.phase === 'windup'))), replay.frames.at(-1)], null, 2) + '\n');
  report.gpu = await page.locator('canvas').evaluate(c => {
    const gl = c.getContext('webgl2'), ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { vendor: gl.getParameter(ext?.UNMASKED_VENDOR_WEBGL ?? gl.VENDOR), renderer: gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER), version: gl.getParameter(gl.VERSION), dpr: devicePixelRatio, viewport: [innerWidth, innerHeight] };
  });
  report.checks.push('Workshop / Brain Lab / My Synths / Arena renders captured at two desktop resolutions');
  const seekTimes = [];
  for (let n = 0; n < 100; n++) {
    const start = performance.now();
    await page.locator('#timeline').evaluate((el, tick) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(tick)); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, (n * 137) % replay.frames.length);
    seekTimes.push(performance.now() - start);
  }
  report.seek = { samples: 100, roundTripP95Ms: seekTimes.sort((a, b) => a - b)[94], note: 'DOM input + browser round trip on warm local frames; not network seek or GPU completion timing.' };
  if (phase === 'final') {
    const baseline = JSON.parse(await readFile('deliverables/implementation/UI3D/U3D-00/baseline/browser.json', 'utf8'));
    assert.deepEqual(report.match, baseline.match); assert.equal(report.sampleInitHash, baseline.sampleInitHash);
    report.checks.push('Same default practice input: exact simulation/replay/events/frames/result parity with baseline');
    await button('Workshop').click(); await button('Import / export JSON').click();
    const input = page.getByLabel('Bot JSON', { exact: false });
    const buffer = await input.inputValue(); await input.fill(buffer + '\n ');
    await page.getByLabel('Chế độ trình bày', { exact: true }).selectOption('3d');
    await page.getByText('Cảnh 3D chưa sẵn sàng ở U3D-00. Đang dùng 2D; bản đang sửa được giữ.', { exact: true }).waitFor();
    await capture('requested-3d-fallback');
    assert.match(page.url(), /presentation=3d/); assert.equal(await input.inputValue(), buffer + '\n ');
    await button('Brain Lab').click(); assert.equal(await page.locator('canvas').count(), 0);
    await button('Arena').click(); await page.locator('canvas').waitFor();
    await button('Workshop').click(); assert.equal(await input.inputValue(), buffer + '\n ');
    await page.getByLabel('Chế độ trình bày', { exact: true }).selectOption('2d');
    await input.fill(buffer); await button('Kiểm tra và áp dụng JSON').click();
    await page.getByRole('status').filter({ hasText: 'hợp lệ' }).waitFor();
    // Existing app intentionally disables rule editing while Body JSON is pending.
    // Test each buffer separately instead of bypassing this safety guard.
    await button('Brain Lab').click();
    const ruleBuffer = page.getByLabel('Rule JSON · condition / intent / set / nextState');
    const rule = await ruleBuffer.inputValue(); await ruleBuffer.fill(rule + '\n ');
    await button('Workshop').click();
    await page.getByLabel('Chế độ trình bày', { exact: true }).selectOption('3d');
    await button('Arena').click(); await page.locator('canvas').waitFor();
    await button('Brain Lab').click(); assert.equal(await ruleBuffer.inputValue(), rule + '\n ');
    report.checks.push('2d/3d switch + screen navigation retain unapplied Body and Brain buffers separately; Brain Lab has no 3D canvas');
    await ruleBuffer.fill(rule); await button('Kiểm tra và áp dụng luật').click();
    await page.getByRole('status').filter({ hasText: 'hợp lệ' }).waitFor();
    await button('Workshop').click();
    const originalName = await page.locator('#synth-name').inputValue();
    await page.locator('#synth-name').fill('U3D buffer probe');
    await page.getByLabel('Chế độ trình bày', { exact: true }).selectOption('3d');
    await button('Hoàn tác').click(); assert.equal(await page.locator('#synth-name').inputValue(), originalName);
    await button('Làm lại').click(); assert.equal(await page.locator('#synth-name').inputValue(), 'U3D buffer probe');
    await button('Hoàn tác').click();
    await page.reload(); await page.locator('#synth-name').waitFor();
    assert.equal(await page.getByLabel('Chế độ trình bày', { exact: true }).inputValue(), '3d');
    assert.equal(await page.locator('#synth-name').inputValue(), originalName);
    report.checks.push('Switch retains undo/redo; URL request survives reload; IndexedDB revision 1 still loads');
    const invalid = await context.newPage(); await invalid.goto(`${url}/?presentation=invalid`); await invalid.locator('#synth-name').waitFor();
    assert.equal(await invalid.getByLabel('Chế độ trình bày', { exact: true }).inputValue(), '2d'); await invalid.close();
    report.checks.push('Invalid mode safely defaults to 2d');
    report.responsive = [];
    for (const width of [1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      const size = await page.evaluate(() => ({ viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth }));
      assert(size.documentWidth <= size.viewportWidth, `No overflow at ${width}`);
      await page.screenshot({ path: `${root}/screenshots/fallback-${width}.png`, fullPage: true, animations: 'disabled' });
      report.responsive.push(size);
    }
    report.checks.push('Presentation selector/fallback at 1024/768/390/320 has no horizontal overflow (desktop emulation)');
    report.requested3dActuallyRendered = false;
  }
  report.heavyGlbRequests = await page.evaluate(() => performance.getEntriesByType('resource').filter(r => /\.glb(?:\?|$)/i.test(r.name)).map(r => r.name));
  assert.equal(report.heavyGlbRequests.length, 0); assert.equal(report.pageErrors.length, 0); assert.equal(report.consoleErrors.length, 0);
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.error = String(error); process.exitCode = 1; }
finally { report.finishedAt = new Date().toISOString(); await writeFile(`${root}/browser.json`, JSON.stringify(report, null, 2) + '\n'); await browser?.close(); if (server.exitCode === null) server.kill(); console.log(JSON.stringify({ phase, status: report.status, checks: report.checks, error: report.error, root }, null, 2)); }
