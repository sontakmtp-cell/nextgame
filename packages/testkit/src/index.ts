import { BotDefinition, BrainSource, ModulePlacement } from '@nextgame/contracts';
import { REFERENCE_BOTS } from '@nextgame/content';

// 1. Positive Reference Bot Fixtures
export const VALID_MANTIS: BotDefinition = REFERENCE_BOTS.mantis;
export const VALID_BASTION: BotDefinition = REFERENCE_BOTS.bastion;
export const VALID_KESTREL: BotDefinition = REFERENCE_BOTS.kestrel;

// 2. Negative Bot Fixtures for Geometry & Rule Boundaries

// Missing Core
export const INVALID_BOT_NO_CORE: BotDefinition = {
  ...VALID_MANTIS,
  body: {
    grid: 'square-12-v1',
    modules: VALID_MANTIS.body.modules.filter((m: ModulePlacement) => m.catalogId !== 'core'),
  },
};

// Multiple Cores
export const INVALID_BOT_MULTIPLE_CORES: BotDefinition = {
  ...VALID_MANTIS,
  body: {
    grid: 'square-12-v1',
    modules: [
      ...VALID_MANTIS.body.modules,
      { id: 'core_extra', catalogId: 'core', cell: { x: 0, y: 0 }, orientation: 0 },
    ],
  },
};

// Module Overlap (two modules on cell 5, 5)
export const INVALID_BOT_OVERLAP: BotDefinition = {
  ...VALID_MANTIS,
  body: {
    grid: 'square-12-v1',
    modules: [
      ...VALID_MANTIS.body.modules,
      { id: 'overlap_mod', catalogId: 'armor', cell: { x: 5, y: 5 }, orientation: 0 },
    ],
  },
};

// Disconnected Module (module at 0, 0 while Core is at 5, 5)
export const INVALID_BOT_DISCONNECTED: BotDefinition = {
  ...VALID_MANTIS,
  body: {
    grid: 'square-12-v1',
    modules: [
      ...VALID_MANTIS.body.modules,
      { id: 'island_mod', catalogId: 'armor', cell: { x: 0, y: 0 }, orientation: 0 },
    ],
  },
};

// Exceed Budget > 100 points
export const INVALID_BOT_BUDGET_EXCEEDED: BotDefinition = {
  ...VALID_MANTIS,
  body: {
    grid: 'square-12-v1',
    modules: [
      ...VALID_MANTIS.body.modules,
      { id: 'armor_1', catalogId: 'armor', cell: { x: 4, y: 3 }, orientation: 0 },
      { id: 'armor_2', catalogId: 'armor', cell: { x: 4, y: 2 }, orientation: 0 },
      { id: 'armor_3', catalogId: 'armor', cell: { x: 4, y: 1 }, orientation: 0 },
      { id: 'armor_4', catalogId: 'armor', cell: { x: 4, y: 0 }, orientation: 0 },
      { id: 'armor_5', catalogId: 'armor', cell: { x: 7, y: 3 }, orientation: 0 },
      { id: 'armor_6', catalogId: 'armor', cell: { x: 7, y: 2 }, orientation: 0 },
      { id: 'armor_7', catalogId: 'armor', cell: { x: 7, y: 1 }, orientation: 0 },
      { id: 'armor_8', catalogId: 'armor', cell: { x: 7, y: 0 }, orientation: 0 },
      { id: 'armor_9', catalogId: 'armor', cell: { x: 3, y: 5 }, orientation: 0 },
      { id: 'armor_10', catalogId: 'armor', cell: { x: 2, y: 5 }, orientation: 0 },
      { id: 'armor_11', catalogId: 'armor', cell: { x: 1, y: 5 }, orientation: 0 },
    ],
  },
};

// Exceed Max Modules (> 24)
export const INVALID_BOT_TOO_MANY_MODULES: BotDefinition = {
  schemaVersion: '2.0',
  name: 'Overloaded',
  cosmetic: { skinId: 'default', paletteId: 'red' },
  brain: VALID_MANTIS.brain,
  body: {
    grid: 'square-12-v1',
    modules: [
      { id: 'core', catalogId: 'core', cell: { x: 5, y: 5 }, orientation: 0 },
      // 24 connected armors = 25 modules total
      ...Array.from({ length: 24 }, (_, i) => {
        const x = 5 + (i % 2);
        const y = i < 4 ? 4 : i < 8 ? 7 : i < 16 ? (i % 8) : (i % 12);
        return {
          id: `mod_${i}`,
          catalogId: 'armor' as const,
          cell: { x: (5 + (i % 4)) % 12, y: (3 + Math.floor(i / 3)) % 12 },
          orientation: 0 as const,
        };
      }),
    ],
  },
};

// Exceed Bounding Radius > 6500 milli-units (Core at (5,5), cell at (11, 11) is distance ~7.07 units = 7071)
export const INVALID_BOT_RADIUS_EXCEEDED: BotDefinition = {
  schemaVersion: '2.0',
  name: 'Stretched',
  cosmetic: { skinId: 'default', paletteId: 'red' },
  brain: VALID_MANTIS.brain,
  body: {
    grid: 'square-12-v1',
    // Chain from 5,5 down to 11,11
    modules: [
      { id: 'core', catalogId: 'core', cell: { x: 4, y: 4 }, orientation: 0 }, // center is 5,5
      { id: 'a1', catalogId: 'armor', cell: { x: 6, y: 5 }, orientation: 0 },
      { id: 'a2', catalogId: 'armor', cell: { x: 7, y: 5 }, orientation: 0 },
      { id: 'a3', catalogId: 'armor', cell: { x: 8, y: 5 }, orientation: 0 },
      { id: 'a4', catalogId: 'armor', cell: { x: 9, y: 5 }, orientation: 0 },
      { id: 'a5', catalogId: 'armor', cell: { x: 10, y: 5 }, orientation: 0 },
      { id: 'a6', catalogId: 'armor', cell: { x: 11, y: 5 }, orientation: 0 },
      { id: 'a7', catalogId: 'armor', cell: { x: 11, y: 6 }, orientation: 0 },
      { id: 'a8', catalogId: 'armor', cell: { x: 11, y: 7 }, orientation: 0 },
      { id: 'a9', catalogId: 'armor', cell: { x: 11, y: 8 }, orientation: 0 },
      { id: 'a10', catalogId: 'armor', cell: { x: 11, y: 9 }, orientation: 0 },
      { id: 'a11', catalogId: 'armor', cell: { x: 11, y: 10 }, orientation: 0 },
      { id: 'a12', catalogId: 'armor', cell: { x: 11, y: 11 }, orientation: 0 }, // corner corner: (12, 12) vs (5, 5) => dx=7, dy=7 => dist = 9.89 > 6.5
    ],
  },
};

// 3. Brain Test Fixtures

// Brain exceeding 16 expression depth
export function createDeepBrain(depth: number): BrainSource {
  let expr: any = { kind: 'const', value: 1 };
  for (let i = 0; i < depth; i++) {
    expr = { kind: 'op', op: 'add', left: expr, right: { kind: 'const', value: 1 } };
  }

  return {
    abiVersion: '2.0',
    initialState: 'idle',
    variables: [],
    skills: [],
    states: [
      {
        id: 'idle',
        rules: [
          {
            id: 'deep_rule',
            when: { kind: 'compare', op: 'gt', left: expr, right: { kind: 'const', value: 0 } },
            intent: {
              thrust: { forward: { kind: 'const', value: 0 }, strafe: { kind: 'const', value: 0 } },
              turn: { kind: 'const', value: 0 },
              modules: [],
            },
          },
        ],
      },
    ],
  };
}

// Brain with variable number of rules to stress gas consumption
export function createGasStressBrain(ruleCount: number): BrainSource {
  const rules = Array.from({ length: ruleCount }, (_, i) => ({
    id: `rule_${i}`,
    when: { kind: 'bool' as const, value: false }, // doesn't match, VM advances to next rule consuming gas
    intent: {
      thrust: { forward: { kind: 'const' as const, value: 0 }, strafe: { kind: 'const' as const, value: 0 } },
      turn: { kind: 'const' as const, value: 0 },
      modules: [],
    },
  }));

  // Append a final matching rule
  rules.push({
    id: 'final_rule',
    when: { kind: 'bool' as const, value: true },
    intent: {
      thrust: { forward: { kind: 'const' as const, value: 500 }, strafe: { kind: 'const' as const, value: 0 } },
      turn: { kind: 'const' as const, value: 100 },
      modules: [],
    },
  });

  return {
    abiVersion: '2.0',
    initialState: 'state_0',
    variables: [],
    skills: [],
    states: [
      {
        id: 'state_0',
        rules,
      },
    ],
  };
}
