import { describe, it, expect } from 'vitest';
import { MatchSimulation } from '../src/index.js';
import { MatchManifest } from '@nextgame/contracts';
import { REFERENCE_BOTS, ARENA_INIT_PRESETS } from '@nextgame/content';

describe('Engine - Deterministic Match Simulation (T04, T05)', () => {
  const botA = REFERENCE_BOTS.mantis;
  const botB = REFERENCE_BOTS.bastion;

  const mockManifest: MatchManifest = {
    engineDigest: 'sha256:alpha0_engine_v2',
    rulesetDigest: 'sha256:alpha0_ruleset_v2',
    catalogDigest: 'sha256:alpha0_catalog_v2',
    brainAbiVersion: '2.0',
    packageHashA: 'mock_hash_a',
    packageHashB: 'mock_hash_b',
    seed: '1234567890abcdef1234567890abcdef',
    scenarioId: 0,
    presetValues: ARENA_INIT_PRESETS[0],
    spawnSlotAssignment: 'leg0_standard',
    maxTicks: 5400,
  };

  it('runs match to completion and produces valid outcome', () => {
    const sim = new MatchSimulation(mockManifest, botA, botB);
    const outcome = sim.runToCompletion();

    expect(outcome).toBeDefined();
    expect(['botA', 'botB', 'draw']).toContain(outcome.winner);
    expect(sim.tick).toBeGreaterThan(0);
    expect(sim.tick).toBeLessThanOrEqual(5400);
    expect(sim.replayFrames.length).toBe(sim.tick);
  });

  it('guarantees 100% deterministic bit-parity across multiple runs with identical seed', () => {
    const sim1 = new MatchSimulation(mockManifest, botA, botB);
    const sim2 = new MatchSimulation(mockManifest, botA, botB);

    const outcome1 = sim1.runToCompletion();
    const outcome2 = sim2.runToCompletion();

    expect(outcome1).toEqual(outcome2);
    expect(sim1.tick).toBe(sim2.tick);
    expect(sim1.objectives.controlTicksA).toBe(sim2.objectives.controlTicksA);
    expect(sim1.objectives.controlTicksB).toBe(sim2.objectives.controlTicksB);
    expect(sim1.botA.kinematics.x).toBe(sim2.botA.kinematics.x);
    expect(sim1.botA.kinematics.y).toBe(sim2.botA.kinematics.y);
    expect(sim1.botB.kinematics.x).toBe(sim2.botB.kinematics.x);
    expect(sim1.botB.kinematics.y).toBe(sim2.botB.kinematics.y);
  });

  it('handles slot swapping (leg0 vs leg1) properly', () => {
    const swappedManifest: MatchManifest = {
      ...mockManifest,
      spawnSlotAssignment: 'leg1_swapped',
    };

    const sim = new MatchSimulation(swappedManifest, botA, botB);
    // In leg1_swapped, botA spawns on the right (+12000) and botB on the left (-12000)
    expect(sim.botA.kinematics.x).toBe(12_000);
    expect(sim.botB.kinematics.x).toBe(-12_000);
  });
});
