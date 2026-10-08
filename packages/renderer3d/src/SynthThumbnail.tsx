import { useCallback, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { WorkshopStage } from './Stages.js';
import { SynthVisual } from './SynthVisual.js';
import { coreAnchor, fitPreviewCamera } from './geometry.js';
import { SceneViewport, workshopCamera } from './SceneViewport.js';
import type { SynthPreviewProps } from './interfaces.js';

interface Props extends Omit<SynthPreviewProps, 'viewport'> {
  readonly token: number;
  readonly onImage: (token: number, blob: Blob) => void;
  readonly onError: (token: number, message: string) => void;
}
// One mounted thumbnail viewport serves the whole queue; no canvas per card.
export function SynthThumbnail(p: Props) {
  const [ready, setReady] = useState(false), current = useRef(p); current.current = p;
  const graphics = useCallback((state: string, message: string | null) => {
    setReady(state === 'ready');
    if (state === 'lost' || state === 'unavailable') current.current.onError(current.current.token, message ?? state);
  }, []);
  const camera = fitPreviewCamera(p.body, p.footprintByCatalogId, p.manifest, { width: 256, height: 192 }, workshopCamera);
  const core = coreAnchor(p.body);
  return <SceneViewport quality="medium" camera={camera} cameraLocked reducedMotion grayscale={false} onCameraChange={() => {}} onReady={() => {}} onGraphicsState={graphics} onRequest2d={() => p.onError(p.token, 'Thumbnail unavailable')}>
    <WorkshopStage origin={[6 - core.x, core.y - 6]} />
    <SynthVisual body={p.body} manifest={p.manifest} footprintByCatalogId={p.footprintByCatalogId} quality="medium" publicState={null} team="preview" selectedModuleId={null} onSelectModule={() => {}} reducedMotion energyLinks={false} />
    <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[48, 36]} /><shadowMaterial color="#17262f" opacity={0.55} transparent depthWrite={false} /></mesh>
    <Capture ready={ready} job={p} />
  </SceneViewport>;
}
function Capture({ ready, job }: { ready: boolean; job: Props }) {
  const frames = useRef({ token: -1, count: 0, done: false });
  const invalidate = useThree(s => s.invalidate);
  useFrame(({ gl, scene, camera, setDpr, viewport }) => {
    if (frames.current.token !== job.token) frames.current = { token: job.token, count: 0, done: false };
    if (viewport.dpr !== 1) { setDpr(1); invalidate(); return; }
    gl.render(scene, camera);
    // State ready can precede the React commit that attaches loaded model graphs.
    const synth = scene.getObjectByName('synth-preview-medium');
    const populated = synth && job.body.modules.every(m => (synth.getObjectByName(`module-${m.id}`)?.children.length ?? 0) >= 2);
    if (!ready || !populated || frames.current.done) return;
    if (++frames.current.count < 3) { invalidate(); return; }
    frames.current.done = true;
    try {
      // Encode immediately after rendering, before WebGL clears the drawing buffer.
      gl.domElement.toBlob(blob => { if (blob) job.onImage(job.token, blob); else job.onError(job.token, 'PNG encode failed'); }, 'image/png');
    } catch (error) { job.onError(job.token, String(error)); }
  }, 1);
  return null;
}
