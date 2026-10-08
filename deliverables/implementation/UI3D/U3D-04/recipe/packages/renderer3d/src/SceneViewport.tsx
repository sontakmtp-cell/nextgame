import { Component, Suspense, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping, MOUSE, PMREMGenerator, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AssetContext, SceneAssetCache } from './assets.js';
import type { CameraState, SceneViewportProps } from './interfaces.js';

export const workshopCamera: CameraState = { target: [0, 0.4, 0], azimuth: Math.PI / 4, elevation: 0.85, zoom: 140 };
export const arenaCamera: CameraState = { target: [0, 0, 0], azimuth: 0, elevation: 1.15, zoom: 23 };
interface Graphics { pending: (change: number) => void; fail: (message: string) => void }
const GraphicsContext = createContext<Graphics>({ pending: () => {}, fail: () => {} });
export const useGraphics = () => useContext(GraphicsContext);

class GraphicsBoundary extends Component<{ children: ReactNode; fail: (message: string) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.fail(error.message); }
  render() { return this.state.failed ? null : this.props.children; }
}

function Rig({ viewport }: { viewport: SceneViewportProps }) {
  const { camera, gl, scene, invalidate } = useThree();
  const current = useRef(viewport); current.current = viewport;
  const controlRef = useRef<OrbitControls | null>(null);
  useEffect(() => {
    const control = new OrbitControls(camera, gl.domElement); controlRef.current = control;
    control.enablePan = false; control.enableDamping = false; control.mouseButtons = { LEFT: null, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE };
    control.minPolarAngle = 0.22; control.maxPolarAngle = 1.35; control.minZoom = current.current.zoomBounds?.[0] ?? 12; control.maxZoom = current.current.zoomBounds?.[1] ?? 240;
    const change = () => { invalidate(); const offset = camera.position.clone().sub(control.target); current.current.onCameraChange({ target: control.target.toArray(), azimuth: Math.atan2(offset.x, offset.z), elevation: Math.asin(offset.y / offset.length()), zoom: 'zoom' in camera ? Number(camera.zoom) : 1 }); };
    control.addEventListener('change', change);
    const context = (e: Event) => { e.preventDefault(); current.current.onGraphicsState('lost', 'Mất context đồ họa; giữ nguyên dữ liệu cảnh'); };
    const restore = () => { invalidate(); current.current.onGraphicsState('ready', null); };
    gl.domElement.addEventListener('webglcontextlost', context); gl.domElement.addEventListener('webglcontextrestored', restore);
    const pmrem = new PMREMGenerator(gl), room = new RoomEnvironment(), env = pmrem.fromScene(room, 0.04);
    scene.environment = env.texture; scene.environmentIntensity = 0.6; room.dispose(); pmrem.dispose(); invalidate();
    return () => { control.removeEventListener('change', change); control.dispose(); controlRef.current = null; gl.domElement.removeEventListener('webglcontextlost', context); gl.domElement.removeEventListener('webglcontextrestored', restore); scene.environment = null; env.dispose(); };
  }, [camera, gl, scene, invalidate]);
  useEffect(() => {
    const control = controlRef.current; if (!control) return;
    const c = viewport.camera, distance = 35;
    control.target.set(...c.target); camera.position.copy(control.target).add(new Vector3(Math.sin(c.azimuth) * Math.cos(c.elevation) * distance, Math.sin(c.elevation) * distance, Math.cos(c.azimuth) * Math.cos(c.elevation) * distance));
    if ('zoom' in camera) camera.zoom = Math.max(viewport.zoomBounds?.[0] ?? 12, Math.min(viewport.zoomBounds?.[1] ?? 240, c.zoom));
    camera.lookAt(control.target); camera.updateProjectionMatrix(); control.enabled = !viewport.cameraLocked; control.update(); invalidate();
  }, [camera, invalidate, viewport.camera, viewport.cameraLocked]);
  return null;
}

function Resources({ children, viewport, graphics }: { children: ReactNode; viewport: SceneViewportProps; graphics: Graphics }) {
  const gl = useThree(s => s.gl), cache = useMemo(() => new SceneAssetCache(gl), [gl]);
  const shadowSize = viewport.quality === 'low' ? 512 : viewport.quality === 'medium' ? 1024 : 2048;
  useEffect(() => { cache.retain(); graphics.pending(0); return () => cache.release(); }, [cache, graphics]);
  return <AssetContext.Provider value={cache}><GraphicsContext.Provider value={graphics}><Rig viewport={viewport} /><hemisphereLight args={['#fff3dd', '#323642', 1.8]} /><directionalLight position={[8, 15, 6]} intensity={3} color="#ffebd2" castShadow shadow-mapSize={[shadowSize, shadowSize]} shadow-radius={3} shadow-camera-left={-24} shadow-camera-right={24} shadow-camera-top={24} shadow-camera-bottom={-24} shadow-bias={-0.0003} /><directionalLight position={[-8, 6, -8]} color="#c5e1e8" intensity={1} />{children}</GraphicsContext.Provider></AssetContext.Provider>;
}

export function SceneViewport(props: SceneViewportProps & { readonly children: ReactNode; readonly label?: string }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'lost' | 'unavailable'>('loading'), [message, setMessage] = useState<string | null>(null);
  const pending = useRef(0), current = useRef(props); current.current = props;
  const stateRef = useRef(status);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const graphics = useMemo<Graphics>(() => ({
    pending: delta => { pending.current += delta; if (!mounted.current || stateRef.current === 'unavailable' || stateRef.current === 'lost') return; const state = pending.current > 0 ? 'loading' : 'ready'; stateRef.current = state; setStatus(state); current.current.onGraphicsState(state, null); if (!pending.current) current.current.onReady(); },
    fail: text => { if (!mounted.current) return; stateRef.current = 'unavailable'; setStatus('unavailable'); setMessage(text); current.current.onGraphicsState('unavailable', text); }
  }), []);
  const viewport: SceneViewportProps = { ...props, onGraphicsState: (requested, text) => { if (!mounted.current) return; const state = requested === 'ready' && pending.current > 0 ? 'loading' : requested; stateRef.current = state; setStatus(state); setMessage(text); props.onGraphicsState(state, text); } };
  return <section aria-label={props.label ?? 'Cảnh Synth 3D'} data-graphics={status} style={{ position: 'relative', width: '100%', height: '100%', minHeight: 300, background: '#d8d5ce', filter: props.grayscale ? 'grayscale(1)' : undefined }} onContextMenu={e => e.preventDefault()}>
    <GraphicsBoundary fail={graphics.fail}><Canvas orthographic frameloop="demand" shadows="percentage" dpr={props.quality === 'low' ? 1 : [1, 2]} camera={{ position: [16, 20, 16], zoom: props.camera.zoom, near: 0.1, far: 150 }} gl={{ antialias: props.quality !== 'low', toneMapping: ACESFilmicToneMapping }} fallback={<Failure onRequest2d={props.onRequest2d} />}><Suspense fallback={null}><Resources viewport={viewport} graphics={graphics}>{props.children}</Resources></Suspense></Canvas></GraphicsBoundary>
    {status === 'loading' && <div role="status" style={{ position: 'absolute', top: 12, left: 12, padding: '8px 12px', background: '#1d2933', color: '#fff' }}>Đang tải tài nguyên 3D…</div>}
    {(status === 'unavailable' || status === 'lost') && <div role="alert" style={{ position: 'absolute', inset: '35% 10% auto', padding: 20, background: '#fff' }}>{message}<Failure onRequest2d={props.onRequest2d} /></div>}
  </section>;
}
function Failure({ onRequest2d }: Pick<SceneViewportProps, 'onRequest2d'>) { return <div>Không mở được cảnh 3D. <button onClick={onRequest2d}>Chuyển 2D</button></div>; }
