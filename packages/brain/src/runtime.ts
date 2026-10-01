import {
  IntExpr,
  BoolExpr,
  ModuleIntent,
  SensorName,
} from '@nextgame/contracts';
import { CompiledBrainIR } from './compiler.js';

export interface BrainExecutionContext {
  sensors: Record<SensorName, number>;
  currentState: string;
  stateAge: number;
  variables: Map<string, number | boolean>;
  faultStreak: number;
}

export interface DecisionResult {
  thrust: { forward: number; strafe: number };
  turn: number;
  modules: ModuleIntent[];
  nextState?: string;
  gasUsed: number;
  fault?: 'gasFault' | 'divZeroFault' | 'clampFault' | 'unknownVariableFault' | 'unknownStateFault';
  matchedRuleId?: string;
}

export const GAS_LIMIT = 4096;

export class BrainVM {
  private gas = 0;
  private fault: DecisionResult['fault'] = undefined;

  executeTick(ir: CompiledBrainIR, ctx: BrainExecutionContext): DecisionResult {
    this.gas = 0;
    this.fault = undefined;

    const state = ir.states.find(s => s.id === ctx.currentState);
    if (!state) {
      return this.handleFault(ctx, 'unknownStateFault');
    }

    // Snapshot variables at tick start
    const varSnapshot = new Map(ctx.variables);
    const pendingWrites = new Map<string, number | boolean>();

    let matchedRuleId: string | undefined = undefined;
    let chosenIntent: DecisionResult = {
      thrust: { forward: 0, strafe: 0 },
      turn: 0,
      modules: [],
      gasUsed: 0,
    };

    for (const rule of state.rules) {
      this.consumeGas();
      if (this.fault) break;

      const matched = this.evalBool(rule.when, ctx.sensors, varSnapshot);
      if (this.fault) break;

      if (matched) {
        matchedRuleId = rule.id;

        // Evaluate thrust & turn
        const fwd = this.evalInt(rule.intent.thrust.forward, ctx.sensors, varSnapshot);
        const str = this.evalInt(rule.intent.thrust.strafe, ctx.sensors, varSnapshot);
        const trn = this.evalInt(rule.intent.turn, ctx.sensors, varSnapshot);
        if (this.fault) break;

        // Clamp thrust and turn to -1000..1000
        const clampedFwd = Math.max(-1000, Math.min(1000, fwd));
        const clampedStr = Math.max(-1000, Math.min(1000, str));
        const clampedTurn = Math.max(-1000, Math.min(1000, trn));

        // Evaluate module intents
        const evaluatedModules: ModuleIntent[] = [];
        for (const mi of rule.intent.modules) {
          this.consumeGas();
          let aimOffsetVal: any = undefined;
          if (mi.aimOffset) {
            const rawAim = this.evalInt(mi.aimOffset, ctx.sensors, varSnapshot);
            aimOffsetVal = { kind: 'const', value: Math.max(-256, Math.min(256, rawAim)) };
          }
          evaluatedModules.push({
            moduleId: mi.moduleId,
            action: mi.action,
            aimOffset: aimOffsetVal,
            priority: Math.max(0, Math.min(15, mi.priority)),
          });
        }
        if (this.fault) break;

        // Sort module intents by priority (0 highest)
        evaluatedModules.sort((a, b) => a.priority - b.priority);

        // Evaluate variable assignments
        if (rule.set) {
          for (const s of rule.set) {
            this.consumeGas();
            const val = this.evalInt(s.value, ctx.sensors, varSnapshot);
            pendingWrites.set(s.variable, val);
          }
        }
        if (this.fault) break;

        if (rule.nextState) {
          this.consumeGas();
        }

        chosenIntent = {
          thrust: { forward: clampedFwd, strafe: clampedStr },
          turn: clampedTurn,
          modules: evaluatedModules,
          nextState: rule.nextState,
          gasUsed: this.gas,
          matchedRuleId,
        };
        break; // First matching rule wins
      }
    }

    if (this.fault) {
      return this.handleFault(ctx, this.fault);
    }

    // Commit variable updates simultaneously
    for (const [k, v] of pendingWrites) {
      ctx.variables.set(k, v);
    }

    // Reset fault streak on valid execution
    ctx.faultStreak = 0;
    chosenIntent.gasUsed = this.gas;
    return chosenIntent;
  }

  private handleFault(ctx: BrainExecutionContext, fault: NonNullable<DecisionResult['fault']>): DecisionResult {
    ctx.faultStreak++;
    return {
      thrust: { forward: 0, strafe: 0 },
      turn: 0,
      modules: [],
      gasUsed: this.gas,
      fault,
    };
  }

  private consumeGas() {
    this.gas++;
    if (this.gas > GAS_LIMIT) {
      this.fault = 'gasFault';
    }
  }

  private evalInt(expr: IntExpr, sensors: Record<SensorName, number>, vars: Map<string, number | boolean>): number {
    this.consumeGas();
    if (this.fault) return 0;

    switch (expr.kind) {
      case 'const':
        return Math.floor(expr.value);
      case 'var': {
        const val = vars.get(expr.id);
        if (typeof val !== 'number') {
          this.fault = 'unknownVariableFault';
          return 0;
        }
        return val;
      }
      case 'sensor':
        return sensors[expr.name] !== undefined ? Math.floor(sensors[expr.name]) : 0;
      case 'op': {
        const left = this.evalInt(expr.left, sensors, vars);
        const right = this.evalInt(expr.right, sensors, vars);
        if (this.fault) return 0;

        switch (expr.op) {
          case 'add':
            return left + right;
          case 'sub':
            return left - right;
          case 'mul': {
            // BigInt intermediate products
            const prod = BigInt(left) * BigInt(right);
            // Saturated int32
            if (prod > 2147483647n) return 2147483647;
            if (prod < -2147483648n) return -2147483648;
            return Number(prod);
          }
          case 'div': {
            if (right === 0) {
              this.fault = 'divZeroFault';
              return 0;
            }
            return Number(BigInt(left) / BigInt(right));
          }
          case 'min':
            return Math.min(left, right);
          case 'max':
            return Math.max(left, right);
        }
        break;
      }
      case 'clamp': {
        const val = this.evalInt(expr.value, sensors, vars);
        const min = this.evalInt(expr.min, sensors, vars);
        const max = this.evalInt(expr.max, sensors, vars);
        if (min > max) {
          this.fault = 'clampFault';
          return 0;
        }
        return Math.max(min, Math.min(max, val));
      }
    }
    return 0;
  }

  private evalBool(expr: BoolExpr, sensors: Record<SensorName, number>, vars: Map<string, number | boolean>): boolean {
    this.consumeGas();
    if (this.fault) return false;

    switch (expr.kind) {
      case 'bool':
        return expr.value;
      case 'var': {
        const val = vars.get(expr.id);
        return Boolean(val);
      }
      case 'compare': {
        const l = this.evalInt(expr.left, sensors, vars);
        const r = this.evalInt(expr.right, sensors, vars);
        if (this.fault) return false;
        switch (expr.op) {
          case 'eq': return l === r;
          case 'ne': return l !== r;
          case 'lt': return l < r;
          case 'lte': return l <= r;
          case 'gt': return l > r;
          case 'gte': return l >= r;
        }
        break;
      }
      case 'all': {
        // Short-circuit: return false on first false
        for (const arg of expr.args) {
          const res = this.evalBool(arg, sensors, vars);
          if (this.fault) return false;
          if (!res) return false;
        }
        return true;
      }
      case 'any': {
        // Short-circuit: return true on first true
        for (const arg of expr.args) {
          const res = this.evalBool(arg, sensors, vars);
          if (this.fault) return false;
          if (res) return true;
        }
        return false;
      }
      case 'not':
        return !this.evalBool(expr.value, sensors, vars);
    }
    return false;
  }
}
