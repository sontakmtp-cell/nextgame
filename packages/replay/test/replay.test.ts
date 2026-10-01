import { describe, it, expect } from 'vitest';
import {
  buildMatchReplay,
  seekReplayTick,
  verifyReplayIntegrity,
} from '../src/index.js';
import { MatchManifest, ReplayFrame } from '@nextgame/contracts';

describe('Replay - Codec, Chunks, Seek & Integrity (T06)', () => {
  const mockManifest: MatchManifest = {
    engineDigest: 'sha256:alpha0_engine_v2',
    rulesetDigest: 'sha256:alpha0_ruleset_v2',
    catalogDigest: 'sha256:alpha0_catalog_v2',
    brainAbiVersion: '2.0',
    packageHashA: 'hash_a',
    packageHashB: 'hash_b',
    seed: 'seed1234',
    scenarioId: 0,
    presetValues: { yLeft: 0, yRight: 0, jitterLeft: 0, jitterRight: 0 },
    spawnSlotAssignment: 'leg0_standard',
    maxTicks: 5400,
  };

  // Generate 150 test frames (spanning 3 chunks of 60 ticks each: [0..59], [60..119], [120..149])
  const dummyFrames: ReplayFrame[] = Array.from({ length: 150 }, (_, i) => ({
    tick: i,
    poses: {
      botA: { x: -12000 + i * 10, y: 0, heading: 0, vx: 600, vy: 0 },
      botB: { x: 12000 - i * 10, y: 0, heading: 2048, vx: -600, vy: 0 },
    },
    resources: {
      botA: { energy: 1000 - i, heat: i, coreHp: 800, isOverheated: false },
      botB: { energy: 1000 - i, heat: i, coreHp: 800, isOverheated: false },
    },
    events: [],
  }));

  it('builds valid chunked replay with 60 ticks per chunk', () => {
    const replay = buildMatchReplay(mockManifest, dummyFrames, { winner: 'botA', reason: 'core' });
    expect(replay.totalTicks).toBe(150);
    expect(replay.chunkCount).toBe(3);
    expect(replay.chunks[0].frames).toHaveLength(60);
    expect(replay.chunks[1].frames).toHaveLength(60);
    expect(replay.chunks[2].frames).toHaveLength(30);
    expect(replay.publicReplayHash).toHaveLength(64);
  });

  it('seeks to arbitrary tick accurately matching straight playback', () => {
    const replay = buildMatchReplay(mockManifest, dummyFrames, { winner: 'botA', reason: 'core' });

    // Seek tick 0
    const frame0 = seekReplayTick(replay, 0);
    expect(frame0?.tick).toBe(0);
    expect(frame0?.poses.botA.x).toBe(-12000);

    // Seek tick 75 (in chunk 1)
    const frame75 = seekReplayTick(replay, 75);
    expect(frame75?.tick).toBe(75);
    expect(frame75?.poses.botA.x).toBe(-12000 + 750);

    // Seek tick 149 (in chunk 2)
    const frame149 = seekReplayTick(replay, 149);
    expect(frame149?.tick).toBe(149);

    // Seek invalid tick
    expect(seekReplayTick(replay, 999)).toBeNull();
  });

  it('verifies replay integrity and rejects tampered frames', () => {
    const replay = buildMatchReplay(mockManifest, dummyFrames, { winner: 'botA', reason: 'core' });
    const verifyValid = verifyReplayIntegrity(replay);
    expect(verifyValid.isValid).toBe(true);

    // Tamper with a frame in chunk 0
    replay.chunks[0].frames[5].poses.botA.x = 999999;
    const verifyTampered = verifyReplayIntegrity(replay);
    expect(verifyTampered.isValid).toBe(false);
    expect(verifyTampered.error).toMatch(/mismatch/i);
  });
});
