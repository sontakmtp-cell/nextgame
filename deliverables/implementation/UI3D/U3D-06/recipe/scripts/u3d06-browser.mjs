import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import os from 'node:os';
import { evidence, save, sha } from './u3d06-evidence.mjs';

const require = createRequire(import.meta.url);
const dependencies = resolve(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? resolve(dependencies, 'playwright'));
const { expect } = require(resolve(dependencies, 'playwright/test'));
const { PNG } = require(resolve(dependencies, 'pngjs'));
const phase = process.argv[2] ?? 'final', channel = process.env.U3D_BROWSER ?? 'chrome';
assert(['baseline', 'final'].includes(phase));
const root = `${evidence}/${phase}/${channel}`;
if (phase === 'baseline') { try { await readFile(`${root}/browser.json`); throw Error('Baseline exists; refusing overwrite'); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
const url = 'http://127.0.0.1:5206';
const server = spawn(process.execPath, [resolve('apps/web/node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '5206', '--strictPort'], { cwd: 'apps/web', stdio: ['ignore', 'pipe', 'pipe'] });
let output = '', browser;
server.stdout.on('data', d => output += d); server.stderr.on('data', d => output += d);
const report = { command: `node scripts/u3d06-browser.mjs ${phase}`, phase, channel, startedAt: new Date().toISOString(), status: 'running', checks: [], errors: [], consoleErrors: [], networkFailures: [], assets: [], comparisons: [], measurements: {} };
const compare = async (path, reference, label, required = true) => {
  const actualBytes = await readFile(path), referenceBytes = await readFile(reference);
  const a = PNG.sync.read(actualBytes), b = PNG.sync.read(referenceBytes);
  let differentPixels = 0;
  if (a.width === b.width && a.height === b.height) {
    for (let i = 0; i < a.data.length; i += 4) if (a.data.subarray(i, i + 4).compare(b.data.subarray(i, i + 4))) differentPixels++;
  } else differentPixels = null;
  const result = { label, path, reference, actualSize: [a.width, a.height], referenceSize: [b.width, b.height], differentPixels, byteIdentical: actualBytes.equals(referenceBytes), actualHash: sha(actualBytes), referenceHash: sha(referenceBytes) };
  report.comparisons.push(result);
  if (required) assert.equal(differentPixels, 0, label);
};
await save(`${root}/browser.json`, report);
try {
  let ready = false;
  for (let i = 0; i < 100; i++) { if (server.exitCode !== null) throw Error(output); try { if ((await fetch(url)).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 100)); }
  assert(ready);
  browser = await chromium.launch({ channel, headless: true }); report.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    window.__workerCount = 0; window.__requests = [];
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url, options) { super(url, options); if (!String(url).includes('local.worker')) return; window.__workerCount++; this.addEventListener('message', e => { if (e.data.kind === 'init') window.__init = e.data; if (e.data.kind === 'match') window.__match = e.data; if (e.data.kind === 'validate' || e.data.kind === 'error') window.__validation = e.data; }); }
      postMessage(message, transfer) { if (message?.kind) window.__requests.push(message); super.postMessage(message, transfer ?? []); }
    };
  });
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
  page.on('requestfailed', r => report.networkFailures.push({ url: r.url(), failure: r.failure() }));
  page.on('response', async r => { if (/\.(glb|ktx2|woff2|wasm)(\?|$)/.test(r.url())) report.assets.push({ url: r.url().replace(url, ''), bytes: (await r.body().catch(() => Buffer.alloc(0))).length, status: r.status() }); });
  const button = name => page.getByRole('button', { name, exact: true });
  const ruleBuffer = page.getByLabel('Rule JSON · condition / intent / set / nextState');
  const readRule = async expected => { await expect.poll(async () => JSON.parse(await ruleBuffer.inputValue())).toMatchObject(expected); return JSON.parse(await ruleBuffer.inputValue()); };
  const botBuffer = page.getByLabel('Bot JSON', { exact: false });
  const settle = async () => { await page.evaluate(() => document.fonts.ready); await page.evaluate(async () => { scrollTo(0, 0); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }); };
  const capture = async name => {
    // Navigation moves the clicked button between horizontal 3D and vertical
    // pixel menus. Normalize the pointer so hover is the same in both images.
    if (/^brain-(before-3d|after)/.test(name)) { await page.mouse.move(1599, 0); await page.waitForTimeout(200); }
    await settle(); await page.screenshot({ path: `${root}/${name}.png`, fullPage: true, animations: 'disabled' });
  };
  const valid = async () => {
    await page.waitForFunction(() => window.__validation?.id === window.__requests.at(-1)?.id && window.__validation?.kind === 'validate');
    await page.getByRole('status').filter({ hasText: 'hợp lệ' }).waitFor();
  };
  const no3d = async () => {
    assert.equal(await page.locator('canvas').count(), 0);
    assert.equal(await page.locator('.ui3d-shell,.presentation-control').count(), 0);
    if (phase === 'final') assert.equal(await page.locator('.brain-lab-shell').count(), 1);
    else assert.equal(await page.locator('.brain-lab-shell').count(), 0, 'Baseline uses pre-edit production build');
  };
  const styleSignature = () => page.evaluate(() => {
    const signature = {};
    for (const selector of ['.app-shell', '.topbar', '.n8n-container', '.n8n-node-state', '.n8n-node-condition', '.n8n-node-action', '.n8n-node-header', '.n8n-wire-core', '.n8n-inspector', '.n8n-inspector textarea', '.n8n-toolbar button']) {
      const style = getComputedStyle(document.querySelector(selector));
      signature[selector] = Object.fromEntries(['fontFamily','fontSize','color','backgroundColor','borderRadius','borderColor','boxShadow','imageRendering','display','height','width'].map(k => [k, style[k]]));
    }
    return signature;
  });
  await page.goto(url); await page.locator('#synth-name').waitFor(); await button('Brain Lab').click();
  report.sampleInitHash = sha(JSON.stringify(await page.evaluate(() => window.__init)));
  if (phase === 'final') assert.equal(report.sampleInitHash, JSON.parse(await readFile(`${evidence}/baseline/${channel}/browser.json`)).sampleInitHash);
  report.measurements.standaloneBrainGlbRequests = report.assets.filter(a => a.url.endsWith('.glb')).length;
  assert.equal(report.measurements.standaloneBrainGlbRequests, 0);
  for (const [width, height] of [[1600, 1100], [1920, 1080]]) {
    await page.setViewportSize({ width, height }); await capture(`brain-${width}`); await no3d();
    if (channel === 'chrome') await compare(`${root}/brain-${width}.png`, `deliverables/implementation/UI3D/U3D-00/baseline-stable/screenshots/brain-lab-${width}.png`, `U3D-00 pixel baseline ${width}`);
    if (phase === 'final') await compare(`${root}/brain-${width}.png`, `${evidence}/baseline/${channel}/brain-${width}.png`, `Input checkout pixels ${width}`);
  }
  report.checks.push('Brain Lab desktop render + computed pixel styles unchanged; no canvas/presentation selector/theme');
  await page.setViewportSize({ width: 1600, height: 1100 });
  await settle(); await page.waitForTimeout(200); report.pixelStyles = await styleSignature();
  if (phase === 'final') assert.deepEqual(report.pixelStyles, JSON.parse(await readFile(`${evidence}/baseline/${channel}/browser.json`)).pixelStyles);
  await button('Workshop').click(); await button('Thử trận').click(); await page.locator('#timeline').waitFor({ timeout: 180000 });
  const replay = await page.evaluate(() => window.__match.replay);
  report.match = { manifest: replay.manifest, result: replay.result, simulationHash: replay.simulationHash, publicReplayHash: replay.publicReplayHash, orderedEventsHash: sha(JSON.stringify(replay.frames.flatMap(f => f.events))), publicFramesHash: sha(JSON.stringify(replay.frames)), frameCount: replay.frames.length };
  if (phase === 'final') assert.deepEqual(report.match, JSON.parse(await readFile(`${evidence}/baseline/${channel}/browser.json`)).match);
  const originalBot = replay.source;
  report.checks.push('Default match manifest/result/simulation/replay/public frames/ordered events exact input parity');
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.mouse.move(1599, 0);
  await button('Brain Lab').click(); await capture('brain-before-3d');
  await button('Workshop').click(); await page.getByLabel('Chế độ trình bày', { exact: true }).selectOption('3d');
  await page.locator('.ui3d-stage canvas').waitFor(); await page.locator('[data-workshop-graphics="ready"]').waitFor({ state: 'attached', timeout: 120000 });
  await button('Brain Lab').click(); await no3d();
  // Same full screen as initial state: navigation alone cannot alter a pixel or a bot.
  await capture('brain-after-workshop');
  await compare(`${root}/brain-after-workshop.png`, `${root}/brain-before-3d.png`, 'Brain after loaded Workshop 3D');
  assert.deepEqual(await styleSignature(), report.pixelStyles);
  await button('Arena').click(); await page.locator('.ui3d-arena-canvas canvas').waitFor();
  await page.waitForFunction(() => document.querySelector('.ui3d-arena-shell') && !document.body.textContent.includes('Đang tải Arena 3D…'));
  await capture('arena-3d');
  report.gpu = await page.locator('canvas').evaluate(c => { const gl = c.getContext('webgl2'), ext = gl.getExtension('WEBGL_debug_renderer_info'); return { vendor: gl.getParameter(ext?.UNMASKED_VENDOR_WEBGL ?? gl.VENDOR), renderer: gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER), version: gl.getParameter(gl.VERSION), dpr: devicePixelRatio }; });
  await button('My Synths').click(); await page.locator('.ui3d-synth-shell canvas').waitFor();
  await button('Brain Lab').click(); await no3d(); await capture('brain-after-all-3d');
  await compare(`${root}/brain-after-all-3d.png`, `${root}/brain-before-3d.png`, 'Brain after all three 3D CSS chunks loaded');
  assert.deepEqual(await styleSignature(), report.pixelStyles);
  report.checks.push('Workshop/Arena/My Synths keep actual 3D; Brain resumes same pixel screen after lazy CSS loads');
  // Independent Body and Brain buffers, including deliberately invalid text.
  const transitions = [];
  for (const mode of ['3d', '2d']) {
    await button('Workshop').click(); await page.getByLabel('Chế độ trình bày', { exact: true }).selectOption(mode);
    await button('Brain Lab').click(); const original = await ruleBuffer.inputValue();
    const text = original + '\n uncommitted-U3D06'; await ruleBuffer.fill(text);
    const requests = await page.evaluate(() => window.__requests.length), start = performance.now();
    await button('Workshop').click(); await button('Brain Lab').click(); assert.equal(await ruleBuffer.inputValue(), text);
    await button('Arena').click(); await page.locator('#timeline').waitFor(); await button('Brain Lab').click();
    assert.equal(await ruleBuffer.inputValue(), text); await no3d();
    assert.equal(await button('Thử trận').isDisabled(), true); assert.equal(await button('+ Thêm state').isDisabled(), true);
    assert.equal(await page.evaluate(() => window.__requests.length), requests);
    transitions.push({ mode, kind: 'Brain invalid unapplied buffer', roundTripMs: performance.now() - start });
    await capture(`brain-buffer-${mode}`); await button('Bỏ JSON đang gõ').click(); await expect(ruleBuffer).toHaveValue(original);
    await button('Mở Bot JSON').click(); const source = await botBuffer.inputValue(); assert.deepEqual(JSON.parse(source), originalBot);
    const bodyText = source + '\n unapplied-body-U3D06'; await botBuffer.fill(bodyText);
    await button('Workshop').click(); await button('Brain Lab').click(); await button('Arena').click(); await button('Brain Lab').click();
    assert.equal(await botBuffer.inputValue(), bodyText); assert.equal(await ruleBuffer.isDisabled(), true); await no3d();
    await button('Bỏ JSON đang sửa').click(); await expect(botBuffer).toHaveValue(source);
    await button('✕ Đóng').click();
  }
  report.measurements.transitions = transitions;
  report.checks.push('Workshop → Brain Lab → Arena → Brain Lab keeps invalid unapplied Brain/Body buffers separately in 2d and 3d; no worker request or bot mutation');
  const world = page.locator('.n8n-world'), viewport = page.locator('.n8n-canvas-viewport');
  const transform = await world.getAttribute('style');
  const rect = await viewport.boundingBox();
  await page.mouse.move(rect.x + 70, rect.y + 25); await page.mouse.down(); await page.mouse.move(rect.x + 170, rect.y + 70, { steps: 5 }); await page.mouse.up();
  assert.notEqual(await world.getAttribute('style'), transform);
  await page.mouse.wheel(0, -100); await page.waitForFunction(() => document.querySelector('.n8n-world').style.transform.includes('scale(1.1)'));
  await button('1:1').click(); assert.match(await world.getAttribute('style'), /translate\(40px, 40px\) scale\(1\)/);
  await button('+').click(); assert.match(await world.getAttribute('style'), /scale\(1.15\)/);
  await button('−').click(); await button('⚡ SẮP XẾP N8N').click();
  const wireBefore = await page.locator('.n8n-wire-core').first().getAttribute('d');
  const stateNode = page.locator('.n8n-node-state'), nodeRect = await stateNode.boundingBox();
  await page.mouse.move(nodeRect.x + 100, nodeRect.y + 40); await page.mouse.down(); await page.mouse.move(nodeRect.x + 130, nodeRect.y + 85, { steps: 5 }); await page.mouse.up();
  assert.notEqual(await page.locator('.n8n-wire-core').first().getAttribute('d'), wireBefore);
  report.measurements.graph = { nodes: await page.locator('.n8n-node').count(), wires: await page.locator('.n8n-wire-core').count() };
  await capture('brain-pan-drag'); await button('⚡ SẮP XẾP N8N').click();
  report.checks.push('Graph pan, wheel/button zoom, 1:1, auto-layout, node drag + SVG wire endpoints');
  // Library search/filter/empty state; real worker compilation of each added node.
  await button('Thư viện node · 16').click();
  assert.equal(await page.locator('.node-library-card').count(), 16);
  await page.getByLabel('Tìm node').fill('zz-U3D06'); await page.getByText('Không tìm thấy node. Thử từ khác hoặc chọn tất cả nhóm.').waitFor();
  await page.getByLabel('Tìm node').fill(''); await page.getByLabel('Nhóm node').selectOption('Bộ nhớ & trạng thái');
  assert.equal(await page.locator('.node-library-card').count(), 3); await capture('brain-library');
  await button('Thêm node Ghi nhớ quyết định').click(); await valid();
  await readRule({ set: [{ value: { op: 'add' } }] });
  await button('Thư viện node · 16').click(); await button('Thêm node Chuyển trạng thái').click(); await valid();
  await readRule({ nextState: 'recover' });
  assert.equal(await page.locator('.n8n-node-transition').count() > 0, true);
  await button('recover (2)').click(); await readRule({ id: 'cooled' });
  const startState = page.locator('.brain-layout select').first(); await startState.selectOption('recover');
  await page.locator('.n8n-node-state').getByText('START: recover', { exact: true }).waitFor();
  await button('Kiểm tra bot').click(); await valid();
  await button('+ Thêm state').click(); await button('+ Thêm luật idle').click();
  await readRule({ id: 'rule1' });
  await button('Xóa luật').click(); await expect.poll(async () => JSON.parse(await ruleBuffer.inputValue())).toEqual({});
  await button('recover (2)').click();
  await page.locator('.n8n-node-condition').nth(1).click(); await readRule({ id: 'rest' });
  await button('Tăng ưu tiên').click();
  await readRule({ id: 'rest' });
  await page.locator('.n8n-node-condition').first().getByText('1. rest', { exact: true }).waitFor();
  await page.getByLabel('Tên / ID của Quy tắc').fill('restU3D06');
  await page.getByLabel('Tiến/lùi (−1000…1000)').fill('123');
  await page.getByLabel('Lách ngang (−1000…1000)').fill('234');
  await page.getByLabel('Xoay thân turn (−1000…1000)').fill('345');
  await page.getByLabel('Đích đến FSM').selectOption(originalBot.brain.initialState);
  const edit = await readRule({ id: 'restU3D06', intent: { thrust: { forward: { value: 123 }, strafe: { value: 234 } }, turn: { value: 345 } }, nextState: originalBot.brain.initialState });
  assert.equal(edit.id, 'restU3D06'); assert.equal(edit.intent.thrust.forward.value, 123); assert.equal(edit.intent.thrust.strafe.value, 234); assert.equal(edit.intent.turn.value, 345);
  await page.locator('.n8n-node-condition').nth(1).click(); await page.getByLabel(/Ngưỡng so sánh/).fill('410');
  await readRule({ id: 'cooled', when: { right: { value: 410 } } });
  const validRuleText = await ruleBuffer.inputValue();
  await ruleBuffer.fill('{ invalid rule'); await button('Kiểm tra và áp dụng luật').click(); await page.getByRole('alert').waitFor();
  assert.equal(await ruleBuffer.inputValue(), '{ invalid rule');
  await button('Bỏ JSON đang gõ').click();
  await expect(ruleBuffer).toHaveValue(validRuleText);
  const jsonRule = JSON.parse(await ruleBuffer.inputValue()); jsonRule.when.right.value = 405;
  await ruleBuffer.fill(JSON.stringify(jsonRule, null, 2)); await button('Kiểm tra và áp dụng luật').click(); await valid();
  await readRule({ when: { right: { value: 405 } } });
  await ruleBuffer.blur(); await page.keyboard.press('Control+z'); await readRule({ when: { right: { value: 410 } } });
  await page.keyboard.press('Control+Shift+z'); await readRule({ when: { right: { value: 405 } } });
  await capture('brain-edited');
  report.measurements.appWorkerCountBeforeReload = await page.evaluate(() => window.__workerCount);
  assert.equal(report.measurements.appWorkerCountBeforeReload, 1);
  await button('Lưu revision').click(); await page.getByRole('status').filter({ hasText: 'Đã lưu revision 1' }).waitFor();
  const database = await page.evaluate(async () => { const db = await new Promise((res, rej) => { const r = indexedDB.open('prompt-chien-local'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); const result = { version: db.version, stores: [...db.objectStoreNames] }; db.close(); return result; });
  assert.deepEqual(database, { version: 1, stores: ['heads', 'revisions'] }); report.database = database;
  await button('Mở Bot JSON').click(); const saved = JSON.parse(await botBuffer.inputValue());
  assert.deepEqual(saved.body, originalBot.body); assert.deepEqual(saved.brain.states.find(s => s.id === 'recover').rules.map(r => r.id), ['restU3D06', 'cooled']);
  await page.reload(); await page.locator('#synth-name').waitFor(); await button('Brain Lab').click(); await button('Mở Bot JSON').click();
  assert.deepEqual(JSON.parse(await botBuffer.inputValue()), saved);
  report.checks.push('Library search/filter/empty/memory/transition; state/initialState/rule add/delete/select/priority; inspector fields; invalid rule rejection + valid worker apply; saved rule order and reload in DB v1');
  await button('✕ Đóng').click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 }); await capture(`brain-responsive-${width}`); await no3d();
    assert.equal(await ruleBuffer.isVisible(), true);
  }
  if (phase === 'final') {
    // Scoped selectors must not style an unrelated copy of Brain classes in 3D.
    await button('Workshop').click(); await page.getByLabel('Chế độ trình bày', { exact: true }).selectOption('3d');
    report.measurements.isolationProbe = await page.evaluate(() => { const probe = document.createElement('div'); probe.className = 'n8n-node n8n-node-action'; document.querySelector('.app-shell').append(probe); const s = getComputedStyle(probe), result = { position: s.position, boxShadow: s.boxShadow, width: s.width }; probe.remove(); return result; });
    assert.equal(report.measurements.isolationProbe.position, 'static'); assert.equal(report.measurements.isolationProbe.boxShadow, 'none');
    report.checks.push('Brain-only CSS cannot style Brain class names mounted in a 3D shell');
  }
  assert.equal(report.errors.length, 0, report.errors.join('\n'));
  const knownWheelWarning = 'Unable to preventDefault inside passive event listener invocation.';
  assert(report.consoleErrors.every(message => message === knownWheelWarning), report.consoleErrors.join('\n'));
  if (phase === 'final') assert.deepEqual(report.consoleErrors, JSON.parse(await readFile(`${evidence}/baseline/${channel}/browser.json`)).consoleErrors, 'No new console errors versus input checkout');
  report.baselineWarning = { message: knownWheelWarning, count: report.consoleErrors.length, note: 'Observed in pre-edit Brain graph wheel handler. Zoom works; native page scroll is not prevented by React passive wheel listener. Kept out of U3D-06 regression-only scope; no console errors are silently suppressed.' };
  report.measurements.abortedNetworkRequests = report.networkFailures.filter(r => r.failure?.errorText === 'net::ERR_ABORTED').length;
  assert(report.networkFailures.every(r => r.failure?.errorText === 'net::ERR_ABORTED'), 'Unexpected network failure (screen-unmount aborts are recorded separately)');
  assert(report.assets.filter(a => a.url.endsWith('.glb')).every(a => a.url.startsWith('/assets/ui3d/u3d01/modules/')), 'Only optimized runtime GLBs');
  report.measurements.glbRequests = report.assets.filter(a => a.url.endsWith('.glb')).length;
  report.measurements.glbResponseBytes = report.assets.filter(a => a.url.endsWith('.glb')).reduce((sum, a) => sum + a.bytes, 0);
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = String(error); process.exitCode = 1; }
finally { report.finishedAt = new Date().toISOString(); await save(`${root}/browser.json`, report); await browser?.close(); server.kill(); console.log(JSON.stringify({ phase, channel, status: report.status, comparisons: report.comparisons.map(c => ({ label: c.label, differentPixels: c.differentPixels })), failure: report.failure })); }
