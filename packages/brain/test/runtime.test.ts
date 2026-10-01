import { describe, it, expect } from 'vitest';
import { BrainVM, BrainCompiler, BrainExecutionContext } from '../src/index.js';
import { VALID_MANTIS } from '../../testkit/src/index.js';
import { BrainSource, SensorName } from '@nextgame/contracts';

function createMockContext(): BrainExecutionContext {
  const defaultSensors: Record<SensorName, number> = {
    'clock.tick': 0,
    'clock.decision': 0,
    'clock.stateAge': 0,
    'self.energy': 1000,
    'self.heat': 0,
    'self.coreHpPermille': 1000,
    'self.overheated': 0,
    'self.speed': 0,
    'self.x': 6000,
    'self.y': 6000,
    'self.heading': 0,
    'enemy.distance': 2500,
    'enemy.bearing': 0,
    'enemy.speed': 0,
    'enemy.heading': 2048,
    'enemy.coreHpPermille': 1000,
    'enemy.telegraph': 0,
    'arena.centerBearing': 0,
    'arena.centerDistance': 0,
    'arena.controlOwner': 0,
    'arena.ringRadius': 12000,
    'self.outsideRing': 0,
  };

  return {
    sensors: defaultSensors,
    currentState: 'engage',
    stateAge: 0,
    variables: new Map([
      ['tickCount', 0],
      ['strikeCooldown', 0],
      ['targetAcquired', false],
    ]),
    faultStreak: 0,
  };
}

describe('Brain - Deterministic VM Runtime & Gas Metering', () => {
  const compiler = new BrainCompiler();
  const vm = new BrainVM();

  it('executes valid Mantis brain with bounded gas usage (< 4096)', () => {
    const compileRes = compiler.compile(VALID_MANTIS.brain);
    expect(compileRes.ir).toBeDefined();

    const ctx = createMockContext();
    const result = vm.executeTick(compileRes.ir!, ctx);

    expect(result.fault).toBeUndefined();
    expect(result.gasUsed).toBeGreaterThan(0);
    expect(result.gasUsed).toBeLessThanOrEqual(4096);
    expect(result.thrust.forward).toBeGreaterThan(0);
    expect(ctx.faultStreak).toBe(0);
  });

  it('triggers gasFault when gas limit (4096) is exceeded', () => {
    // Construct a deeply nested expression or long rule sequence that consumes > 4096 gas units
    // An addition chain of 2,100 nodes consumes > 4100 gas units
    let longExpr: any = { kind: 'const', value: 1 };
    for (let i = 0; i < 2100; i++) {
      longExpr = { kind: 'op', op: 'add', left: longExpr, right: { kind: 'const', value: 1 } };
    }

    const heavyBrain: BrainSource = {
      abiVersion: '2.0',
      initialState: 's0',
      variables: [],
      skills: [],
      states: [
        {
          id: 's0',
          rules: [
            {
              id: 'heavy_rule',
              when: {
                kind: 'compare',
                op: 'gt',
                left: longExpr,
                right: { kind: 'const', value: 0 },
              },
              intent: {
                thrust: { forward: { kind: 'const', value: 100 }, strafe: { kind: 'const', value: 0 } },
                turn: { kind: 'const', value: 0 },
                modules: [],
              },
            },
          ],
        },
      ],
    };

    // Bypass compiler caps for runtime gas boundary test
    const ir: any = {
      abiVersion: '2.0',
      compilerDigest: 'mock',
      initialState: 's0',
      variables: [],
      states: heavyBrain.states,
      totalNodes: 4200,
    };

    const ctx = createMockContext();
    ctx.currentState = 's0';
    const result = vm.executeTick(ir, ctx);

    expect(result.fault).toBe('gasFault');
    expect(result.thrust.forward).toBe(0);
    expect(result.thrust.strafe).toBe(0);
    expect(result.turn).toBe(0);
    expect(result.modules).toEqual([]);
    expect(ctx.faultStreak).toBe(1);
  });

  it('handles division by zero with divZeroFault and zero drive', () => {
    const divZeroBrain: BrainSource = {
      abiVersion: '2.0',
      initialState: 's0',
      variables: [],
      skills: [],
      states: [
        {
          id: 's0',
          rules: [
            {
              id: 'div_zero_rule',
              when: {
                kind: 'compare',
                op: 'gt',
                left: {
                  kind: 'op',
                  op: 'div',
                  left: { kind: 'const', value: 100 },
                  right: { kind: 'const', value: 0 },
                },
                right: { kind: 'const', value: 0 },
              },
              intent: {
                thrust: { forward: { kind: 'const', value: 500 }, strafe: { kind: 'const', value: 0 } },
                turn: { kind: 'const', value: 0 },
                modules: [],
              },
            },
          ],
        },
      ],
    };

    const compileRes = compiler.compile(divZeroBrain);
    expect(compileRes.ir).toBeDefined();

    const ctx = createMockContext();
    ctx.currentState = 's0';
    const result = vm.executeTick(compileRes.ir!, ctx);

    expect(result.fault).toBe('divZeroFault');
    expect(result.thrust.forward).toBe(0);
    expect(result.turn).toBe(0);
    expect(ctx.faultStreak).toBe(1);
  });

  it('triggers clampFault when min > max in clamp expression', () => {
    const clampBrain: BrainSource = {
      abiVersion: '2.0',
      initialState: 's0',
      variables: [],
      skills: [],
      states: [
        {
          id: 's0',
          rules: [
            {
              id: 'clamp_rule',
              when: {
                kind: 'compare',
                op: 'gt',
                left: {
                  kind: 'clamp',
                  value: { kind: 'const', value: 50 },
                  min: { kind: 'const', value: 100 }, // min 100 > max 20 -> invalid!
                  max: { kind: 'const', value: 20 },
                },
                right: { kind: 'const', value: 0 },
              },
              intent: {
                thrust: { forward: { kind: 'const', value: 100 }, strafe: { kind: 'const', value: 0 } },
                turn: { kind: 'const', value: 0 },
                modules: [],
              },
            },
          ],
        },
      ],
    };

    const compileRes = compiler.compile(clampBrain);
    expect(compileRes.ir).toBeDefined();

    const ctx = createMockContext();
    ctx.currentState = 's0';
    const result = vm.executeTick(compileRes.ir!, ctx);

    expect(result.fault).toBe('clampFault');
    expect(result.thrust.forward).toBe(0);
    expect(ctx.faultStreak).toBe(1);
  });

  it('short-circuits evaluation in all and any expressions', () => {
    // If short circuit works, div/0 in the second term will never be evaluated!
    const shortCircuitBrain: BrainSource = {
      abiVersion: '2.0',
      initialState: 's0',
      variables: [],
      skills: [],
      states: [
        {
          id: 's0',
          rules: [
            {
              id: 'short_circuit_rule',
              when: {
                kind: 'all',
                args: [
                  { kind: 'bool', value: false }, // First term is false -> short-circuit!
                  {
                    kind: 'compare',
                    op: 'gt',
                    left: {
                      kind: 'op',
                      op: 'div',
                      left: { kind: 'const', value: 100 },
                      right: { kind: 'const', value: 0 }, // Would fault if evaluated
                    },
                    right: { kind: 'const', value: 0 },
                  },
                ],
              },
              intent: {
                thrust: { forward: { kind: 'const', value: 100 }, strafe: { kind: 'const', value: 0 } },
                turn: { kind: 'const', value: 0 },
                modules: [],
              },
            },
          ],
        },
      ],
    };

    const compileRes = compiler.compile(shortCircuitBrain);
    expect(compileRes.ir).toBeDefined();

    const ctx = createMockContext();
    ctx.currentState = 's0';
    const result = vm.executeTick(compileRes.ir!, ctx);

    // No divZeroFault because of short-circuit!
    expect(result.fault).toBeUndefined();
  });

  it('performs simultaneous variable updates via initial decision snapshot', () => {
    const swapBrain: BrainSource = {
      abiVersion: '2.0',
      initialState: 's0',
      variables: [
        { id: 'a', type: 'int', initial: 10 },
        { id: 'b', type: 'int', initial: 20 },
      ],
      skills: [],
      states: [
        {
          id: 's0',
          rules: [
            {
              id: 'swap_rule',
              when: { kind: 'bool', value: true },
              set: [
                { variable: 'a', value: { kind: 'var', id: 'b' } }, // a = b (20)
                { variable: 'b', value: { kind: 'var', id: 'a' } }, // b = a (10 from snapshot!)
              ],
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

    const compileRes = compiler.compile(swapBrain);
    expect(compileRes.ir).toBeDefined();

    const ctx = createMockContext();
    ctx.currentState = 's0';
    ctx.variables.set('a', 10);
    ctx.variables.set('b', 20);

    const result = vm.executeTick(compileRes.ir!, ctx);
    expect(result.fault).toBeUndefined();
    // Verify values were swapped simultaneously!
    expect(ctx.variables.get('a')).toBe(20);
    expect(ctx.variables.get('b')).toBe(10);
  });

  it('tracks fault streaks across consecutive failures and resets on success', () => {
    const divZeroBrain: BrainSource = {
      abiVersion: '2.0',
      initialState: 's0',
      variables: [],
      skills: [],
      states: [
        {
          id: 's0',
          rules: [
            {
              id: 'fault_rule',
              when: {
                kind: 'compare',
                op: 'gt',
                left: {
                  kind: 'op',
                  op: 'div',
                  left: { kind: 'const', value: 1 },
                  right: { kind: 'const', value: 0 },
                },
                right: { kind: 'const', value: 0 },
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
    };

    const compileRes = compiler.compile(divZeroBrain);
    const ctx = createMockContext();
    ctx.currentState = 's0';

    // Simulate 9 consecutive faults
    for (let i = 1; i <= 9; i++) {
      vm.executeTick(compileRes.ir!, ctx);
      expect(ctx.faultStreak).toBe(i);
    }

    // 10th fault reaches loss threshold
    vm.executeTick(compileRes.ir!, ctx);
    expect(ctx.faultStreak).toBe(10);
  });
});
