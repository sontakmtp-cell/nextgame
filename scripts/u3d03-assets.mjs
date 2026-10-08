import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { io, triangles, levels } from './u3d01-lib.mjs';
import { evidence, save, sha } from './u3d03-evidence.mjs';
const path = 'apps/web/public/assets/ui3d/u3d01/manifest.json';
const bytes = await readFile(path), manifest = JSON.parse(bytes), rows = [];
const file = url => { assert(url.startsWith('/assets/ui3d/u3d01/') && !url.includes('..')); return 'apps/web/public' + url; };
for (const module of manifest.modules) {
  assert.equal(sha(await readFile(module.source.path)), module.source.sha256);
  assert.equal(sha(await readFile(file(module.thumbnail.url))), module.thumbnail.sha256);
  for (const [quality, level] of Object.entries(module.levels)) {
    const data = await readFile(file(level.modelUrl)), doc = await io.readBinary(data), count = triangles(doc);
    assert.equal(sha(data), level.modelSha256); assert.equal(data.length, level.bytes); assert.equal(count, level.triangles);
    assert(count <= levels[quality].triangles); assert(data.length <= levels[quality].bytes);
    for (const texture of level.textures) { const ktx = await readFile(file(texture.url)); assert.equal(sha(ktx), texture.sha256); assert.equal(ktx.readUInt32LE(20), texture.width); assert.equal(ktx.readUInt32LE(24), texture.height); assert(Math.max(texture.width, texture.height) <= levels[quality].texture); }
    rows.push({ catalogId: module.catalogId, quality, bytes: data.length, triangles: count, maxTextureDimension: Math.max(...level.textures.map(t => Math.max(t.width, t.height))), modelSha256: sha(data) });
  }
}
for (const decoder of manifest.decoders) assert.equal(sha(await readFile(file(decoder.url))), decoder.sha256);
await save(`${evidence}/assets.json`, { command: 'node scripts/u3d03-assets.mjs', status: 'passed', manifestSha256: sha(bytes), assetRevision: manifest.assetRevision, rows, note: 'Read-only remeasurement of all 30 optimized U3D-01 models and source/texture/thumbnail/decoder hashes. Rebuild recipe remains scripts/u3d01-build.mjs and scripts/u3d02-assets.mjs; U3D-03 creates no new runtime asset.' });
console.log(JSON.stringify({ status: 'passed', models: rows.length, trianglesMax: Math.max(...rows.map(r => r.triangles)), bytesMax: Math.max(...rows.map(r => r.bytes)) }));
