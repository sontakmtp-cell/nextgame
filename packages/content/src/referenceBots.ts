import { BotDefinition } from '@nextgame/contracts';

export const REFERENCE_BOTS: Record<string, BotDefinition> = {
  mantis: {
    schemaVersion: '2.0',
    name: 'Mantis Prime',
    body: {
      grid: 'square-12-v1',
      modules: [
        { id: 'coreMain', catalogId: 'core', cell: { x: 5, y: 5 }, orientation: 0 },
        { id: 'driveTop', catalogId: 'thruster', cell: { x: 4, y: 5 }, orientation: 0 },
        { id: 'driveBottom', catalogId: 'thruster', cell: { x: 4, y: 6 }, orientation: 0 },
        { id: 'driveRear', catalogId: 'thruster', cell: { x: 3, y: 5 }, orientation: 0 },
        { id: 'bladeFront', catalogId: 'blade', cell: { x: 7, y: 5 }, orientation: 0 },
        { id: 'bladeSide', catalogId: 'blade', cell: { x: 7, y: 6 }, orientation: 0 },
        { id: 'shieldMain', catalogId: 'shield', cell: { x: 8, y: 5 }, orientation: 0 },
        { id: 'cooler', catalogId: 'radiator', cell: { x: 5, y: 4 }, orientation: 0 },
        { id: 'plateTop', catalogId: 'armor', cell: { x: 6, y: 4 }, orientation: 0 },
        { id: 'plateBottom', catalogId: 'armor', cell: { x: 6, y: 7 }, orientation: 0 },
        { id: 'plateRear', catalogId: 'armor', cell: { x: 3, y: 6 }, orientation: 0 },
      ],
    },
    brain: {
      abiVersion: '2.0',
      initialState: 'engage',
      variables: [],
      skills: [],
      states: [
        {
          id: 'engage',
          name: 'Áp sát & Nhử đòn',
          rules: [
            {
              id: 'evadeOnTelegraph',
              when: {
                kind: 'compare',
                op: 'eq',
                left: { kind: 'sensor', name: 'enemy.telegraph' },
                right: { kind: 'const', value: 1 },
              },
              intent: {
                thrust: { forward: { kind: 'const', value: -400 }, strafe: { kind: 'const', value: 900 } },
                turn: { kind: 'sensor', name: 'enemy.bearing' },
                modules: [{ moduleId: 'shieldMain', action: 'shieldOn', priority: 10 }],
              },
              nextState: 'evade',
            },
            {
              id: 'strikeInMeleeRange',
              when: {
                kind: 'compare',
                op: 'lt',
                left: { kind: 'sensor', name: 'enemy.distance' },
                right: { kind: 'const', value: 3000 },
              },
              intent: {
                thrust: { forward: { kind: 'const', value: 800 }, strafe: { kind: 'const', value: 0 } },
                turn: { kind: 'sensor', name: 'enemy.bearing' },
                modules: [
                  { moduleId: 'bladeFront', action: 'activate', priority: 1 },
                  { moduleId: 'bladeSide', action: 'activate', priority: 2 },
                ],
              },
              nextState: 'punish',
            },
            {
              id: 'approachDefault',
              when: { kind: 'bool', value: true },
              intent: {
                thrust: { forward: { kind: 'const', value: 1000 }, strafe: { kind: 'const', value: 0 } },
                turn: { kind: 'sensor', name: 'enemy.bearing' },
                modules: [],
              },
            },
          ],
        },
        {
          id: 'evade',
          name: 'Né tránh & Vòng sau',
          rules: [
            {
              id: 'counterAttackWhenTelegraphEnds',
              when: {
                kind: 'compare',
                op: 'eq',
                left: { kind: 'sensor', name: 'enemy.telegraph' },
                right: { kind: 'const', value: 0 },
              },
              intent: {
                thrust: { forward: { kind: 'const', value: 1000 }, strafe: { kind: 'const', value: -300 } },
                turn: { kind: 'sensor', name: 'enemy.bearing' },
                modules: [{ moduleId: 'bladeFront', action: 'activate', priority: 1 }],
              },
              nextState: 'engage',
            },
            {
              id: 'continueCircle',
              when: { kind: 'bool', value: true },
              intent: {
                thrust: { forward: { kind: 'const', value: 200 }, strafe: { kind: 'const', value: 1000 } },
                turn: { kind: 'sensor', name: 'enemy.bearing' },
                modules: [],
              },
            },
          ],
        },
        {
          id: 'punish',
          name: 'Trừng phạt & Hồi nhiệt',
          rules: [
            {
              id: 'disengageIfHot',
              when: {
                kind: 'compare',
                op: 'gt',
                left: { kind: 'sensor', name: 'self.heat' },
                right: { kind: 'const', value: 650 },
              },
              intent: {
                thrust: { forward: { kind: 'const', value: -800 }, strafe: { kind: 'const', value: 600 } },
                turn: { kind: 'sensor', name: 'enemy.bearing' },
                modules: [{ moduleId: 'shieldMain', action: 'shieldOff', priority: 1 }],
              },
              nextState: 'engage',
            },
            {
              id: 'returnToEngage',
              when: { kind: 'bool', value: true },
              intent: {
                thrust: { forward: { kind: 'const', value: 900 }, strafe: { kind: 'const', value: 0 } },
                turn: { kind: 'sensor', name: 'enemy.bearing' },
                modules: [],
              },
              nextState: 'engage',
            },
          ],
        },
      ],
    },
    cosmetic: { skinId: 'ceramic-pure', paletteId: 'graphite-core' },
  },
  bastion: {
    schemaVersion: '2.0',
    name: 'Bastion Phalanx',
    body: {
      grid: 'square-12-v1',
      modules: [
        { id: 'coreMain', catalogId: 'core', cell: { x: 5, y: 5 }, orientation: 0 },
        { id: 'driveL', catalogId: 'thruster', cell: { x: 4, y: 5 }, orientation: 0 },
        { id: 'driveR', catalogId: 'thruster', cell: { x: 4, y: 6 }, orientation: 0 },
        { id: 'armorF1', catalogId: 'armor', cell: { x: 7, y: 4 }, orientation: 0 },
        { id: 'armorF2', catalogId: 'armor', cell: { x: 7, y: 5 }, orientation: 0 },
        { id: 'armorF3', catalogId: 'armor', cell: { x: 7, y: 6 }, orientation: 0 },
        { id: 'armorF4', catalogId: 'armor', cell: { x: 7, y: 7 }, orientation: 0 },
        { id: 'shieldMain', catalogId: 'shield', cell: { x: 6, y: 4 }, orientation: 0 },
        { id: 'lanceMain', catalogId: 'lance', cell: { x: 8, y: 5 }, orientation: 0 },
        { id: 'capa1', catalogId: 'capacitor', cell: { x: 5, y: 4 }, orientation: 0 },
        { id: 'rad1', catalogId: 'radiator', cell: { x: 5, y: 7 }, orientation: 0 },
        { id: 'armorBot', catalogId: 'armor', cell: { x: 6, y: 7 }, orientation: 0 },
      ],
    },
    brain: {
      abiVersion: '2.0',
      initialState: 'holdCenter',
      variables: [],
      skills: [],
      states: [
        {
          id: 'holdCenter',
          name: 'Chiếm cứ điểm trung tâm',
          rules: [
            {
              id: 'thrustToObjective',
              when: {
                kind: 'compare',
                op: 'gt',
                left: { kind: 'sensor', name: 'arena.centerDistance' },
                right: { kind: 'const', value: 2500 },
              },
              intent: {
                thrust: { forward: { kind: 'const', value: 700 }, strafe: { kind: 'const', value: 0 } },
                turn: { kind: 'sensor', name: 'arena.centerBearing' },
                modules: [],
              },
            },
            {
              id: 'faceEnemyAndThrustLance',
              when: {
                kind: 'compare',
                op: 'lt',
                left: { kind: 'sensor', name: 'enemy.distance' },
                right: { kind: 'const', value: 4000 },
              },
              intent: {
                thrust: { forward: { kind: 'const', value: 200 }, strafe: { kind: 'const', value: 0 } },
                turn: { kind: 'sensor', name: 'enemy.bearing' },
                modules: [
                  { moduleId: 'lanceMain', action: 'activate', priority: 1 },
                  { moduleId: 'shieldMain', action: 'shieldOn', priority: 2 },
                ],
              },
            },
          ],
        },
      ],
    },
    cosmetic: { skinId: 'ceramic-heavy', paletteId: 'graphite-core' },
  },
};
