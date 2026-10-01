// PROMPT Chiến - Deterministic Spatial Geometry & Colliders (ABI v2.0)
// Local units: milli-units (1 world unit = 1000 milli-units).

import { ModulePlacement } from '@nextgame/contracts';
import { rotateVector, normalizeAngle } from './math.js';

export interface Point2D {
  x: number;
  y: number;
}

export interface Box2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface TransformedModule {
  id: string;
  catalogId: string;
  localCenter: Point2D;
  worldCenter: Point2D;
  localVertices: Point2D[]; // 4 corners
  worldVertices: Point2D[]; // 4 corners
  orientationAngle: number; // 0..4095
  worldHeading: number;     // 0..4095
  hp: number;
  isAlive: boolean;
}

/**
 * Computes the center of the 2x2 Core in milli-units given its anchor cell (x, y)
 */
export function getCoreCenterMilli(coreAnchor: Point2D): Point2D {
  return {
    x: (coreAnchor.x + 1) * 1000,
    y: (coreAnchor.y + 1) * 1000,
  };
}

/**
 * Computes local module center in milli-units relative to Core center
 */
export function getModuleLocalCenter(cell: Point2D, coreCenter: Point2D, isCore: boolean = false): Point2D {
  if (isCore) {
    return { x: 0, y: 0 };
  }
  return {
    x: cell.x * 1000 + 500 - coreCenter.x,
    y: cell.y * 1000 + 500 - coreCenter.y,
  };
}

/**
 * Computes 4 corners in local coordinates for a 1x1 cell or 2x2 Core
 */
export function getModuleLocalCorners(localCenter: Point2D, isCore: boolean = false): Point2D[] {
  const half = isCore ? 1000 : 500;
  return [
    { x: localCenter.x - half, y: localCenter.y - half },
    { x: localCenter.x + half, y: localCenter.y - half },
    { x: localCenter.x + half, y: localCenter.y + half },
    { x: localCenter.x - half, y: localCenter.y + half },
  ];
}

/**
 * Transforms all bot modules into world coordinates given bot pose (x, y, heading)
 */
export function transformBotModules(
  modules: ModulePlacement[],
  botX: number,
  botY: number,
  botHeading: number,
  moduleHps?: Map<string, number>
): TransformedModule[] {
  const coreModule = modules.find(m => m.catalogId === 'core');
  const coreAnchor = coreModule ? coreModule.cell : { x: 5, y: 5 };
  const coreCenter = getCoreCenterMilli(coreAnchor);

  return modules.map(m => {
    const isCore = m.catalogId === 'core';
    const localCenter = getModuleLocalCenter(m.cell, coreCenter, isCore);
    const rotatedCenter = rotateVector(localCenter.x, localCenter.y, botHeading);
    const worldCenter = { x: botX + rotatedCenter.x, y: botY + rotatedCenter.y };

    const localCorners = getModuleLocalCorners(localCenter, isCore);
    const worldVertices = localCorners.map(corner => {
      const rot = rotateVector(corner.x, corner.y, botHeading);
      return { x: botX + rot.x, y: botY + rot.y };
    });

    const orientationAngle = normalizeAngle(m.orientation * 1024);
    const worldHeading = normalizeAngle(botHeading + orientationAngle);
    const currentHp = moduleHps ? (moduleHps.get(m.id) ?? 100) : 100;

    return {
      id: m.id,
      catalogId: m.catalogId,
      localCenter,
      worldCenter,
      localVertices: localCorners,
      worldVertices,
      orientationAngle,
      worldHeading,
      hp: currentHp,
      isAlive: currentHp > 0,
    };
  });
}

/**
 * Computes world AABB enclosing all active vertices of a bot
 */
export function computeBotAABB(modules: TransformedModule[]): Box2D {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const m of modules) {
    if (!m.isAlive) continue;
    for (const v of m.worldVertices) {
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
    }
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Continuous segment intersection test against an axis-aligned square cell.
 * Used for ray/projectile Continuous Collision Detection (CCD).
 * Returns parametric distance t in range [0..1] if hit, otherwise null.
 */
export function segmentIntersectsCell(
  p1: Point2D,
  p2: Point2D,
  cellMin: Point2D,
  cellMax: Point2D
): { hit: boolean; t: number; point?: Point2D } {
  let tmin = 0;
  let tmax = 1;

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  // X slab
  if (dx !== 0) {
    let t1 = (cellMin.x - p1.x) / dx;
    let t2 = (cellMax.x - p1.x) / dx;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return { hit: false, t: 1 };
  } else {
    if (p1.x < cellMin.x || p1.x > cellMax.x) return { hit: false, t: 1 };
  }

  // Y slab
  if (dy !== 0) {
    let t1 = (cellMin.y - p1.y) / dy;
    let t2 = (cellMax.y - p1.y) / dy;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return { hit: false, t: 1 };
  } else {
    if (p1.y < cellMin.y || p1.y > cellMax.y) return { hit: false, t: 1 };
  }

  if (tmax < 0 || tmin > 1) return { hit: false, t: 1 };

  const hitT = Math.max(0, tmin);
  return {
    hit: true,
    t: hitT,
    point: {
      x: Math.round(p1.x + dx * hitT),
      y: Math.round(p1.y + dy * hitT),
    },
  };
}
