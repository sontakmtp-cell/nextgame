import { useLayoutEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import type { InstancedMesh } from 'three';
import { Billboard, Line } from '@react-three/drei';
import { Color, DoubleSide, Object3D } from 'three';
import { moduleTransform, publicBody, TAU } from './geometry.js';
import { teamColor } from './arena-sample.js';
import type { ArenaSample } from './arena-sample.js';
type Point = [number, number, number];
function arc(radius: number, heading: number, y: number, center: Point = [0, 0, 0]): Point[] {
  return Array.from({ length: 25 }, (_, i) => { const angle = heading - Math.PI / 4 + i / 24 * Math.PI / 2; return [center[0] + Math.cos(angle) * radius, y, center[2] - Math.sin(angle) * radius]; });
}
export function ArenaCombat({ sample, footprints, maxHp, vfx, reduced }: { sample: ArenaSample; footprints: Readonly<Record<string, number>>; maxHp: Readonly<Record<string, number>>; vfx: boolean; reduced: boolean }) {
  return <group name="combat-public">
    {sample.actors.map(a => { const body = publicBody(a.state); return <group key={a.team} name={`state-${a.team}`} position={[a.pose.x, 0, a.pose.z]} rotation={[0, a.pose.yaw, 0]}>
      <mesh name={`team-marker-${a.team}`} position={[0, .04, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.1, 1.16, a.team === 'A' ? 32 : 6]} /><meshBasicMaterial color={teamColor[a.team]} side={DoubleSide} /></mesh>
      {a.state.modules.map(m => {
        if (m.status !== 'alive') return null;
        const placement = body.modules.find(p => p.id === `public-${m.ordinal}`)!, t = moduleTransform(body, placement, footprints);
        const hp = Math.max(0, Math.min(1, m.hp / (maxHp[m.catalogId] ?? (m.catalogId === 'core' ? 800 : 300))));
        const heading = (m.orientation * 1024 + m.aim) * TAU / 4096;
        const offset = .501 / Math.max(Math.abs(Math.cos(m.aim * TAU / 4096)), Math.abs(Math.sin(m.aim * TAU / 4096)));
        const center: Point = [t.x + Math.cos(heading) * offset, 2.15, t.z - Math.sin(heading) * offset];
        const active = m.phase === 'active', telegraph = m.phase === 'windup' || active;
        const progress = a.modules.find(p => p.ordinal === m.ordinal)!.progress;
        return <group key={m.ordinal}>
          <Billboard position={[t.x, m.catalogId === 'core' ? 3.1 : 2.65, t.z]}><mesh name={`hp-${a.team}-${m.ordinal}`}><planeGeometry args={[t.footprint * .72, .075]} /><meshBasicMaterial color="#243947" /></mesh><mesh position={[(hp - 1) * t.footprint * .36, 0, .002]}><planeGeometry args={[Math.max(.001, hp * t.footprint * .72), .075]} /><meshBasicMaterial color={hp < .3 ? '#bb3045' : teamColor[a.team]} /></mesh></Billboard>
          {telegraph && m.catalogId === 'burst' && <Line name={`telegraph-${a.team}-${m.ordinal}`} points={[center, [center[0] + Math.cos(heading) * 12, center[1], center[2] - Math.sin(heading) * 12]]} color={active ? '#fff6d1' : '#ba7a0b'} lineWidth={active ? 3 : 2} dashed={!active} dashSize={.3} gapSize={.15} />}
          {telegraph && m.catalogId === 'blade' && <Line name={`telegraph-${a.team}-${m.ordinal}`} points={[center, ...arc(1.5, heading, center[1], center), center]} color={active ? '#fff6d1' : '#ba7a0b'} lineWidth={active ? 3 : 2} />}
          {telegraph && <mesh name={`phase-${a.team}-${m.ordinal}`} userData={{ phase: m.phase, phaseOffset: m.phaseOffset, progress, aim: m.aim }} position={[t.x, 2.2, t.z]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.32, .38, 32, 1, 0, active ? TAU : Math.max(.02, progress * TAU)]} /><meshBasicMaterial color={active ? '#fff6d1' : '#b67909'} side={DoubleSide} /></mesh>}
          {m.shield && <group name={`shield-${a.team}-${m.ordinal}`}><Line points={arc(a.shieldRadius, m.orientation * Math.PI / 2, 1.8)} color={teamColor[a.team]} lineWidth={4} /><Line points={arc(a.shieldRadius, m.orientation * Math.PI / 2, .25)} color={teamColor[a.team]} lineWidth={2} />{[0, 6, 12, 18, 24].map(i => { const p = arc(a.shieldRadius, m.orientation * Math.PI / 2, .25)[i]!; return <Line key={i} points={[p, [p[0], 1.8, p[2]]]} color={teamColor[a.team]} lineWidth={1.5} transparent opacity={.55} />; })}</group>}
        </group>;
      })}
      {a.state.overheated && <mesh name={`overheated-${a.team}`} position={[0, .08, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.25, 1.33, 3]} /><meshBasicMaterial color="#b62436" side={DoubleSide} /></mesh>}
    </group>; })}
    <ProjectileBatch sample={sample} trails={vfx && !reduced} />
    <DebrisBatch sample={sample} />
    {sample.effects.map(e => <group key={e.id} name={`effect-${e.id}`} position={[e.x, 1.65, e.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.12 + e.age * .025, .16 + e.age * .025, 16]} /><meshBasicMaterial color={e.kind === 'blocked' ? teamColor[e.team] : '#f1a02f'} transparent opacity={Math.max(0, 1 - e.age / 36)} side={DoubleSide} depthWrite={false} /></mesh>
    </group>)}
    {sample.ringNotice && <mesh name="ring-notice" position={[0, .03, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[sample.frame.ringRadius / 1000 - .12, sample.frame.ringRadius / 1000 + .12, 160]} /><meshBasicMaterial color="#ba7a0b" side={DoubleSide} /></mesh>}
  </group>;
}

// Batch cosmetic geometry: 128 projectiles and up to 256 fragments share
// three draw calls. Transform buffers are reconstructed from the public sample.
function ProjectileBatch({ sample, trails }: { sample: ArenaSample; trails: boolean }) {
  const spheres = useRef<InstancedMesh>(null), tails = useRef<InstancedMesh>(null), invalidate = useThree(s => s.invalidate);
  useLayoutEffect(() => {
    const object = new Object3D(), color = new Color();
    for (const mesh of [spheres.current, tails.current]) if (mesh) mesh.count = sample.projectiles.length;
    sample.projectiles.forEach((p, i) => {
      object.position.set(p.x, 1.75, p.z); object.rotation.set(0, p.yaw, 0); object.scale.set(1, 1, 1); object.updateMatrix(); spheres.current?.setMatrixAt(i, object.matrix);
      object.position.x -= Math.cos(p.yaw) * .18; object.position.z += Math.sin(p.yaw) * .18; object.updateMatrix(); tails.current?.setMatrixAt(i, object.matrix); tails.current?.setColorAt(i, color.set(teamColor[p.team]));
    });
    for (const mesh of [spheres.current, tails.current]) if (mesh) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere(); }
    invalidate();
  }, [sample.projectiles, invalidate]);
  return <group>
    {sample.projectiles.map(p => <group key={`${p.team}/${p.ordinal}`} name={`projectile-${p.team}-${p.ordinal}`} position={[p.x, 1.75, p.z]} userData={{ batch: 'public-projectile-batch' }} />)}
    <instancedMesh ref={spheres} name="public-projectile-batch" args={[undefined, undefined, 128]}><sphereGeometry args={[.09, 8, 6]} /><meshBasicMaterial color="#fff1bc" /></instancedMesh>
    <instancedMesh ref={tails} name="projectile-trail-batch" args={[undefined, undefined, 128]} visible={trails}><boxGeometry args={[.35, .025, .025]} /><meshBasicMaterial /></instancedMesh>
  </group>;
}
function DebrisBatch({ sample }: { sample: ArenaSample }) {
  const mesh = useRef<InstancedMesh>(null), invalidate = useThree(s => s.invalidate);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const object = new Object3D(), color = new Color(); let index = 0;
    for (const e of sample.effects) if (e.kind === 'destroyed' || e.kind === 'detached') for (let i = 0; i < 4; i++) {
      const angle = (e.seed + i * 1.618) * 2.4, age = e.age / 60;
      object.position.set(e.x + Math.cos(angle) * age * 2, 1.65 + Math.sin(age * Math.PI) * .6 - age, e.z + Math.sin(angle) * age * 2);
      object.rotation.set(angle + age * 3, angle, age * 2); object.scale.setScalar(Math.max(.001, 1 - e.age / 36)); object.updateMatrix();
      mesh.current.setMatrixAt(index, object.matrix); mesh.current.setColorAt(index++, color.set(e.kind === 'detached' ? '#899da7' : '#343b43'));
    }
    mesh.current.count = index; mesh.current.instanceMatrix.needsUpdate = true; if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true; mesh.current.computeBoundingSphere(); invalidate();
  }, [sample.effects, invalidate]);
  return <instancedMesh ref={mesh} name="deterministic-debris-batch" args={[undefined, undefined, 256]}><boxGeometry args={[.15, .1, .12]} /><meshStandardMaterial /></instancedMesh>;
}
