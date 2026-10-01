// PROMPT Chiến - Combat Slice, Weapon State Machines, Resources & Destruction (ABI v2.0)
// 60 Hz simulation. Energy regen 2/tick, Heat cooling 1/tick + radiators.

import { TransformedModule, Point2D } from './geometry.js';
import { rotateVector, normalizeAngle, relativeBearing } from './math.js';

export interface WeaponState {
  moduleId: string;
  catalogId: 'blade' | 'burst' | 'shield';
  phase: 'idle' | 'windup' | 'active' | 'recovery';
  phaseTicks: number;
  aimOffset: number;       // clamped -256..256
  isShieldActive: boolean;
  shieldCooldownLock: number; // 30 ticks after deactivation
  attackInstanceId: number;
  hasHitThisCycle: boolean;
}

export interface Projectile {
  id: number;
  ownerSlot: 'botA' | 'botB';
  x: number;               // milli-units
  y: number;               // milli-units
  vx: number;              // milli-units/s
  vy: number;              // milli-units/s
  remainingRange: number;  // milli-units
  damage: number;
}

export interface BotCombatResources {
  energy: number;
  maxEnergy: number;
  heat: number;
  isOverheated: boolean;
  radiatorCount: number;
  capacitorCount: number;
  initialTotalHp: number;
  damageDealt: number;
}

/**
 * Creates default initial combat resources for a bot
 */
export function initCombatResources(modules: TransformedModule[]): BotCombatResources {
  const capCount = modules.filter(m => m.catalogId === 'capacitor').length;
  const radCount = modules.filter(m => m.catalogId === 'radiator').length;
  const maxEnergy = 1000 + 250 * capCount;
  const totalHp = modules.reduce((sum, m) => sum + m.hp, 0);

  return {
    energy: maxEnergy,
    maxEnergy,
    heat: 0,
    isOverheated: false,
    radiatorCount: radCount,
    capacitorCount: capCount,
    initialTotalHp: totalHp,
    damageDealt: 0,
  };
}

/**
 * Initializes weapon state machines for all active weapon modules
 */
export function initWeaponStates(modules: TransformedModule[]): Map<string, WeaponState> {
  const map = new Map<string, WeaponState>();
  for (const m of modules) {
    if (m.catalogId === 'blade' || m.catalogId === 'burst' || m.catalogId === 'shield') {
      map.set(m.id, {
        moduleId: m.id,
        catalogId: m.catalogId,
        phase: 'idle',
        phaseTicks: 0,
        aimOffset: 0,
        isShieldActive: false,
        shieldCooldownLock: 0,
        attackInstanceId: 0,
        hasHitThisCycle: false,
      });
    }
  }
  return map;
}

/**
 * Phase 1: Resource regeneration and cooling at the start of each tick
 */
export function tickResources(res: BotCombatResources, isShieldActive: boolean): void {
  // 1. Energy regeneration: +2 per tick
  res.energy = Math.min(res.maxEnergy, res.energy + 2);

  // 2. Shield upkeep: -1 energy per tick
  if (isShieldActive) {
    res.energy = Math.max(0, res.energy - 1);
  }

  // 3. Heat dissipation: base 1/tick + 1/tick per radiator
  const dissipation = 1 + res.radiatorCount;
  res.heat = Math.max(0, res.heat - dissipation);

  // 4. Overheat recovery hysteresis
  if (res.isOverheated && res.heat <= 600) {
    res.isOverheated = false;
  }
}

/**
 * Handles module intent activation (called on decision tick)
 */
export function tryActivateWeapon(
  wState: WeaponState,
  res: BotCombatResources,
  aimOffset: number = 0
): boolean {
  if (wState.catalogId === 'shield') return false; // Shield uses toggle
  if (wState.phase !== 'idle' || res.isOverheated) return false;

  let energyCost = 0;
  let heatCost = 0;

  if (wState.catalogId === 'blade') {
    energyCost = 140;
    heatCost = 180;
  } else if (wState.catalogId === 'burst') {
    energyCost = 180;
    heatCost = 220;
  }

  if (res.energy < energyCost) return false;

  // Pay costs immediately
  res.energy -= energyCost;
  res.heat += heatCost;
  if (res.heat >= 1000) {
    res.isOverheated = true;
  }

  wState.phase = 'windup';
  wState.phaseTicks = 0;
  wState.aimOffset = Math.max(-256, Math.min(256, aimOffset));
  wState.attackInstanceId++;
  wState.hasHitThisCycle = false;

  return true;
}

/**
 * Toggles Shield on or off
 */
export function setShieldActive(wState: WeaponState, res: BotCombatResources, active: boolean): boolean {
  if (wState.catalogId !== 'shield') return false;

  if (active) {
    if (wState.isShieldActive) return true; // Already active
    if (res.isOverheated || wState.shieldCooldownLock > 0 || res.energy < 40) return false;

    res.energy -= 40;
    res.heat += 20;
    if (res.heat >= 1000) res.isOverheated = true;

    wState.isShieldActive = true;
    return true;
  } else {
    if (!wState.isShieldActive) return true;
    wState.isShieldActive = false;
    wState.shieldCooldownLock = 30; // 30 ticks lock after deactivation
    return true;
  }
}

/**
 * Advances weapon phases for one tick
 */
export function advanceWeaponPhases(
  wStates: Map<string, WeaponState>,
  res: BotCombatResources,
  ownerSlot: 'botA' | 'botB',
  botModules: TransformedModule[],
  spawnProjectiles: Projectile[],
  nextProjId: { val: number }
): void {
  for (const wState of wStates.values()) {
    // Shield cooldown lock decay
    if (wState.shieldCooldownLock > 0) {
      wState.shieldCooldownLock--;
    }

    // Auto-disable shield if overheated or depleted
    if (wState.isShieldActive && (res.isOverheated || res.energy <= 0)) {
      wState.isShieldActive = false;
      wState.shieldCooldownLock = 30;
    }

    if (wState.catalogId === 'shield') continue;

    wState.phaseTicks++;

    if (wState.catalogId === 'blade') {
      // Blade: 18 windup / 6 active / 30 recovery
      if (wState.phase === 'windup' && wState.phaseTicks >= 18) {
        wState.phase = 'active';
        wState.phaseTicks = 0;
      } else if (wState.phase === 'active' && wState.phaseTicks >= 6) {
        wState.phase = 'recovery';
        wState.phaseTicks = 0;
      } else if (wState.phase === 'recovery' && wState.phaseTicks >= 30) {
        wState.phase = 'idle';
        wState.phaseTicks = 0;
      }
    } else if (wState.catalogId === 'burst') {
      // Burst: 18 windup / 9 active / 45 recovery
      if (wState.phase === 'windup' && wState.phaseTicks >= 18) {
        wState.phase = 'active';
        wState.phaseTicks = 0;
      }

      if (wState.phase === 'active') {
        // Spawns projectile at active offsets 0, 4, 8 ticks
        if (wState.phaseTicks === 0 || wState.phaseTicks === 4 || wState.phaseTicks === 8) {
          const mod = botModules.find(m => m.id === wState.moduleId);
          if (mod && mod.isAlive) {
            const fireHeading = normalizeAngle(mod.worldHeading + wState.aimOffset);
            // Muzzle position 500 milli-units forward from module center
            const muzzleOffset = rotateVector(500, 0, fireHeading);
            const muzzlePos = {
              x: mod.worldCenter.x + muzzleOffset.x,
              y: mod.worldCenter.y + muzzleOffset.y,
            };
            // Speed 18 units/s = 18,000 milli-units/s
            const vel = rotateVector(18_000, 0, fireHeading);

            spawnProjectiles.push({
              id: nextProjId.val++,
              ownerSlot,
              x: muzzlePos.x,
              y: muzzlePos.y,
              vx: vel.x,
              vy: vel.y,
              remainingRange: 12_000, // 12 units
              damage: 32,
            });
          }
        }

        if (wState.phaseTicks >= 9) {
          wState.phase = 'recovery';
          wState.phaseTicks = 0;
        }
      } else if (wState.phase === 'recovery' && wState.phaseTicks >= 45) {
        wState.phase = 'idle';
        wState.phaseTicks = 0;
      }
    }
  }
}

/**
 * Applies damage packet to defender module, taking shield & armor into account
 */
export function applyDamageToModule(
  targetModule: TransformedModule,
  rawDamage: number,
  defenderRes: BotCombatResources,
  isShieldArcCovering: boolean
): number {
  let effectiveDamage = rawDamage;

  // 1. Shield reduction: blocks floor(R * 700 / 1000) for min(B, 2 * energy)
  if (isShieldArcCovering && defenderRes.energy > 0) {
    const rawToBlock = Math.floor((effectiveDamage * 700) / 1000);
    const actualBlocked = Math.min(rawToBlock, defenderRes.energy * 2);
    const energyCost = Math.ceil(actualBlocked / 2);

    defenderRes.energy = Math.max(0, defenderRes.energy - energyCost);
    effectiveDamage -= actualBlocked;
  }

  // 2. Armor reduction: kinetic damage hitting Armor is reduced to 700/1000
  if (targetModule.catalogId === 'armor') {
    effectiveDamage = Math.floor((effectiveDamage * 700) / 1000);
  }

  // 3. Apply HP damage
  const hpLost = Math.min(targetModule.hp, effectiveDamage);
  targetModule.hp -= hpLost;
  if (targetModule.hp <= 0) {
    targetModule.hp = 0;
    targetModule.isAlive = false;
  }

  return hpLost;
}
