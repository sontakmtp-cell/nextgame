// PROMPT Chiến - Core Contract Types (ABI Baseline v2.0)
// Zero I/O, Pure TypeScript definitions

export type ModuleCatalogId =
  | 'core'
  | 'thruster'
  | 'armor'
  | 'blade'
  | 'lance'
  | 'burst'
  | 'shield'
  | 'breaker'
  | 'capacitor'
  | 'radiator';

export type Orientation = 0 | 1 | 2 | 3; // 0=+X, 1=+Y, 2=-X, 3=-Y

export interface ModulePlacement {
  id: string; // ASCII [A-Za-z][A-Za-z0-9_-]{0,47}
  catalogId: ModuleCatalogId;
  cell: { x: number; y: number }; // 0..11 on 12x12 grid
  orientation: Orientation;
}

export interface BotBody {
  grid: 'square-12-v1';
  modules: ModulePlacement[];
}

export type SensorName =
  | 'clock.tick'
  | 'clock.decision'
  | 'clock.stateAge'
  | 'self.energy'
  | 'self.heat'
  | 'self.coreHpPermille'
  | 'self.overheated'
  | 'self.speed'
  | 'self.x'
  | 'self.y'
  | 'self.heading'
  | 'enemy.distance'
  | 'enemy.bearing'
  | 'enemy.speed'
  | 'enemy.heading'
  | 'enemy.coreHpPermille'
  | 'enemy.telegraph'
  | 'arena.centerBearing'
  | 'arena.centerDistance'
  | 'arena.controlOwner'
  | 'arena.ringRadius'
  | 'self.outsideRing';

export type IntExpr =
  | { kind: 'const'; value: number }
  | { kind: 'var'; id: string }
  | { kind: 'sensor'; name: SensorName }
  | { kind: 'op'; op: 'add' | 'sub' | 'mul' | 'div' | 'min' | 'max'; left: IntExpr; right: IntExpr }
  | { kind: 'clamp'; value: IntExpr; min: IntExpr; max: IntExpr };

export type BoolExpr =
  | { kind: 'bool'; value: boolean }
  | { kind: 'var'; id: string }
  | { kind: 'compare'; op: 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte'; left: IntExpr; right: IntExpr }
  | { kind: 'all'; args: BoolExpr[] }
  | { kind: 'any'; args: BoolExpr[] }
  | { kind: 'not'; value: BoolExpr };

export interface ModuleIntent {
  moduleId: string;
  action: 'activate' | 'shieldOn' | 'shieldOff';
  aimOffset?: IntExpr; // clamped -256..256 for burst/breaker, 0 for blade/lance
  priority: number;    // 0..15, 0 is highest priority
}

export interface Rule {
  id: string;
  description?: string;
  when: BoolExpr;
  set?: { variable: string; value: IntExpr }[];
  intent: {
    thrust: { forward: IntExpr; strafe: IntExpr }; // -1000..1000
    turn: IntExpr;                                  // -1000..1000
    modules: ModuleIntent[];
  };
  nextState?: string;
}

export interface SkillDefinition {
  id: string;
  parameters: { id: string; type: 'int' | 'bool' }[];
  body: {
    when: BoolExpr;
    intent: Rule['intent'];
    set?: Rule['set'];
    nextState?: string;
  };
}

export interface BrainState {
  id: string;
  name?: string;
  description?: string;
  rules: Rule[];
}

export interface BrainSource {
  abiVersion: '2.0';
  initialState: string;
  variables: { id: string; type: 'int' | 'bool'; initial: number | boolean }[];
  skills: SkillDefinition[];
  states: BrainState[];
}

export interface BehaviorCard {
  hypothesis: string;
  tactics: string;
  knownWeaknesses: string;
}

export interface BotDefinition {
  schemaVersion: '2.0';
  name: string;
  body: BotBody;
  brain: BrainSource;
  cosmetic: {
    skinId: string;
    paletteId: string;
  };
}

export interface BotPackage {
  canonicalGameplay: string;
  packageHash: string; // SHA-256 hex
  compilerDigest: string;
  catalogDigest: string;
}

export interface ValidationError {
  type: 'error' | 'warning';
  code: string;
  message: string;
  cell?: { x: number; y: number };
}

export interface ValidationReport {
  isValid: boolean;
  packageHash?: string;
  totalModules: number;
  totalCost: number;
  totalMass: number;
  boundingRadiusMilli: number;
  coreFound: boolean;
  isConnected: boolean;
  weaponCount: number;
  thrusterCount: number;
  vMax: number;
  wMax: number;
  energyCap: number;
  heatDissipation: number;
  errors: ValidationError[];
}

export interface MatchManifest {
  engineDigest: string;
  rulesetDigest: string;
  catalogDigest: string;
  brainAbiVersion: string;
  packageHashA: string;
  packageHashB: string;
  seed: string; // 16 bytes hex (128-bit)
  scenarioId: number; // 0..1224
  presetValues: {
    yLeft: number;
    yRight: number;
    jitterLeft: number;
    jitterRight: number;
  };
  spawnSlotAssignment: 'leg0_standard' | 'leg1_swapped';
  maxTicks: number; // 5400
}

export interface ReplayFrame {
  tick: number;
  poses: {
    botA: { x: number; y: number; heading: number; vx: number; vy: number };
    botB: { x: number; y: number; heading: number; vx: number; vy: number };
  };
  resources: {
    botA: { energy: number; heat: number; coreHp: number; isOverheated: boolean };
    botB: { energy: number; heat: number; coreHp: number; isOverheated: boolean };
  };
  events: any[];
}
