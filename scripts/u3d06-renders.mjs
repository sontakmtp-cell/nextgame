import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import os from 'node:os';
import { evidence, save, sha } from './u3d06-evidence.mjs';
const require = createRequire(import.meta.url);
const sharp = require(resolve(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const output = `${evidence}/renders`;
await mkdir(output, { recursive: true });
const records = [];
const report = JSON.parse(await readFile(`${evidence}/final/chrome/browser.json`));
assert.equal(report.status, 'passed', 'Successful browser evidence required before labeling comparison sheets');
for (const width of [1600, 1920]) {
  assert.equal(report.comparisons.find(c => c.label === `U3D-00 pixel baseline ${width}`)?.differentPixels, 0);
  const paths = [
    `deliverables/implementation/UI3D/U3D-00/baseline-stable/screenshots/brain-lab-${width}.png`,
    `${evidence}/final/chrome/brain-${width}.png`,
  ];
  const images = await Promise.all(paths.map(async path => ({ path, bytes: await readFile(path) })));
  const resized = await Promise.all(images.map(async image => sharp(image.bytes).resize({ width: 800 }).png().toBuffer()));
  const heights = await Promise.all(resized.map(async bytes => (await sharp(bytes).metadata()).height));
  const labels = Buffer.from('<svg width="1648" height="40"><rect width="1648" height="40" fill="#08111f"/><g fill="#80f8ff" font-family="Arial" font-size="18"><text x="16" y="27">U3D-00 pixel baseline</text><text x="832" y="27">U3D-06 final - 0 different pixels</text></g></svg>');
  const target = `${output}/brain-comparison-${width}.png`;
  await sharp({ create: { width: 1648, height: Math.max(...heights) + 56, channels: 4, background: '#08111f' } }).composite([{ input: labels, top: 0, left: 0 }, { input: resized[0], top: 40, left: 16 }, { input: resized[1], top: 40, left: 832 }]).png().toFile(target);
  records.push({ output: target, sha256: sha(await readFile(target)), inputs: images.map(image => ({ path: image.path, sha256: sha(image.bytes) })), note: 'Comparison sheet only: screenshots resized identically to 800 px wide, labeled; original full-resolution screenshots retained for exact pixel comparison.' });
}
await save(`${output}/recipe.json`, { command: 'node scripts/u3d06-renders.mjs', at: new Date().toISOString(), records });
console.log(JSON.stringify(records.map(record => ({ output: record.output, sha256: record.sha256 }))));
