import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BotDefinition, CatalogEntry } from '@prompt-chien/contracts';
import { SynthPreview, SynthThumbnail, fitPreviewCamera, workshopCamera } from '@prompt-chien/renderer3d';
import type { CameraState, PresentationManifest, Quality } from '@prompt-chien/renderer3d';
import { listDrafts, revisions } from './drafts.js';
import type { Draft } from './drafts.js';
import { BrowserThumbnailStore, ThumbnailQueue, thumbnailCacheName } from './synth-thumbnail.js';
import type { ThumbnailBody } from './synth-thumbnail.js';
import './mysynths3d.css';

interface Props {
  bot: BotDefinition; catalog: CatalogEntry[]; drafts: Draft[]; dirty: boolean;
  busy: boolean; pending: boolean; saving: boolean; cameraLocked: boolean;
  onOpen: (draft: Draft, head: Draft) => void; onRestore: (draft: Draft, head: Draft) => void;
  onSave: (fork: boolean) => void; onExport: () => void; onRequest2d: () => void;
}
interface Job { token: number; body: ThumbnailBody; resolve: (blob: Blob) => void; reject: (error: Error) => void }
const savedAt = (d: Draft) => new Date(d.savedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
export default function MySynths3D(p: Props) {
  const [heads, setHeads] = useState(p.drafts), [selected, setSelected] = useState<Draft | null>(null);
  const [lineage, setLineage] = useState<Draft[]>([]), [historyError, setHistoryError] = useState(''), [loadingHistory, setLoadingHistory] = useState(false);
  const [manifest, setManifest] = useState<PresentationManifest | null>(null), [assetError, setAssetError] = useState('');
  const [queue, setQueue] = useState<ThumbnailQueue | null>(null), [job, setJob] = useState<Job | null>(null), [epoch, setEpoch] = useState(0), [clearing, setClearing] = useState(false);
  const jobRef = useRef(job); jobRef.current = job;
  const thumbnailFailure = useRef<string | null>(null);
  const serial = useRef(0), stage = useRef<HTMLDivElement>(null), lost = useRef(false);
  const [generation, setGeneration] = useState(0), [size, setSize] = useState({ width: 800, height: 650 });
  const [camera, setCamera] = useState<CameraState>(workshopCamera), [graphics, setGraphics] = useState('loading');
  const [quality, setQuality] = useState<Quality>(() => innerWidth < 768 ? 'low' : 'high');
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches), [gray, setGray] = useState(false);
  const body = selected?.definition.body ?? p.bot.body;
  const footprint = useMemo(() => Object.fromEntries(p.catalog.map(c => [c.id, c.footprint])), [p.catalog]);
  const blocked = p.dirty || p.pending || p.busy || p.saving;
  useEffect(() => setHeads(p.drafts), [p.drafts]);
  useEffect(() => {
    let active = true; setHistoryError(''); setLineage([]);
    if (!selected) { setLoadingHistory(false); return; }
    setLoadingHistory(true);
    void revisions(selected.id).then(rows => { if (active) { setLineage([...rows].sort((a, b) => b.revision - a.revision)); setLoadingHistory(false); } }).catch(e => { if (active) { setHistoryError(String(e)); setLoadingHistory(false); } });
    return () => { active = false; };
  }, [selected?.id, heads]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/assets/ui3d/u3d01/manifest.json', { signal: controller.signal }).then(r => { if (!r.ok) throw Error(`Manifest HTTP ${r.status}`); return r.json(); }).then((m: PresentationManifest) => { if (m.version !== 'ui3d-v1') throw Error('Manifest không tương thích'); setManifest(m); }).catch(e => { if (!controller.signal.aborted) setAssetError(String(e)); });
    return () => controller.abort();
  }, []);
  useEffect(() => { const observer = new ResizeObserver(entries => { const r = entries[0]?.contentRect; if (r) setSize({ width: r.width, height: r.height }); }); if (stage.current) observer.observe(stage.current); return () => observer.disconnect(); }, []);
  const bodyKey = JSON.stringify(body);
  const reset = () => { if (manifest && body.modules.some(m => m.catalogId === 'core')) setCamera(fitPreviewCamera(body, footprint, manifest, size, workshopCamera)); };
  useEffect(reset, [bodyKey, footprint, manifest, size.width, size.height]);
  const graphicsState = useCallback((state: string) => {
    if (state === 'lost') lost.current = true;
    if (state === 'ready' && lost.current) { lost.current = false; setGeneration(n => n + 1); setGraphics('loading'); return; }
    setGraphics(state);
  }, []);
  useEffect(() => {
    if (!manifest) return;
    thumbnailFailure.current = null;
    const q = new ThumbnailQueue(manifest.assetRevision, footprint, new BrowserThumbnailStore(), (snapshot, signal) => new Promise((resolve, reject) => {
      if (thumbnailFailure.current) { reject(Error(thumbnailFailure.current)); return; }
      const token = ++serial.current;
      let settled = false;
      const finish = (blob: Blob | null, error?: Error) => {
        if (settled) return; settled = true; clearTimeout(timer); signal.removeEventListener('abort', abort);
        if (blob) resolve(blob); else reject(error ?? Error('Thumbnail cancelled'));
      };
      const abort = () => finish(null);
      const timer = setTimeout(() => finish(null, Error('Thumbnail render timeout')), 35000);
      signal.addEventListener('abort', abort, { once: true });
      setJob({ token, body: snapshot, resolve: blob => finish(blob), reject: error => finish(null, error) });
    }));
    setQueue(q);
    return () => { q.dispose(); };
  }, [manifest, footprint, epoch]);
  const image = useCallback((token: number, blob: Blob) => { if (jobRef.current?.token === token) jobRef.current.resolve(blob); }, []);
  const imageError = useCallback((token: number, message: string) => { if (jobRef.current?.token === token) { thumbnailFailure.current = message; jobRef.current.reject(Error(message)); } }, []);
  const clearThumbnails = async () => {
    if (clearing) return; setClearing(true); queue?.dispose();
    try { await queue?.idle(); await caches.delete(thumbnailCacheName); } catch { /* Memory-only is still rebuildable. */ }
    setJob(null); setEpoch(n => n + 1); setClearing(false);
  };
  const refresh = async () => { try { setHeads(await listDrafts()); setHistoryError(''); } catch (e) { setHistoryError(String(e)); } };
  return <section className="ui3d-synths" aria-label="My Synths 3D" data-thumbnail-epoch={epoch}>
    <div className="ui3d-synth-columns">
      <aside className="ui3d-synth-library" aria-label="Danh sách Synth">
        <h2>My Synths</h2><p>Những phiên bản trên máy này</p><small>Lưu trên máy · local/unofficial</small>
        <div className="controls"><button onClick={() => void refresh()}>Làm mới danh sách</button></div>
        <button className="ui3d-synth-draft" aria-pressed={!selected} onClick={() => setSelected(null)}>Xem bản đang sửa · {p.bot.name}</button>
        {!heads.length && <p>Chưa có bản lưu. Lưu revision đầu tiên ở thanh bên dưới.</p>}
        {heads.map(d => <button className="ui3d-synth-card" key={d.id} aria-label={`Xem Synth ${d.definition.name}`} aria-pressed={selected?.id === d.id} onClick={() => setSelected(d)}>
          <Thumbnail body={d.definition.body} queue={clearing ? null : queue} epoch={epoch} />
          <span><b>{d.definition.name}</b><small>r{d.revision} · {d.hypothesis || 'Chưa ghi giả thuyết'}</small><small>{savedAt(d)}</small></span>
        </button>)}
      </aside>
      <div className="ui3d-synth-center">
        <div className="ui3d-synth-title"><p className="eyebrow">{selected ? `BẢN LƯU / r${selected.revision} · CHỈ XEM` : 'BẢN ĐANG SỬA'}</p><h2>{selected?.definition.name ?? p.bot.name}</h2><p>{selected?.hypothesis ?? 'Lưu một giả thuyết rồi thử trong Arena.'}</p></div>
        <div className="ui3d-synth-preview" ref={stage} data-preview-body={bodyKey} data-camera-state={JSON.stringify(camera)}>
          {assetError || !body.modules.some(m => m.catalogId === 'core') ? <div role="alert">{assetError || 'Body thiếu Core, chưa thể xem 3D.'}<button onClick={p.onRequest2d}>Chuyển 2D</button></div> : manifest ? <SynthPreview key={generation} body={body} footprintByCatalogId={footprint} manifest={manifest} viewport={{ quality, camera, cameraLocked: p.cameraLocked, reducedMotion: reduced, grayscale: gray, onCameraChange: setCamera, onReady: () => {}, onGraphicsState: graphicsState, onRequest2d: p.onRequest2d }} /> : <p role="status">Đang tải cảnh Synth…</p>}
        </div>
        <div className="ui3d-synth-view-controls"><button onClick={reset}>Đặt lại góc</button><label>Chất lượng<select aria-label="Chất lượng Synth 3D" value={quality} onChange={e => setQuality(e.target.value as Quality)}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label><label><input type="checkbox" checked={reduced} onChange={e => setReduced(e.target.checked)} /> Giảm chuyển động</label><label><input type="checkbox" checked={gray} onChange={e => setGray(e.target.checked)} /> Thang xám</label><small>{quality} · {graphics}</small></div>
        <small>Chuột phải xoay · cuộn để zoom. Chọn bản lưu chỉ đổi cảnh xem trước.</small>
      </div>
      <aside className="ui3d-synth-history" aria-label="Lịch sử phiên bản">
        <h2>Lịch sử phiên bản</h2><p>Khôi phục vào draft rồi lưu sẽ tạo revision mới.</p>
        {!selected && <p>Chọn một Synth bên trái để xem lịch sử.</p>}
        {loadingHistory && <p role="status">Đang đọc lịch sử…</p>}{historyError && <p role="alert">{historyError}</p>}
        {lineage.map(d => <article className="ui3d-synth-revision" key={`${d.id}/${d.revision}`} data-selected={selected?.revision === d.revision}>
          <button aria-label={`Xem revision ${d.revision}`} aria-pressed={selected?.revision === d.revision} onClick={() => setSelected(d)}><b>r{d.revision} · {d.hypothesis || d.definition.name}</b><Thumbnail body={d.definition.body} queue={clearing ? null : queue} epoch={epoch} /><small>{savedAt(d)}</small><small>{d.weakness}</small></button>
          <button disabled={blocked} title={blocked ? 'Lưu hoặc export bản đang sửa trước' : ''} onClick={() => { const head = heads.find(h => h.id === d.id); if (!blocked && head) p.onRestore(d, head); }}>Khôi phục nội dung r{d.revision}</button>
        </article>)}
      </aside>
    </div>
    <div className="ui3d-synth-actions"><p role="note">{p.dirty ? 'Bản đang sửa chưa lưu. Lưu revision trước khi mở hoặc khôi phục bản khác.' : 'Chọn phiên bản để xem; mở hoặc khôi phục mới thay bản đang sửa.'}</p><div className="controls"><button onClick={p.onExport}>Export bản đang sửa</button><button disabled={p.saving || p.pending || p.busy} onClick={() => p.onSave(false)}>Lưu revision</button><button className="primary" disabled={!selected || blocked} onClick={() => { const head = heads.find(h => h.id === selected?.id); if (selected && head && !blocked) p.onOpen(selected, head); }}>Mở trong Workshop</button><button disabled={p.saving || p.pending || p.busy} onClick={() => p.onSave(true)}>Lưu thành Synth mới</button></div></div>
    <details className="ui3d-synth-cache"><summary>Ảnh xem trước</summary><p>Ảnh được dựng từ Body, dùng chung hàng đợi. Xóa ảnh không xóa Synth hay lịch sử.</p><button disabled={clearing || !queue} onClick={() => void clearThumbnails()}>Dựng lại thumbnail</button></details>
    {manifest && job && <div className="ui3d-thumbnail-stage" aria-hidden="true" data-thumbnail-renders={queue?.stats.renders} data-thumbnail-hits={queue?.stats.hits}><SynthThumbnail token={job.token} body={job.body} manifest={manifest} footprintByCatalogId={footprint} onImage={image} onError={imageError} /></div>}
  </section>;
}
function Thumbnail({ body, queue, epoch }: { body: ThumbnailBody; queue: ThumbnailQueue | null; epoch: number }) {
  const [url, setUrl] = useState(''), [failed, setFailed] = useState(false);
  const content = JSON.stringify(body);
  useEffect(() => {
    let active = true, objectUrl = ''; setUrl(''); setFailed(false);
    if (queue) void queue.request(body).then(blob => { if (active) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); } }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [content, queue, epoch]);
  return url ? <img className="ui3d-synth-thumbnail" src={url} alt="Robot của phiên bản" /> : <span className="ui3d-synth-thumbnail-placeholder">{failed ? 'Ảnh chưa dựng được' : 'Đang dựng ảnh…'}</span>;
}
