// PROMPT Chiến - Kinematic Motion, Fixed-Point Integrator & Collisions (ABI v2.0)
// 60 Hz simulation step. Positions in milli-units, velocities in milli-units/s.

import {
  rotateVector,
  normalizeAngle,
  isqrt,
  clampVectorNorm,
} from './math.js';
import { TransformedModule, computeBotAABB, Box2D } from './geometry.js';

export const ARENA_HALF_WIDTH = 20_000;   // 40 units wide (-20000..20000)
export const ARENA_HALF_HEIGHT = 14_000;  // 28 units high (-14000..14000)
export const TICKS_PER_SECOND = 60;
export const LINEAR_DAMPING = 100;        // 6000 / 60 milli-units/s per tick
export const ANGULAR_ACCEL_STEP = 34;     // 2048 / 60 angle units/s per tick

export interface BotKinematicsState {
  x: number;               // milli-units
  y: number;               // milli-units
  heading: number;         // 0..4095
  vx: number;              // milli-units/s
  vy: number;              // milli-units/s
  w: number;               // angular velocity (angle units/s)
  mass: number;            // locked mass
  initialThrusterTorque: number;
  residualVx: number;      // fractional remainder accumulator
  residualVy: number;
  residualW: number;
}

export interface PropulsionMetrics {
  drive: number;
  vMax: number;
  accel: number;
  wMax: number;
}

/**
 * Calculates current propulsion metrics based on locked mass and alive thrusters
 */
export function calculatePropulsionMetrics(
  mass: number,
  initialThrusterTorque: number,
  modules: TransformedModule[]
): PropulsionMetrics {
  const aliveThrusters = modules.filter(m => m.catalogId === 'thruster' && m.isAlive);
  const thrusterCount = aliveThrusters.length;

  const drive = Math.min(1000, Math.floor((8 * thrusterCount * 1000) / Math.max(1, mass)));
  const vMax = Math.floor((6000 * drive) / 1000);
  const accel = Math.floor((12000 * drive) / 1000);

  let currentTorque = 0;
  for (const t of aliveThrusters) {
    const dx = t.localCenter.x;
    const dy = t.localCenter.y;
    const distSq = dx * dx + dy * dy;
    const lever = Math.min(4000, isqrt(distSq));
    currentTorque += 1000 + lever;
  }

  const torqueRatio = initialThrusterTorque > 0
    ? Math.min(1000, Math.floor((currentTorque * 1000) / initialThrusterTorque))
    : 0;

  const wMax = Math.floor((1024 * torqueRatio) / 1000);

  return { drive, vMax, accel, wMax };
}

/**
 * Advances kinematic motion for one tick (1/60s)
 */
export function integrateMotion(
  state: BotKinematicsState,
  thrust: { forward: number; strafe: number },
  turn: number,
  metrics: PropulsionMetrics
): void {
  // 1. Clamp input thrust vector length <= 1000
  let f = Math.max(-1000, Math.min(1000, thrust.forward));
  let s = Math.max(-1000, Math.min(1000, thrust.strafe));
  const thrustLenSq = f * f + s * s;
  if (thrustLenSq > 1_000_000) {
    const len = isqrt(thrustLenSq);
    f = Math.trunc((f * 1000) / len);
    s = Math.trunc((s * 1000) / len);
  }

  // 2. Linear velocity approach
  if (f === 0 && s === 0) {
    // Deceleration / damping towards zero
    if (state.vx > 0) state.vx = Math.max(0, state.vx - LINEAR_DAMPING);
    else if (state.vx < 0) state.vx = Math.min(0, state.vx + LINEAR_DAMPING);

    if (state.vy > 0) state.vy = Math.max(0, state.vy - LINEAR_DAMPING);
    else if (state.vy < 0) state.vy = Math.min(0, state.vy + LINEAR_DAMPING);
  } else {
    // Desired local velocity
    const localTargetVx = Math.trunc((metrics.vMax * f) / 1000);
    const localTargetVy = Math.trunc((metrics.vMax * s) / 1000);
    const worldTarget = rotateVector(localTargetVx, localTargetVy, state.heading);
    const clampedTarget = clampVectorNorm(worldTarget.x, worldTarget.y, metrics.vMax);

    const accelStep = Math.trunc(metrics.accel / TICKS_PER_SECOND);
    const dvx = clampedTarget.x - state.vx;
    const dvy = clampedTarget.y - state.vy;
    const dvLenSq = dvx * dvx + dvy * dvy;

    if (dvLenSq <= accelStep * accelStep) {
      state.vx = clampedTarget.x;
      state.vy = clampedTarget.y;
    } else {
      const dvLen = isqrt(dvLenSq);
      if (dvLen > 0) {
        state.vx += Math.trunc((dvx * accelStep) / dvLen);
        state.vy += Math.trunc((dvy * accelStep) / dvLen);
      }
    }
  }

  // 3. Angular velocity approach
  const clampedTurn = Math.max(-1000, Math.min(1000, turn));
  const targetW = Math.trunc((metrics.wMax * clampedTurn) / 1000);
  const dw = targetW - state.w;

  if (Math.abs(dw) <= ANGULAR_ACCEL_STEP) {
    state.w = targetW;
  } else {
    state.w += dw > 0 ? ANGULAR_ACCEL_STEP : -ANGULAR_ACCEL_STEP;
  }

  // 4. Integrate positions with fractional remainder
  const stepX = state.vx + state.residualVx;
  const deltaX = Math.trunc(stepX / TICKS_PER_SECOND);
  state.residualVx = stepX % TICKS_PER_SECOND;
  state.x += deltaX;

  const stepY = state.vy + state.residualVy;
  const deltaY = Math.trunc(stepY / TICKS_PER_SECOND);
  state.residualVy = stepY % TICKS_PER_SECOND;
  state.y += deltaY;

  const stepW = state.w + state.residualW;
  const deltaW = Math.trunc(stepW / TICKS_PER_SECOND);
  state.residualW = stepW % TICKS_PER_SECOND;
  state.heading = normalizeAngle(state.heading + deltaW);
}

/**
 * Resolves arena wall collisions to keep all active vertices within arena bounds
 */
export function resolveWallCollisions(state: BotKinematicsState, aabb: Box2D): void {
  // Check Min X wall
  if (aabb.minX < -ARENA_HALF_WIDTH) {
    const pen = -ARENA_HALF_WIDTH - aabb.minX;
    state.x += pen;
    if (state.vx < 0) state.vx = 0;
  }
  // Check Max X wall
  if (aabb.maxX > ARENA_HALF_WIDTH) {
    const pen = aabb.maxX - ARENA_HALF_WIDTH;
    state.x -= pen;
    if (state.vx > 0) state.vx = 0;
  }
  // Check Min Y wall
  if (aabb.minY < -ARENA_HALF_HEIGHT) {
    const pen = -ARENA_HALF_HEIGHT - aabb.minY;
    state.y += pen;
    if (state.vy < 0) state.vy = 0;
  }
  // Check Max Y wall
  if (aabb.maxY > ARENA_HALF_HEIGHT) {
    const pen = aabb.maxY - ARENA_HALF_HEIGHT;
    state.y -= pen;
    if (state.vy > 0) state.vy = 0;
  }
}

/**
 * Resolves body vs body collision between Bot A and Bot B (max 4 solver iterations)
 * Inelastic response along contact normal; preserves tangential velocities.
 */
export function resolveBodyCollisions(
  stateA: BotKinematicsState,
  aabbA: Box2D,
  stateB: BotKinematicsState,
  aabbB: Box2D
): boolean {
  // Quick AABB overlap rejection
  const overlapX = Math.min(aabbA.maxX, aabbB.maxX) - Math.max(aabbA.minX, aabbB.minX);
  const overlapY = Math.min(aabbA.maxY, aabbB.maxY) - Math.max(aabbA.minY, aabbB.minY);

  if (overlapX <= 0 || overlapY <= 0) {
    return false; // No collision
  }

  // Minimum translation vector along smaller overlap axis
  let nx = 0;
  let ny = 0;
  let penetration = 0;

  if (overlapX < overlapY) {
    penetration = overlapX;
    nx = stateA.x < stateB.x ? -1 : 1;
  } else {
    penetration = overlapY;
    ny = stateA.y < stateB.y ? -1 : 1;
  }

  // Distribute positional correction based on mass
  const totalMass = stateA.mass + stateB.mass;
  const ratioA = stateB.mass / totalMass;
  const ratioB = stateA.mass / totalMass;

  stateA.x += Math.trunc(nx * penetration * ratioA);
  stateA.y += Math.trunc(ny * penetration * ratioA);
  stateB.x -= Math.trunc(nx * penetration * ratioB);
  stateB.y -= Math.trunc(ny * penetration * ratioB);

  // Inelastic normal response on velocities
  const relVx = stateA.vx - stateB.vx;
  const relVy = stateA.vy - stateB.vy;
  const vn = relVx * nx + relVy * ny;

  if (vn < 0) {
    // Moving towards each other, remove normal velocity component
    stateA.vx -= Math.trunc(vn * nx * ratioA);
    stateA.vy -= Math.trunc(vn * ny * ratioA);
    stateB.vx += Math.trunc(vn * nx * ratioB);
    stateB.vy += Math.trunc(vn * ny * ratioB);
  }

  return true;
}
