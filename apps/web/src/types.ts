import type {
  BotDefinition,
  CombatEvent,
  MatchManifest,
  MatchResult,
  Placement,
  PublicFrame,
} from '@prompt-chien/contracts';

export interface BehaviorCard {
  hypothesis: string;
  attackConditions: string;
  partLossTactics: string;
  expectedWeaknesses: string;
}

export interface DraftBot {
  id: string;
  name: string;
  revision: number;
  updatedAt: string;
  definition: BotDefinition;
  behaviorCard: BehaviorCard;
  isUnofficial: true;
  parentRevision?: number | undefined;
}

export interface RevisionRecord {
  draftId: string;
  revision: number;
  timestamp: string;
  definition: BotDefinition;
  behaviorCard: BehaviorCard;
  summary: string;
}

export interface PrivateTraceStep {
  tick: number;
  actor: 'A' | 'B';
  stateId: string;
  ruleId: string | null;
  gas: number;
  fault: boolean;
  observationsUsed: string[];
  varDiff: Record<string, number | boolean>;
  rejections: string[];
}

export interface SimulationPayload {
  frames: PublicFrame[];
  result: MatchResult;
  manifest: MatchManifest;
  simulationHash: string;
  publicReplayHash: string;
  traces: PrivateTraceStep[];
}

export interface TurningPoint {
  tick: number;
  title: string;
  description: string;
  kind: 'windup' | 'hit' | 'module_broken' | 'core_critical' | 'ring';
  event?: CombatEvent | undefined;
}

export interface DebriefData {
  result: MatchResult;
  manifest: MatchManifest;
  turningPoints: TurningPoint[];
  frames: PublicFrame[];
  traces: PrivateTraceStep[];
}

export interface ExperimentScenarioResult {
  scenarioId: number;
  seed: string;
  leg1: {
    baselineScore: number;
    opponentScore: number;
    winner: 'A' | 'B' | 'draw';
    cause: string;
  };
  leg2: {
    baselineScore: number;
    opponentScore: number;
    winner: 'A' | 'B' | 'draw';
    cause: string;
  };
  candidateLeg1: {
    candidateScore: number;
    opponentScore: number;
    winner: 'A' | 'B' | 'draw';
    cause: string;
  };
  candidateLeg2: {
    candidateScore: number;
    opponentScore: number;
    winner: 'A' | 'B' | 'draw';
    cause: string;
  };
  scoreDelta: number;
}

export interface ExperimentRunResult {
  id: string;
  timestamp: string;
  draftId: string;
  baselineName: string;
  candidateName: string;
  opponentName: string;
  scenariosCount: number;
  baselineMeanScore: number;
  candidateMeanScore: number;
  scoreDelta: number;
  baselineWins: number;
  candidateWins: number;
  draws: number;
  representativeScenarioIndex: number;
  representativeReplay?: SimulationPayload | undefined;
  scenarios: ExperimentScenarioResult[];
}

// Worker Protocol
export type WorkerRequest =
  | { id: string; type: 'validate'; bot: BotDefinition }
  | { id: string; type: 'simulate'; botA: BotDefinition; botB: BotDefinition; seed?: string | undefined; swapped?: boolean | undefined }
  | { id: string; type: 'experiment'; baseline: BotDefinition; candidate: BotDefinition; opponent: BotDefinition; scenarioCount: number };

export type WorkerResponse =
  | { id: string; type: 'validate_success'; valid: true; packageHash: string; modules: Placement[] }
  | { id: string; type: 'validate_error'; valid: false; error: string; pointer?: string | undefined }
  | { id: string; type: 'simulate_success'; data: SimulationPayload }
  | { id: string; type: 'experiment_progress'; current: number; total: number }
  | { id: string; type: 'experiment_success'; data: ExperimentRunResult }
  | { id: string; type: 'worker_error'; message: string };

export interface DiagnosticsResult {
  valid: boolean;
  moduleCount: number;
  maxModules: number;
  pointCost: number;
  maxCost: number;
  weaponsCount: number;
  maxWeapons: number;
  mass: number;
  connected: boolean;
  disconnectedCells: string[];
  occlusions: {
    moduleId: string;
    catalogId: string;
    cell: { x: number; y: number };
    warning: string;
  }[];
  unreachableStates: string[];
  deadRules: { stateId: string; ruleId: string; reason: string }[];
  errors: { message: string; pointer?: string | undefined }[];
}
