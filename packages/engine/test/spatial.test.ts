import { describe, it, expect } from 'vitest';
import {
  isqrt,
  normalizeAngle,
  relativeBearing,
  integerAtan2,
  rotateVector,
  segmentIntersectsCell,
  resolveWallCollisions,
  resolveBodyCollisions,
  BotKinematicsState,
  ARENA_HALF_WIDTH,
  ARENA_HALF_HEIGHT,
} from '../src/index.js';

describe('Engine - Spatial Determinism & CCD (T04)', () => {
  it('isqrt calculates exact floor square roots for standard and large numbers', () => {
    expect(isqrt(0)).toBe(0);
    expect(isqrt(1)).toBe(1);
    expect(isqrt(4)).toBe(2);
    expect(isqrt(9)).toBe(3);
    expect(isqrt(15)).toBe(3);
    expect(isqrt(16)).toBe(4);
    expect(isqrt(1_000_000)).toBe(1000);
    expect(isqrt(2_000_000_000n)).toBe(44721);
  });

  it('normalizes angles and calculates relative bearings symmetrically', () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(4096)).toBe(0);
    expect(normalizeAngle(-1024)).toBe(3072);

    // Opposite angles: bearing should be +-2048
    expect(Math.abs(relativeBearing(0, 2048))).toBe(2048);
    // Relative bearings in [-2048..2047]
    expect(relativeBearing(0, 1024)).toBe(1024);
    expect(relativeBearing(1024, 0)).toBe(-1024);
  });

  it('calculates integerAtan2 accurately across all 4 quadrants', () => {
    expect(integerAtan2(0, 1000)).toBe(0);         // +X = 0
    expect(integerAtan2(1000, 0)).toBe(1024);      // +Y = 1024
    expect(integerAtan2(0, -1000)).toBe(2048);     // -X = 2048
    expect(integerAtan2(-1000, 0)).toBe(3072);     // -Y = 3072
  });

  it('prevents projectile tunneling via Continuous Collision Detection (CCD)', () => {
    // High-speed step jumping directly over a cell: from x=-1000 to x=+1000 in one tick
    const p1 = { x: -1000, y: 0 };
    const p2 = { x: 1000, y: 0 };
    const cellMin = { x: -500, y: -500 };
    const cellMax = { x: 500, y: 500 };

    const isect = segmentIntersectsCell(p1, p2, cellMin, cellMax);
    expect(isect.hit).toBe(true);
    expect(isect.t).toBeCloseTo(0.25, 2);
    expect(isect.point?.x).toBe(-500);
  });

  it('rejects ray missing the cell bounds', () => {
    const p1 = { x: -1000, y: 2000 };
    const p2 = { x: 1000, y: 2000 };
    const cellMin = { x: -500, y: -500 };
    const cellMax = { x: 500, y: 500 };

    const isect = segmentIntersectsCell(p1, p2, cellMin, cellMax);
    expect(isect.hit).toBe(false);
  });

  it('constrains bot motion within arena walls', () => {
    const state: BotKinematicsState = {
      x: ARENA_HALF_WIDTH + 500,
      y: 0,
      heading: 0,
      vx: 500,
      vy: 0,
      w: 0,
      mass: 50,
      initialThrusterTorque: 2000,
      residualVx: 0,
      residualVy: 0,
      residualW: 0,
    };
    const aabb = {
      minX: ARENA_HALF_WIDTH - 500,
      minY: -1000,
      maxX: ARENA_HALF_WIDTH + 1000, // Penetratiing wall by 1000
      maxY: 1000,
    };

    resolveWallCollisions(state, aabb);
    expect(state.x).toBe(ARENA_HALF_WIDTH - 500);
    expect(state.vx).toBe(0); // Normal velocity stopped
  });

  it('resolves body-to-body collision inelastically without sticking or damage', () => {
    const botA: BotKinematicsState = {
      x: 0, y: 0, heading: 0, vx: 500, vy: 0, w: 0, mass: 40,
      initialThrusterTorque: 1000, residualVx: 0, residualVy: 0, residualW: 0,
    };
    const botB: BotKinematicsState = {
      x: 800, y: 0, heading: 2048, vx: -500, vy: 0, w: 0, mass: 40,
      initialThrusterTorque: 1000, residualVx: 0, residualVy: 0, residualW: 0,
    };

    const aabbA = { minX: -500, minY: -500, maxX: 500, maxY: 500 };
    const aabbB = { minX: 300, minY: -500, maxX: 1300, maxY: 500 }; // Overlap in X of 200

    const collided = resolveBodyCollisions(botA, aabbA, botB, aabbB);
    expect(collided).toBe(true);
    // Relative velocity along normal removed
    expect(botA.vx).toBeLessThanOrEqual(botB.vx);
  });
});
