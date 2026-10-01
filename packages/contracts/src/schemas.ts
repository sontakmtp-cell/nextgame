// JSON Schema 2020-12 for PROMPT Chiến Contracts

export const BOT_DEFINITION_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://promptchien.vn/schemas/v2/bot-definition.json',
  title: 'BotDefinition',
  type: 'object',
  required: ['schemaVersion', 'name', 'body', 'brain', 'cosmetic'],
  additionalProperties: false,
  properties: {
    schemaVersion: {
      type: 'string',
      const: '2.0',
    },
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 64,
    },
    body: {
      type: 'object',
      required: ['grid', 'modules'],
      additionalProperties: false,
      properties: {
        grid: {
          type: 'string',
          const: 'square-12-v1',
        },
        modules: {
          type: 'array',
          maxItems: 24,
          items: {
            type: 'object',
            required: ['id', 'catalogId', 'cell', 'orientation'],
            additionalProperties: false,
            properties: {
              id: {
                type: 'string',
                pattern: '^[A-Za-z][A-Za-z0-9_-]{0,47}$',
              },
              catalogId: {
                type: 'string',
                enum: [
                  'core',
                  'thruster',
                  'armor',
                  'blade',
                  'lance',
                  'burst',
                  'shield',
                  'breaker',
                  'capacitor',
                  'radiator',
                ],
              },
              cell: {
                type: 'object',
                required: ['x', 'y'],
                additionalProperties: false,
                properties: {
                  x: { type: 'integer', minimum: 0, maximum: 11 },
                  y: { type: 'integer', minimum: 0, maximum: 11 },
                },
              },
              orientation: {
                type: 'integer',
                enum: [0, 1, 2, 3],
              },
            },
          },
        },
      },
    },
    brain: {
      type: 'object',
      required: ['abiVersion', 'initialState', 'variables', 'skills', 'states'],
      additionalProperties: false,
      properties: {
        abiVersion: {
          type: 'string',
          const: '2.0',
        },
        initialState: {
          type: 'string',
          pattern: '^[A-Za-z][A-Za-z0-9_-]{0,47}$',
        },
        variables: {
          type: 'array',
          maxItems: 64,
          items: {
            type: 'object',
            required: ['id', 'type', 'initial'],
            additionalProperties: false,
            properties: {
              id: {
                type: 'string',
                pattern: '^[A-Za-z][A-Za-z0-9_-]{0,47}$',
              },
              type: {
                type: 'string',
                enum: ['int', 'bool'],
              },
              initial: {
                oneOf: [{ type: 'integer' }, { type: 'boolean' }],
              },
            },
          },
        },
        skills: {
          type: 'array',
          maxItems: 16,
          items: {
            type: 'object',
            required: ['id', 'parameters', 'body'],
            additionalProperties: false,
            properties: {
              id: { type: 'string', pattern: '^[A-Za-z][A-Za-z0-9_-]{0,47}$' },
              parameters: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['id', 'type'],
                  additionalProperties: false,
                  properties: {
                    id: { type: 'string' },
                    type: { type: 'string', enum: ['int', 'bool'] },
                  },
                },
              },
              body: { type: 'object' },
            },
          },
        },
        states: {
          type: 'array',
          minItems: 1,
          maxItems: 32,
          items: {
            type: 'object',
            required: ['id', 'rules'],
            additionalProperties: false,
            properties: {
              id: {
                type: 'string',
                pattern: '^[A-Za-z][A-Za-z0-9_-]{0,47}$',
              },
              name: { type: 'string' },
              description: { type: 'string' },
              rules: {
                type: 'array',
                maxItems: 32,
                items: {
                  type: 'object',
                  required: ['id', 'when', 'intent'],
                  additionalProperties: false,
                  properties: {
                    id: { type: 'string', pattern: '^[A-Za-z][A-Za-z0-9_-]{0,47}$' },
                    description: { type: 'string' },
                    when: { type: 'object' },
                    set: {
                      type: 'array',
                      items: {
                        type: 'object',
                        required: ['variable', 'value'],
                        additionalProperties: false,
                        properties: {
                          variable: { type: 'string' },
                          value: { type: 'object' },
                        },
                      },
                    },
                    intent: {
                      type: 'object',
                      required: ['thrust', 'turn', 'modules'],
                      additionalProperties: false,
                      properties: {
                        thrust: {
                          type: 'object',
                          required: ['forward', 'strafe'],
                          additionalProperties: false,
                          properties: {
                            forward: { type: 'object' },
                            strafe: { type: 'object' },
                          },
                        },
                        turn: { type: 'object' },
                        modules: {
                          type: 'array',
                          maxItems: 3,
                          items: {
                            type: 'object',
                            required: ['moduleId', 'action', 'priority'],
                            additionalProperties: false,
                            properties: {
                              moduleId: { type: 'string' },
                              action: { type: 'string', enum: ['activate', 'shieldOn', 'shieldOff'] },
                              aimOffset: { type: 'object' },
                              priority: { type: 'integer', minimum: 0, maximum: 15 },
                            },
                          },
                        },
                      },
                    },
                    nextState: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    cosmetic: {
      type: 'object',
      required: ['skinId', 'paletteId'],
      additionalProperties: false,
      properties: {
        skinId: { type: 'string' },
        paletteId: { type: 'string' },
      },
    },
  },
} as const;

export const MATCH_MANIFEST_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://promptchien.vn/schemas/v2/match-manifest.json',
  title: 'MatchManifest',
  type: 'object',
  required: [
    'engineDigest',
    'rulesetDigest',
    'catalogDigest',
    'brainAbiVersion',
    'packageHashA',
    'packageHashB',
    'seed',
    'scenarioId',
    'presetValues',
    'spawnSlotAssignment',
    'maxTicks',
  ],
  additionalProperties: false,
  properties: {
    engineDigest: { type: 'string' },
    rulesetDigest: { type: 'string' },
    catalogDigest: { type: 'string' },
    brainAbiVersion: { type: 'string', const: '2.0' },
    packageHashA: { type: 'string', pattern: '^[0-9a-f]{64}$' },
    packageHashB: { type: 'string', pattern: '^[0-9a-f]{64}$' },
    seed: { type: 'string', pattern: '^[0-9a-f]{32}$' },
    scenarioId: { type: 'integer', minimum: 0, maximum: 1224 },
    presetValues: {
      type: 'object',
      required: ['yLeft', 'yRight', 'jitterLeft', 'jitterRight'],
      additionalProperties: false,
      properties: {
        yLeft: { type: 'integer', minimum: -3000, maximum: 3000 },
        yRight: { type: 'integer', minimum: -3000, maximum: 3000 },
        jitterLeft: { type: 'integer', minimum: -128, maximum: 128 },
        jitterRight: { type: 'integer', minimum: -128, maximum: 128 },
      },
    },
    spawnSlotAssignment: {
      type: 'string',
      enum: ['leg0_standard', 'leg1_swapped'],
    },
    maxTicks: { type: 'integer', const: 5400 },
  },
} as const;
