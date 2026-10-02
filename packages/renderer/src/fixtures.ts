import type { PublicFrame, CombatEvent } from '@prompt-chien/contracts';
import type { EventGalleryItem } from './types.js';

/**
 * Creates canonical test frames for event gallery inspection and automated visual regression.
 * Conforms 100% to PublicFrame / PublicActor / CombatEvent schemas.
 */
export function createSampleCombatFrames(): { frames: PublicFrame[]; events: CombatEvent[] } {
  const frames: PublicFrame[] = [];
  const events: CombatEvent[] = [];

  // 60 frames (1 full second at 60 Hz)
  for (let tick = 0; tick < 60; tick++) {
    const actorAX = -12000 + tick * 150; // Moving right
    const actorBX = 12000 - tick * 100; // Moving left

    // Frame 18-36: Blade windup phase on Mantis (18 ticks / 300ms)
    const bladePhase = tick >= 18 && tick < 36 ? 'windup' : tick >= 36 && tick < 42 ? 'active' : 'idle';

    // Frame 40: Burst firing from Bastion
    const burstPhase = tick >= 38 && tick < 46 ? 'windup' : tick >= 46 && tick < 54 ? 'active' : 'idle';

    // Frame 38: Shield active on Bastion
    const shieldPhase = tick >= 34 && tick < 50 ? 'active' : 'idle';

    const tickEvents: CombatEvent[] = [];

    if (tick === 36) {
      // Blade impact on Bastion
      const evt: CombatEvent = {
        tick: 36,
        kind: 'hit',
        actor: 'A',
        module: 1,
        target: 3,
        value: 30000,
        key: 101,
      };
      events.push(evt);
      tickEvents.push(evt);
    }
    if (tick === 37) {
      // Module destroyed on Bastion
      const evt: CombatEvent = {
        tick: 37,
        kind: 'destroyed',
        actor: 'B',
        module: 3,
        target: 3,
        value: 0,
        key: 102,
      };
      events.push(evt);
      tickEvents.push(evt);
    }
    if (tick === 44) {
      // Shield blocks burst projectile
      const evt: CombatEvent = {
        tick: 44,
        kind: 'blocked',
        actor: 'B',
        module: 1,
        target: 0,
        value: 15000,
        key: 103,
      };
      events.push(evt);
      tickEvents.push(evt);
    }

    const frame: PublicFrame = {
      boundary: tick + 1,
      actors: {
        A: {
          pose: { x: actorAX, y: 0, heading: 0 },
          overheated: false,
          controlTicks: tick > 30 ? tick - 30 : 0,
          modules: [
            { ordinal: 0, catalogId: 'core', x: 5, y: 5, orientation: 0, hp: 100000, status: 'alive', phase: 'idle', phaseOffset: 0, shield: false, aim: 0 },
            { ordinal: 1, catalogId: 'blade', x: 7, y: 5, orientation: 0, hp: 50000, status: 'alive', phase: bladePhase, phaseOffset: 0, shield: false, aim: 0 },
            { ordinal: 2, catalogId: 'armor', x: 5, y: 7, orientation: 0, hp: 100000, status: 'alive', phase: 'idle', phaseOffset: 0, shield: false, aim: 0 },
            { ordinal: 3, catalogId: 'thruster', x: 4, y: 5, orientation: 0, hp: 40000, status: 'alive', phase: 'idle', phaseOffset: 0, shield: false, aim: 0 },
          ],
        },
        B: {
          pose: { x: actorBX, y: 0, heading: 2048 },
          overheated: false,
          controlTicks: 0,
          modules: [
            { ordinal: 0, catalogId: 'core', x: 5, y: 5, orientation: 0, hp: tick >= 37 ? 70000 : 100000, status: 'alive', phase: 'idle', phaseOffset: 0, shield: false, aim: 0 },
            { ordinal: 1, catalogId: 'shield', x: 3, y: 5, orientation: 0, hp: 80000, status: 'alive', phase: shieldPhase, phaseOffset: 0, shield: shieldPhase === 'active', aim: 0 },
            { ordinal: 2, catalogId: 'burst', x: 3, y: 6, orientation: 0, hp: 45000, status: 'alive', phase: burstPhase, phaseOffset: 0, shield: false, aim: 0 },
            { ordinal: 3, catalogId: 'armor', x: 5, y: 7, orientation: 0, hp: tick >= 37 ? 0 : 100000, status: tick >= 37 ? 'destroyed' : 'alive', phase: 'idle', phaseOffset: 0, shield: false, aim: 0 },
          ],
        },
      },
      projectiles: [],
      controlOwner: tick > 30 ? 'A' : 'neutral',
      ringRadius: 28000 - tick * 100,
      events: tickEvents,
    };

    frames.push(frame);
  }

  return { frames, events };
}

/**
 * Event Gallery catalog for interactive UI inspection and screenshot tests.
 */
export function getEventGallery(): EventGalleryItem[] {
  const { frames, events } = createSampleCombatFrames();

  return [
    {
      id: 'gallery_windup',
      name: 'Blade Windup Telegraph (18 ticks / 300ms)',
      description: 'Mantis prepares forward blade strike; 60-degree warning arc is fully visible with VFX off.',
      frameIndex: 24,
      tick: 24,
      eventType: 'telegraph_windup',
      actorId: 'A',
      frames,
      events,
    },
    {
      id: 'gallery_blade_active',
      name: 'Blade Active Slash & Ceramic Impact',
      description: 'Blade strikes opponent chassis, triggering directional ceramic fracture sparks.',
      frameIndex: 36,
      tick: 36,
      eventType: 'blade_active',
      actorId: 'A',
      frames,
      events,
    },
    {
      id: 'gallery_module_break',
      name: 'Module Destruction & Fragment Scatter',
      description: 'Bastion armor module shatters into ceramic shards that dissipate cleanly in <=400ms.',
      frameIndex: 38,
      tick: 38,
      eventType: 'module_destroyed',
      actorId: 'B',
      frames,
      events,
    },
    {
      id: 'gallery_shield_block',
      name: 'Shield Protective Barrier & Energy Ripple',
      description: 'Bastion shield absorbs incoming projectile, dampening impact with acoustic filter cue.',
      frameIndex: 44,
      tick: 44,
      eventType: 'shield_block',
      actorId: 'B',
      frames,
      events,
    },
    {
      id: 'gallery_burst_lane',
      name: 'Burst Triple Projectile Lane',
      description: 'Forward trajectory lines indicating weapon aim across 3 offsets (0, 4, 8 ticks).',
      frameIndex: 42,
      tick: 42,
      eventType: 'burst_telegraph',
      actorId: 'B',
      frames,
      events,
    },
  ];
}
