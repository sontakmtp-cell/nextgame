import type { ReactNode } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { SceneViewport } from './SceneViewport.js';
import { SynthVisual } from './SynthVisual.js';
import { WorkshopStage } from './Stages.js';
import { coreAnchor, localToCell } from './geometry.js';
import type { SynthPreviewProps, WorkshopSceneProps } from './interfaces.js';
const noop = () => {};
function GroundShadow() { return <mesh name="shadow-catcher" position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[48, 36]} /><shadowMaterial color="#17262f" opacity={0.55} transparent depthWrite={false} /></mesh>; }
export function SynthPreview(props: SynthPreviewProps & { readonly children?: ReactNode }) {
  const core = coreAnchor(props.body);
  return <SceneViewport {...props.viewport}><WorkshopStage origin={[6 - core.x, core.y - 6]} /><SynthVisual body={props.body} footprintByCatalogId={props.footprintByCatalogId} manifest={props.manifest} quality={props.viewport.quality} reducedMotion={props.viewport.reducedMotion} publicState={null} team="preview" selectedModuleId={null} onSelectModule={noop} /><GroundShadow />{props.children}</SceneViewport>;
}
export function WorkshopScene(props: WorkshopSceneProps & { readonly children?: ReactNode }) {
  const core = coreAnchor(props.body);
  const cell = (event: ThreeEvent<MouseEvent>) => localToCell(props.body, event.point.x, event.point.z);
  return <SceneViewport {...props.viewport} label="Atelier — robot và ô lắp 3D"><WorkshopStage origin={[6 - core.x, core.y - 6]} />
    <mesh name="grid-pick-plane" position={[6 - core.x, 0.006, core.y - 6]} rotation={[-Math.PI / 2, 0, 0]} onClick={event => { if (event.button !== 0) return; const selected = cell(event); if (selected) { event.stopPropagation(); props.onSelectCell(selected); } }} onDoubleClick={event => { if (event.button !== 0) return; const selected = cell(event); if (selected) { event.stopPropagation(); props.onConfirmPlacement(selected); } }}><planeGeometry args={[12, 12]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} /></mesh>
    <mesh name="cursor" position={[props.cursor.x + 0.5 - core.x, 0.012, -(props.cursor.y + 0.5 - core.y)]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.96, 0.96]} /><meshBasicMaterial color="#21b9ae" transparent opacity={0.16} depthWrite={false} /></mesh>
    <SynthVisual body={props.body} footprintByCatalogId={props.footprintByCatalogId} manifest={props.manifest} quality={props.viewport.quality} reducedMotion={props.viewport.reducedMotion} publicState={null} team="preview" selectedModuleId={props.selectedModuleId} onSelectModule={props.onSelectModule} ghost={props.ghost} />
    <GroundShadow />
    {props.children}
  </SceneViewport>;
}
export { ArenaScene } from './ArenaScene.js';
