import { describe, it, expect } from 'vitest';
import { ARENA_INIT_PRESETS, deriveScenarioFromSeed } from '../src/index.js';

describe('Content - Arena Init Presets & Scenario Derivation', () => {
  it('generates exactly 1,225 distinct arena presets', () => {
    expect(ARENA_INIT_PRESETS).toHaveLength(1225);
  });

  it('guarantees unique scenarioId for all 1,225 presets', () => {
    const ids = new Set(ARENA_INIT_PRESETS.map(p => p.scenarioId));
    expect(ids.size).toBe(1225);
  });

  it('keeps all coordinate and jitter values within documented bounds', () => {
    for (const preset of ARENA_INIT_PRESETS) {
      expect(preset.yLeft).toBeGreaterThanOrEqual(-3000);
      expect(preset.yLeft).toBeLessThanOrEqual(3000);
      expect(preset.yRight).toBeGreaterThanOrEqual(-3000);
      expect(preset.yRight).toBeLessThanOrEqual(3000);
      expect(preset.jitterLeft).toBeGreaterThanOrEqual(-128);
      expect(preset.jitterLeft).toBeLessThanOrEqual(128);
      expect(preset.jitterRight).toBeGreaterThanOrEqual(-128);
      expect(preset.jitterRight).toBeLessThanOrEqual(128);
    }
  });

  it('derives scenarioId deterministically via SHA-256 modulo 1225', () => {
    // 16-byte zero seed
    const seedZeros = new Uint8Array(16);
    const result1 = deriveScenarioFromSeed(seedZeros);
    const result2 = deriveScenarioFromSeed(seedZeros);

    expect(result1.scenarioId).toBe(result2.scenarioId);
    expect(result1.scenarioId).toBeGreaterThanOrEqual(0);
    expect(result1.scenarioId).toBeLessThan(1225);
    expect(result1.preset).toEqual(ARENA_INIT_PRESETS[result1.scenarioId]);

    // 16-byte distinct seed
    const seedOther = new Uint8Array(16);
    seedOther[0] = 0x42;
    seedOther[15] = 0xff;
    const resultOther = deriveScenarioFromSeed(seedOther);
    expect(resultOther.scenarioId).toBeGreaterThanOrEqual(0);
    expect(resultOther.scenarioId).toBeLessThan(1225);
  });
});
