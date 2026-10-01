import { describe, it, expect } from 'vitest';
import {
  initCombatResources,
  initWeaponStates,
  tickResources,
  tryActivateWeapon,
  setShieldActive,
  advanceWeaponPhases,
  applyDamageToModule,
  TransformedModule,
  WeaponState,
} from '../src/index.js';

describe('Engine - Combat Slice & State Machines (T05)', () => {
  it('manages energy regeneration and heat dissipation with hysteresis', () => {
    const dummyModule: TransformedModule = {
      id: 'm1', catalogId: 'core', localCenter: { x: 0, y: 0 }, worldCenter: { x: 0, y: 0 },
      localVertices: [], worldVertices: [], orientationAngle: 0, worldHeading: 0, hp: 800, isAlive: true,
    };
    const res = initCombatResources([dummyModule]);
    res.energy = 500;
    res.heat = 990;

    // Tick 1
    tickResources(res, false);
    expect(res.energy).toBe(502); // +2 regen
    expect(res.heat).toBe(989);   // -1 base cooling

    // Overheat threshold trigger
    res.heat = 1000;
    res.isOverheated = true;

    // Cooling until <= 600
    res.heat = 601;
    tickResources(res, false);
    expect(res.isOverheated).toBe(false); // Cleared at 600
  });

  it('cycles Blade through exactly 18 windup, 6 active, and 30 recovery ticks', () => {
    const wState: WeaponState = {
      moduleId: 'blade_1',
      catalogId: 'blade',
      phase: 'idle',
      phaseTicks: 0,
      aimOffset: 0,
      isShieldActive: false,
      shieldCooldownLock: 0,
      attackInstanceId: 0,
      hasHitThisCycle: false,
    };
    const res = {
      energy: 1000, maxEnergy: 1000, heat: 0, isOverheated: false,
      radiatorCount: 0, capacitorCount: 0, initialTotalHp: 800, damageDealt: 0,
    };

    const activated = tryActivateWeapon(wState, res, 0);
    expect(activated).toBe(true);
    expect(wState.phase).toBe('windup');
    expect(res.energy).toBe(1000 - 140);
    expect(res.heat).toBe(180);

    const wMap = new Map([[wState.moduleId, wState]]);
    const projs: any[] = [];
    const nextProjId = { val: 1 };

    // Advance 18 ticks of windup
    for (let i = 0; i < 18; i++) {
      advanceWeaponPhases(wMap, res, 'botA', [], projs, nextProjId);
    }
    expect(wState.phase).toBe('active');

    // Advance 6 ticks of active
    for (let i = 0; i < 6; i++) {
      advanceWeaponPhases(wMap, res, 'botA', [], projs, nextProjId);
    }
    expect(wState.phase).toBe('recovery');

    // Advance 30 ticks of recovery
    for (let i = 0; i < 30; i++) {
      advanceWeaponPhases(wMap, res, 'botA', [], projs, nextProjId);
    }
    expect(wState.phase).toBe('idle');
  });

  it('applies Armor damage reduction (700/1000) for kinetic hits', () => {
    const armorMod: TransformedModule = {
      id: 'a1', catalogId: 'armor', localCenter: { x: 0, y: 0 }, worldCenter: { x: 0, y: 0 },
      localVertices: [], worldVertices: [], orientationAngle: 0, worldHeading: 0, hp: 300, isAlive: true,
    };
    const res = {
      energy: 1000, maxEnergy: 1000, heat: 0, isOverheated: false,
      radiatorCount: 0, capacitorCount: 0, initialTotalHp: 300, damageDealt: 0,
    };

    const rawDamage = 100;
    const hpLost = applyDamageToModule(armorMod, rawDamage, res, false);

    // 100 * 700 / 1000 = 70 damage taken
    expect(hpLost).toBe(70);
    expect(armorMod.hp).toBe(230);
  });

  it('absorbs incoming damage with active Shield paying proportional energy', () => {
    const targetMod: TransformedModule = {
      id: 'c1', catalogId: 'core', localCenter: { x: 0, y: 0 }, worldCenter: { x: 0, y: 0 },
      localVertices: [], worldVertices: [], orientationAngle: 0, worldHeading: 0, hp: 800, isAlive: true,
    };
    const res = {
      energy: 500, maxEnergy: 1000, heat: 0, isOverheated: false,
      radiatorCount: 0, capacitorCount: 0, initialTotalHp: 800, damageDealt: 0,
    };

    // Incoming 100 raw damage covered by shield
    // Blocked = floor(100 * 700 / 1000) = 70
    // Energy paid = ceil(70 / 2) = 35
    // Remainder damage to module = 100 - 70 = 30
    const hpLost = applyDamageToModule(targetMod, 100, res, true);

    expect(hpLost).toBe(30);
    expect(targetMod.hp).toBe(770);
    expect(res.energy).toBe(500 - 35);
  });
});
