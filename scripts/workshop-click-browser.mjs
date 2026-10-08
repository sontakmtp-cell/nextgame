import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import os from 'node:os';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE ?? resolve(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const channel = process.env.U3D_BROWSER ?? 'chrome';
const root = resolve('deliverables/implementation/WORKSHOP-CLICK', channel), url = 'http://127.0.0.1:5217';
await mkdir(root, { recursive: true });
const started = Date.now();
const report = { command: 'node scripts/workshop-click-browser.mjs', channel, startedAt: new Date().toISOString(), checks: [], errors: [] };
const server = spawn(process.execPath, [resolve('apps/web/node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '5217', '--strictPort'], { cwd: 'apps/web', stdio: ['ignore', 'pipe', 'pipe'] });
let output = '', browser;
server.stdout.on('data', d => output += d); server.stderr.on('data', d => output += d);
try {
  let ready = false;
  for (let i = 0; i < 100; i++) { if (server.exitCode !== null) throw Error(output); try { if ((await fetch(url)).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 100)); }
  assert(ready, 'preview did not start');
  browser = await chromium.launch({ channel, headless: true }); report.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => { const NativeWorker = window.Worker; window.Worker = class extends NativeWorker { constructor(url, options) { super(url, options); this.addEventListener('message', e => { if (e.data.kind === 'init') window.__init = e.data; if (e.data.kind === 'validate' || e.data.kind === 'error') window.__validation = e.data; }); } }; });
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  const button = name => page.getByRole('button', { name, exact: true });
  const settle = async () => { await page.evaluate(() => document.fonts.ready); await page.evaluate(async () => { scrollTo(0, 0); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }); };
  const capture = async name => { await settle(); await page.screenshot({ path: `${root}/${name}.png`, fullPage: true, animations: 'disabled' }); };
  await page.goto(`${url}/?presentation=3d`); await page.locator('#synth-name').waitFor();
  await page.locator('[data-workshop-graphics="ready"]').waitFor({ state: 'attached', timeout: 120000 });
  const readBot = async () => {
    const in3d = await page.locator('.ui3d-workshop').count();
    if (in3d) await button('Công cụ khác').click();
    if (!await page.getByLabel('Bot JSON', { exact: false }).count()) await button('Import / export JSON').click();
    const value = JSON.parse(await page.getByLabel('Bot JSON', { exact: false }).inputValue());
    if (in3d) await button('Đóng công cụ').click();
    return value;
  };
  const edit = async action => { const id = await page.evaluate(() => window.__validation?.id ?? -1); await action(); await page.waitForFunction(id => (window.__validation?.id ?? -1) > id, id); await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).some(b => b.textContent === 'Hủy job')); };
  const before = await readBot(), footprints = await page.evaluate(() => Object.fromEntries(window.__init.catalog.map(c => [c.id, c.footprint])));
  report.initialModules = before.body.modules;
  const empty = { x: 8, y: 5 };
  assert(!before.body.modules.some(m => empty.x >= m.cell.x && empty.x < m.cell.x + footprints[m.catalogId] && empty.y >= m.cell.y && empty.y < m.cell.y + footprints[m.catalogId]));
  const project = async (cell, height = .025, size = 1) => {
    await settle();
    const box = await page.locator('.ui3d-stage canvas').boundingBox(), camera = JSON.parse(await page.locator('.ui3d-stage').getAttribute('data-camera-state'));
    const current = await readBot(), core = current.body.modules.find(m => m.catalogId === 'core');
    const dx = cell.x + size / 2 - core.cell.x - 1 - camera.target[0], dz = -(cell.y + size / 2 - core.cell.y - 1) - camera.target[2], dy = height - camera.target[1];
    return { x: box.x + box.width / 2 + (Math.cos(camera.azimuth) * dx - Math.sin(camera.azimuth) * dz) * camera.zoom, y: box.y + box.height / 2 - (-Math.sin(camera.azimuth) * Math.sin(camera.elevation) * dx + Math.cos(camera.elevation) * dy - Math.cos(camera.azimuth) * Math.sin(camera.elevation) * dz) * camera.zoom };
  };
  const point = await project(empty);
  await page.mouse.move(point.x, point.y); assert.deepEqual(await readBot(), before);
  await edit(() => page.mouse.click(point.x, point.y));
  const added = await readBot(); assert.equal(added.body.modules.length, before.body.modules.length + 1); assert.deepEqual(added.body.modules.at(-1).cell, empty); assert.deepEqual(added.brain, before.brain);
  assert.equal(await page.evaluate(() => window.__validation.kind), 'validate');
  await capture('single-click-installed');
  // Native module picking must select the module without adding on top.
  const hit = await project(empty, 1.47); await page.mouse.click(hit.x, hit.y); assert.deepEqual(await readBot(), added);
  assert(await button('Xóa module').isEnabled()); await edit(() => button('Xóa module').click()); assert.deepEqual(await readBot(), before);
  await button('Hoàn tác').click(); assert.deepEqual(await readBot(), added);
  await button('Làm lại').click(); assert.deepEqual(await readBot(), before);
  report.checks.push('Real WebGL hover does not edit; single click installs one module; occupied click selects; delete/undo/redo preserve exact Body and Brain');
  // A native double click cannot install twice.
  const double = await project(empty); await edit(() => page.mouse.dblclick(double.x, double.y)); assert.equal((await readBot()).body.modules.length, before.body.modules.length + 1);
  await button('Hoàn tác').click(); assert.deepEqual(await readBot(), before);
  await button('Lưới chuẩn').click();
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const core = before.body.modules.find(m => m.catalogId === 'core');
    await page.locator(`[data-cell="${core.cell.x + dx},${core.cell.y + dy}"]`).click(); assert.deepEqual(await readBot(), before);
    assert(await button('Lắp module').isDisabled());
  }
  await edit(() => page.locator('[data-cell="8,5"]').press('Enter')); assert.equal((await readBot()).body.modules.length, before.body.modules.length + 1);
  await button('Hoàn tác').click();
  report.checks.push('Double click installs once; all four Core cells select without overlap; grid Enter installs immediately');
  // Move a 2x2 Core into an empty anchor whose remaining footprint hits another module.
  const core = before.body.modules.find(m => m.catalogId === 'core');
  const target = Array.from({ length: 121 }, (_, i) => ({ x: i % 11, y: Math.floor(i / 11) })).find(c => {
    if (before.body.modules.some(m => c.x >= m.cell.x && c.x < m.cell.x + footprints[m.catalogId] && c.y >= m.cell.y && c.y < m.cell.y + footprints[m.catalogId])) return false;
    return before.body.modules.some(m => m.id !== core.id && c.x < m.cell.x + footprints[m.catalogId] && c.x + 2 > m.cell.x && c.y < m.cell.y + footprints[m.catalogId] && c.y + 2 > m.cell.y);
  }); assert(target);
  await page.locator(`[data-cell="${core.cell.x},${core.cell.y}"]`).click(); await button('Di chuyển module').click();
  await page.locator(`[data-cell="${target.x},${target.y}"]`).click();
  await page.getByRole('alert').filter({ hasText: 'Không thể lắp chồng' }).waitFor(); assert.deepEqual(await readBot(), before);
  await capture('overlap-blocked');
  await button('Hủy di chuyển').click();
  await button('Hoàn tác').click(); assert.deepEqual(await readBot(), added, 'blocked move must not add an undo entry');
  await button('Làm lại').click(); assert.deepEqual(await readBot(), before);
  report.checks.push(`Full 2x2 move footprint at ${target.x},${target.y} blocked before mutation or undo entry`);
  const armor = before.body.modules.find(m => m.catalogId === 'armor');
  await page.locator(`[data-cell="${armor.cell.x},${armor.cell.y}"]`).click(); await button('Di chuyển module').click();
  const movePoint = await project({ x: 7, y: 4 }); await edit(() => page.mouse.click(movePoint.x, movePoint.y));
  const moved = await readBot(); assert.deepEqual(moved.body.modules.find(m => m.id === armor.id).cell, { x: 7, y: 4 }); assert.deepEqual(moved.brain, before.brain);
  await button('Hoàn tác').click(); assert.deepEqual(await readBot(), before);
  report.checks.push('Single canvas click moves a selected module into a free cell, retaining ID/Brain and undo');
  // A pending JSON buffer locks click/delete, preserving both buffers and body.
  await button('Công cụ khác').click(); const buffer = page.getByLabel('Bot JSON', { exact: false }), text = await buffer.inputValue(); await buffer.fill(text + '\n '); await button('Đóng công cụ').click();
  await page.locator('[data-cell="8,5"]').click(); assert.deepEqual(await readBot(), before); assert(await button('Xóa module').isDisabled()); await button('Bỏ JSON đang sửa').click();
  report.checks.push('Pending JSON prevents direct placement/deletion');
  await page.getByLabel('Chế độ trình bày', { exact: true }).selectOption('2d');
  await edit(() => page.locator('[data-cell="8,5"]').click()); const added2d = await readBot(); assert.equal(added2d.body.modules.length, before.body.modules.length + 1); assert.deepEqual(added2d.brain, before.brain);
  await page.locator('[data-cell="8,5"]').click(); assert.deepEqual(await readBot(), added2d);
  await page.getByLabel('X', { exact: true }).fill('6'); await page.getByRole('alert').filter({ hasText: 'OVERLAP' }).waitFor(); assert.deepEqual(await readBot(), added2d);
  await edit(() => button('Xóa module').click()); assert.deepEqual(await readBot(), before); await capture('workshop-2d');
  report.checks.push('2D click installs; occupied click selects; numeric movement onto Core is blocked; delete preserves Brain');
  const fresh = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 }), brain = await fresh.newPage();
  await brain.goto(url); await brain.locator('#synth-name').waitFor(); await brain.getByRole('button', { name: 'Brain Lab', exact: true }).click(); await brain.evaluate(() => document.fonts.ready);
  await brain.screenshot({ path: `${root}/brain-1600.png`, fullPage: true, animations: 'disabled' }); assert.equal(await brain.locator('canvas').count(), 0);
  const baseline = `deliverables/implementation/UI3D/U3D-06/final/${channel}/brain-1600.png`;
  assert((await readFile(`${root}/brain-1600.png`)).equals(await readFile(baseline)), 'Brain render changed');
  report.checks.push('Brain Lab still 2D; screenshot byte-identical to U3D-06 final in same browser');
  assert.deepEqual(report.errors, []); report.status = 'passed'; console.log(JSON.stringify(report, null, 2));
} catch (error) { report.status = 'failed'; report.failure = String(error.stack ?? error); console.error(report.failure); process.exitCode = 1; }
finally { report.elapsedMs = Date.now() - started; await writeFile(`${root}/browser.json`, JSON.stringify(report, null, 2) + '\n'); await browser?.close(); server.kill(); }

