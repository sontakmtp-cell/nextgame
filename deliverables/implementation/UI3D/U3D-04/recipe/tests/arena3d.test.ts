import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { PublicActor, PublicFrame, PublicModule } from '../packages/contracts/src/index.js';
import { sampleArena, shieldRadius, moduleWorld } from '../packages/renderer3d/src/arena-sample.js';
import { ruleset } from '../packages/content/dist/index.js';
import { replayArenaLayout } from '../apps/web/src/arena-layout.js';
import { ArenaAudio } from '../packages/presentation/dist/index.js';
const footprints = { core: 2, burst: 1, shield: 1 };
const modules: PublicModule[] = [
  { ordinal: 7, catalogId: 'core', x: 3, y: 4, orientation: 0, hp: 800, status: 'alive', phase: 'idle', phaseOffset: 0, aim: 0, shield: false },
  { ordinal: 2, catalogId: 'burst', x: 5, y: 4, orientation: 1, hp: 180, status: 'alive', phase: 'windup', phaseOffset: 0, aim: 64, shield: false },
  { ordinal: 5, catalogId: 'shield', x: 3, y: 6, orientation: 3, hp: 260, status: 'alive', phase: 'idle', phaseOffset: 0, aim: 0, shield: true }
];
const actor: PublicActor = { pose: { x: 1000, y: 2000, heading: 4090 }, modules, overheated: false, controlTicks: 0 };
const frames: PublicFrame[] = Array.from({ length: 50 }, (_, i) => ({ boundary: i, actors: { A: { ...actor, pose: { x: 1000 + i * 100, y: 2000, heading: (4090 + i * 12) % 4096 }, modules: modules.map(m => ({ ...m, status: m.ordinal === 2 && i >= 20 ? 'destroyed' : m.status, hp: m.ordinal === 2 && i >= 20 ? 0 : m.hp, phaseOffset: m.ordinal === 2 ? i : 0 })) }, B: structuredClone(actor) }, projectiles: i >= 3 && i < 20 ? [{ ordinal: 5, owner: 'B', x: i * 1000, y: 500, heading: 4090 }] : [], controlOwner: i < 10 ? 'neutral' : 'A', ringRadius: 25000 - i * 50, events: i === 1 ? [{ tick: 0, kind: 'activation', actor: 'A', module: 2, target: 0, key: 0, value: 18 }] : i === 20 ? [{ tick: 19, kind: 'destroyed', actor: 'A', module: 2, target: 0, key: 2, value: 0 }, { tick: 19, kind: 'hit', actor: 'B', module: 5, target: 2, key: 3, value: 32 }] : [] }));
const sample = (position: number, vfx = true) => sampleArena(frames, position, footprints, 'high', vfx, false)!;
describe('U3D-04 public replay projection', () => {
  it('matches the pinned arena init without changing the gameplay authority', () => {
    expect(replayArenaLayout.width * 1000).toBe(ruleset.arena.width);
    expect(replayArenaLayout.depth * 1000).toBe(ruleset.arena.height);
    expect(replayArenaLayout.objective.radius * 1000).toBe(ruleset.arena.controlRadius);
  });
  it('interpolates poses across heading wrap and projectiles by identity; discrete state changes at exact boundary', () => {
    expect(sample(.5).actors[0]!.pose.x).toBe(1.05);
    expect(sample(.5).actors[0]!.pose.yaw).toBeCloseTo(Math.PI * 2);
    expect(sample(2.999).projectiles).toHaveLength(0);
    expect(sample(3.5).projectiles[0]!.x).toBe(3.5);
    expect(sample(19.999).actors[0]!.modules.find(m => m.ordinal === 2)!.status).toBe('alive');
    expect(sample(20).actors[0]!.modules.find(m => m.ordinal === 2)!.status).toBe('destroyed');
    expect(sample(19.999).effects).toHaveLength(0);
    expect(sample(20).effects).toHaveLength(2);
    expect(sample(19.999).projectiles).toHaveLength(1);
    expect(sample(20).projectiles).toHaveLength(0);
  });
  it('gets windup duration from the engine activation and phaseOffset; VFX off keeps telegraphs/shield/projectiles/ring', () => {
    expect(sample(9).actors[0]!.modules.find(m => m.ordinal === 2)!.progress).toBe(.5);
    const off = sample(9, false);
    expect(off.actors).toEqual(sample(9).actors); expect(off.projectiles).toEqual(sample(9).projectiles); expect(off.frame.ringRadius).toBe(24550);
    expect(sample(20, false).effects).toEqual([]);
  });
  it('uses public ordinals rather than array index for event location and holds original Core origin after destruction', () => {
    expect(moduleWorld(actor, modules[1]!, footprints)).toEqual(moduleWorld({ ...actor, modules: [...modules].reverse() }, modules[1]!, footprints));
    expect(sample(20).effects[0]!.x).toBeCloseTo(sample(20).effects[1]!.x);
    expect(shieldRadius(actor, footprints)).toBe(Math.ceil(Math.sqrt(5) * 1000) / 1000 + .25);
  });
  it('reconstructs all visual state independently of 100 random seek orders without mutating frames', () => {
    const before = JSON.stringify(frames), target = sample(20.5);
    for (let i = 0; i < 100; i++) { sample((i * 3571 % 4900) / 100); expect(sample(20.5)).toEqual(target); }
    expect(JSON.stringify(frames)).toBe(before);
    expect(sample(-1).position).toBe(0); expect(sample(Infinity).position).toBe(0); expect(sample(999).position).toBe(49);
    expect(sampleArena([], 0, footprints, 'high', true, false)).toBeNull();
  });
  it('keeps distinct flashes when the engine emits two hits with the same attack key at one boundary', () => {
    const duplicate = structuredClone(frames); duplicate[20]!.events.push({ ...duplicate[20]!.events[1]! });
    const effects = sampleArena(duplicate, 20, footprints, 'high', true, false)!.effects;
    expect(new Set(effects.map(e => e.id)).size).toBe(effects.length);
  });
  it('keeps private replay fields outside Arena3D and Pixi out of eager Arena imports', () => {
    const arena = readFileSync('apps/web/src/Arena.tsx', 'utf8'), scene = readFileSync('apps/web/src/Arena3D.tsx', 'utf8');
    expect(scene).not.toMatch(/LocalReplay|owner\.|replay\.source|Brain/);
    expect(arena).toContain("import { ArenaAudio } from '@prompt-chien/presentation'");
    expect(arena).toContain("import('@prompt-chien/renderer')");
    expect(arena).not.toContain('import { ArenaRenderer');
  });
  it('audio playhead stop/seek never replays events crossed by a seek, and speed >1 suppresses dense audio', () => {
    const audio = new ArenaAudio();
    // Real play() cursor logic, substitute only WebAudio output in this unit test.
    const runtime = audio as unknown as { context: object; master: object; event: (event: unknown) => void };
    runtime.context = {}; runtime.master = {}; const heard: unknown[] = []; runtime.event = e => heard.push(e);
    audio.stop(20); audio.play(frames, 20, 1); expect(heard).toHaveLength(0);
    audio.stop(0); audio.play(frames, 1, 1); expect(heard).toHaveLength(1);
    audio.play(frames, 1, 1); expect(heard).toHaveLength(1);
    audio.stop(0); audio.play(frames, 20, 2); expect(heard).toHaveLength(1);
    audio.play(frames, 2, 1); expect(heard).toHaveLength(1);
  });
});
