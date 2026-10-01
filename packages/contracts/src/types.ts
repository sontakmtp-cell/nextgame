export type ValueType = 'int' | 'bool';
export type Expr =
  | { kind: 'const'; value: number }
  | { kind: 'bool'; value: boolean }
  | { kind: 'var' | 'param'; id: string }
  | { kind: 'sensor'; name: string }
  | { kind: 'op'; op: 'add' | 'sub' | 'mul' | 'div' | 'min' | 'max'; left: Expr; right: Expr }
  | { kind: 'compare'; op: 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte'; left: Expr; right: Expr }
  | { kind: 'clamp'; value: Expr; min: Expr; max: Expr }
  | { kind: 'all' | 'any'; args: Expr[] }
  | { kind: 'not'; value: Expr };
export interface Placement { id: string; catalogId: string; cell: { x: number; y: number }; orientation: 0 | 1 | 2 | 3 }
export type ModuleIntent = { moduleId: string; action: 'activate'; aimOffset: Expr; priority: number } | { moduleId: string; action: 'shieldOn' | 'shieldOff'; priority: number };
export interface IntentSource { thrust: { forward: Expr; strafe: Expr }; turn: Expr; modules: ModuleIntent[] }
export interface InlineRule { when: Expr; intent: IntentSource; set?: { variable: string; value: Expr }[]; nextState?: string | { parameter: string } }
export interface SkillCall { useSkill: string; args: Record<string, Expr | string> }
export type Rule = { id: string } & (InlineRule | SkillCall);
export interface BrainSource {
  abiVersion: '2.0'; initialState: string;
  variables: { id: string; type: ValueType; initial: number | boolean }[];
  skills: { id: string; parameters: { id: string; type: ValueType | 'state' }[]; body: InlineRule | SkillCall }[];
  states: { id: string; rules: Rule[] }[];
}
export interface BotDefinition { schemaVersion: '2.0'; name: string; body: { grid: 'square-12-v1'; modules: Placement[] }; brain: BrainSource; cosmetic: { skinId: string; paletteId: string } }
export interface Diagnostic { code: string; pointer: string; message: string }
export interface NormalizedIR { abiVersion: '2.0'; initialState: string; variables: BrainSource['variables']; states: { id: string; rules: ({ id: string } & InlineRule)[] }[] }
export interface CompiledBrain { brainAbiVersion: '2.0'; compilerDigest: string; normalizedIR: NormalizedIR; sourceMap: Record<string, string>; symbolMap: { modules: string[]; states: string[]; variables: string[] }; nodeCount: number }
export interface CanonicalGameplay { schemaVersion: '2.0'; brainAbiVersion: '2.0'; compilerDigest: string; catalogDigest: string; body: { grid: 'square-12-v1'; modules: Omit<Placement, 'id'>[] }; brain: NormalizedIR }
export interface BotPackage { canonicalGameplay: CanonicalGameplay; packageHash: string; presentationHash: string; capabilityDigest: string }
export interface ControlIntent { thrust: { forward: number; strafe: number }; turn: number; modules: ({ moduleOrdinal: number; action: 'activate'; aimOffset: number; priority: number } | { moduleOrdinal: number; action: 'shieldOn' | 'shieldOff'; priority: number })[] }
export interface Observation { tick: number; sensors: Record<string, number> }
export interface ValidationReport { packageHash: string; engineDigest: string; rulesetDigest: string; suiteDigest: string; status: 'passed' | 'failed'; diagnostics: Diagnostic[] }
export interface ExperimentSpec { baselineHash: string; candidateHash: string; opponentHashes: string[]; seedSetDigest: string; engineDigest: string; rulesetDigest: string; phase: 'exploration' | 'holdout' }
export interface Experiment { manifestDigest: string; spec: ExperimentSpec; status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'; pairedResults: { scenarioId: number; baseline: number; candidate: number }[]; confidence: { meanDeltaMillionths: number; lower95Millionths: number; upper95Millionths: number; resamples: 10000 } | null; cost: number }
export interface PresetValues { yLeft: number; yRight: number; jitterLeft: number; jitterRight: number }
export interface MatchManifest { engineDigest: string; rulesetDigest: string; catalogDigest: string; compilerDigest: string; brainAbiVersion: '2.0'; packageHashes: { A: string; B: string }; seed: string; arenaDigest: string; arenaInitDigest: string; scenarioId: number; presetValues: PresetValues; spawnSlotAssignment: { A: 'left' | 'right'; B: 'left' | 'right' }; maxTicks: 5400; numericalAbiVersion: 'milli-v1' }
export interface MatchResult { winner: 'A' | 'B' | 'draw'; cause: 'core' | 'coreDouble' | 'brainBudget' | 'timeout'; elapsedTicks: number; scores: { A: number; B: number } }
export interface ReplayManifest { version: '2.0'; match: MatchManifest; publicReplayHash: string; chunks: { firstBoundary: number; lastBoundary: number; hash: string; bytes: number }[]; result: MatchResult }
export interface Ratings { userId: string; seasonId: string; runId: string; rating: number; played: number; wins: number; draws: number; revision: number }
