// PROMPT Chiến - Objectives, Ring Shrink, Timeout & Scoring (ABI v2.0)
// Control circle at center (radius 3 units = 3000 milli-units) from tick 600.
// Ring shrinks tick 3600..5400 from radius 25000 to 6000 milli-units.

export const MAX_MATCH_TICKS = 5400;
export const CONTROL_START_TICK = 600;
export const CONTROL_RADIUS = 3000;
export const RING_WARN_TICK = 3480;
export const RING_START_TICK = 3600;
export const RING_INITIAL_RADIUS = 25_000;
export const RING_FINAL_RADIUS = 6_000;

export interface ObjectiveState {
  controlTicksA: number;
  controlTicksB: number;
  currentRingRadius: number;
  ringRemainderA: number;
  ringRemainderB: number;
}

export function initObjectiveState(): ObjectiveState {
  return {
    controlTicksA: 0,
    controlTicksB: 0,
    currentRingRadius: RING_INITIAL_RADIUS,
    ringRemainderA: 0,
    ringRemainderB: 0,
  };
}

/**
 * Computes the ring radius at a given tick
 */
export function getRingRadiusAtTick(tick: number): number {
  if (tick < RING_START_TICK) {
    return RING_INITIAL_RADIUS;
  }
  if (tick >= MAX_MATCH_TICKS) {
    return RING_FINAL_RADIUS;
  }
  const progress = tick - RING_START_TICK;
  const shrink = Math.floor((19_000 * progress) / 1800);
  return RING_INITIAL_RADIUS - shrink;
}

/**
 * Evaluates control circle occupation and ring damage for both bots at the current tick
 */
export function updateObjectives(
  tick: number,
  obj: ObjectiveState,
  corePosA: { x: number; y: number },
  corePosB: { x: number; y: number },
  coreHpA: { hp: number; maxHp: number },
  coreHpB: { hp: number; maxHp: number }
): { ringDamageA: number; ringDamageB: number; controlOwner: number } {
  obj.currentRingRadius = getRingRadiusAtTick(tick);

  // 1. Control Circle (+1 controlTick from tick 600 if exactly one Core is inside radius 3000)
  let controlOwner = 0; // 0 = contested/none, 1 = A, -1 = B
  if (tick >= CONTROL_START_TICK) {
    const distSqA = corePosA.x * corePosA.x + corePosA.y * corePosA.y;
    const distSqB = corePosB.x * corePosB.x + corePosB.y * corePosB.y;
    const ctrlRadiusSq = CONTROL_RADIUS * CONTROL_RADIUS;

    const insideA = distSqA <= ctrlRadiusSq;
    const insideB = distSqB <= ctrlRadiusSq;

    if (insideA && !insideB) {
      obj.controlTicksA++;
      controlOwner = 1;
    } else if (insideB && !insideA) {
      obj.controlTicksB++;
      controlOwner = -1;
    }
  }

  // 2. Ring Damage (50/1000 maxCoreHP per second outside ring)
  const ringRadiusSq = obj.currentRingRadius * obj.currentRingRadius;
  const distSqA = corePosA.x * corePosA.x + corePosA.y * corePosA.y;
  const distSqB = corePosB.x * corePosB.x + corePosB.y * corePosB.y;

  let ringDamageA = 0;
  let ringDamageB = 0;

  if (distSqA > ringRadiusSq) {
    // 50 * maxCoreHp / (1000 * 60)
    const accum = coreHpA.maxHp * 50 + obj.ringRemainderA;
    ringDamageA = Math.floor(accum / 60_000);
    obj.ringRemainderA = accum % 60_000;
  } else {
    obj.ringRemainderA = 0;
  }

  if (distSqB > ringRadiusSq) {
    const accum = coreHpB.maxHp * 50 + obj.ringRemainderB;
    ringDamageB = Math.floor(accum / 60_000);
    obj.ringRemainderB = accum % 60_000;
  } else {
    obj.ringRemainderB = 0;
  }

  return { ringDamageA, ringDamageB, controlOwner };
}

/**
 * Calculates score for timeout adjudication according to Docs/02_GAMEPLAY.md:
 * D = floor(actualEnemyHPDamage * 1000 / enemyInitialTotalHP), clamp 0..1000
 * C = floor(controlTicks * 1000 / 4800), clamp 0..1000
 * H = floor(coreHP * 1000 / initialCoreHP)
 * score = 5 * C + 3 * D + 2 * H (0..10000)
 */
export function calculateTimeoutScore(
  controlTicks: number,
  damageDealt: number,
  enemyInitialTotalHp: number,
  coreHp: number,
  initialCoreHp: number
): number {
  const C = Math.min(1000, Math.max(0, Math.floor((controlTicks * 1000) / 4800)));
  const D = Math.min(1000, Math.max(0, Math.floor((damageDealt * 1000) / Math.max(1, enemyInitialTotalHp))));
  const H = Math.min(1000, Math.max(0, Math.floor((coreHp * 1000) / Math.max(1, initialCoreHp))));

  return 5 * C + 3 * D + 2 * H;
}

export type MatchOutcome =
  | { winner: 'botA' | 'botB'; reason: 'core' | 'brainBudget' | 'timeoutScore' }
  | { winner: 'draw'; reason: 'coreDouble' | 'brainBudget' | 'timeoutTie' };

export function adjudicateTimeout(
  scoreA: number,
  scoreB: number
): MatchOutcome {
  if (Math.abs(scoreA - scoreB) <= 100) {
    return { winner: 'draw', reason: 'timeoutTie' };
  }
  return {
    winner: scoreA > scoreB ? 'botA' : 'botB',
    reason: 'timeoutScore',
  };
}
