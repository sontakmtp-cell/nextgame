import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { save, evidence } from './u3d05-evidence.mjs';
const html = await readFile('apps/web/dist/index.html', 'utf8'), starts = [...html.matchAll(/(?:src|href)="(\/assets\/[^" ]+\.(?:js|css))"/g)].map(m => m[1]);
const seen = new Set();
async function walk(url) { if (seen.has(url)) return; seen.add(url); const bytes = await readFile('apps/web/dist' + url); if (url.endsWith('.js')) for (const match of bytes.toString().matchAll(/(?:from|import)\s*"(\.[^" ]+\.js)"/g)) await walk('/assets/' + match[1].replace(/^\.\//, '')); }
for (const url of starts) await walk(url);
const shell = []; for (const url of seen) { const bytes = await readFile('apps/web/dist' + url); shell.push({ url, bytes: bytes.length, gzipBytes: gzipSync(bytes).length }); }
const cold = JSON.parse(await readFile(`${evidence}/faults/faults.json`)).cold;
const report = { command: 'node scripts/u3d05-budget.mjs', shell, shellGzipBytes: shell.reduce((sum, row) => sum + row.gzipBytes, 0), shellLimitBytes: 400 * 1024, assetLimitBytes: 8 * 1048576, cold, scope: 'Shell = static entry JS/CSS/preload closure. Lazy 3D, worker and runtime asset bytes reported separately. Cold excludingHigh is unique response bodies filtered by URL, not an exact first-paint timestamp.' };
report.passed = report.shellGzipBytes <= report.shellLimitBytes && cold.excludingHighBytes <= report.assetLimitBytes;
await save(`${evidence}/budget.json`, report); assert(report.passed); console.log(JSON.stringify({ shellGzipBytes: report.shellGzipBytes, coldMediumAssetsBytes: cold.excludingHighBytes, highAndMediumAssetsBytes: cold.uniqueBytes }));
