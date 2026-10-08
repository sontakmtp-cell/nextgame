import type { PublicActor, PublicModule, PublicFrame } from '@prompt-chien/contracts';
import type { DeepReadonly, Quality } from './interfaces.js';
import { interpolatedPose, publicBody, moduleTransform, TAU } from './geometry.js';
export const teamColor = { A: '#f27b59', B: '#38cbd5' } as const;
type Frames = DeepReadonly<readonly PublicFrame[]>;
export function clampPosition(frames: Frames, position: number) {
  return Math.max(0, Math.min(Math.max(0, frames.length - 1), Number.isFinite(position) ? position : 0));
}
export function moduleWorld(actor: DeepReadonly<PublicActor>, module: DeepReadonly<PublicModule>, footprints: Readonly<Record<string, number>>) {
  const local = moduleTransform(publicBody(actor), { id: `public-${module.ordinal}`, catalogId: module.catalogId, cell: { x: module.x, y: module.y }, orientation: module.orientation as 0 | 1 | 2 | 3 }, footprints);
  const yaw = actor.pose.heading * TAU / 4096, c = Math.cos(yaw), s = Math.sin(yaw);
  return { x: actor.pose.x / 1000 + local.x * c + local.z * s, z: -actor.pose.y / 1000 - local.x * s + local.z * c };
}
export function shieldRadius(actor: DeepReadonly<PublicActor>, footprints: Readonly<Record<string, number>>) {
  const core = actor.modules.find(m => m.catalogId === 'core');
  if (!core) return 0;
  const radius = Math.max(...actor.modules.flatMap(m => {
    const f = footprints[m.catalogId] ?? 1;
    return [0, f].flatMap(x => [0, f].map(y => Math.hypot(m.x + x - core.x - 1, m.y + y - core.y - 1)));
  }));
  return Math.ceil(radius * 1000) / 1000 + .25;
}
// Stateless projection: births, deaths and discrete phases come only from the
// lower boundary. Never look ahead for status or consume an event queue.
export function sampleArena(frames: Frames, requested: number, footprints: Readonly<Record<string, number>>, quality: Quality, vfx: boolean, reducedMotion: boolean) {
  const position = clampPosition(frames, requested), index = Math.floor(position), fraction = position - index;
  const frame = frames[index], next = frames[Math.min(index + 1, frames.length - 1)];
  if (!frame || !next) return null;
  const actors = (['A', 'B'] as const).map(team => ({ team, state: frame.actors[team], pose: interpolatedPose(frame.actors[team], next.actors[team], fraction), shieldRadius: shieldRadius(frame.actors[team], footprints), modules: frame.actors[team].modules.map(m => {
    let windupTicks = 0;
    if (m.phase === 'windup') for (let n = index; n >= Math.max(0, index - m.phaseOffset - 2); n--) {
      const activation = frames[n]!.events.find(e => e.kind === 'activation' && e.actor === team && e.module === m.ordinal);
      if (activation) { windupTicks = activation.value; break; }
    }
    return { ordinal: m.ordinal, hp: m.hp, status: m.status, phase: m.phase, phaseOffset: m.phaseOffset, aim: m.aim,
      progress: windupTicks > 0 ? Math.min(1, (m.phaseOffset + fraction) / windupTicks) : 0 };
  }) }));
  const projectiles = frame.projectiles.map(p => {
    const b = next.projectiles.find(q => q.ordinal === p.ordinal && q.owner === p.owner) ?? p;
    return { ordinal: p.ordinal, team: p.owner, x: (p.x + (b.x - p.x) * fraction) / 1000, z: -(p.y + (b.y - p.y) * fraction) / 1000, yaw: p.heading * TAU / 4096 };
  });
  const effects: { id: string; kind: string; team: 'A' | 'B'; x: number; z: number; age: number; seed: number }[] = [];
  const cap = quality === 'high' ? 64 : quality === 'medium' ? 24 : 8;
  if (vfx && !reducedMotion) for (let n = index; n >= Math.max(0, index - 36) && effects.length < cap; n--) {
    for (const [eventIndex, e] of frames[n]!.events.entries()) {
      if (!['hit', 'blocked', 'destroyed', 'detached', 'shot'].includes(e.kind) || e.actor === 'world') continue;
      const team = e.kind === 'hit' ? (e.actor === 'A' ? 'B' : 'A') : e.actor;
      const actor = frames[n]!.actors[team], ordinal = e.kind === 'hit' ? e.target : e.module, module = actor.modules.find(m => m.ordinal === ordinal);
      if (!module) continue;
      const age = frame.boundary + fraction - frames[n]!.boundary;
      const lifetime = e.kind === 'destroyed' || e.kind === 'detached' ? 36 : e.kind === 'shot' ? 5 : 14;
      if (age >= lifetime) continue;
      effects.push({ id: `${n}/${eventIndex}/${e.kind}/${team}/${ordinal}/${e.key}`, kind: e.kind, team, ...moduleWorld(actor, module, footprints), age, seed: e.key * 31 + ordinal * 17 + e.tick });
      if (effects.length === cap) break;
    }
  }
  let ringNotice = false;
  for (let n = index; n >= Math.max(0, index - 120); n--) if (frames[n]!.events.some(e => e.kind === 'ringNotice')) { ringNotice = true; break; }
  return { position, index, fraction, boundary: frame.boundary, time: (frame.boundary + fraction) / 60, frame, actors, projectiles, effects, ringNotice };
}
export type ArenaSample = NonNullable<ReturnType<typeof sampleArena>>;
