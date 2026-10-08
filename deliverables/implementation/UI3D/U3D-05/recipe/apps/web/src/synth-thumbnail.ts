import type { BotDefinition } from '@prompt-chien/contracts';

export type ThumbnailBody = BotDefinition['body'];
export const thumbnailCacheName = 'prompt-chien-synth-thumbnails-v1';
export const thumbnailRecipe = 'synth-medium-256x192-ceramic-static-no-links-v2';
// Presentation identity only. Never include Brain, notes, timestamps or database IDs.
export function thumbnailContent(body: ThumbnailBody, assetRevision: string, footprints: Readonly<Record<string, number>>): string {
  return JSON.stringify({ recipe: thumbnailRecipe, assetRevision, grid: body.grid,
    modules: body.modules.map(m => ({ id: m.id, catalogId: m.catalogId, x: m.cell.x, y: m.cell.y, orientation: m.orientation, footprint: footprints[m.catalogId] ?? null })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0) });
}
export async function thumbnailKey(content: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
}
export interface ThumbnailStore { get(key: string): Promise<Blob | null>; put(key: string, blob: Blob): Promise<void> }
// CacheStorage is disposable derived data; prompt-chien-local stays at version 1.
export class BrowserThumbnailStore implements ThumbnailStore {
  private memory = new Map<string, Blob>();
  private url(key: string) { return new URL(`/__synth-thumbnail__/${key}.png`, location.origin).href; }
  async get(key: string): Promise<Blob | null> {
    try { const hit = await (await caches.open(thumbnailCacheName)).match(this.url(key)); if (hit) return await hit.blob(); } catch { /* Storage denied: use bounded memory. */ }
    return this.memory.get(key) ?? null;
  }
  async put(key: string, blob: Blob): Promise<void> {
    this.memory.delete(key); this.memory.set(key, blob);
    while (this.memory.size > 128) this.memory.delete(this.memory.keys().next().value!);
    try {
      const cache = await caches.open(thumbnailCacheName);
      await cache.delete(this.url(key)); await cache.put(this.url(key), new Response(blob, { headers: { 'Content-Type': 'image/png' } }));
      const keys = await cache.keys(); for (const stale of keys.slice(0, Math.max(0, keys.length - 128))) await cache.delete(stale);
    } catch { /* Cache quota is never a draft save failure. */ }
  }
}
export class ThumbnailQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private pending = new Map<string, Promise<Blob>>();
  private controller = new AbortController();
  readonly stats = { renders: 0, hits: 0, failures: 0 };
  constructor(private assetRevision: string, private footprints: Readonly<Record<string, number>>, private store: ThumbnailStore,
    private render: (body: ThumbnailBody, signal: AbortSignal) => Promise<Blob>) {}
  async request(body: ThumbnailBody): Promise<Blob> {
    // Snapshot only the Body allowlist. Caller edits cannot change an enqueued job.
    const snapshot: ThumbnailBody = { grid: body.grid, modules: body.modules.map(m => ({ id: m.id, catalogId: m.catalogId, cell: { x: m.cell.x, y: m.cell.y }, orientation: m.orientation })) };
    const key = await thumbnailKey(thumbnailContent(snapshot, this.assetRevision, this.footprints));
    if (this.controller.signal.aborted) throw Error('Thumbnail queue closed');
    const existing = this.pending.get(key); if (existing) return existing;
    const task = this.tail.catch(() => {}).then(async () => {
      if (this.controller.signal.aborted) throw Error('Thumbnail queue closed');
      const cached = await this.store.get(key);
      if (this.controller.signal.aborted) throw Error('Thumbnail queue closed');
      if (cached) { this.stats.hits++; return cached; }
      try {
        this.stats.renders++; const blob = await this.render(snapshot, this.controller.signal);
        if (this.controller.signal.aborted) throw Error('Thumbnail queue closed');
        await this.store.put(key, blob); return blob;
      } catch (error) { this.stats.failures++; throw error; }
    });
    this.pending.set(key, task); this.tail = task;
    void task.finally(() => this.pending.delete(key)).catch(() => {});
    return task;
  }
  dispose() { this.controller.abort(); this.pending.clear(); }
  async idle() { await this.tail.catch(() => {}); }
}
