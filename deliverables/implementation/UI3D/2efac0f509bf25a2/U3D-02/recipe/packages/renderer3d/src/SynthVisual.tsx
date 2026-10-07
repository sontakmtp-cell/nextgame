import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Mesh } from 'three';
import type { Group, Material } from 'three';
import { useAssetCache } from './assets.js';
import { useGraphics } from './SceneViewport.js';
import { moduleTransform } from './geometry.js';
import type { SynthVisualProps } from './interfaces.js';
import { CoreLinks } from './CoreLinks.js';
import { baseHoverHeight, hoverHeight } from './hover.js';

type Ghost = SynthVisualProps['body']['modules'][number] | null;
export function SynthVisual(props: SynthVisualProps & { readonly ghost?: Ghost; readonly energyLinks?: boolean; readonly reducedMotion?: boolean }) {
  const cache = useAssetCache(), graphics = useGraphics();
  const elapsed = useRef(0), groups = useRef(new Map<string, Group>()), ghostGroup = useRef<Group>(null);
  const invalidate = useThree(s => s.invalidate), gl = useThree(s => s.gl);
  useFrame((_state, delta) => {
    if (document.hidden || gl.getContext().isContextLost()) return;
    elapsed.current = props.reducedMotion ? 0 : elapsed.current + Math.min(delta, .05);
    for (const module of props.body.modules) {
      const group = groups.current.get(module.id);
      if (group) group.position.y = hoverHeight(module.catalogId, module.id, elapsed.current);
    }
    if (props.ghost && ghostGroup.current) ghostGroup.current.position.y = hoverHeight(props.ghost.catalogId, props.ghost.id, elapsed.current);
    if (!props.reducedMotion && loaded && (groups.current.size || ghostGroup.current)) invalidate();
  }, -1); // Update shells before CoreLinks updates its attachment points.
  useEffect(() => { invalidate(); }, [props.reducedMotion, invalidate]);
  useEffect(() => { const visible = () => { if (!document.hidden) invalidate(); }; document.addEventListener('visibilitychange', visible); return () => document.removeEventListener('visibilitychange', visible); }, [invalidate]);
  const ids = [...new Set([...props.body.modules.map(m => m.catalogId), ...(props.ghost ? [props.ghost.catalogId] : [])])].sort().join(',');
  const [models, setModels] = useState<Readonly<Record<string, Group>>>({});
  const [loaded, setLoaded] = useState('');
  const key = `${props.manifest.assetRevision}/${ids}/${props.quality}`;
  useEffect(() => {
    let active = true, settled = false; graphics.pending(1);
    const finish = () => { if (!settled) { settled = true; graphics.pending(-1); } };
    const load = async () => {
      const modules = ids.split(',').filter(Boolean).map(id => { const module = props.manifest.modules.find(m => m.catalogId === id); if (!module) throw Error(`Manifest thiếu model: ${id}`); return module; });
      const first = props.quality === 'high' ? 'medium' : props.quality;
      const medium = await Promise.all(modules.map(async m => [m.catalogId, await cache.loadModel(props.manifest, m, first)] as const));
      if (!active) return;
      setModels(Object.fromEntries(medium)); setLoaded(first);
      if (props.quality === 'high') {
        const high = await Promise.all(modules.map(async m => [m.catalogId, await cache.loadModel(props.manifest, m, 'high')] as const));
        if (active) { setModels(Object.fromEntries(high)); setLoaded('high'); }
      }
    };
    void load().catch(error => { if (active) graphics.fail(String(error)); }).finally(() => { if (active) finish(); });
    return () => { active = false; finish(); };
  }, [cache, graphics, key, ids, props.manifest, props.quality]);
  // Clone graph nodes, never the expensive geometry or embedded textures.
  const placements = useMemo(() => props.body.modules.map(module => {
    const model = models[module.catalogId]?.clone(true);
    model?.traverse(o => { if (o instanceof Mesh) o.raycast = () => {}; });
    return { module, model, transform: moduleTransform(props.body, module, props.footprintByCatalogId) };
  }), [props.body, models, props.footprintByCatalogId]);
  const ghost = props.ghost ? moduleTransform(props.body, props.ghost, props.footprintByCatalogId) : null;
  const ghostSource = props.ghost ? models[props.ghost.catalogId] : undefined;
  const color = props.team === 'B' ? '#42c9d5' : props.team === 'A' ? '#ff8158' : '#46c9bd';
  return <group name={`synth-${props.team}-${loaded}`}>
    {loaded && props.energyLinks !== false && <CoreLinks {...props} motionClock={elapsed} />}
    {placements.map(({ module, model, transform: t }) => {
      const state = props.publicState?.modules.find(m => `public-${m.ordinal}` === module.id);
      if (state && state.status !== 'alive') return null;
      const selected = props.selectedModuleId === module.id;
      return <group key={module.id} ref={group => { if (group) groups.current.set(module.id, group); else groups.current.delete(module.id); }} name={`module-${module.id}`} userData={{ catalogId: module.catalogId }} position={[t.x, baseHoverHeight(module.catalogId), t.z]} rotation={[0, t.yaw, 0]}>
        {model && <primitive object={model} dispose={null} />}
        <mesh name={`pick-${module.id}`} position={[0, 0.07, 0]} onClick={event => { if (event.button !== 0) return; event.stopPropagation(); props.onSelectModule({ moduleId: module.id }); }}>
          <boxGeometry args={[t.footprint, 0.16, t.footprint]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
        {selected && <Selection footprint={t.footprint} color="#24c8b7" />}
        {props.team !== 'preview' && <mesh position={[0, 0.035, t.footprint / 2 + 0.07]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.045, 0.095, props.team === 'B' ? 4 : 24]} /><meshBasicMaterial color={color} /></mesh>}
        {module.catalogId === 'core' && <mesh position={[0, 0.017, t.footprint / 2 + 0.1]}><boxGeometry args={[1.1, 0.035, 0.045]} /><meshBasicMaterial color={color} /></mesh>}
      </group>;
    })}
    {ghost && props.ghost && <group ref={ghostGroup} name="ghost-preview" position={[ghost.x, baseHoverHeight(props.ghost.catalogId), ghost.z]} rotation={[0, ghost.yaw, 0]}>{ghostSource && <GhostModel source={ghostSource} />}<Selection footprint={ghost.footprint} color="#44f9d5" /></group>}
  </group>;
}
function GhostModel({ source }: { source: Group }) {
  const { model, materials } = useMemo(() => {
    const model = source.clone(true), materials: Material[] = [];
    model.traverse(object => { if (object instanceof Mesh) { const tint = (source: Material) => { const material = source.clone(); material.transparent = true; material.opacity = 0.45; material.depthWrite = false; if ('color' in material && typeof material.color === 'object' && material.color && 'set' in material.color) (material.color as { set: (color: string) => void }).set('#43ffdf'); materials.push(material); return material; }; object.material = Array.isArray(object.material) ? object.material.map(tint) : tint(object.material); object.castShadow = false; object.raycast = () => {}; } });
    return { model, materials };
  }, [source]);
  useEffect(() => () => { materials.forEach(m => m.dispose()); }, [materials]);
  return <primitive object={model} dispose={null} />;
}
function Selection({ footprint, color }: { footprint: number; color: string }) {
  return <group>{[-1, 1].flatMap(sign => [<mesh key={`x${sign}`} position={[sign * footprint / 2, 0.018, 0]}><boxGeometry args={[0.022, 0.024, footprint]} /><meshBasicMaterial color={color} /></mesh>, <mesh key={`z${sign}`} position={[0, 0.018, sign * footprint / 2]}><boxGeometry args={[footprint, 0.024, 0.022]} /><meshBasicMaterial color={color} /></mesh>])}</group>;
}
