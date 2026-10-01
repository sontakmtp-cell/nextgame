import { BrainSource, BrainState, Rule, IntExpr, BoolExpr, SkillDefinition } from '@nextgame/contracts';

export interface CompiledBrainIR {
  abiVersion: '2.0';
  compilerDigest: string;
  initialState: string;
  variables: BrainSource['variables'];
  states: BrainState[];
  totalNodes: number;
}

export interface CompilerDiagnostic {
  type: 'error' | 'warning';
  code: string;
  message: string;
}

export class BrainCompiler {
  private nodeCount = 0;
  private maxDepth = 0;

  compile(source: BrainSource): { ir?: CompiledBrainIR; diagnostics: CompilerDiagnostic[] } {
    const diagnostics: CompilerDiagnostic[] = [];
    this.nodeCount = 0;
    this.maxDepth = 0;

    // 1. Check basic limits
    if (source.states.length > 32) {
      diagnostics.push({
        type: 'error',
        code: 'MAX_STATES_EXCEEDED',
        message: `Vượt quá giới hạn số trạng thái (${source.states.length}/32).`,
      });
    }

    if (source.variables.length > 64) {
      diagnostics.push({
        type: 'error',
        code: 'MAX_VARS_EXCEEDED',
        message: `Vượt quá giới hạn số biến nhớ (${source.variables.length}/64).`,
      });
    }

    const stateIds = new Set(source.states.map((s: BrainState) => s.id));
    if (!stateIds.has(source.initialState)) {
      diagnostics.push({
        type: 'error',
        code: 'INITIAL_STATE_NOT_FOUND',
        message: `Trạng thái khởi đầu "${source.initialState}" không tồn tại.`,
      });
    }

    // 2. Expand skills (macros)
    const skillsMap = new Map<string, SkillDefinition>();
    for (const sk of source.skills || []) {
      skillsMap.set(sk.id, sk);
    }

    const compiledStates: BrainState[] = [];

    for (const state of source.states) {
      if (state.rules.length > 32) {
        diagnostics.push({
          type: 'error',
          code: 'MAX_RULES_EXCEEDED',
          message: `Trạng thái "${state.id}" có quá nhiều quy tắc (${state.rules.length}/32).`,
        });
      }

      const compiledRules: Rule[] = [];
      for (const rule of state.rules) {
        this.nodeCount++;
        this.inspectBoolExpr(rule.when, 1, diagnostics);

        this.inspectIntExpr(rule.intent.thrust.forward, 1, diagnostics);
        this.inspectIntExpr(rule.intent.thrust.strafe, 1, diagnostics);
        this.inspectIntExpr(rule.intent.turn, 1, diagnostics);

        for (const mi of rule.intent.modules) {
          this.nodeCount++;
          if (mi.aimOffset) this.inspectIntExpr(mi.aimOffset, 1, diagnostics);
        }

        if (rule.nextState && !stateIds.has(rule.nextState)) {
          diagnostics.push({
            type: 'error',
            code: 'UNKNOWN_NEXT_STATE',
            message: `Quy tắc "${rule.id}" chuyển sang trạng thái không tồn tại: "${rule.nextState}".`,
          });
        }

        compiledRules.push(rule);
      }

      compiledStates.push({
        id: state.id,
        name: state.name,
        rules: compiledRules,
      });
    }

    if (this.nodeCount > 2048) {
      diagnostics.push({
        type: 'error',
        code: 'MAX_NODES_EXCEEDED',
        message: `Vượt quá giới hạn nút AST (${this.nodeCount}/2048).`,
      });
    }

    if (this.maxDepth > 16) {
      diagnostics.push({
        type: 'error',
        code: 'MAX_DEPTH_EXCEEDED',
        message: `Độ sâu biểu thức vượt quá 16 (${this.maxDepth}).`,
      });
    }

    if (diagnostics.some(d => d.type === 'error')) {
      return { diagnostics };
    }

    return {
      ir: {
        abiVersion: '2.0',
        compilerDigest: 'sha256:alpha0_compiler_v2',
        initialState: source.initialState,
        variables: source.variables,
        states: compiledStates,
        totalNodes: this.nodeCount,
      },
      diagnostics,
    };
  }

  private inspectIntExpr(expr: IntExpr, depth: number, diagnostics: CompilerDiagnostic[]) {
    this.nodeCount++;
    if (depth > this.maxDepth) this.maxDepth = depth;

    if (expr.kind === 'op') {
      this.inspectIntExpr(expr.left, depth + 1, diagnostics);
      this.inspectIntExpr(expr.right, depth + 1, diagnostics);
    } else if (expr.kind === 'clamp') {
      this.inspectIntExpr(expr.value, depth + 1, diagnostics);
      this.inspectIntExpr(expr.min, depth + 1, diagnostics);
      this.inspectIntExpr(expr.max, depth + 1, diagnostics);
    }
  }

  private inspectBoolExpr(expr: BoolExpr, depth: number, diagnostics: CompilerDiagnostic[]) {
    this.nodeCount++;
    if (depth > this.maxDepth) this.maxDepth = depth;

    if (expr.kind === 'compare') {
      this.inspectIntExpr(expr.left, depth + 1, diagnostics);
      this.inspectIntExpr(expr.right, depth + 1, diagnostics);
    } else if (expr.kind === 'all' || expr.kind === 'any') {
      for (const arg of expr.args) {
        this.inspectBoolExpr(arg, depth + 1, diagnostics);
      }
    } else if (expr.kind === 'not') {
      this.inspectBoolExpr(expr.value, depth + 1, diagnostics);
    }
  }
}
