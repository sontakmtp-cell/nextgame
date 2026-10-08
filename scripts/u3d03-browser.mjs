import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import os from 'node:os';
import { evidence, save, sha } from './u3d03-evidence.mjs';
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
const report = { command: `node scripts/u3d03-browser.mjs ${phase}`, phase, channel, startedAt: new Date().toISOString(), status: 'running', checks: [], errors: [], assets: [], measurements: {} };
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
  await button('Workshop').click(); await capture('workshop-2d');
  if (phase === 'final') {
    await page.getByLabel('Chế độ trình bày', { exact: true }).selectOption('3d');
    await page.locator('.ui3d-stage [data-graphics="ready"]').waitFor({ timeout: 120000 });
    assert.equal(await page.locator('canvas').count(), 1);
    for (const [width, height] of [[1600, 1100], [1920, 1080]]) { await page.setViewportSize({ width, height }); await capture(`workshop-high-${width}`); }
    await page.setViewportSize({ width: 1600, height: 1100 });
    report.gpu = await page.locator('canvas').evaluate(c => { const gl = c.getContext('webgl2'), ext = gl.getExtension('WEBGL_debug_renderer_info'); return { renderer: gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER), vendor: gl.getParameter(ext?.UNMASKED_VENDOR_WEBGL ?? gl.VENDOR), dpr: devicePixelRatio, viewport: [innerWidth, innerHeight] }; });
    report.checks.push('Workshop High renders from optimized GLB/KTX2, one real canvas');
    const readBot = async () => { await button('Công cụ khác').click(); if (!await page.getByLabel('Bot JSON', { exact: false }).count()) await button('Import / export JSON').click(); const value = JSON.parse(await page.getByLabel('Bot JSON', { exact: false }).inputValue()); await button('Đóng công cụ').click(); return value; };
    const waitJob = async () => { await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).some(b => b.textContent === 'Hủy job')); };
    const before = await readBot();
    await page.locator('.ui3d-display > summary').click(); await page.getByLabel('Giảm chuyển động', { exact: false }).check();
    const canvas = page.locator('.ui3d-stage canvas');
    const manifest = JSON.parse(await readFile('apps/web/public/assets/ui3d/u3d01/manifest.json'));
    const footprints = await page.evaluate(() => Object.fromEntries(window.__init.catalog.map(c => [c.id, c.footprint])));
    const project = async (body, cell, y = 0.025, f = 1) => {
      await settle();
      const box = await canvas.boundingBox(), camera = fitPreviewCamera(body, footprints, manifest, box, workshopCamera), core = body.modules.find(m => m.catalogId === 'core');
      const dx = cell.x + f / 2 - core.cell.x - 1 - camera.target[0], dz = -(cell.y + f / 2 - core.cell.y - 1) - camera.target[2], dy = y - camera.target[1];
      return { x: box.x + box.width / 2 + (Math.cos(camera.azimuth) * dx - Math.sin(camera.azimuth) * dz) * camera.zoom, y: box.y + box.height / 2 - (-Math.sin(camera.azimuth) * Math.sin(camera.elevation) * dx + Math.cos(camera.elevation) * dy - Math.cos(camera.azimuth) * Math.sin(camera.elevation) * dz) * camera.zoom };
    };
    const empty = { x: 8, y: 5 }, pos = await project(before.body, empty);
    await page.mouse.move(pos.x, pos.y); await capture('hover-ghost');
    assert((await page.locator('.ui3d-preview-label').textContent()).includes('(8,5)'));
    assert.deepEqual(await readBot(), before);
    await page.mouse.click(pos.x, pos.y);
    assert.equal(await page.getByLabel('Ô X', { exact: true }).inputValue(), '8');
    assert.deepEqual(await readBot(), before);
    for (const heading of [0, 1, 2, 3]) {
      // The same empty cell and explicit confirmation through the DOM controls.
      if (!await page.getByLabel('Hướng lắp', { exact: true }).isVisible()) await page.locator('.ui3d-inspector > summary').click();
      await page.getByLabel('Hướng lắp', { exact: true }).selectOption(String(heading));
      await button('Lắp module').click(); await waitJob();
      const added = await readBot(); assert.equal(added.body.modules.length, before.body.modules.length + 1); assert.equal(added.body.modules.at(-1).orientation, heading); assert.deepEqual(added.brain, before.brain);
      await button('Hoàn tác').click(); assert.deepEqual(await readBot(), before);
    }
    report.checks.push('Real canvas hover and click never mutate Body; confirmed add in all four headings uses validator and undo');
    // Pick a real module using its footprint proxy, then rotate/move/delete.
    const armor = before.body.modules.find(m => m.catalogId === 'armor'), point = await project(before.body, armor.cell, 1.47);
    await page.mouse.click(point.x, point.y); await page.getByRole('button', { name: 'Xoay 90°', exact: true }).waitFor();
    await button('Xoay 90°').click(); await waitJob(); assert.equal((await readBot()).body.modules.find(m => m.id === armor.id).orientation, (armor.orientation + 1) % 4);
    await button('Hoàn tác').click(); await button('Di chuyển module').click();
    await page.getByLabel('Ô X', { exact: true }).fill('7'); await page.getByLabel('Ô Y', { exact: true }).fill('4');
    assert.deepEqual(await readBot(), before);
    await button('Xác nhận di chuyển').click(); await waitJob(); assert.deepEqual((await readBot()).body.modules.find(m => m.id === armor.id).cell, { x: 7, y: 4 });
    await button('Hoàn tác').click(); const repick = await project(before.body, armor.cell, 1.47); await page.mouse.click(repick.x, repick.y); await button('Xóa module').click(); await waitJob(); assert.equal((await readBot()).body.modules.length, before.body.modules.length - 1);
    await button('Hoàn tác').click(); await button('Làm lại').click(); await button('Hoàn tác').click(); assert.deepEqual(await readBot(), before);
    report.checks.push('3D module picking, rotate, deferred move, delete, undo/redo retain module IDs and Brain');
    await button('Lưới chuẩn').click();
    await page.locator('[data-cell="8,5"]').click(); await page.keyboard.press('ArrowRight'); assert.equal(await page.locator('[data-cell="9,5"]').evaluate(e => e === document.activeElement), true);
    await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Enter');
    await button('Lắp module').click(); await waitJob(); const added = await readBot(); await button('Hoàn tác').click(); assert.deepEqual(await readBot(), before);
    report.checks.push('Accessible standard grid: roving keyboard focus, Enter selection and confirmed placement');
    // Authoritative diagnostics through the unchanged worker; each invalid edit remains undoable.
    for (const [x, y, code] of [[5, 5, 'OVERLAP'], [12, 5, 'SCHEMA'], [0, 0, 'DISCONNECTED']]) {
      if (!await page.getByLabel('Ô X', { exact: true }).isVisible()) await page.locator('.ui3d-inspector > summary').click();
      await page.getByLabel('Ô X', { exact: true }).fill(String(x)); await page.getByLabel('Ô Y', { exact: true }).fill(String(y));
      await button('Lắp module').click(); await waitJob();
      const result = await page.evaluate(() => window.__validation); assert.equal(result.kind, 'error'); assert.equal(result.diagnostic.code, code); report.checks.push(`Validator diagnostic ${result.diagnostic.code} at ${x},${y}`);
      await capture(`diagnostic-${code}`); await button('Hoàn tác').click(); assert.deepEqual(await readBot(), before);
    }
    // Draft and both JSON buffers persist independently across navigation/mode switches.
    await button('Công cụ khác').click(); const buffer = page.getByLabel('Bot JSON', { exact: false }); const text = await buffer.inputValue(); await buffer.fill(text + '\n '); await button('Đóng công cụ').click();
    await button('Brain Lab').click(); assert.equal(await page.locator('canvas').count(), 0); await button('Arena').click(); await page.locator('#timeline').waitFor(); await button('Workshop').click();
    await button('Công cụ khác').click(); assert.equal(await buffer.inputValue(), text + '\n '); await button('Đóng công cụ').click(); await button('Bỏ JSON đang sửa').click();
    await button('Brain Lab').click(); const rule = page.getByLabel('Rule JSON · condition / intent / set / nextState'); const ruleText = await rule.inputValue(); await rule.fill(ruleText + '\n ');
    await button('Workshop').click(); await page.getByLabel('Chế độ trình bày', { exact: true }).selectOption('2d'); await page.getByLabel('Chế độ trình bày', { exact: true }).selectOption('3d'); await button('My Synths').click(); await button('Brain Lab').click(); assert.equal(await rule.inputValue(), ruleText + '\n '); await button('Bỏ JSON đang sửa').click();
    report.checks.push('Unapplied Body/Brain JSON, draft and undo survive all screens and 2d/3d switching; Brain always no canvas');
    await button('Workshop').click(); await page.locator('.ui3d-stage [data-graphics="ready"]').waitFor({ timeout: 120000 });
    await button('Lưu revision').click(); await page.getByRole('status').filter({ hasText: 'Đã lưu revision 1' }).waitFor();
    await page.reload(); await page.locator('#synth-name').waitFor(); assert.deepEqual(await readBot(), before);
    report.database = await page.evaluate(async () => { const db = await new Promise((resolve, reject) => { const r = indexedDB.open('prompt-chien-local'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); const result = { version: db.version, stores: Array.from(db.objectStoreNames) }; db.close(); return result; }); assert.deepEqual(report.database, { version: 1, stores: ['heads', 'revisions'] });
    report.checks.push('3D save/reload restores exact Body/Brain through unchanged IndexedDB v1');
    await button('Công cụ khác').click();
    const downloadEvent = page.waitForEvent('download'); await button('Export bot đã áp dụng').click(); const downloaded = await downloadEvent; assert.deepEqual(JSON.parse(await readFile(await downloaded.path(), 'utf8')), before);
    await buffer.fill('{broken'); await button('Kiểm tra và áp dụng JSON').click(); await waitJob(); const invalidImport = await page.evaluate(() => window.__validation); assert.equal(invalidImport.kind, 'error'); await page.getByRole('alert').filter({ hasText: invalidImport.diagnostic.code }).waitFor(); assert.equal(await buffer.inputValue(), '{broken');
    await buffer.fill(JSON.stringify(before, null, 2) + '\n '); await button('Kiểm tra và áp dụng JSON').click(); await waitJob(); assert.equal(await page.evaluate(() => window.__validation.kind), 'validate');
    await button('Khóa baseline hiện tại').click(); await page.getByLabel('Scenario', { exact: false }).selectOption('1'); await button('Chạy A/B (4 legs)').click(); await page.locator('#timeline').waitFor({ timeout: 180000 });
    const comparison = await page.evaluate(() => window.__match.comparison); assert.equal(comparison.rows.length, 1); assert.equal(comparison.rows[0].legs.length, 4); assert.equal(comparison.baselineHash, comparison.candidateHash); assert.equal(comparison.meanDelta, 0);
    await button('Workshop').click(); await page.locator('.ui3d-stage [data-graphics="ready"]').waitFor(); assert.deepEqual(await readBot(), before);
    report.checks.push('Drawer export exact JSON, validated import, A/B paired four legs/seed/both slots retain shared draft');
    await page.locator('.ui3d-display > summary').click(); await page.getByLabel('Giảm chuyển động', { exact: false }).check(); await page.locator('.ui3d-display > summary').click();
    await button('Đặt lại góc').click(); await settle();
    const cameraStateBefore = JSON.parse(await page.locator('.ui3d-stage').getAttribute('data-camera-state'));
    const cameraBefore = await canvas.screenshot(), box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width * .7, box.y + box.height * .45); await page.mouse.down({ button: 'right' }); await page.mouse.move(box.x + box.width * .85, box.y + box.height * .6, { steps: 8 }); await page.mouse.up({ button: 'right' });
    const cameraRotated = await canvas.screenshot(); assert(!cameraRotated.equals(cameraBefore)); await button('Đặt lại góc').click(); await settle(); const cameraReset = await canvas.screenshot();
    const cameraStateReset = JSON.parse(await page.locator('.ui3d-stage').getAttribute('data-camera-state'));
    for (const key of ['azimuth', 'elevation', 'zoom']) assert(Math.abs(cameraStateReset[key] - cameraStateBefore[key]) < 1e-7);
    for (let i = 0; i < 3; i++) assert(Math.abs(cameraStateReset.target[i] - cameraStateBefore.target[i]) < 1e-7);
    report.camera = { rotationChangedRender: true, resetStateEqualWithin: 1e-7, before: cameraStateBefore, reset: cameraStateReset, resetPixelEqual: cameraReset.equals(cameraBefore), note: 'Real WebGL canvas capture with reduced motion; hover can alter ghost so pixel equality is recorded separately from the authoritative camera state.' };
    report.checks.push('Right-button camera orbit changes the real render; reset restores fitted camera');
    // Responsive and LOD render evidence.
    for (const quality of ['medium', 'low']) { await page.locator('.ui3d-display > summary').click(); await page.getByLabel('Chất lượng 3D').selectOption(quality); await page.locator('.ui3d-stage [data-graphics="ready"]').waitFor(); await capture(`workshop-${quality}`); await page.locator('.ui3d-display > summary').click(); }
    for (const width of [1024, 768, 390, 320]) { await page.setViewportSize({ width, height: 1100 }); await capture(`responsive-${width}`); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}`); }
    report.checks.push('High/Medium/Low and responsive 1024/768/390/320 rendered without horizontal document overflow');
    report.measurements.assetsUniqueBytes = Array.from(new Map(report.assets.map(a => [a.url, a])).values()).reduce((s, a) => s + a.bytes, 0);
    assert(report.assets.filter(a => a.url.endsWith('.glb')).every(a => a.url.startsWith('/assets/ui3d/u3d01/modules/')));
    assert(report.assets.filter(a => a.url.endsWith('.glb')).every(a => a.bytes < 3 * 1024 * 1024));
    const second = await context.newPage(); await second.goto(`${url}/?presentation=3d`); await second.locator('#synth-name').waitFor();
    await page.locator('#synth-name').fill('U3D CAS draft retained'); await second.locator('#synth-name').fill('U3D other tab'); await second.getByRole('button', { name: 'Lưu revision', exact: true }).click(); await second.getByRole('status').filter({ hasText: 'Đã lưu revision' }).waitFor();
    await button('Lưu revision').click(); await page.getByRole('alert').filter({ hasText: 'DRAFT_SAVE_FAILED' }).waitFor(); assert.equal(await page.locator('#synth-name').inputValue(), 'U3D CAS draft retained'); await second.close();
    report.checks.push('Two-tab IndexedDB CAS rejects stale revision and retains the unsaved 3D draft');
    const failed = await context.newPage(); await failed.route('**/assets/ui3d/u3d01/manifest.json', route => route.fulfill({ status: 404, body: 'missing manifest' })); await failed.goto(`${url}/?presentation=3d`); await failed.getByRole('alert').filter({ hasText: 'Manifest HTTP 404' }).waitFor(); const failedName = await failed.locator('#synth-name').inputValue(); await failed.getByRole('button', { name: 'Chuyển 2D', exact: true }).click(); assert.equal(await failed.locator('#synth-name').inputValue(), failedName); assert.equal(await failed.locator('.cell-grid').count(), 1); await failed.close();
    report.checks.push('Missing manifest offers working 2D fallback while keeping the draft');
  }
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; process.exitCode = 1; }
finally { if (browser) await browser.close(); server.kill(); await save(`${root}/browser.json`, report); }
console.log(JSON.stringify({ status: report.status, checks: report.checks, failure: report.failure, root }));
