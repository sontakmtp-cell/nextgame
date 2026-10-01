// PROMPT Chiến - Game Types Definition (Baseline v2.0)
// Sources: Docs/02_GAMEPLAY.md, Docs/03_BOT_BRAIN.md, Docs/06_ART_UX.md

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

export interface ModuleCatalogItem {
  id: ModuleCatalogId;
  name: string;
  vietnameseName: string;
  cost: number;        // Build points (max 100)
  mass: number;        // Affects acceleration & max speed
  hp: number;          // Durability
  description: string;
  role: string;
  glyph: string;       // Visual glyph description
  footprint: { w: number; h: number };
  weaponStats?: {
    damage: number;
    reachOrRange: number;
    windup: number;    // in ticks (60Hz)
    active: number;
    recovery: number;
    energyCost: number;
    heatCost: number;
    geometryType: 'sector' | 'capsule' | 'burst_projectiles' | 'breaker_projectile';
  };
  shieldStats?: {
    arcDegrees: number;
    activationEnergy: number;
    activationHeat: number;
    upkeepEnergyPerTick: number;
    reductionFactor: number; // 700/1000 = 70%
  };
  specialEffect?: string;
}

export interface PlacedModule {
  id: string;
  catalogId: ModuleCatalogId;
  cell: { x: number; y: number }; // 0..11 on 12x12 grid
  orientation: 0 | 1 | 2 | 3;     // 0 = +X (Front), 1 = +Y (Left), 2 = -X (Back), 3 = -Y (Right)
  currentHp?: number;
  isDetached?: boolean;
}

// ---------------- Brain Types ----------------
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
  | 'arena.centerDistance';

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
  aimOffset?: IntExpr;
  priority: number;
}

export interface Rule {
  id: string;
  description?: string;
  when: BoolExpr;
  set?: { variable: string; value: IntExpr }[];
  intent: {
    thrust: { forward: IntExpr; strafe: IntExpr };
    turn: IntExpr;
    modules: ModuleIntent[];
  };
  nextState?: string;
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
  skills: any[];
  states: BrainState[];
}

export interface BehaviorCard {
  hypothesis: string;
  tactics: string;
  knownWeaknesses: string;
}

export interface BotDefinition {
  schemaVersion: '2.0';
  id: string;
  name: string;
  author: string;
  revision: number;
  body: {
    grid: 'square-12-v1';
    modules: PlacedModule[];
  };
  brain: BrainSource;
  cosmetic: {
    skinId: string;
    paletteId: string;
  };
  behaviorCard: BehaviorCard;
  lineage?: string;
  status?: 'Draft' | 'Validated' | 'RankedReady';
}

// ---------------- Validation Types ----------------
export interface ValidationError {
  type: 'error' | 'warning';
  code: string;
  message: string;
  cell?: { x: number; y: number };
}

export interface ValidationReport {
  isValid: boolean;
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

// ---------------- Combat & Arena Simulation Types ----------------
export interface CombatEntity {
  id: string;
  team: 'A' | 'B';
  botName: string;
  definition: BotDefinition;
  x: number;          // in world units (-20..20)
  y: number;          // in world units (-14..14)
  heading: number;    // 0..4095 angle units (0 = facing East/+X)
  vx: number;
  vy: number;
  angularVelocity: number;
  energy: number;
  maxEnergy: number;
  heat: number;
  maxHeat: number;
  isOverheated: boolean;
  coreHp: number;
  maxCoreHp: number;
  modules: PlacedModule[];
  currentBrainState: string;
  activeTelegraph?: {
    moduleId: string;
    type: 'blade' | 'lance' | 'burst' | 'breaker';
    currentTick: number;
    windupTicks: number;
  };
  shieldActive: boolean;
  controlTicks: number;
}

export interface CombatEvent {
  id: string;
  tick: number;
  timeSec: number;
  type: 'windup' | 'hit' | 'module_destroyed' | 'shield_block' | 'overheat' | 'control_point' | 'ring_damage' | 'victory';
  sourceTeam: 'A' | 'B';
  targetTeam?: 'A' | 'B';
  description: string;
  damage?: number;
  moduleId?: string;
}

export interface MatchDebrief {
  winner: 'A' | 'B' | 'Draw';
  reason: 'core_destroyed' | 'timeout_score' | 'brain_fault';
  scoreA: number;
  scoreB: number;
  durationSec: number;
  durationTicks: number;
  statsA: {
    damageDealt: number;
    modulesLost: number;
    controlShare: number;
    peakHeat: number;
  };
  statsB: {
    damageDealt: number;
    modulesLost: number;
    controlShare: number;
    peakHeat: number;
  };
  turningPoints: {
    tick: number;
    timeSec: number;
    title: string;
    description: string;
  }[];
}
