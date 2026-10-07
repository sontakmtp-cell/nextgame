import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Texture } from 'three';
import { Object3D } from 'three';
import type { InstancedMesh } from 'three';
import { useThree } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { useAssetCache } from './assets.js';
import { useGraphics } from './SceneViewport.js';
import type { ArenaLayout } from './interfaces.js';
const floorUrl = '/assets/ui3d/u3d02/floor.webp';
function useFloor() {
  const cache = useAssetCache(), graphics = useGraphics(), [texture, setTexture] = useState<Texture | null>(null);
  useEffect(() => { let active = true, settled = false; graphics.pending(1); const finish = () => { if (!settled) { settled = true; graphics.pending(-1); } }; void cache.loadTexture(floorUrl).then(t => { if (active) setTexture(t); }).catch(e => { if (active) graphics.fail(String(e)); }).finally(() => { if (active) finish(); }); return () => { active = false; finish(); }; }, [cache, graphics]);
  return texture;
}
export function WorkshopStage({ origin = [0, 0] }: { readonly origin?: readonly [number, number] }) {
  const texture = useFloor();
  return <group name="workshop-stage" position={[origin[0], 0, origin[1]]}>
    <RoundedBox args={[14.4, 0.55, 14.4]} position={[0, -0.45, 0]} radius={0.16} smoothness={2} receiveShadow><meshStandardMaterial color="#303841" roughness={0.5} metalness={0.65} /></RoundedBox>
    {[-1, 1].flatMap(sign => [<Rail key={`x${sign}`} x={sign * 7} z={0} length={14.2} vertical />, <Rail key={`z${sign}`} x={0} z={sign * 7} length={14.2} />])}
    <FloorPanels width={12} depth={12} cols={12} rows={12} texture={texture} />
    {[-1, 1].flatMap(x => [-1, 1].map(z => <group key={`${x}/${z}`} position={[x * 6.45, 0.05, z * 6.45]}><RoundedBox args={[0.65, 0.22, 0.65]} radius={0.08} smoothness={2}><meshStandardMaterial color="#d8d3c9" roughness={0.55} metalness={0.25} /></RoundedBox><mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.085, 0.085, 0.015, 12]} /><meshStandardMaterial color="#38434b" roughness={0.45} metalness={0.8} /></mesh></group>))}
  </group>;
}
function FloorPanels({ width, depth, cols, rows, texture }: { width: number; depth: number; cols: number; rows: number; texture: Texture | null }) {
  const ref = useRef<InstancedMesh>(null), invalidate = useThree(s => s.invalidate);
  useLayoutEffect(() => { if (!ref.current) return; const object = new Object3D(); for (let i = 0; i < cols * rows; i++) { object.position.set((i % cols + 0.5) * width / cols - width / 2, -0.035, (Math.floor(i / cols) + 0.5) * depth / rows - depth / 2); object.updateMatrix(); ref.current.setMatrixAt(i, object.matrix); } ref.current.instanceMatrix.needsUpdate = true; ref.current.computeBoundingSphere(); invalidate(); }, [width, depth, cols, rows, invalidate]);
  return <instancedMesh ref={ref} args={[undefined, undefined, cols * rows]} receiveShadow><boxGeometry args={[width / cols - 0.02, 0.065, depth / rows - 0.02]} /><meshStandardMaterial key={texture ? 'textured' : 'loading'} map={texture} color="#e4e0d5" roughness={0.8} metalness={0.05} /></instancedMesh>;
}
function Rail({ x, z, length, vertical = false }: { x: number; z: number; length: number; vertical?: boolean }) {
  return <group position={[x, 0.12, z]} rotation={[0, vertical ? Math.PI / 2 : 0, 0]}>
    <RoundedBox args={[length, 0.5, 0.52]} radius={0.1} smoothness={2} castShadow receiveShadow><meshStandardMaterial color="#343c45" roughness={0.48} metalness={0.6} /></RoundedBox>
    <RoundedBox args={[length - 0.1, 0.1, 0.45]} position={[0, 0.28, 0]} radius={0.03} smoothness={1}><meshStandardMaterial color="#e1ddd3" roughness={0.57} metalness={0.15} /></RoundedBox>
    {Array.from({ length: Math.max(1, Math.floor(length / 2)) }, (_, i) => <mesh key={i} position={[-length / 2 + 1 + i * 2, 0, 0.27]}><boxGeometry args={[1.35, 0.095, 0.012]} /><meshStandardMaterial color="#ffad3f" emissive="#ff830a" emissiveIntensity={2.2} /></mesh>)}
  </group>;
}
export function ArenaStage({ layout, ringRadius, controlOwner }: { readonly layout: ArenaLayout; readonly ringRadius: number; readonly controlOwner: 'A' | 'B' | 'neutral' }) {
  const texture = useFloor(), { width, depth, objective } = layout;
  const cols = Math.ceil(width), rows = Math.ceil(depth);
  return <group name="arena-stage">
    <mesh position={[0, -0.45, 0]} receiveShadow><boxGeometry args={[width + 2, 0.7, depth + 2]} /><meshStandardMaterial color="#303b43" roughness={0.7} metalness={0.3} /></mesh>
    <FloorPanels width={width} depth={depth} cols={cols} rows={rows} texture={texture} />
    {[-1, 1].flatMap(sign => [<Rail key={`x${sign}`} x={sign * (width / 2 + 0.3)} z={0} length={depth + 0.5} vertical />, <Rail key={`z${sign}`} x={0} z={sign * (depth / 2 + 0.3)} length={width + 0.5} />])}
    {layout.props.map((prop, i) => <group key={i} position={[prop.x, prop.height / 2, prop.z]}><RoundedBox args={[prop.width, prop.height, prop.depth]} radius={0.12} smoothness={2} castShadow receiveShadow><meshStandardMaterial color="#35414a" metalness={0.6} roughness={0.55} /></RoundedBox><RoundedBox args={[prop.width * 0.85, 0.12, prop.depth * 0.85]} position={[0, prop.height / 2, 0]} radius={0.04} smoothness={1}><meshStandardMaterial color="#e8e3d7" roughness={0.7} /></RoundedBox></group>)}
    <mesh name="objective" position={[objective.x, 0.012, objective.z]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[Math.max(0, objective.radius - 0.035), objective.radius + 0.035, 128]} /><meshBasicMaterial color={controlOwner === 'A' ? '#f27b59' : controlOwner === 'B' ? '#28a6b7' : '#edaa31'} /></mesh>
    {ringRadius > 0 && <mesh name="gameplay-ring" position={[0, 0.023, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[Math.max(0, ringRadius - 0.04), ringRadius + 0.04, 160]} /><meshBasicMaterial color="#e26553" /></mesh>}
  </group>;
}
