import { describe, it, expect } from 'vitest';
import type { BotDefinition } from '../packages/contracts/dist/index.js';
import { ThumbnailQueue, thumbnailContent, thumbnailKey } from '../apps/web/src/synth-thumbnail.js';
import type { ThumbnailStore } from '../apps/web/src/synth-thumbnail.js';
const body: BotDefinition['body'] = { grid: 'square-12-v1', modules: [
  { id: 'core', catalogId: 'core', cell: { x: 5, y: 5 }, orientation: 0 },
  { id: 'armor', catalogId: 'armor', cell: { x: 7, y: 5 }, orientation: 1 },
] };
const footprints = { core: 2, armor: 1 };
function store(): ThumbnailStore { const items = new Map<string, Blob>(); return { get: async key => items.get(key) ?? null, put: async (key, blob) => { items.set(key, blob); } }; }
describe('Synth thumbnails are derived Body data', () => {
  it('stable across field/module order, invalidates geometry, asset and footprint changes', async () => {
    const key = thumbnailContent(body, 'asset-a', footprints);
    const reordered = { grid: body.grid, modules: [...body.modules].reverse().map(m => ({ orientation: m.orientation, cell: { y: m.cell.y, x: m.cell.x }, catalogId: m.catalogId, id: m.id })) };
    expect(thumbnailContent(reordered, 'asset-a', footprints)).toBe(key);
    const turned = structuredClone(body); turned.modules[1]!.orientation = 2;
    expect(thumbnailContent(turned, 'asset-a', footprints)).not.toBe(key);
    expect(thumbnailContent(body, 'asset-b', footprints)).not.toBe(key);
    expect(thumbnailContent(body, 'asset-a', { ...footprints, armor: 2 })).not.toBe(key);
    expect(await thumbnailKey(key)).toMatch(/^[0-9a-f]{64}$/);
  });
  it('serializes distinct jobs, coalesces duplicates and reuses persisted cache across queues', async () => {
    let active = 0, max = 0, count = 0; const memory = store();
    const render = async () => { count++; max = Math.max(max, ++active); await new Promise(r => setTimeout(r, 5)); active--; return new Blob(['png']); };
    const q = new ThumbnailQueue('a', footprints, memory, render), changed = structuredClone(body); changed.modules[1]!.orientation = 3;
    const [a, duplicate] = await Promise.all([q.request(body), q.request(body), q.request(changed)]);
    expect(a).toBe(duplicate); expect(max).toBe(1); expect(count).toBe(2);
    q.dispose(); const warm = new ThumbnailQueue('a', footprints, memory, render);
    expect(await warm.request(body)).toBe(a); expect(warm.stats.hits).toBe(1); expect(count).toBe(2); warm.dispose();
  });
  it('snapshots queued Body and recovers the queue after a renderer error', async () => {
    const seen: BotDefinition['body'][] = [], snapshot = structuredClone(body);
    const q = new ThumbnailQueue('a', footprints, store(), async value => { seen.push(value); if (seen.length === 1) throw Error('network fault'); return new Blob(['ok']); });
    const first = q.request(snapshot); snapshot.modules[1]!.cell.x = 10;
    await expect(first).rejects.toThrow('network fault'); expect(seen[0]!.modules[1]!.cell.x).toBe(7);
    await expect(q.request(body)).resolves.toBeInstanceOf(Blob); expect(q.stats.failures).toBe(1); q.dispose();
  });
  it('aborts an in-flight render and never writes it into cache', async () => {
    let started!: () => void; const entered = new Promise<void>(r => { started = r; }); let writes = 0;
    const q = new ThumbnailQueue('a', footprints, { get: async () => null, put: async () => { writes++; } }, async (_body, signal) => {
      started(); return await new Promise<Blob>((_resolve, reject) => signal.addEventListener('abort', () => reject(Error('cancelled')), { once: true }));
    });
    const job = q.request(body); await entered; q.dispose(); await expect(job).rejects.toThrow('cancelled'); await q.idle(); expect(writes).toBe(0);
    await expect(q.request(body)).rejects.toThrow('closed');
  });
  it('does not start a renderer when closed during an asynchronous cache lookup', async () => {
    let entered!: () => void, finish!: (value: Blob | null) => void, renders = 0;
    const lookupStarted = new Promise<void>(r => { entered = r; });
    const q = new ThumbnailQueue('a', footprints, { get: async () => { entered(); return await new Promise<Blob | null>(r => { finish = r; }); }, put: async () => {} }, async () => { renders++; return new Blob(); });
    const job = q.request(body); await lookupStarted; q.dispose(); finish(null);
    await expect(job).rejects.toThrow('closed'); expect(renders).toBe(0); await q.idle();
  });
});
