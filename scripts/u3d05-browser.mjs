import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import os from 'node:os';
import { evidence, save, sha } from './u3d05-evidence.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE ?? resolve(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const channel = process.env.U3D_BROWSER ?? 'chrome', root = `${evidence}/final/${channel}/synths`, url = 'http://127.0.0.1:5205';
await mkdir(root, { recursive: true });
const server = spawn(process.execPath, [resolve('apps/web/node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '5205', '--strictPort'], { cwd: 'apps/web', stdio: ['ignore', 'pipe', 'pipe'] });
let output = '', browser; server.stdout.on('data', d => output += d); server.stderr.on('data', d => output += d);
const report = { command: 'node scripts/u3d05-browser.mjs', channel, startedAt: new Date().toISOString(), cpu: os.cpus()[0].model, status: 'running', checks: [], errors: [], assets: [], metrics: {} };
const note = (name, detail = true) => report.checks.push({ name, detail });
try {
  for (let i = 0; i < 100; i++) { if (server.exitCode !== null) throw Error(output); try { if ((await fetch(url)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch({ channel, headless: true }); report.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1, acceptDownloads: true });
  await context.addInitScript(() => { const NativeWorker = window.Worker; window.Worker = class extends NativeWorker { constructor(url, options) { super(url, options); this.addEventListener('message', e => { if (e.data.kind === 'init') window.__init = e.data; }); } }; });
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  const bodies = [];
  page.on('response', r => { if (/\.(glb|ktx2|woff2|wasm|webp)(\?|$)/.test(r.url())) bodies.push(r.body().then(bytes => report.assets.push({ url: r.url().replace(url, ''), bytes: bytes.length, status: r.status() })).catch(() => {})); });
  const button = name => page.getByRole('button', { name, exact: true });
  const status = text => page.locator('.status-strip').filter({ hasText: text });
  const settle = async () => { await page.evaluate(() => document.fonts.ready); await page.evaluate(async () => { scrollTo(0, 0); for (let i = 0; i < 4; i++) await new Promise(r => requestAnimationFrame(r)); }); };
  const capture = async name => { await settle(); await page.screenshot({ path: `${root}/${name}.png`, fullPage: true, animations: 'disabled' }); };
  const ready = async () => { await page.locator('.ui3d-synth-preview [data-graphics="ready"]').waitFor({ timeout: 45000 }); await settle(); };
  const thumbnails = async count => { await page.waitForFunction(n => document.querySelectorAll('.ui3d-synths img.ui3d-synth-thumbnail').length === n, count, { timeout: 90000 }); };
  const db = () => page.evaluate(async () => { const database = await new Promise((resolve, reject) => { const r = indexedDB.open('prompt-chien-local', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); const result = { version: database.version, stores: [...database.objectStoreNames] }; for (const store of result.stores) result[store] = await new Promise((resolve, reject) => { const r = database.transaction(store).objectStore(store).getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); database.close(); return result; });
  await page.goto(url); await page.locator('#synth-name').waitFor();
  const fixture = await page.evaluate(() => {
    const kits = window.__init.templates;
    const record = (id, revision, definition, hypothesis, savedAt) => ({ id, revision, definition, hypothesis, weakness: 'Giữ Body và Brain đúng phiên bản.', parentHash: null, savedAt });
    const a1 = structuredClone(kits[0]); a1.name = 'Mantis';
    const a2 = structuredClone(a1); const module = a2.body.modules.find(m => m.catalogId !== 'core'); module.orientation = (module.orientation + 1) % 4;
    const a3 = structuredClone(kits[1]); a3.name = 'Mantis';
    const b = structuredClone(kits[1]); b.name = 'Kestrel';
    const c = structuredClone(a1); c.name = 'Mantis thử nghiệm'; c.brain.initialState = c.brain.states[0].id;
    const rows = [record('fixture-mantis', 1, a1, 'Bản đầu tiên', '2026-10-08T01:00:00.000Z'), record('fixture-mantis', 2, a2, 'Đổi hướng động cơ', '2026-10-08T02:00:00.000Z'), record('fixture-mantis', 3, a3, 'Thử cơ thể khác', '2026-10-08T05:00:00.000Z'), record('fixture-kestrel', 1, b, 'Bắn rồi giữ khoảng cách', '2026-10-08T04:00:00.000Z'), record('fixture-experiment', 1, c, 'Né đòn rồi áp sát', '2026-10-08T03:00:00.000Z')];
    return { rows, heads: [rows[2], rows[3], rows[4]], provenance: 'Current worker init templates in isolated browser context; revisions vary Body orientation/topology. Never touches a user profile.' };
  });
  await save(`${root}/fixture.json`, fixture);
  await page.evaluate(async fixture => { const database = await new Promise((resolve, reject) => { const r = indexedDB.open('prompt-chien-local', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); await new Promise((resolve, reject) => { const tx = database.transaction(['heads', 'revisions'], 'readwrite'); for (const row of fixture.rows) tx.objectStore('revisions').add(row); for (const row of fixture.heads) tx.objectStore('heads').put(row); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); database.close(); }, fixture);
  await page.reload(); await page.locator('#synth-name').waitFor(); assert.equal(await page.locator('#synth-name').inputValue(), 'Mantis');
  const original = await db(); assert.equal(original.version, 1); assert.deepEqual(original.stores, ['heads', 'revisions']);
  await button('My Synths').click(); const start = performance.now(); await page.getByLabel('Chế độ trình bày', { exact: true }).selectOption('3d'); await ready(); await thumbnails(3);
  report.metrics.coldSceneAnd3CardsMs = performance.now() - start;
  await button('Xem Synth Mantis').click(); await thumbnails(6); await ready();
  assert.equal(await page.locator('canvas').count(), 2); note('One preview canvas and one serial thumbnail canvas for all six cards');
  const imageRows = await page.locator('img.ui3d-synth-thumbnail').evaluateAll(async images => await Promise.all(images.map(async img => ({ width: img.naturalWidth, height: img.naturalHeight, bytes: (await (await fetch(img.src)).blob()).size }))));
  assert(imageRows.every(r => r.width === 256 && r.height === 192 && r.bytes > 1000)); report.metrics.thumbnails = imageRows;
  const cache = async () => page.evaluate(async () => { const c = await caches.open('prompt-chien-synth-thumbnails-v1'); return await Promise.all((await c.keys()).map(async key => ({ key: key.url, bytes: (await (await c.match(key)).blob()).size }))); });
  report.metrics.cacheCold = await cache(); assert.equal(report.metrics.cacheCold.length, 3); note('Content-key queue deduplicates equal Body across Synth/revision/notes; three unique PNGs', report.metrics.cacheCold);
  await page.getByRole('checkbox', { name: 'Giảm chuyển động', exact: true }).check(); await ready();
  for (const [width, height] of [[1600, 1100], [1920, 1080]]) { await page.setViewportSize({ width, height }); await ready(); await capture(`mysynths-high-${width}`); const actions = await page.locator('.ui3d-synth-actions').boundingBox(); assert(actions && actions.y + actions.height <= height, `Archive actions cropped at ${width}`); await page.screenshot({ path: `${root}/mysynths-viewport-${width}.png`, fullPage: false, animations: 'disabled' }); }
  await page.setViewportSize({ width: 1600, height: 1100 });
  const preview = async () => JSON.parse(await page.locator('.ui3d-synth-preview').getAttribute('data-preview-body'));
  const revisionImages = [];
  for (const revision of [1, 2, 3]) { await button(`Xem revision ${revision}`).click(); await ready(); assert.deepEqual(await preview(), fixture.rows[revision - 1].definition.body); await capture(`revision-${revision}`); revisionImages.push(sha(await page.locator('.ui3d-synth-preview canvas').screenshot())); }
  assert.equal(new Set(revisionImages).size, 3); assert.deepEqual(await db(), original); note('Each saved revision renders its own Body; selecting all revisions leaves database unchanged', revisionImages);
  await button('Xem revision 1').click(); await ready();
  const downloadPromise = page.waitForEvent('download'); await button('Export bản đang sửa').click(); const download = await downloadPromise; await download.saveAs(`${root}/export.bot.json`);
  assert.deepEqual(JSON.parse(await readFile(`${root}/export.bot.json`)), fixture.rows[2].definition); note('Archive preview does not replace exported/current draft');
  // Cached PNGs survive view teardown; image bytes stay deterministic when regenerated.
  const hashes = async () => page.evaluate(async () => { const c = await caches.open('prompt-chien-synth-thumbnails-v1'); return await Promise.all((await c.keys()).map(async k => { const data = await (await c.match(k)).arrayBuffer(), digest = await crypto.subtle.digest('SHA-256', data); return [k.url, [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('')]; })); });
  const exportImages = async phase => { const images = await page.evaluate(async () => { const c = await caches.open('prompt-chien-synth-thumbnails-v1'); return await Promise.all((await c.keys()).map(async k => ({ key: k.url.split('/').pop(), data: btoa(String.fromCharCode(...new Uint8Array(await (await c.match(k)).arrayBuffer()))) }))); }); for (const item of images) await writeFile(`${root}/${phase}-${item.key}`, Buffer.from(item.data, 'base64')); };
  await exportImages('cold');
  const cachedHashes = await hashes(); await button('Workshop').click(); await button('My Synths').click(); await ready(); await thumbnails(3);
  assert.deepEqual(await hashes(), cachedHashes); note('Thumbnail cache survives view teardown');
  await button('Xem Synth Mantis').click(); await thumbnails(6); await ready();
  await page.locator('.ui3d-synth-cache summary').click(); await button('Dựng lại thumbnail').click(); await page.waitForFunction(() => document.querySelector('.ui3d-synths')?.dataset.thumbnailEpoch === '1'); await thumbnails(6); await page.waitForFunction(() => document.querySelector('.ui3d-thumbnail-stage')?.dataset.thumbnailRenders === '3');
  await page.waitForFunction(async () => (await (await caches.open('prompt-chien-synth-thumbnails-v1')).keys()).length === 3);
  await exportImages('rebuilt');
  const rebuiltHashes = (await hashes()).sort(); assert.deepEqual(rebuiltHashes.map(row => row[0]), cachedHashes.sort().map(row => row[0]));
  const pixelPairs = []; for (const [key] of cachedHashes) { const file = key.split('/').pop(); pixelPairs.push({ key, before: (await readFile(`${root}/cold-${file}`)).toString('base64'), after: (await readFile(`${root}/rebuilt-${file}`)).toString('base64') }); }
  const differences = await page.evaluate(async pairs => {
    const decode = async b64 => { const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: 'image/png' })); const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height; const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0); bitmap.close(); return ctx.getImageData(0, 0, canvas.width, canvas.height).data; };
    return await Promise.all(pairs.map(async pair => { const a = await decode(pair.before), b = await decode(pair.after); let changedPixels = 0, maxChannelDifference = 0; for (let i = 0; i < a.length; i += 4) { let changed = false; for (let c = 0; c < 4; c++) { const d = Math.abs(a[i + c] - b[i + c]); changed ||= d !== 0; maxChannelDifference = Math.max(maxChannelDifference, d); } if (changed) changedPixels++; } return { key: pair.key, changedPixels, maxChannelDifference, pixels: a.length / 4 }; }));
  }, pixelPairs);
  // GPU rasterization may differ by one 8-bit level after context rebuild.
  // Bound that quantization explicitly; geometry/asset/body errors change far more.
  assert(differences.every(d => d.maxChannelDifference <= 1 && d.changedPixels <= d.pixels * .001));
  report.metrics.thumbnailRebuildPixels = differences;
  assert.deepEqual(await db(), original); note('Clear/rebuild retains keys and pixels within <=1/255 on <=0.1% pixels, measured explicitly; never changes Synth storage', differences);
  report.gpu = await page.locator('.ui3d-synth-preview canvas').evaluate(c => { const gl = c.getContext('webgl2'), ext = gl.getExtension('WEBGL_debug_renderer_info'); return { renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), version: gl.getParameter(gl.VERSION) }; });
  await page.getByLabel('Chất lượng Synth 3D', { exact: true }).selectOption('low'); await page.getByRole('checkbox', { name: 'Thang xám', exact: true }).check(); await ready(); await capture('mysynths-low-gray');
  await page.getByRole('checkbox', { name: 'Thang xám', exact: true }).uncheck();
  for (const width of [1024, 768, 390, 320]) { await page.setViewportSize({ width, height: 900 }); await ready(); await capture(`mysynths-responsive-${width}`); assert((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1, `overflow ${width}`); }
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.locator('.ui3d-synth-preview canvas').evaluate(c => { window.__loss = c.getContext('webgl2').getExtension('WEBGL_lose_context'); window.__loss.loseContext(); }); await page.locator('.ui3d-synth-preview [data-graphics="lost"]').waitFor(); assert.deepEqual(await preview(), fixture.rows[2].definition.body);
  await page.evaluate(() => window.__loss.restoreContext()); await ready(); assert.deepEqual(await preview(), fixture.rows[2].definition.body); note('Real WebGL context loss/restore keeps selected version and reloads viewport');
  await button('Brain Lab').click(); assert.equal(await page.locator('canvas').count(), 0);
  const rule = page.getByLabel(/Rule JSON/), ruleText = await rule.inputValue(); await rule.fill(ruleText + '\n ');
  await button('My Synths').click(); await ready(); await button('Xem Synth Kestrel').click(); await ready(); assert(await button('Mở trong Workshop').isDisabled()); await button('Brain Lab').click(); assert.equal(await rule.inputValue(), ruleText + '\n '); assert.equal(await page.locator('canvas').count(), 0); await button('Bỏ JSON đang gõ').click(); note('Unapplied Brain JSON survives archive browsing; opens/restores are disabled while dirty');
  await button('Workshop').click(); await page.locator('#synth-name').fill('Draft chưa lưu'); await button('My Synths').click(); await ready(); await button('Xem Synth Kestrel').click(); await ready(); assert(await button('Mở trong Workshop').isDisabled());
  assert(await page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); dispatchEvent(e); return e.defaultPrevented; }));
  await button('Workshop').click(); assert.equal(await page.locator('#synth-name').inputValue(), 'Draft chưa lưu'); await button('Hoàn tác').click(); assert.equal(await page.locator('#synth-name').inputValue(), 'Mantis'); note('Dirty draft and undo remain intact while previewing; beforeunload warning remains active');
  await button('My Synths').click(); await ready(); await button('Xem Synth Kestrel').click(); await ready(); await button('Mở trong Workshop').click(); await page.locator('#synth-name').waitFor(); assert.equal(await page.locator('#synth-name').inputValue(), 'Kestrel');
  await button('My Synths').click(); await ready(); await button('Xem Synth Mantis').click(); await thumbnails(6); await ready(); await button('Xem revision 1').click(); await ready(); await button('Khôi phục nội dung r1').click(); await page.locator('#synth-name').waitFor();
  assert.equal(await page.locator('#synth-name').inputValue(), 'Mantis'); await button('Lưu revision').click(); await status('Đã lưu revision 4').waitFor();
  const restored = await db(); const r4 = restored.revisions.find(d => d.id === 'fixture-mantis' && d.revision === 4); assert.deepEqual(r4.definition, fixture.rows[0].definition); assert.equal(r4.hypothesis, fixture.rows[0].hypothesis);
  for (const entry of original.revisions) assert.deepEqual(restored.revisions.find(d => d.id === entry.id && d.revision === entry.revision), entry);
  note('Restore from a different Synth targets correct ID and current CAS head; creates r4 without overwriting r1-r3');
  const second = await context.newPage(); await second.goto(url); await second.locator('#synth-name').waitFor(); assert.equal(await second.locator('#synth-name').inputValue(), 'Mantis');
  await page.locator('#synth-name').fill('Tab một'); await button('Lưu revision').click(); await status('Đã lưu revision 5').waitFor();
  await second.locator('#synth-name').fill('Tab hai chưa lưu'); await second.getByRole('button', { name: 'Lưu revision', exact: true }).click(); await second.getByRole('alert').filter({ hasText: 'Tab khác đã lưu' }).waitFor(); assert.equal(await second.locator('#synth-name').inputValue(), 'Tab hai chưa lưu');
  await second.getByRole('button', { name: 'My Synths', exact: true }).click(); await second.getByLabel('Chế độ trình bày', { exact: true }).selectOption('3d'); await second.locator('.ui3d-synth-preview [data-graphics="ready"]').waitFor({ timeout: 45000 });
  await second.getByRole('button', { name: 'Lưu thành Synth mới', exact: true }).click(); await second.locator('.status-strip').filter({ hasText: 'Đã lưu revision 1' }).waitFor();
  assert.equal((await db()).heads.find(d => d.id === 'fixture-mantis').revision, 5); note('Two real tabs: stale CAS save rejects and retains draft; fork saves a new ID');
  await second.close();
  await button('My Synths').click(); await ready(); await button('Xem Synth Kestrel').click(); await ready();
  await button('Xem revision 1').click(); await ready(); await button('Mở trong Workshop').click(); await page.locator('#synth-name').waitFor();
  // JS heap measurement only; no claim about GPU/native/process memory.
  await button('My Synths').click(); await ready(); await thumbnails(3); const cdp = await context.newCDPSession(page); await cdp.send('HeapProfiler.collectGarbage'); const before = await cdp.send('Runtime.getHeapUsage');
  const cycles = [];
  for (let i = 0; i < 10; i++) { const t = performance.now(); await page.getByLabel('Chế độ trình bày', { exact: true }).selectOption('2d'); assert.equal(await page.locator('canvas').count(), 0); await page.getByLabel('Chế độ trình bày', { exact: true }).selectOption('3d'); await ready(); await thumbnails(3); cycles.push(performance.now() - t); }
  await cdp.send('HeapProfiler.collectGarbage'); const after = await cdp.send('Runtime.getHeapUsage'); report.metrics.memory = { before, after, driftMiB: (after.usedSize - before.usedSize) / 1048576, kind: 'CDP forced-GC JS heap only, 10 archive mode teardown cycles', cyclesMs: cycles }; assert(report.metrics.memory.driftMiB <= 10);
  await Promise.all(bodies); report.status = 'passed'; assert.deepEqual(report.errors, []);
} catch (error) { report.status = 'failed'; report.failure = error.stack; process.exitCode = 1; }
finally { await save(`${root}/browser.json`, report); await browser?.close(); server.kill(); console.log(JSON.stringify({ status: report.status, checks: report.checks.length, failure: report.failure, metrics: report.metrics })); }
