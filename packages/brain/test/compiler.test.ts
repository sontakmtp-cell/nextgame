import { describe, it, expect } from 'vitest';
import { BrainCompiler } from '../src/index.js';
import { VALID_MANTIS, createDeepBrain } from '../../testkit/src/index.js';
import { BrainSource } from '@nextgame/contracts';

describe('Brain - Compiler Limits & Diagnostics', () => {
  const compiler = new BrainCompiler();

  it('compiles valid reference Mantis brain successfully', () => {
    const res = compiler.compile(VALID_MANTIS.brain);
    expect(res.ir).toBeDefined();
    expect(res.diagnostics.filter(d => d.type === 'error')).toHaveLength(0);
    expect(res.ir?.abiVersion).toBe('2.0');
    expect(res.ir?.totalNodes).toBeLessThanOrEqual(2048);
  });

  it('rejects expression tree exceeding depth 16', () => {
    const deepBrain = createDeepBrain(18); // depth 18 > 16
    const res = compiler.compile(deepBrain);
    expect(res.ir).toBeUndefined();
    expect(res.diagnostics.some(d => d.code === 'MAX_DEPTH_EXCEEDED')).toBe(true);
  });

  it('rejects brain with missing initialState', () => {
    const brokenBrain: BrainSource = {
      ...VALID_MANTIS.brain,
      initialState: 'non_existent_state',
    };
    const res = compiler.compile(brokenBrain);
    expect(res.ir).toBeUndefined();
    expect(res.diagnostics.some(d => d.code === 'INITIAL_STATE_NOT_FOUND')).toBe(true);
  });

  it('rejects rule transitioning to unknown nextState', () => {
    const brokenBrain: BrainSource = {
      abiVersion: '2.0',
      initialState: 'state1',
      variables: [],
      skills: [],
      states: [
        {
          id: 'state1',
          rules: [
            {
              id: 'r1',
              when: { kind: 'bool', value: true },
              intent: {
                thrust: { forward: { kind: 'const', value: 0 }, strafe: { kind: 'const', value: 0 } },
                turn: { kind: 'const', value: 0 },
                modules: [],
              },
              nextState: 'ghost_state',
            },
          ],
        },
      ],
    };
    const res = compiler.compile(brokenBrain);
    expect(res.ir).toBeUndefined();
    expect(res.diagnostics.some(d => d.code === 'UNKNOWN_NEXT_STATE')).toBe(true);
  });

  it('rejects brain exceeding 32 states', () => {
    const manyStatesBrain: BrainSource = {
      abiVersion: '2.0',
      initialState: 's_0',
      variables: [],
      skills: [],
      states: Array.from({ length: 33 }, (_, i) => ({
        id: `s_${i}`,
        rules: [],
      })),
    };
    const res = compiler.compile(manyStatesBrain);
    expect(res.ir).toBeUndefined();
    expect(res.diagnostics.some(d => d.code === 'MAX_STATES_EXCEEDED')).toBe(true);
  });

  it('rejects brain exceeding 64 variables', () => {
    const manyVarsBrain: BrainSource = {
      ...VALID_MANTIS.brain,
      variables: Array.from({ length: 65 }, (_, i) => ({
        id: `v_${i}`,
        type: 'int' as const,
        initial: 0,
      })),
    };
    const res = compiler.compile(manyVarsBrain);
    expect(res.ir).toBeUndefined();
    expect(res.diagnostics.some(d => d.code === 'MAX_VARS_EXCEEDED')).toBe(true);
  });
});
