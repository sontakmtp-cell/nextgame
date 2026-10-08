import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import type { BotDefinition, CatalogEntry, Placement } from '@prompt-chien/contracts';
import { WorkshopScene, fitPreviewCamera, workshopCamera } from '@prompt-chien/renderer3d';
import type { CameraState, PresentationManifest, Quality } from '@prompt-chien/renderer3d';
import type { Validation } from './protocol.js';
import { editModule } from './model.js';
import { placementCandidate, placementOverlap } from './workshop-intent.js';

interface PointEvent { point: { x: number; z: number }; buttons: number; button: number; stopPropagation: () => void }
interface Props {
  bot: BotDefinition; catalog: CatalogEntry[]; labels: Record<string, string>;
  selected: string; cell: { x: number; y: number }; palette: string;
  busy: boolean; pending: boolean; saving: boolean; cameraLocked: boolean;
  validation: Validation | null; canUndo: boolean; canRedo: boolean;
  onPick: (x: number, y: number) => void; onPalette: (id: string) => void;
  onEdit: (bot: BotDefinition) => void; onUndo: () => void; onRedo: () => void;
  onValidate: () => void; onSave: () => void; onPractice: () => void;
  onExtras: () => void; onRequest2d: () => void;
}

export default function Workshop3D(p: Props) {
  const [manifest, setManifest] = useState<PresentationManifest | null>(null);
  const [assetError, setAssetError] = useState('');
  const [quality, setQuality] = useState<Quality>(() => window.innerWidth < 768 ? 'low' : 'high');
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [grayscale, setGrayscale] = useState(false);
  const [camera, setCamera] = useState<CameraState>(workshopCamera);
  const [graphics, setGraphics] = useState('loading');
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [placementError, setPlacementError] = useState('');
  const [orientation, setOrientation] = useState<Placement['orientation']>(0);
  const [grid, setGrid] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(() => window.innerWidth >= 1024);
  const [size, setSize] = useState({ width: 900, height: 650 });
  const stage = useRef<HTMLDivElement>(null), gridRoot = useRef<HTMLDivElement>(null);
  const footprint = useMemo(() => Object.fromEntries(p.catalog.map(c => [c.id, c.footprint])), [p.catalog]);
  const core = p.bot.body.modules.find(m => m.catalogId === 'core');
  const selected = p.bot.body.modules.find(m => m.id === p.selected);
  const source = moving ? p.bot.body.modules.find(m => m.id === moving) : null;
  const previewCell = hover ?? p.cell;
  const ghost: Placement = { id: 'placement-preview', catalogId: source?.catalogId ?? p.palette, cell: previewCell, orientation };
  const locked = p.pending || p.busy;
  const previewBlocker = placementOverlap(p.bot, ghost.catalogId, previewCell, footprint, moving);
  const cost = p.bot.body.modules.reduce((sum, m) => sum + (p.catalog.find(c => c.id === m.catalogId)?.cost ?? 0), 0);

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/assets/ui3d/u3d01/manifest.json', { signal: controller.signal }).then(r => { if (!r.ok) throw Error(`Manifest HTTP ${r.status}`); return r.json(); }).then((m: PresentationManifest) => { if (m.version !== 'ui3d-v1') throw Error('Manifest không tương thích'); setManifest(m); }).catch(error => { if (!controller.signal.aborted) setAssetError(String(error)); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const element = stage.current; if (!element) return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height }); });
    observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const query = matchMedia('(min-width: 1024px)');
    const change = () => setLibraryOpen(query.matches);
    query.addEventListener('change', change); return () => query.removeEventListener('change', change);
  }, []);
  // Refit on topology/viewport changes, never on camera orbit or hover.
  const bodyKey = JSON.stringify(p.bot.body);
  useEffect(() => {
    if (manifest && core) setCamera(fitPreviewCamera(p.bot.body, footprint, manifest, size, workshopCamera));
  }, [bodyKey, footprint, manifest, size.width, size.height]);
  useEffect(() => { if (moving && !p.bot.body.modules.some(m => m.id === moving)) setMoving(null); }, [p.bot.body, moving]);
  useEffect(() => { if (selected) setInspectorOpen(true); }, [selected?.id]);

  const confirm = (cell = p.cell) => {
    if (locked || !p.catalog.some(c => c.id === ghost.catalogId && c.enabled)) return;
    const blocker = placementOverlap(p.bot, ghost.catalogId, cell, footprint, moving);
    if (blocker) { setPlacementError(`Ô đã có ${p.labels[blocker.catalogId]} (${blocker.id}). Không thể lắp chồng module.`); return; }
    p.onEdit(placementCandidate(p.bot, ghost.catalogId, cell, orientation, moving));
    setMoving(null); setHover(null); setPlacementError('');
  };
  const reset = () => { if (manifest && core) setCamera(fitPreviewCamera(p.bot.body, footprint, manifest, size, workshopCamera)); };
  const pick = (x: number, y: number) => { setHover(null); setPlacementError(''); p.onPick(x, y); };
  const activateCell = (cell: { x: number; y: number }) => {
    pick(cell.x, cell.y);
    const occupied = p.bot.body.modules.some(m => cell.x >= m.cell.x && cell.x < m.cell.x + (footprint[m.catalogId] ?? 1) && cell.y >= m.cell.y && cell.y < m.cell.y + (footprint[m.catalogId] ?? 1));
    if (moving || !occupied) confirm(cell);
  };
  const removeSelected = () => {
    if (locked || !selected) return;
    p.onEdit(editModule(p.bot, selected.id, null));
    setMoving(null); setHover(null); setPlacementError('');
  };
  const key = (event: React.KeyboardEvent) => {
    if (event.target instanceof HTMLElement && event.target.matches('input,textarea,select')) return;
    const delta: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const d = delta[event.key];
    if (d) { event.preventDefault(); const x = Math.max(0, Math.min(11, p.cell.x + d[0])), y = Math.max(0, Math.min(11, p.cell.y + d[1])); pick(x, y); gridRoot.current?.querySelector<HTMLButtonElement>(`[data-cell="${x},${y}"]`)?.focus(); }
  };
  return <section className="ui3d-workshop" aria-label="Workshop 3D">
    <div className="ui3d-workbench">
      <div className="ui3d-stage-column">
        <div className="ui3d-scene-toolbar">
          <span>ATELIER / 12 × 12 · +X phía trước</span>
          <button onClick={reset}>Đặt lại góc</button>
          <button aria-expanded={grid} onClick={() => setGrid(!grid)}>Lưới chuẩn</button>
          <button disabled={locked || !selected} onClick={removeSelected}>Xóa module</button>
          <button aria-haspopup="dialog" onClick={p.onExtras}>Công cụ khác</button>
        </div>
        <div className="ui3d-stage" ref={stage} data-camera-state={JSON.stringify(camera)}>
          {assetError || !core ? <div className="ui3d-scene-error" role="alert">{assetError || 'Body thiếu Core. Dùng lưới chuẩn hoặc hoàn tác để sửa.'}<button onClick={p.onRequest2d}>Chuyển 2D</button></div> : manifest ? <WorkshopScene
            body={p.bot.body} footprintByCatalogId={footprint} manifest={manifest}
            cursor={previewCell} ghost={locked || previewBlocker ? null : ghost} selectedModuleId={p.selected || null}
            onSelectCell={activateCell} onSelectModule={s => { const m = p.bot.body.modules.find(m => m.id === s.moduleId); if (m) activateCell(m.cell); }}
            onConfirmPlacement={activateCell}
            viewport={{ quality, camera, cameraLocked: p.cameraLocked, reducedMotion, grayscale, onCameraChange: setCamera, onReady: () => {}, onGraphicsState: state => setGraphics(state), onRequest2d: p.onRequest2d }}>
            {createElement('mesh', { name: 'workshop-hover-grid', position: [6 - (core.cell.x + 1), 0.025, core.cell.y + 1 - 6], rotation: [-Math.PI / 2, 0, 0],
              onPointerMove: (event: PointEvent) => { if (event.buttons || p.cameraLocked) return; const x = Math.floor(event.point.x + core.cell.x + 1), y = Math.floor(-event.point.z + core.cell.y + 1); if (x >= 0 && x < 12 && y >= 0 && y < 12) setHover(old => old?.x === x && old.y === y ? old : { x, y }); },
              onPointerLeave: () => setHover(null),
              onClick: (event: PointEvent) => { if (event.button !== 0) return; event.stopPropagation(); const x = Math.floor(event.point.x + core.cell.x + 1), y = Math.floor(-event.point.z + core.cell.y + 1); if (x >= 0 && x < 12 && y >= 0 && y < 12) activateCell({ x, y }); } }, createElement('planeGeometry', { args: [12, 12] }), createElement('meshBasicMaterial', { transparent: true, opacity: 0, colorWrite: false, depthWrite: false }))}
          </WorkshopScene> : <p role="status">Đang mở cảnh 3D…</p>}
          <div className="ui3d-preview-label">{locked ? (p.pending ? 'Áp dụng JSON trước khi lắp' : 'Đang kiểm tra…') : previewBlocker ? 'Ô đã có module · nhấp để chọn' : `${moving ? 'Di chuyển' : 'Lắp'} · ${p.labels[ghost.catalogId]} (${previewCell.x},${previewCell.y}) · nhấp ô để đặt`}</div>
        </div>
        <p className="ui3d-camera-help">Nhấp ô trống để lắp · nhấp module để chọn · Xóa module để gỡ · phải xoay góc · cuộn phóng to.</p>
        {placementError && <p role="alert" className="notice">{placementError}</p>}
        {(grid || !core) && <div className="ui3d-standard-grid" onKeyDown={key}>
          <p>Lưới chuẩn: ← ↑ ↓ → chọn ô · nhấp hoặc Enter để lắp ô trống / chọn module.</p>
          <div className="cell-grid" ref={gridRoot} role="group" aria-label="Lưới cơ thể 12 nhân 12">
            {Array.from({ length: 144 }, (_, i) => { const x = i % 12, y = 11 - Math.floor(i / 12); const m = p.bot.body.modules.find(m => x >= m.cell.x && x < m.cell.x + (footprint[m.catalogId] ?? 1) && y >= m.cell.y && y < m.cell.y + (footprint[m.catalogId] ?? 1)); return <button key={i} data-cell={`${x},${y}`} tabIndex={p.cell.x === x && p.cell.y === y ? 0 : -1} aria-label={`Ô ${x},${y}${m ? ` · ${p.labels[m.catalogId]} ${m.id}` : ' · trống'}`} aria-pressed={p.cell.x === x && p.cell.y === y} onPointerEnter={() => setHover({ x, y })} onPointerLeave={() => setHover(null)} onClick={() => activateCell({ x, y })}>{m ? (m.catalogId === 'core' ? 'C' : p.labels[m.catalogId]?.slice(0, 2)) : '·'}</button>; })}
          </div>
        </div>}
      </div>
      <aside className="ui3d-sidebar">
        <details className="ui3d-library-panel" open={libraryOpen} onToggle={event => setLibraryOpen(event.currentTarget.open)}><summary>Thư viện module</summary><section className="ui3d-library" aria-label="Thư viện module">
          <h2>Thư viện module</h2>
          {p.catalog.filter(c => c.enabled).map(c => <button key={c.id} className="ui3d-module-choice" aria-pressed={!moving && p.palette === c.id} onClick={() => { p.onPalette(c.id); setMoving(null); setOrientation(0); setPlacementError(''); }}>
            <img src={`/assets/ui3d/u3d01/thumbnails/${c.id}.png`} alt="" /><span><b>{p.labels[c.id]}</b><small>{c.cost} điểm · {c.mass} mass</small></span><span className="ui3d-footprint">{c.footprint}×{c.footprint}</span>
          </button>)}
          <small>Lance / Breaker mở ở G4.</small>
        </section></details>
        <details className="ui3d-inspector" open={inspectorOpen} onToggle={event => setInspectorOpen(event.currentTarget.open)}>
          <summary>{selected ? `${p.labels[selected.catalogId]} / ${selected.id}` : `Ô trống (${p.cell.x},${p.cell.y})`}</summary>
          <div className="controls">{selected && <>
            <button disabled={locked} aria-pressed={moving === selected.id} onClick={() => { setMoving(selected.id); setOrientation(selected.orientation); }}>Di chuyển module</button>
            <button disabled={locked} onClick={() => p.onEdit(editModule(p.bot, selected.id, { orientation: ((selected.orientation + 1) % 4) as Placement['orientation'] }))}>Xoay 90°</button>
          </>}</div>
          <div className="xy"><label>Ô X<input aria-label="Ô X" type="number" min="0" max="11" value={p.cell.x} onChange={e => { if (Number.isInteger(e.target.valueAsNumber)) pick(e.target.valueAsNumber, p.cell.y); }} /></label><label>Ô Y<input aria-label="Ô Y" type="number" min="0" max="11" value={p.cell.y} onChange={e => { if (Number.isInteger(e.target.valueAsNumber)) pick(p.cell.x, e.target.valueAsNumber); }} /></label></div>
          <label>Hướng lắp<select aria-label="Hướng lắp" value={orientation} onChange={e => setOrientation(Number(e.target.value) as Placement['orientation'])}>{['+X', '+Y', '−X', '−Y'].map((v, i) => <option key={v} value={i}>{i} · {v}</option>)}</select></label>
          {moving && <button onClick={() => setMoving(null)}>Hủy di chuyển</button>}
          <details><summary>Danh sách module ({p.bot.body.modules.length})</summary><ul className="module-list">{p.bot.body.modules.map(m => <li key={m.id}><button onClick={() => pick(m.cell.x, m.cell.y)}>{p.labels[m.catalogId]} · {m.id} · ({m.cell.x},{m.cell.y}) · hướng {m.orientation}</button></li>)}</ul></details>
          <p>{p.validation ? `Body / Brain hợp lệ · ${p.validation.compiled.nodeCount} nodes · bán kính ${p.validation.radius.toFixed(0)}/6500` : 'Kiểm tra sau khi sửa Body hoặc Brain.'}</p>
        </details>
        <details className="ui3d-display"><summary>Chất lượng & hiển thị</summary><label>Chất lượng<select aria-label="Chất lượng 3D" value={quality} onChange={e => setQuality(e.target.value as Quality)}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label><label><input type="checkbox" checked={reducedMotion} onChange={e => setReducedMotion(e.target.checked)} /> Giảm chuyển động</label><label><input type="checkbox" checked={grayscale} onChange={e => setGrayscale(e.target.checked)} /> Grayscale</label><small data-workshop-graphics={graphics}>{quality} · {graphics}</small></details>
      </aside>
    </div>
    <div className="ui3d-build-bar">
      <div className="ui3d-budget"><strong>{cost}<small> / 100</small></strong><meter min="0" max="100" value={cost} /><span>ĐIỂM BUILD</span></div>
      <div className="ui3d-count"><strong>{p.bot.body.modules.length}<small> / 24</small></strong><span>SỐ MODULE</span></div>
      <div className="controls"><button disabled={!p.canUndo || p.pending} onClick={p.onUndo}>Hoàn tác</button><button disabled={!p.canRedo || p.pending} onClick={p.onRedo}>Làm lại</button><button className="primary" disabled={locked || !!placementOverlap(p.bot, ghost.catalogId, p.cell, footprint, moving)} onClick={() => confirm()}>{moving ? 'Xác nhận di chuyển' : 'Lắp module'}</button><button disabled={locked} onClick={p.onValidate}>Kiểm tra bot</button><button disabled={locked} onClick={p.onPractice}>Thử trận</button><button disabled={p.saving || p.pending} onClick={p.onSave}>Lưu revision</button></div>
    </div>
    <p className="ui3d-mobile-note">Dưới 768 px: xem trước, chỉnh ô/hướng bằng tham số; lắp trực tiếp trên desktop.</p>
  </section>;
}
