import { sha256 } from '@nextgame/contracts';

export interface ArenaPreset {
  scenarioId: number; // 0..1224
  yLeft: number;      // -3000..3000 milli-units
  yRight: number;     // -3000..3000 milli-units
  jitterLeft: number; // -128..128 angle units
  jitterRight: number;// -128..128 angle units
}

const Y_VALUES = [-3000, -2000, -1000, 0, 1000, 2000, 3000];
const JITTER_VALUES = [-128, -64, 0, 64, 128];

/**
 * Generates the full 1,225 Cartesian product presets lexicographically
 */
export function generateArenaPresets(): ArenaPreset[] {
  const presets: ArenaPreset[] = [];
  let scenarioId = 0;

  for (const yLeft of Y_VALUES) {
    for (const yRight of Y_VALUES) {
      for (const jitterLeft of JITTER_VALUES) {
        for (const jitterRight of JITTER_VALUES) {
          presets.push({
            scenarioId,
            yLeft,
            yRight,
            jitterLeft,
            jitterRight,
          });
          scenarioId++;
        }
      }
    }
  }

  return presets;
}

export const ARENA_INIT_PRESETS: ArenaPreset[] = generateArenaPresets();

/**
 * Derives scenarioId from a 16-byte seed according to 02_GAMEPLAY.md:
 * scenarioId = firstUint32LE(SHA256(seedBytes || "open-alpha-init-v1")) mod 1225
 */
export function deriveScenarioFromSeed(seedBytes: Uint8Array): { scenarioId: number; preset: ArenaPreset } {
  const suffix = new Uint8Array([
    111, 112, 101, 110, 45, 97, 108, 112, 104, 97, 45, 105, 110, 105, 116, 45, 118, 49
  ]); // 'open-alpha-init-v1' ASCII
  const combined = new Uint8Array(seedBytes.length + suffix.length);
  combined.set(seedBytes, 0);
  combined.set(suffix, seedBytes.length);

  const hashHex = sha256(combined);
  const b0 = parseInt(hashHex.slice(0, 2), 16);
  const b1 = parseInt(hashHex.slice(2, 4), 16);
  const b2 = parseInt(hashHex.slice(4, 6), 16);
  const b3 = parseInt(hashHex.slice(6, 8), 16);
  const firstUint32 = (b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)) >>> 0;
  const scenarioId = firstUint32 % 1225;

  return {
    scenarioId,
    preset: ARENA_INIT_PRESETS[scenarioId],
  };
}
