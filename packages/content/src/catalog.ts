import { ModuleCatalogId } from '@nextgame/contracts';

export interface CatalogItem {
  id: ModuleCatalogId;
  name: string;
  cost: number;
  mass: number;
  hp: number;
  role: string;
  footprint: { w: number; h: number };
  enabledInSlice: boolean; // Lance/Breaker marked disabled until T13 as per T02 spec
  weaponStats?: {
    damage: number;
    reachOrRange: number;
    windup: number;
    active: number;
    recovery: number;
    energyCost: number;
    heatCost: number;
    geometryType: 'sector' | 'capsule' | 'burst_projectiles' | 'breaker_projectile';
  };
}

export const ALPHA_0_CATALOG: Record<ModuleCatalogId, CatalogItem> = {
  core: {
    id: 'core',
    name: 'Core Module',
    cost: 20,
    mass: 12,
    hp: 800,
    role: 'Energy source, terminal kill target, footprint 2x2',
    footprint: { w: 2, h: 2 },
    enabledInSlice: true,
  },
  thruster: {
    id: 'thruster',
    name: 'Thruster',
    cost: 6,
    mass: 3,
    hp: 180,
    role: 'Forward, strafe and rotational torque',
    footprint: { w: 1, h: 1 },
    enabledInSlice: true,
  },
  armor: {
    id: 'armor',
    name: 'Armor Plate',
    cost: 4,
    mass: 4,
    hp: 300,
    role: 'Kinetic mitigation (700/1000 damage on self)',
    footprint: { w: 1, h: 1 },
    enabledInSlice: true,
  },
  blade: {
    id: 'blade',
    name: 'Resonance Blade',
    cost: 14,
    mass: 5,
    hp: 220,
    role: 'Melee sweep 90 deg, damage 90, reach 1.5, 18/6/30 ticks',
    footprint: { w: 1, h: 1 },
    enabledInSlice: true,
    weaponStats: {
      damage: 90,
      reachOrRange: 1.5,
      windup: 18,
      active: 6,
      recovery: 30,
      energyCost: 140,
      heatCost: 180,
      geometryType: 'sector',
    },
  },
  lance: {
    id: 'lance',
    name: 'Heavy Lance',
    cost: 18,
    mass: 6,
    hp: 200,
    role: 'Piercing thrust, damage 140, reach 3.0, 30/1/59 ticks',
    footprint: { w: 1, h: 1 },
    enabledInSlice: false, // Marked not-enabled until T13 per T02 spec
    weaponStats: {
      damage: 140,
      reachOrRange: 3.0,
      windup: 30,
      active: 1,
      recovery: 59,
      energyCost: 220,
      heatCost: 280,
      geometryType: 'capsule',
    },
  },
  burst: {
    id: 'burst',
    name: 'Burst Projector',
    cost: 16,
    mass: 5,
    hp: 180,
    role: '3 projectiles x 32 dmg, range 12, speed 18/s, 18/9/45 ticks',
    footprint: { w: 1, h: 1 },
    enabledInSlice: true,
    weaponStats: {
      damage: 96,
      reachOrRange: 12.0,
      windup: 18,
      active: 9,
      recovery: 45,
      energyCost: 180,
      heatCost: 220,
      geometryType: 'burst_projectiles',
    },
  },
  shield: {
    id: 'shield',
    name: 'Barrier Shield',
    cost: 12,
    mass: 4,
    hp: 260,
    role: 'Frontal 90 deg arc barrier, blocks 70% damage, upkeep 1 energy/tick',
    footprint: { w: 1, h: 1 },
    enabledInSlice: true,
  },
  breaker: {
    id: 'breaker',
    name: 'Heat Breaker',
    cost: 12,
    mass: 4,
    hp: 180,
    role: '60 dmg + 180 heat projectile, range 6, 24/1/65 ticks',
    footprint: { w: 1, h: 1 },
    enabledInSlice: false, // Marked not-enabled until T13 per T02 spec
    weaponStats: {
      damage: 60,
      reachOrRange: 6.0,
      windup: 24,
      active: 1,
      recovery: 65,
      energyCost: 160,
      heatCost: 140,
      geometryType: 'breaker_projectile',
    },
  },
  capacitor: {
    id: 'capacitor',
    name: 'Flux Capacitor',
    cost: 8,
    mass: 2,
    hp: 160,
    role: '+250 energy capacity',
    footprint: { w: 1, h: 1 },
    enabledInSlice: true,
  },
  radiator: {
    id: 'radiator',
    name: 'Thermal Radiator',
    cost: 6,
    mass: 2,
    hp: 160,
    role: '+1 heat dissipation/tick (60/s)',
    footprint: { w: 1, h: 1 },
    enabledInSlice: true,
  },
};

export const CATALOG = ALPHA_0_CATALOG;
