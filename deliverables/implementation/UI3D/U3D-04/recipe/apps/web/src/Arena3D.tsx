import { useCallback, useEffect, useRef, useState } from 'react';
import { ArenaScene, arenaCamera } from '@prompt-chien/renderer3d';
import type { CameraState, PresentationManifest, Quality } from '@prompt-chien/renderer3d';
import type { PublicFrame } from '@prompt-chien/contracts';
import { replayArenaLayout } from './arena-layout.js';
interface Props {
  seekVersion: number; frames: readonly PublicFrame[]; position: number; positionRef: { readonly current: number }; playing: boolean;
  footprints: Readonly<Record<string, number>>; maxHp: Readonly<Record<string, number>>;
  quality: Quality; vfx: boolean; grayscale: boolean; reduced: boolean; cameraLocked: boolean;
  onGraphics: (state: string, message: string | null) => void; onRequest2d: () => void;
}
export default function Arena3D(p: Props) {
  const [manifest, setManifest] = useState<PresentationManifest | null>(null), [error, setError] = useState('');
  const [generation, setGeneration] = useState(0), [camera, setCamera] = useState<CameraState>(arenaCamera);
  const host = useRef<HTMLDivElement>(null), lost = useRef(false), current = useRef(p); current.current = p;
  const [size, setSize] = useState({ width: 1000, height: 700 });
  useEffect(() => { const observer = new ResizeObserver(entries => { const r = entries[0]?.contentRect; if (r) setSize({ width: r.width, height: r.height }); }); if (host.current) observer.observe(host.current); return () => observer.disconnect(); }, []);
  const reset = () => setCamera({ ...arenaCamera, zoom: Math.max(4, Math.min(23, size.width / 45, size.height / 31)) });
  useEffect(reset, [size.width, size.height]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/assets/ui3d/u3d01/manifest.json', { signal: controller.signal }).then(r => { if (!r.ok) throw Error(`Manifest HTTP ${r.status}`); return r.json(); }).then((m: PresentationManifest) => { if (m.version !== 'ui3d-v1') throw Error('Manifest không tương thích'); setManifest(m); }).catch(e => { if (!controller.signal.aborted) { setError(String(e)); current.current.onGraphics('unavailable', String(e)); } });
    return () => controller.abort();
  }, []);
  const graphics = useCallback((state: string, message: string | null) => {
    if (state === 'lost') lost.current = true;
    if (state === 'ready' && lost.current) { lost.current = false; setGeneration(n => n + 1); current.current.onGraphics('loading', 'Đang tải lại tài nguyên tại tick đã giữ…'); return; }
    current.current.onGraphics(state, message);
  }, []);
  return <div className="ui3d-arena-view">
    <div className="ui3d-arena-camera"><span>PUBLIC REPLAY / 3D</span><button onClick={reset}>Đặt lại góc</button></div>
    <div className="ui3d-arena-canvas" ref={host}>
      {manifest && !error && <ArenaScene key={generation} layout={replayArenaLayout} frames={p.frames} position={p.position} seekVersion={p.seekVersion} positionRef={p.positionRef} playing={p.playing} footprintByCatalogId={p.footprints} maxHpByCatalogId={p.maxHp} manifest={manifest} vfx={p.vfx} viewport={{ quality: p.quality, camera, zoomBounds: [4, 60], cameraLocked: p.cameraLocked, grayscale: p.grayscale, reducedMotion: p.reduced, onCameraChange: setCamera, onReady: () => {}, onGraphicsState: graphics, onRequest2d: p.onRequest2d }} />}
      {!manifest && !error && <p role="status">Đang tải Arena 3D…</p>}
      {error && <div role="alert"><p>{error}</p><button onClick={p.onRequest2d}>Chuyển 2D</button></div>}
    </div>
  </div>;
}
