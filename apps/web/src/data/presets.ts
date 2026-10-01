import { BotDefinition } from '../types/game';

export const PRESET_SYNTHS: BotDefinition[] = [
  {
    schemaVersion: '2.0',
    id: 'mantis-v2',
    name: 'Mantis Prime',
    author: 'AcrobatX',
    revision: 12,
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
          description: 'Tiến về phía mục tiêu, theo dõi telegraph của đối phương',
          rules: [
            {
              id: 'evadeOnTelegraph',
              description: 'Né ngang tức thì khi đối thủ bắt đầu windup vũ khí',
              when: {
                kind: 'compare',
                op: 'eq',
                left: { kind: 'sensor', name: 'enemy.telegraph' },
                right: { kind: 'const', value: 1 },
              },
              intent: {
                thrust: {
                  forward: { kind: 'const', value: -400 },
                  strafe: { kind: 'const', value: 900 },
                },
                turn: { kind: 'sensor', name: 'enemy.bearing' },
                modules: [
                  { moduleId: 'shieldMain', action: 'shieldOn', priority: 10 },
                ],
              },
              nextState: 'evade',
            },
            {
              id: 'strikeInMeleeRange',
              description: 'Chém lưỡi Resonance Blade khi đối thủ vào tầm 1.8 unit',
              when: {
                kind: 'compare',
                op: 'lt',
                left: { kind: 'sensor', name: 'enemy.distance' },
                right: { kind: 'const', value: 3000 },
              },
              intent: {
                thrust: {
                  forward: { kind: 'const', value: 800 },
                  strafe: { kind: 'const', value: 0 },
                },
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
              description: 'Giữ hướng và tiến công tới kẻ địch',
              when: { kind: 'bool', value: true },
              intent: {
                thrust: {
                  forward: { kind: 'const', value: 1000 },
                  strafe: { kind: 'const', value: 0 },
                },
                turn: { kind: 'sensor', name: 'enemy.bearing' },
                modules: [],
              },
            },
          ],
        },
        {
          id: 'evade',
          name: 'Né tránh & Vòng sau',
          description: 'Lạng lách né đòn và lấy góc hở sườn',
          rules: [
            {
              id: 'counterAttackWhenTelegraphEnds',
              description: 'Phản công ngay khi đối thủ vung hụt vũ khí',
              when: {
                kind: 'compare',
                op: 'eq',
                left: { kind: 'sensor', name: 'enemy.telegraph' },
                right: { kind: 'const', value: 0 },
              },
              intent: {
                thrust: {
                  forward: { kind: 'const', value: 1000 },
                  strafe: { kind: 'const', value: -300 },
                },
                turn: { kind: 'sensor', name: 'enemy.bearing' },
                modules: [
                  { moduleId: 'bladeFront', action: 'activate', priority: 1 },
                ],
              },
              nextState: 'engage',
            },
            {
              id: 'continueCircle',
              description: 'Tiếp tục trôi vòng quanh',
              when: { kind: 'bool', value: true },
              intent: {
                thrust: {
                  forward: { kind: 'const', value: 200 },
                  strafe: { kind: 'const', value: 1000 },
                },
                turn: { kind: 'sensor', name: 'enemy.bearing' },
                modules: [],
              },
            },
          ],
        },
        {
          id: 'punish',
          name: 'Trừng phạt & Hồi nhiệt',
          description: 'Tung đòn bồi rồi lùi lại hạ nhiệt',
          rules: [
            {
              id: 'disengageIfHot',
              description: 'Lùi giữ khoảng cách nếu nhiệt độ cao',
              when: {
                kind: 'compare',
                op: 'gt',
                left: { kind: 'sensor', name: 'self.heat' },
                right: { kind: 'const', value: 650 },
              },
              intent: {
                thrust: {
                  forward: { kind: 'const', value: -800 },
                  strafe: { kind: 'const', value: 600 },
                },
                turn: { kind: 'sensor', name: 'enemy.bearing' },
                modules: [
                  { moduleId: 'shieldMain', action: 'shieldOff', priority: 1 },
                ],
              },
              nextState: 'engage',
            },
            {
              id: 'returnToEngage',
              description: 'Quay lại áp sát khi nhiệt độ an toàn',
              when: { kind: 'bool', value: true },
              intent: {
                thrust: {
                  forward: { kind: 'const', value: 900 },
                  strafe: { kind: 'const', value: 0 },
                },
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
    behaviorCard: {
      hypothesis: 'Tận dụng tốc độ cơ động vượt trội để nhử telegraph của vũ khí đối phương, sidestep sang sườn và tung Blade kép trừng phạt.',
      tactics: 'Bait windup -> Né sườn 90° -> Chém Blade đôi -> Thối lui tản nhiệt.',
      knownWeaknesses: 'Dễ tổn thương trước pháo Burst rải thảm tầm xa hoặc gặp giáp Bastion quá dày.',
    },
    lineage: 'v2-baseline-mantis',
    status: 'RankedReady',
  },
  {
    schemaVersion: '2.0',
    id: 'bastion-v2',
    name: 'Bastion Phalanx',
    author: 'IronForge',
    revision: 8,
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
          description: 'Tiến về vòng tròn Control Circle và chốt chặn',
          rules: [
            {
              id: 'thrustToObjective',
              description: 'Tiến vào tâm sân khi ở ngoài khoảng cách 3.0',
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
              description: 'Xoay mặt về phía địch và phóng Lance đâm',
              when: {
                kind: 'compare',
                op: 'lt',
                left: { kind: 'sensor', name: 'enemy.distance' },
                right: { kind: 'const', value: 3200 },
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
    behaviorCard: {
      hypothesis: 'Dựng tường giáp dày và lá chắn Shield chặn thẳng lối tiến công, kiểm soát cứ điểm trung tâm tích điểm Control Score.',
      tactics: 'Chiếm tâm -> Dựng khiên Barrier -> Đâm Heavy Lance xuyên giáp khi đối thủ áp sát.',
      knownWeaknesses: 'Khối lượng nặng, xoay chậm, dễ bị Breaker gây quá nhiệt hoặc bị tạt sườn.',
    },
    lineage: 'v2-baseline-bastion',
    status: 'RankedReady',
  },
  {
    schemaVersion: '2.0',
    id: 'kestrel-v2',
    name: 'Kestrel Interceptor',
    author: 'ZephyrAI',
    revision: 15,
    body: {
      grid: 'square-12-v1',
      modules: [
        { id: 'coreMain', catalogId: 'core', cell: { x: 5, y: 5 }, orientation: 0 },
        { id: 'driveB1', catalogId: 'thruster', cell: { x: 4, y: 5 }, orientation: 0 },
        { id: 'driveB2', catalogId: 'thruster', cell: { x: 4, y: 6 }, orientation: 0 },
        { id: 'driveL', catalogId: 'thruster', cell: { x: 5, y: 4 }, orientation: 1 },
        { id: 'driveR', catalogId: 'thruster', cell: { x: 5, y: 7 }, orientation: 3 },
        { id: 'burstGun1', catalogId: 'burst', cell: { x: 7, y: 5 }, orientation: 0 },
        { id: 'burstGun2', catalogId: 'burst', cell: { x: 7, y: 6 }, orientation: 0 },
        { id: 'rad1', catalogId: 'radiator', cell: { x: 6, y: 4 }, orientation: 0 },
        { id: 'capa1', catalogId: 'capacitor', cell: { x: 6, y: 7 }, orientation: 0 },
        { id: 'armorFront1', catalogId: 'armor', cell: { x: 8, y: 5 }, orientation: 0 },
      ],
    },
    brain: {
      abiVersion: '2.0',
      initialState: 'kite',
      variables: [],
      skills: [],
      states: [
        {
          id: 'kite',
          name: 'Thả diều tầm xa (Kite)',
          description: 'Duy trì khoảng cách 7-10 unit và xả pháo Burst',
          rules: [
            {
              id: 'backpedalIfClose',
              description: 'Lùi khẩn cấp nếu kẻ địch áp sát dưới 5 unit',
              when: {
                kind: 'compare',
                op: 'lt',
                left: { kind: 'sensor', name: 'enemy.distance' },
                right: { kind: 'const', value: 5000 },
              },
              intent: {
                thrust: { forward: { kind: 'const', value: -1000 }, strafe: { kind: 'const', value: 400 } },
                turn: { kind: 'sensor', name: 'enemy.bearing' },
                modules: [
                  { moduleId: 'burstGun1', action: 'activate', priority: 1 },
                ],
              },
            },
            {
              id: 'fireBurstVolley',
              description: 'Khai hỏa pháo Burst đôi',
              when: {
                kind: 'compare',
                op: 'lt',
                left: { kind: 'sensor', name: 'enemy.distance' },
                right: { kind: 'const', value: 11000 },
              },
              intent: {
                thrust: { forward: { kind: 'const', value: 0 }, strafe: { kind: 'const', value: 800 } },
                turn: { kind: 'sensor', name: 'enemy.bearing' },
                modules: [
                  { moduleId: 'burstGun1', action: 'activate', priority: 1 },
                  { moduleId: 'burstGun2', action: 'activate', priority: 2 },
                ],
              },
            },
          ],
        },
      ],
    },
    cosmetic: { skinId: 'ceramic-aerodynamic', paletteId: 'graphite-core' },
    behaviorCard: {
      hypothesis: 'Duy trì khoảng cách giao tranh an toàn ở tầm 8-12 unit, dẫn đường đạn Burst 3 viên liên tiếp nhằm bóc tách giáp và triệt hạ từ xa.',
      tactics: 'Strafe ngang đổi lane -> Bắn Burst đôi -> Lùi lại khi đối thủ áp sát.',
      knownWeaknesses: 'Khi bị dồn vào góc tường hoặc vòng bo thu hẹp, không thể thả diều tiếp.',
    },
    lineage: 'v2-baseline-kestrel',
    status: 'RankedReady',
  },
  {
    schemaVersion: '2.0',
    id: 'ram-v2',
    name: 'Ram Dreadnought',
    author: 'Bulldozer',
    revision: 6,
    body: {
      grid: 'square-12-v1',
      modules: [
        { id: 'coreMain', catalogId: 'core', cell: { x: 5, y: 5 }, orientation: 0 },
        { id: 'driveB1', catalogId: 'thruster', cell: { x: 4, y: 5 }, orientation: 0 },
        { id: 'driveB2', catalogId: 'thruster', cell: { x: 4, y: 6 }, orientation: 0 },
        { id: 'driveB3', catalogId: 'thruster', cell: { x: 3, y: 5 }, orientation: 0 },
        { id: 'driveB4', catalogId: 'thruster', cell: { x: 3, y: 6 }, orientation: 0 },
        { id: 'armorWedge1', catalogId: 'armor', cell: { x: 6, y: 4 }, orientation: 0 },
        { id: 'armorWedge2', catalogId: 'armor', cell: { x: 6, y: 7 }, orientation: 0 },
        { id: 'lanceTip', catalogId: 'lance', cell: { x: 8, y: 5 }, orientation: 0 },
        { id: 'armorFront', catalogId: 'armor', cell: { x: 7, y: 5 }, orientation: 0 },
        { id: 'armorFront2', catalogId: 'armor', cell: { x: 7, y: 6 }, orientation: 0 },
      ],
    },
    brain: {
      abiVersion: '2.0',
      initialState: 'bullRush',
      variables: [],
      skills: [],
      states: [
        {
          id: 'bullRush',
          name: 'Húc xung kích (Bull Rush)',
          description: 'Hết tốc lực lao thẳng và đâm thương Lance',
          rules: [
            {
              id: 'ramForward',
              description: 'Tăng tốc tối đa về phía đối phương và vung Lance',
              when: { kind: 'bool', value: true },
              intent: {
                thrust: { forward: { kind: 'const', value: 1000 }, strafe: { kind: 'const', value: 0 } },
                turn: { kind: 'sensor', name: 'enemy.bearing' },
                modules: [
                  { moduleId: 'lanceTip', action: 'activate', priority: 1 },
                ],
              },
            },
          ],
        },
      ],
    },
    cosmetic: { skinId: 'ceramic-wedge', paletteId: 'graphite-core' },
    behaviorCard: {
      hypothesis: 'Dùng 4 Thruster tạo gia tốc cực đại kết hợp mũi giáp nêm chịu đòn, lao thẳng đâm Lance 140 sát thương dứt điểm Core.',
      tactics: 'Khóa mục tiêu -> Gia tốc 100% -> Đâm xuyên phá.',
      knownWeaknesses: 'Bị Mantis hoặc Kestrel né sườn trong lúc windup 30 tick.',
    },
    lineage: 'v2-baseline-ram',
    status: 'RankedReady',
  },
  {
    schemaVersion: '2.0',
    id: 'wisp-v2',
    name: 'Wisp Disruptor',
    author: 'PhantomCore',
    revision: 11,
    body: {
      grid: 'square-12-v1',
      modules: [
        { id: 'coreMain', catalogId: 'core', cell: { x: 5, y: 5 }, orientation: 0 },
        { id: 'drive1', catalogId: 'thruster', cell: { x: 4, y: 5 }, orientation: 0 },
        { id: 'drive2', catalogId: 'thruster', cell: { x: 4, y: 6 }, orientation: 0 },
        { id: 'breaker1', catalogId: 'breaker', cell: { x: 7, y: 5 }, orientation: 0 },
        { id: 'rad1', catalogId: 'radiator', cell: { x: 5, y: 4 }, orientation: 0 },
        { id: 'rad2', catalogId: 'radiator', cell: { x: 5, y: 7 }, orientation: 0 },
        { id: 'armorSide1', catalogId: 'armor', cell: { x: 6, y: 4 }, orientation: 0 },
        { id: 'armorSide2', catalogId: 'armor', cell: { x: 6, y: 7 }, orientation: 0 },
      ],
    },
    brain: {
      abiVersion: '2.0',
      initialState: 'harass',
      variables: [],
      skills: [],
      states: [
        {
          id: 'harass',
          name: 'Quấy rối nhiệt độ',
          description: 'Bắn Breaker ép nhiệt độ đối thủ lên mức Overheated',
          rules: [
            {
              id: 'fireBreaker',
              description: 'Bắn đạn Breaker khi ở cự ly 6 unit',
              when: {
                kind: 'compare',
                op: 'lt',
                left: { kind: 'sensor', name: 'enemy.distance' },
                right: { kind: 'const', value: 6000 },
              },
              intent: {
                thrust: { forward: { kind: 'const', value: 300 }, strafe: { kind: 'const', value: 800 } },
                turn: { kind: 'sensor', name: 'enemy.bearing' },
                modules: [
                  { moduleId: 'breaker1', action: 'activate', priority: 1 },
                ],
              },
            },
          ],
        },
      ],
    },
    cosmetic: { skinId: 'ceramic-ghost', paletteId: 'graphite-core' },
    behaviorCard: {
      hypothesis: 'Khai thác cơ chế Overheated của game: pháo Breaker dội 180 nhiệt lượng khiến đối thủ rơi vào trạng thái khóa vũ khí và tắt khiên.',
      tactics: 'Vờn vòng ngoài -> Bắn Breaker -> Khi đối thủ quá nhiệt, áp sát dứt điểm.',
      knownWeaknesses: 'Máu ít, giáp mỏng, nếu dính một cú Lance đầy đủ sẽ mất ngay module.',
    },
    lineage: 'v2-baseline-wisp',
    status: 'RankedReady',
  },
  {
    schemaVersion: '2.0',
    id: 'chimera-v2',
    name: 'Chimera Hybrid',
    author: 'EvolutionLab',
    revision: 19,
    body: {
      grid: 'square-12-v1',
      modules: [
        { id: 'coreMain', catalogId: 'core', cell: { x: 5, y: 5 }, orientation: 0 },
        { id: 'drive1', catalogId: 'thruster', cell: { x: 4, y: 5 }, orientation: 0 },
        { id: 'drive2', catalogId: 'thruster', cell: { x: 4, y: 6 }, orientation: 0 },
        { id: 'bladeWing', catalogId: 'blade', cell: { x: 6, y: 4 }, orientation: 0 },
        { id: 'burstWing', catalogId: 'burst', cell: { x: 6, y: 7 }, orientation: 0 },
        { id: 'armorFront', catalogId: 'armor', cell: { x: 7, y: 5 }, orientation: 0 },
        { id: 'armorFront2', catalogId: 'armor', cell: { x: 7, y: 6 }, orientation: 0 },
        { id: 'shieldGen', catalogId: 'shield', cell: { x: 8, y: 5 }, orientation: 0 },
        { id: 'cooler', catalogId: 'radiator', cell: { x: 5, y: 4 }, orientation: 0 },
      ],
    },
    brain: {
      abiVersion: '2.0',
      initialState: 'hybridFight',
      variables: [],
      skills: [],
      states: [
        {
          id: 'hybridFight',
          name: 'Chế độ hỗn hợp Đa Năng',
          description: 'Cân bằng giữa pháo tầm xa và cận chiến khi có cơ hội',
          rules: [
            {
              id: 'bladeClose',
              when: {
                kind: 'compare',
                op: 'lt',
                left: { kind: 'sensor', name: 'enemy.distance' },
                right: { kind: 'const', value: 1600 },
              },
              intent: {
                thrust: { forward: { kind: 'const', value: 800 }, strafe: { kind: 'const', value: 0 } },
                turn: { kind: 'sensor', name: 'enemy.bearing' },
                modules: [
                  { moduleId: 'bladeWing', action: 'activate', priority: 1 },
                ],
              },
            },
            {
              id: 'burstFar',
              when: { kind: 'bool', value: true },
              intent: {
                thrust: { forward: { kind: 'const', value: 400 }, strafe: { kind: 'const', value: 600 } },
                turn: { kind: 'sensor', name: 'enemy.bearing' },
                modules: [
                  { moduleId: 'burstWing', action: 'activate', priority: 1 },
                ],
              },
            },
          ],
        },
      ],
    },
    cosmetic: { skinId: 'ceramic-chimera', paletteId: 'graphite-core' },
    behaviorCard: {
      hypothesis: 'Cấu trúc đa nhánh có khả năng thích nghi: cấu rỉa bằng pháo Burst ở tầm xa và tung Blade trảm quét khi đối phương áp sát.',
      tactics: 'Tấn công đa cự ly -> Kích hoạt khiên phòng thủ khi nguy cấp.',
      knownWeaknesses: 'Cần quản lý năng lượng và nhiệt lượng khéo léo để không cạn tài nguyên.',
    },
    lineage: 'v2-baseline-chimera',
    status: 'RankedReady',
  },
];
