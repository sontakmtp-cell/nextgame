import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { BotDefinition, Placement } from '../packages/contracts/src/index.js';
import { validateBotStructure, parseJsonWithPointer } from '../apps/web/src/validation.js';
import { MANTIS_BOT, BASTION_LITE_BOT, KESTREL_BOT, PRESET_BEHAVIOR_CARDS } from '../apps/web/src/presets.js';
import { createDraft, saveDraft, freezeRevision, getRevisions, ConflictError } from '../apps/web/src/storage.js';
import { createWorld, simulate } from '../packages/engine/src/index.js';
import { encodeReplay, verifyPublic } from '../packages/replay/src/index.js';
import { freezeBot } from '../packages/brain/src/index.js';
import { catalog, contentManifest } from '../packages/content/src/index.js';

describe('T07 — Web Workshop, Brain Lab, and Local Experiments', () => {
  describe('Workshop Diagnostics & Structural Validation', () => {
    it('validates canonical preset bots (Mantis, Bastion-lite, Kestrel) as fully valid', () => {
      for (const bot of [MANTIS_BOT, BASTION_LITE_BOT, KESTREL_BOT]) {
        const res = validateBotStructure(bot);
        expect(res.valid).toBe(true);
        expect(res.errors).toHaveLength(0);
        expect(res.connected).toBe(true);
        expect(res.occlusions).toHaveLength(0);
        expect(res.moduleCount).toBeLessThanOrEqual(24);
        expect(res.pointCost).toBeLessThanOrEqual(100);
        expect(res.weaponsCount).toBeLessThanOrEqual(3);
      }
    });

    it('detects missing Core module', () => {
      const noCore: BotDefinition = {
        ...MANTIS_BOT,
        body: {
          ...MANTIS_BOT.body,
          modules: MANTIS_BOT.body.modules.filter(m => m.catalogId !== 'core'),
        },
      };
      const res = validateBotStructure(noCore);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.message.includes('Core 2x2'))).toBe(true);
    });

    it('rejects exceeding the 24 module cap', () => {
      const extraModules: Placement[] = [...MANTIS_BOT.body.modules];
      for (let i = 0; i < 20; i++) {
        extraModules.push({
          id: `extra_${i}`,
          catalogId: 'armor',
          cell: { x: i % 12, y: Math.floor(i / 12) },
          orientation: 0,
        });
      }
      const overCap: BotDefinition = {
        ...MANTIS_BOT,
        body: {
          grid: 'square-12-v1',
          modules: extraModules,
        },
      };
      const res = validateBotStructure(overCap);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.message.includes('24 module'))).toBe(true);
    });

    it('detects disconnected modules via BFS flood fill from Core', () => {
      // Place an armor module at far corner (0, 0) disconnected from Core at (5, 5)
      const disconnected: BotDefinition = {
        ...MANTIS_BOT,
        body: {
          ...MANTIS_BOT.body,
          modules: [
            ...MANTIS_BOT.body.modules,
            { id: 'lonelyArmor', catalogId: 'armor', cell: { x: 0, y: 0 }, orientation: 0 },
          ],
        },
      };
      const res = validateBotStructure(disconnected);
      expect(res.valid).toBe(false);
      expect(res.connected).toBe(false);
      expect(res.disconnectedCells).toContain('0,0');
      expect(res.errors.some(e => e.message.includes('không nối liền mạch'))).toBe(true);
    });

    it('diagnoses forward weapon occlusion (Burst line blocked by friendly module)', () => {
      // Kestrel has Burst at (7, 5) facing orientation 0 (+X direction).
      // Placing armor at (8, 5) directly in front of the Burst muzzle will block it!
      const occluded: BotDefinition = {
        ...KESTREL_BOT,
        body: {
          ...KESTREL_BOT.body,
          modules: [
            ...KESTREL_BOT.body.modules,
            { id: 'blockingArmor', catalogId: 'armor', cell: { x: 8, y: 5 }, orientation: 0 },
          ],
        },
      };
      const res = validateBotStructure(occluded);
      expect(res.occlusions.length).toBeGreaterThan(0);
      expect(res.occlusions.some(o => o.catalogId === 'burst' && o.warning.includes('bị cản bởi blockingArmor'))).toBe(true);
    });

    it('diagnoses thruster exhaust occlusion (blocked behind exhaust)', () => {
      // Mantis has thruster at (4, 5) facing orientation 0. Exhaust is at (3, 5).
      // Placing an armor at (3, 5) blocks the exhaust!
      const blockedThruster: BotDefinition = {
        ...MANTIS_BOT,
        body: {
          ...MANTIS_BOT.body,
          modules: [
            ...MANTIS_BOT.body.modules,
            { id: 'rearWall', catalogId: 'armor', cell: { x: 3, y: 5 }, orientation: 0 },
          ],
        },
      };
      const res = validateBotStructure(blockedThruster);
      expect(res.occlusions.some(o => o.catalogId === 'thruster' && o.warning.includes('Khe thoát khí Thruster'))).toBe(true);
    });
  });

  describe('Brain Lab Diagnostics & Exact Error Pointers', () => {
    it('detects unreachable states in Brain FSM', () => {
      const unreachableStateBot: BotDefinition = {
        ...MANTIS_BOT,
        brain: {
          ...MANTIS_BOT.brain,
          states: [
            ...MANTIS_BOT.brain.states,
            {
              id: 'lostState',
              rules: [
                {
                  id: 'r1',
                  when: { kind: 'bool', value: true },
                  intent: {
                    thrust: { forward: { kind: 'const', value: 0 }, strafe: { kind: 'const', value: 0 } },
                    turn: { kind: 'const', value: 0 },
                    modules: [],
                  },
                },
              ],
            },
          ],
        },
      };
      const res = validateBotStructure(unreachableStateBot);
      expect(res.unreachableStates).toContain('lostState');
    });

    it('detects dead rules placed after an unconditional true rule', () => {
      const deadRuleBot: BotDefinition = {
        ...MANTIS_BOT,
        brain: {
          ...MANTIS_BOT.brain,
          states: [
            {
              id: 'hunt',
              rules: [
                {
                  id: 'alwaysTrue',
                  when: { kind: 'bool', value: true },
                  intent: {
                    thrust: { forward: { kind: 'const', value: 0 }, strafe: { kind: 'const', value: 0 } },
                    turn: { kind: 'const', value: 0 },
                    modules: [],
                  },
                },
                {
                  id: 'deadRule',
                  when: { kind: 'compare', op: 'lt', left: { kind: 'sensor', name: 'enemy.distance' }, right: { kind: 'const', value: 5000 } },
                  intent: {
                    thrust: { forward: { kind: 'const', value: 500 }, strafe: { kind: 'const', value: 0 } },
                    turn: { kind: 'const', value: 0 },
                    modules: [],
                  },
                },
              ],
            },
          ],
        },
      };
      const res = validateBotStructure(deadRuleBot);
      expect(res.deadRules.some(d => d.ruleId === 'deadRule')).toBe(true);
    });

    it('detects division by zero in condition expression with field pointer', () => {
      const divZeroBot: BotDefinition = {
        ...MANTIS_BOT,
        brain: {
          ...MANTIS_BOT.brain,
          states: [
            {
              id: 'hunt',
              rules: [
                {
                  id: 'faultRule',
                  when: {
                    kind: 'compare',
                    op: 'gt',
                    left: { kind: 'op', op: 'div', left: { kind: 'const', value: 100 }, right: { kind: 'const', value: 0 } },
                    right: { kind: 'const', value: 10 },
                  },
                  intent: {
                    thrust: { forward: { kind: 'const', value: 0 }, strafe: { kind: 'const', value: 0 } },
                    turn: { kind: 'const', value: 0 },
                    modules: [],
                  },
                },
              ],
            },
          ],
        },
      };
      const res = validateBotStructure(divZeroBot);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.message.includes('Lỗi chia cho 0'))).toBe(true);
    });

    it('parses JSON with exact pointer errors, rejecting poison keys and duplicates', () => {
      // 1. Poison key __proto__
      const poisonJson = '{"name": "Evil", "__proto__": {"polluted": true}}';
      const poisonRes = parseJsonWithPointer(poisonJson);
      expect(poisonRes.error).toBeDefined();
      expect(poisonRes.pointer).toBe('/__proto__');

      // 2. Duplicate keys
      const duplicateJson = '{"name": "First", "name": "Second"}';
      const dupRes = parseJsonWithPointer(duplicateJson);
      expect(dupRes.error).toBeDefined();
      expect(dupRes.pointer).toBe('/name');

      // 3. Valid JSON
      const validJson = JSON.stringify(MANTIS_BOT);
      const validRes = parseJsonWithPointer(validJson);
      expect(validRes.error).toBeUndefined();
      expect(validRes.data).toBeDefined();
    });
  });

  describe('Local Persistence & CAS Concurrency Control', () => {
    it('creates drafts with revision 1 and isUnofficial: true', async () => {
      const draft = await createDraft('Test Bot', MANTIS_BOT, PRESET_BEHAVIOR_CARDS.Mantis!);
      expect(draft.id).toBeDefined();
      expect(draft.revision).toBe(1);
      expect(draft.isUnofficial).toBe(true);
      expect(draft.name).toBe('Test Bot');
    });

    it('saves draft monotonically when expectedRevision matches', async () => {
      const draft = await createDraft('Monotonic Bot', MANTIS_BOT, PRESET_BEHAVIOR_CARDS.Mantis!);
      const saved1 = await saveDraft({ ...draft, name: 'Renamed Bot' }, 1);
      expect(saved1.revision).toBe(2);

      const saved2 = await saveDraft(saved1, 2);
      expect(saved2.revision).toBe(3);
    });

    it('rejects save with ConflictError (409) when expectedRevision is stale', async () => {
      const draft = await createDraft('Conflict Bot', MANTIS_BOT, PRESET_BEHAVIOR_CARDS.Mantis!);
      // Draft is at revision 1. Save it once to bump to revision 2.
      await saveDraft(draft, 1);

      // Attempting to save with stale revision 1 must throw ConflictError!
      await expect(saveDraft(draft, 1)).rejects.toThrow(ConflictError);
    });

    it('freezes immutable revision snapshot and records lineage', async () => {
      const draft = await createDraft('Freeze Bot', MANTIS_BOT, PRESET_BEHAVIOR_CARDS.Mantis!);
      const revRecord = await freezeRevision(draft, 'Mốc thử nghiệm 1');
      expect(revRecord.draftId).toBe(draft.id);
      expect(revRecord.revision).toBe(2);
      expect(revRecord.summary).toBe('Mốc thử nghiệm 1');

      const history = await getRevisions(draft.id);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0]!.summary).toBe('Mốc thử nghiệm 1');
    });
  });

  describe('Full User Journey Loop: Create → Edit → Validate → Experiment → Replay → Revision', () => {
    it('completes the entire end-to-end user loop with determinism and replay verification', async () => {
      // 1. Fresh user creates draft from Mantis template
      const draft = await createDraft('Challenger Synth', MANTIS_BOT, PRESET_BEHAVIOR_CARDS.Mantis!);
      expect(draft.revision).toBe(1);

      // 2. User edits body & brain (Candidate variant)
      const candidateDef: BotDefinition = {
        ...draft.definition,
        name: 'Challenger Synth (Evasive)',
        brain: {
          ...draft.definition.brain,
          states: draft.definition.brain.states.map(s => ({
            ...s,
            rules: s.rules.map(r =>
              r.id === 'evadeWindup' && 'intent' in r
                ? { ...r, intent: { ...r.intent, thrust: { forward: { kind: 'const', value: -400 }, strafe: { kind: 'const', value: 1000 } } } }
                : r
            ),
          })),
        },
      };

      // 3. Validate Candidate
      const structureCheck = validateBotStructure(candidateDef);
      expect(structureCheck.valid).toBe(true);

      const pkg = await freezeBot(candidateDef, catalog, contentManifest.catalogDigest, contentManifest.capabilityDigest);
      expect(pkg.packageHash).toBeDefined();

      // 4. Run Headless Simulation against benchmark Kestrel
      const seed = '00000000000000000000000000000001';
      const world = await createWorld(candidateDef, KESTREL_BOT, seed, false);
      const record = await simulate(world);
      expect(record.result).toBeDefined();
      expect(record.frames.length).toBeGreaterThan(0);

      // 5. Replay Encoding & Seek parity verification
      const replay = await encodeReplay(record.manifest, record.frames, record.result);
      const index = await verifyPublic(replay);
      expect(index.frameCount).toBe(record.frames.length);

      // Verify arbitrary seek equals straight playback
      const testTick = Math.min(record.frames.length - 1, 120);
      const sought = index.seek(testTick);
      expect(sought.boundary).toBe(record.frames[testTick]!.boundary);
      expect(sought.actors.A.pose.x).toBe(record.frames[testTick]!.actors.A.pose.x);

      // 6. Turning point extraction & Hypothesis formation
      const events = record.frames.flatMap(f => f.events);
      const firstActivation = events.find(e => e.kind === 'activation');
      expect(firstActivation).toBeDefined();

      const newHypothesis = `Quan sát đòn kích hoạt tại tick ${firstActivation!.tick}: Cần né đòn sớm hơn!`;
      const updatedDraft = {
        ...draft,
        definition: candidateDef,
        behaviorCard: {
          ...draft.behaviorCard,
          hypothesis: newHypothesis,
        },
      };

      // 7. Freeze final revision with new hypothesis
      const frozen = await freezeRevision(updatedDraft, 'Phiên bản cải tiến né đòn sớm');
      expect(frozen.revision).toBe(2);
      expect(frozen.behaviorCard.hypothesis).toBe(newHypothesis);
    });
  });

  describe('Main Thread Architectural Isolation Check', () => {
    it('verifies that the main web bundle does not import the engine simulation loop', () => {
      const distAssetsDir = resolve('apps/web/dist/assets');
      const files = readdirSync(distAssetsDir);
      const mainBundleFile = files.find(f => f.startsWith('index-') && f.endsWith('.js'));
      expect(mainBundleFile).toBeDefined();

      const bundleContent = readFileSync(resolve(distAssetsDir, mainBundleFile!), 'utf8');

      // The main thread bundle should NOT bundle createWorld or simulate loop!
      // Those belong exclusively to the worker bundle.
      expect(bundleContent.includes('ENGINE_DIGEST')).toBe(false);
      expect(bundleContent.includes('calculateTorque')).toBe(false);
    });
  });
});
