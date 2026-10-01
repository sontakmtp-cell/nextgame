// PROMPT Chiến - Deterministic Integer Mathematics & Trigonometry LUT (ABI v2.0)
// Zero Floating Point. Scale = 1,000,000. Angles = 0..4095 (4096 = 2*PI).

export const TRIG_SCALE = 1_000_000;
export const ANGLE_STEPS = 4096;

export const COS_LUT = new Int32Array(ANGLE_STEPS);
export const SIN_LUT = new Int32Array(ANGLE_STEPS);

// Deterministically populate LUT at load time
for (let i = 0; i < ANGLE_STEPS; i++) {
  const theta = (i * 2 * Math.PI) / ANGLE_STEPS;
  COS_LUT[i] = Math.round(Math.cos(theta) * TRIG_SCALE);
  SIN_LUT[i] = Math.round(Math.sin(theta) * TRIG_SCALE);
}

export function normalizeAngle(angle: number): number {
  return ((angle % ANGLE_STEPS) + ANGLE_STEPS) % ANGLE_STEPS;
}

export function lutCos(angle: number): number {
  return COS_LUT[normalizeAngle(angle)];
}

export function lutSin(angle: number): number {
  return SIN_LUT[normalizeAngle(angle)];
}

/**
 * Integer square root returning floor(sqrt(n)).
 * Non-negative numbers only.
 */
export function isqrt(n: number | bigint): number {
  const num = typeof n === 'bigint' ? n : BigInt(Math.max(0, Math.floor(n)));
  if (num === 0n) return 0;
  if (num < 4n) return 1;

  let x0 = num / 2n;
  let x1 = (x0 + num / x0) / 2n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x0 + num / x0) / 2n;
  }
  return Number(x0);
}

/**
 * Rotates a 2D integer vector (x, y) by an integer angle (0..4095)
 * Returns truncated integer coordinates using BigInt 64-bit intermediates.
 */
export function rotateVector(x: number, y: number, angle: number): { x: number; y: number } {
  const c = BigInt(lutCos(angle));
  const s = BigInt(lutSin(angle));
  const bx = BigInt(x);
  const by = BigInt(y);
  const scale = BigInt(TRIG_SCALE);

  const rx = (bx * c - by * s) / scale;
  const ry = (bx * s + by * c) / scale;

  return { x: Number(rx), y: Number(ry) };
}

/**
 * Signed relative bearing from angle A to angle B in range [-2048..2047].
 * Positive is counter-clockwise (+Y).
 */
export function relativeBearing(fromAngle: number, toAngle: number): number {
  let diff = normalizeAngle(toAngle) - normalizeAngle(fromAngle);
  if (diff > 2047) diff -= 4096;
  if (diff < -2048) diff += 4096;
  return diff;
}

/**
 * Deterministic integer atan2 returning angle in range 0..4095.
 */
export function integerAtan2(y: number, x: number): number {
  if (x === 0 && y === 0) return 0;
  const len = isqrt(BigInt(x) * BigInt(x) + BigInt(y) * BigInt(y));
  if (len === 0) return 0;

  // Normalized target unit vector scaled by TRIG_SCALE
  const targetCos = Number((BigInt(x) * BigInt(TRIG_SCALE)) / BigInt(len));
  const targetSin = Number((BigInt(y) * BigInt(TRIG_SCALE)) / BigInt(len));

  // Determine quadrant
  let low = 0;
  let high = ANGLE_STEPS - 1;

  if (targetSin >= 0) {
    if (targetCos >= 0) {
      low = 0; high = 1024;
    } else {
      low = 1024; high = 2048;
    }
  } else {
    if (targetCos < 0) {
      low = 2048; high = 3072;
    } else {
      low = 3072; high = 4095;
    }
  }

  // Binary search within quadrant for highest dot product (closest angle)
  let bestAngle = low;
  let bestDot = -Infinity;

  for (let a = low; a <= high; a++) {
    const dot = BigInt(targetCos) * BigInt(COS_LUT[a]) + BigInt(targetSin) * BigInt(SIN_LUT[a]);
    const dotNum = Number(dot);
    if (dotNum > bestDot) {
      bestDot = dotNum;
      bestAngle = a;
    }
  }

  return bestAngle;
}

/**
 * Clamps vector length to maxLen while preserving direction.
 */
export function clampVectorNorm(x: number, y: number, maxLen: number): { x: number; y: number } {
  const lenSq = BigInt(x) * BigInt(x) + BigInt(y) * BigInt(y);
  const maxLenSq = BigInt(maxLen) * BigInt(maxLen);
  if (lenSq <= maxLenSq) {
    return { x, y };
  }
  const len = isqrt(lenSq);
  if (len === 0) return { x: 0, y: 0 };
  const nx = Number((BigInt(x) * BigInt(maxLen)) / BigInt(len));
  const ny = Number((BigInt(y) * BigInt(maxLen)) / BigInt(len));
  return { x: nx, y: ny };
}
