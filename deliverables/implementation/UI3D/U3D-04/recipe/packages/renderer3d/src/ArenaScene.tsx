import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { SceneViewport } from './SceneViewport.js';
import { SynthVisual } from './SynthVisual.js';
import { ArenaStage } from './Stages.js';
import { publicBody } from './geometry.js';
import { sampleArena, clampPosition } from './arena-sample.js';
import { ArenaCombat } from './ArenaCombat.js';
import type { ArenaSceneProps } from './interfaces.js';
export function ArenaScene(props: ArenaSceneProps & { readonly children?: ReactNode }) {
  return <SceneViewport {...props.viewport} label="Arena — phát lại 3D"><ReplayWorld {...props} />{props.children}</SceneViewport>;
}
function ReplayWorld(props: ArenaSceneProps) {
  const [position, setPosition] = useState(props.position), invalidate = useThree(s => s.invalidate);
  useEffect(() => { if (props.positionRef) setPosition(clampPosition(props.frames, props.positionRef.current)); invalidate(); }, [props.position, props.seekVersion, props.playing, invalidate]);
  const livePosition = props.positionRef ? position : props.position;
  useFrame(() => {
    if (!props.positionRef) return;
    const next = clampPosition(props.frames, props.positionRef.current);
    if (next !== position) setPosition(next);
    if (props.playing && !document.hidden) invalidate();
  }, -2);
  const bodies = useMemo(() => props.frames[0] ? { A: publicBody(props.frames[0].actors.A), B: publicBody(props.frames[0].actors.B) } : null, [props.frames]);
  const sample = useMemo(() => sampleArena(props.frames, livePosition, props.footprintByCatalogId, props.viewport.quality, props.vfx, props.viewport.reducedMotion), [props.frames, livePosition, props.footprintByCatalogId, props.viewport.quality, props.vfx, props.viewport.reducedMotion]);
  if (!sample || !bodies) return null;
  return <group name="replay-world" userData={{ position: sample.position, boundary: sample.boundary }}>
    <ArenaStage layout={props.layout} ringRadius={sample.frame.ringRadius / 1000} controlOwner={sample.frame.controlOwner} />
    {sample.actors.map(a => <group key={a.team} name={`actor-${a.team}`} position={[a.pose.x, 0, a.pose.z]} rotation={[0, a.pose.yaw, 0]}>
      <SynthVisual body={bodies[a.team]} publicState={a.state} footprintByCatalogId={props.footprintByCatalogId} manifest={props.manifest} quality={props.viewport.quality} reducedMotion={props.viewport.reducedMotion} replayTime={sample.time} team={a.team} selectedModuleId={null} onSelectModule={() => {}} energyLinks={props.vfx} />
    </group>)}
    <ArenaCombat sample={sample} footprints={props.footprintByCatalogId} maxHp={props.maxHpByCatalogId ?? {}} vfx={props.vfx} reduced={props.viewport.reducedMotion} />
    <mesh name="shadow-catcher" position={[0, .008, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[props.layout.width, props.layout.depth]} /><shadowMaterial color="#17262f" opacity={.55} transparent depthWrite={false} /></mesh>
  </group>;
}
