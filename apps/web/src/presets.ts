import type { BotDefinition } from '@prompt-chien/contracts';
import type { BehaviorCard } from './types.js';

export const MANTIS_BOT: BotDefinition = {
  schemaVersion: '2.0',
  name: 'Mantis',
  body: {
    grid: 'square-12-v1',
    modules: [
      { id: 'coreMain', catalogId: 'core', cell: { x: 5, y: 5 }, orientation: 0 },
      { id: 'driveTop', catalogId: 'thruster', cell: { x: 4, y: 5 }, orientation: 0 },
      { id: 'driveBottom', catalogId: 'thruster', cell: { x: 4, y: 6 }, orientation: 0 },
      { id: 'part0', catalogId: 'blade', cell: { x: 7, y: 5 }, orientation: 0 },
      { id: 'part1', catalogId: 'radiator', cell: { x: 5, y: 4 }, orientation: 0 },
      { id: 'part2', catalogId: 'armor', cell: { x: 6, y: 4 }, orientation: 0 },
    ],
  },
  brain: {
    abiVersion: '2.0',
    initialState: 'hunt',
    variables: [],
    skills: [],
    states: [
      {
        id: 'hunt',
        rules: [
          {
            id: 'returnToRing',
            when: { kind: 'compare', op: 'eq', left: { kind: 'sensor', name: 'self.outsideRing' }, right: { kind: 'const', value: 1 } },
            intent: {
              thrust: { forward: { kind: 'const', value: 1000 }, strafe: { kind: 'const', value: 0 } },
              turn: { kind: 'clamp', value: { kind: 'op', op: 'mul', left: { kind: 'sensor', name: 'arena.centerBearing' }, right: { kind: 'const', value: 4 } }, min: { kind: 'const', value: -1000 }, max: { kind: 'const', value: 1000 } },
              modules: [],
            },
          },
          {
            id: 'coolAndControl',
            when: { kind: 'compare', op: 'eq', left: { kind: 'sensor', name: 'self.overheated' }, right: { kind: 'const', value: 1 } },
            intent: {
              thrust: { forward: { kind: 'const', value: 700 }, strafe: { kind: 'const', value: 0 } },
              turn: { kind: 'clamp', value: { kind: 'op', op: 'mul', left: { kind: 'sensor', name: 'arena.centerBearing' }, right: { kind: 'const', value: 4 } }, min: { kind: 'const', value: -1000 }, max: { kind: 'const', value: 1000 } },
              modules: [],
            },
          },
          {
            id: 'evadeWindup',
            when: {
              kind: 'all',
              args: [
                { kind: 'compare', op: 'eq', left: { kind: 'sensor', name: 'enemy.telegraph' }, right: { kind: 'const', value: 1 } },
                { kind: 'compare', op: 'lt', left: { kind: 'sensor', name: 'enemy.distance' }, right: { kind: 'const', value: 6500 } },
              ],
            },
            intent: {
              thrust: { forward: { kind: 'const', value: 0 }, strafe: { kind: 'const', value: 1000 } },
              turn: { kind: 'clamp', value: { kind: 'op', op: 'mul', left: { kind: 'sensor', name: 'enemy.bearing' }, right: { kind: 'const', value: 4 } }, min: { kind: 'const', value: -1000 }, max: { kind: 'const', value: 1000 } },
              modules: [],
            },
          },
          {
            id: 'engage',
            when: { kind: 'compare', op: 'lt', left: { kind: 'sensor', name: 'enemy.distance' }, right: { kind: 'const', value: 5000 } },
            intent: {
              thrust: { forward: { kind: 'const', value: 800 }, strafe: { kind: 'const', value: 300 } },
              turn: { kind: 'clamp', value: { kind: 'op', op: 'mul', left: { kind: 'sensor', name: 'enemy.bearing' }, right: { kind: 'const', value: 4 } }, min: { kind: 'const', value: -1000 }, max: { kind: 'const', value: 1000 } },
              modules: [{ moduleId: 'part0', action: 'activate', aimOffset: { kind: 'const', value: 0 }, priority: 1 }],
            },
          },
          {
            id: 'takeCenter',
            when: { kind: 'bool', value: true },
            intent: {
              thrust: { forward: { kind: 'const', value: 1000 }, strafe: { kind: 'const', value: 0 } },
              turn: { kind: 'clamp', value: { kind: 'op', op: 'mul', left: { kind: 'sensor', name: 'arena.centerBearing' }, right: { kind: 'const', value: 4 } }, min: { kind: 'const', value: -1000 }, max: { kind: 'const', value: 1000 } },
              modules: [],
            },
          },
        ],
      },
    ],
  },
  cosmetic: { skinId: 'ceramic-default', paletteId: 'team-auto' },
};

export const BASTION_LITE_BOT: BotDefinition = {
  schemaVersion: '2.0',
  name: 'Bastion-lite',
  body: {
    grid: 'square-12-v1',
    modules: [
      { id: 'coreMain', catalogId: 'core', cell: { x: 5, y: 5 }, orientation: 0 },
      { id: 'driveTop', catalogId: 'thruster', cell: { x: 4, y: 5 }, orientation: 0 },
      { id: 'driveBottom', catalogId: 'thruster', cell: { x: 4, y: 6 }, orientation: 0 },
      { id: 'part0', catalogId: 'blade', cell: { x: 7, y: 5 }, orientation: 0 },
      { id: 'part2', catalogId: 'armor', cell: { x: 6, y: 4 }, orientation: 0 },
      { id: 'guard', catalogId: 'shield', cell: { x: 7, y: 6 }, orientation: 0 },
    ],
  },
  brain: {
    abiVersion: '2.0',
    initialState: 'hunt',
    variables: [],
    skills: [],
    states: [
      {
        id: 'hunt',
        rules: [
          {
            id: 'returnToRing',
            when: { kind: 'compare', op: 'eq', left: { kind: 'sensor', name: 'self.outsideRing' }, right: { kind: 'const', value: 1 } },
            intent: {
              thrust: { forward: { kind: 'const', value: 1000 }, strafe: { kind: 'const', value: 0 } },
              turn: { kind: 'clamp', value: { kind: 'op', op: 'mul', left: { kind: 'sensor', name: 'arena.centerBearing' }, right: { kind: 'const', value: 4 } }, min: { kind: 'const', value: -1000 }, max: { kind: 'const', value: 1000 } },
              modules: [],
            },
          },
          {
            id: 'coolAndControl',
            when: { kind: 'compare', op: 'eq', left: { kind: 'sensor', name: 'self.overheated' }, right: { kind: 'const', value: 1 } },
            intent: {
              thrust: { forward: { kind: 'const', value: 700 }, strafe: { kind: 'const', value: 0 } },
              turn: { kind: 'clamp', value: { kind: 'op', op: 'mul', left: { kind: 'sensor', name: 'arena.centerBearing' }, right: { kind: 'const', value: 4 } }, min: { kind: 'const', value: -1000 }, max: { kind: 'const', value: 1000 } },
              modules: [{ moduleId: 'guard', action: 'shieldOff', priority: 0 }],
            },
          },
          {
            id: 'blockTelegraph',
            when: { kind: 'compare', op: 'eq', left: { kind: 'sensor', name: 'enemy.telegraph' }, right: { kind: 'const', value: 1 } },
            intent: {
              thrust: { forward: { kind: 'const', value: 500 }, strafe: { kind: 'const', value: 0 } },
              turn: { kind: 'clamp', value: { kind: 'op', op: 'mul', left: { kind: 'sensor', name: 'enemy.bearing' }, right: { kind: 'const', value: 4 } }, min: { kind: 'const', value: -1000 }, max: { kind: 'const', value: 1000 } },
              modules: [
                { moduleId: 'guard', action: 'shieldOn', priority: 0 },
                { moduleId: 'part0', action: 'activate', aimOffset: { kind: 'const', value: 0 }, priority: 1 },
              ],
            },
          },
          {
            id: 'engage',
            when: { kind: 'compare', op: 'lt', left: { kind: 'sensor', name: 'enemy.distance' }, right: { kind: 'const', value: 5000 } },
            intent: {
              thrust: { forward: { kind: 'const', value: 300 }, strafe: { kind: 'const', value: 0 } },
              turn: { kind: 'clamp', value: { kind: 'op', op: 'mul', left: { kind: 'sensor', name: 'enemy.bearing' }, right: { kind: 'const', value: 4 } }, min: { kind: 'const', value: -1000 }, max: { kind: 'const', value: 1000 } },
              modules: [
                { moduleId: 'guard', action: 'shieldOn', priority: 0 },
                { moduleId: 'part0', action: 'activate', aimOffset: { kind: 'const', value: 0 }, priority: 1 },
              ],
            },
          },
          {
            id: 'takeCenter',
            when: { kind: 'bool', value: true },
            intent: {
              thrust: { forward: { kind: 'const', value: 1000 }, strafe: { kind: 'const', value: 0 } },
              turn: { kind: 'clamp', value: { kind: 'op', op: 'mul', left: { kind: 'sensor', name: 'arena.centerBearing' }, right: { kind: 'const', value: 4 } }, min: { kind: 'const', value: -1000 }, max: { kind: 'const', value: 1000 } },
              modules: [],
            },
          },
        ],
      },
    ],
  },
  cosmetic: { skinId: 'ceramic-default', paletteId: 'team-auto' },
};

export const KESTREL_BOT: BotDefinition = {
  schemaVersion: '2.0',
  name: 'Kestrel',
  body: {
    grid: 'square-12-v1',
    modules: [
      { id: 'coreMain', catalogId: 'core', cell: { x: 5, y: 5 }, orientation: 0 },
      { id: 'driveTop', catalogId: 'thruster', cell: { x: 4, y: 5 }, orientation: 0 },
      { id: 'driveBottom', catalogId: 'thruster', cell: { x: 4, y: 6 }, orientation: 0 },
      { id: 'part0', catalogId: 'burst', cell: { x: 7, y: 5 }, orientation: 0 },
      { id: 'part1', catalogId: 'radiator', cell: { x: 5, y: 4 }, orientation: 0 },
    ],
  },
  brain: {
    abiVersion: '2.0',
    initialState: 'hunt',
    variables: [],
    skills: [],
    states: [
      {
        id: 'hunt',
        rules: [
          {
            id: 'returnToRing',
            when: { kind: 'compare', op: 'eq', left: { kind: 'sensor', name: 'self.outsideRing' }, right: { kind: 'const', value: 1 } },
            intent: {
              thrust: { forward: { kind: 'const', value: 1000 }, strafe: { kind: 'const', value: 0 } },
              turn: { kind: 'clamp', value: { kind: 'op', op: 'mul', left: { kind: 'sensor', name: 'arena.centerBearing' }, right: { kind: 'const', value: 4 } }, min: { kind: 'const', value: -1000 }, max: { kind: 'const', value: 1000 } },
              modules: [],
            },
          },
          {
            id: 'coolAndControl',
            when: { kind: 'compare', op: 'eq', left: { kind: 'sensor', name: 'self.overheated' }, right: { kind: 'const', value: 1 } },
            intent: {
              thrust: { forward: { kind: 'const', value: 700 }, strafe: { kind: 'const', value: 0 } },
              turn: { kind: 'clamp', value: { kind: 'op', op: 'mul', left: { kind: 'sensor', name: 'arena.centerBearing' }, right: { kind: 'const', value: 4 } }, min: { kind: 'const', value: -1000 }, max: { kind: 'const', value: 1000 } },
              modules: [],
            },
          },
          {
            id: 'kite',
            when: { kind: 'compare', op: 'lt', left: { kind: 'sensor', name: 'enemy.distance' }, right: { kind: 'const', value: 7000 } },
            intent: {
              thrust: { forward: { kind: 'const', value: -700 }, strafe: { kind: 'const', value: 700 } },
              turn: { kind: 'clamp', value: { kind: 'op', op: 'mul', left: { kind: 'sensor', name: 'enemy.bearing' }, right: { kind: 'const', value: 4 } }, min: { kind: 'const', value: -1000 }, max: { kind: 'const', value: 1000 } },
              modules: [
                {
                  moduleId: 'part0',
                  action: 'activate',
                  aimOffset: { kind: 'clamp', value: { kind: 'sensor', name: 'enemy.bearing' }, min: { kind: 'const', value: -256 }, max: { kind: 'const', value: 256 } },
                  priority: 1,
                },
              ],
            },
          },
          {
            id: 'fireAtRange',
            when: { kind: 'compare', op: 'lt', left: { kind: 'sensor', name: 'enemy.distance' }, right: { kind: 'const', value: 12500 } },
            intent: {
              thrust: { forward: { kind: 'const', value: 0 }, strafe: { kind: 'const', value: 500 } },
              turn: { kind: 'clamp', value: { kind: 'op', op: 'mul', left: { kind: 'sensor', name: 'enemy.bearing' }, right: { kind: 'const', value: 4 } }, min: { kind: 'const', value: -1000 }, max: { kind: 'const', value: 1000 } },
              modules: [
                {
                  moduleId: 'part0',
                  action: 'activate',
                  aimOffset: { kind: 'clamp', value: { kind: 'sensor', name: 'enemy.bearing' }, min: { kind: 'const', value: -256 }, max: { kind: 'const', value: 256 } },
                  priority: 1,
                },
              ],
            },
          },
          {
            id: 'engage',
            when: { kind: 'compare', op: 'lt', left: { kind: 'sensor', name: 'enemy.distance' }, right: { kind: 'const', value: 14000 } },
            intent: {
              thrust: { forward: { kind: 'const', value: 800 }, strafe: { kind: 'const', value: 0 } },
              turn: { kind: 'clamp', value: { kind: 'op', op: 'mul', left: { kind: 'sensor', name: 'enemy.bearing' }, right: { kind: 'const', value: 4 } }, min: { kind: 'const', value: -1000 }, max: { kind: 'const', value: 1000 } },
              modules: [
                {
                  moduleId: 'part0',
                  action: 'activate',
                  aimOffset: { kind: 'clamp', value: { kind: 'sensor', name: 'enemy.bearing' }, min: { kind: 'const', value: -256 }, max: { kind: 'const', value: 256 } },
                  priority: 1,
                },
              ],
            },
          },
          {
            id: 'takeCenter',
            when: { kind: 'bool', value: true },
            intent: {
              thrust: { forward: { kind: 'const', value: 1000 }, strafe: { kind: 'const', value: 0 } },
              turn: { kind: 'clamp', value: { kind: 'op', op: 'mul', left: { kind: 'sensor', name: 'arena.centerBearing' }, right: { kind: 'const', value: 4 } }, min: { kind: 'const', value: -1000 }, max: { kind: 'const', value: 1000 } },
              modules: [],
            },
          },
        ],
      },
    ],
  },
  cosmetic: { skinId: 'ceramic-default', paletteId: 'team-auto' },
};

export const PRESET_BEHAVIOR_CARDS: Record<string, BehaviorCard> = {
  Mantis: {
    hypothesis: 'Áp sát nhanh, nhử đối thủ đánh trước, né cú chém rồi phản công bằng Blade cận chiến.',
    attackConditions: 'Khoảng cách kẻ thù < 5000 milli-units và không trong trạng thái đối thủ windup.',
    partLossTactics: 'Nếu mất Blade, lui về giữ tâm sàn để ăn điểm kiểm soát và né đòn bằng strafe.',
    expectedWeaknesses: 'Dễ bị Burst thả diều (kiting) ở tầm xa; dễ nhường tâm sàn khi liên tục né.',
  },
  'Bastion-lite': {
    hypothesis: 'Dựng tường phòng thủ, bật Shield ngay khi thấy kẻ địch lên nòng (telegraph), áp sát chém Blade.',
    attackConditions: 'Khoảng cách < 5000 milli-units, luôn hướng mặt chính diện về kẻ địch.',
    partLossTactics: 'Nếu mất Shield, chuyển sang đánh thận trọng và quản lý nhiệt.',
    expectedWeaknesses: 'Khiên tốn năng lượng; dễ bị tấn công từ sườn hoặc phía sau ngoài cung khiên.',
  },
  Kestrel: {
    hypothesis: 'Giữ khoảng cách xa, bắn tỉa bằng Burst, liên tục di chuyển lùi và đổi hướng (kite).',
    attackConditions: 'Tầm xa 7000 - 12500 milli-units, căn góc bắn theo bearing của đối thủ.',
    partLossTactics: 'Nếu mất Burst, chạy hết tốc độ quanh vòng bo bảo toàn Core HP.',
    expectedWeaknesses: 'Nhường hoàn toàn điểm trung tâm arena; góc nòng bắn hẹp có thể bị che.',
  },
};

export const PRESET_BOTS: readonly BotDefinition[] = [MANTIS_BOT, BASTION_LITE_BOT, KESTREL_BOT];
