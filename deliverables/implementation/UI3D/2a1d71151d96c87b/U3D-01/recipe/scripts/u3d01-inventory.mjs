import { ids, sourcePath, describe, save, evidence } from './u3d01-lib.mjs';
const rows = [];
for (const id of ids) rows.push({ catalogId: id, ...await describe(sourcePath(id)) });
await save(`${evidence}/inventory.json`, { command: 'node scripts/u3d01-inventory.mjs', rows, note: 'Bounds/transforms measured. Source front and mounting anchor are authored in u3d01-settings.json after visual review, not inferred from triangle count.' });
console.log(JSON.stringify(rows.map(r => ({ id: r.catalogId, bytes: r.bytes, triangles: r.triangles, textures: r.textures.map(t => `${t.width}x${t.height}`) })), null, 2));
