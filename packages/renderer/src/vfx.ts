import type { PublicFrame, CombatEvent, PublicModule } from '@prompt-chien/contracts';
import { THEME } from './tokens.js';
import type { QualityTier } from './types.js';

/**
 * Deterministic VFX & Telegraph Director.
 * Complies with 06_ART_UX.md §9, §12 and 09_QUALITY_SECURITY.md Q12.
 * All effects are pure mathematical functions of (tick, frame, events).
 * Seek-safe: arbitrary forward or backward seeking yields 100% reproducible frames.
 */
export class VfxDirector {
  /**
   * Renders weapon telegraphs.
   * MUST be visible even when enableVfx is FALSE (gameplay readability contract).
   */
  public renderTelegraphs(
    ctx: CanvasRenderingContext2D,
    frame: PublicFrame,
    _tier: QualityTier = 'high'
  ): void {
    for (const actorId of ['A', 'B'] as const) {
      const actor = frame.actors[actorId];
      const teamColor = actorId === 'A' ? THEME.TEAM_A : THEME.TEAM_B;
      const core = actor.modules.find((m: PublicModule) => m.catalogId === 'core') ?? actor.modules[0];
      if (!core) continue;

      const actorX = actor.pose.x / 1000;
      const actorY = actor.pose.y / 1000;
      const actorHeading = (actor.pose.heading * Math.PI) / 2048;

      for (const m of actor.modules) {
        if (m.status !== 'alive') continue;

        // 1. Blade Windup Telegraph (Baseline 18 ticks / 300ms)
        if (m.catalogId === 'blade' && m.phase === 'windup') {
          ctx.save();
          ctx.translate(actorX, actorY);
          ctx.rotate(actorHeading);

          const modRelX = m.x - core.x - 1 + 0.5;
          const modRelY = m.y - core.y - 1 + 0.5;
          ctx.translate(modRelX, modRelY);

          // Attack Arc Sector: 60-degree forward cone, radius 2.5 meters
          const arcRadius = 2.5;
          const startAngle = -Math.PI / 6;
          const endAngle = Math.PI / 6;

          ctx.strokeStyle = THEME.WARNING_HEAT;
          ctx.lineWidth = 0.08;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, arcRadius, startAngle, endAngle);
          ctx.closePath();
          ctx.stroke();

          // Telegraph fill: semi-transparent warning hatch
          ctx.fillStyle = 'rgba(240, 184, 91, 0.18)';
          ctx.fill();

          // Telegraph boundary ticks
          ctx.strokeStyle = THEME.TEXT_PRIMARY;
          ctx.lineWidth = 0.04;
          ctx.beginPath();
          ctx.arc(0, 0, arcRadius, startAngle, endAngle);
          ctx.stroke();

          ctx.restore();
        }

        // 2. Burst Firing Lane Telegraph
        if (m.catalogId === 'burst' && m.phase === 'windup') {
          ctx.save();
          ctx.translate(actorX, actorY);
          ctx.rotate(actorHeading);

          const modRelX = m.x - core.x - 1 + 0.5;
          const modRelY = m.y - core.y - 1 + 0.5;
          ctx.translate(modRelX, modRelY);

          // 3 Projected Trajectory Lines (length 6 meters)
          ctx.strokeStyle = THEME.WARNING_HEAT;
          ctx.lineWidth = 0.05;
          ctx.setLineDash([0.4, 0.2]);

          for (const yOffset of [-0.2, 0, 0.2]) {
            ctx.beginPath();
            ctx.moveTo(0, yOffset);
            ctx.lineTo(6.0, yOffset);
            ctx.stroke();
          }

          ctx.restore();
        }

        // 3. Shield Projection Boundary
        if (m.catalogId === 'shield' && (m.phase === 'active' || m.phase === 'windup')) {
          ctx.save();
          ctx.translate(actorX, actorY);
          ctx.rotate(actorHeading);

          const modRelX = m.x - core.x - 1 + 0.5;
          const modRelY = m.y - core.y - 1 + 0.5;
          ctx.translate(modRelX, modRelY);

          ctx.strokeStyle = teamColor;
          ctx.lineWidth = 0.08;
          ctx.beginPath();
          ctx.arc(0, 0, 1.8, -Math.PI / 3, Math.PI / 3);
          ctx.stroke();

          ctx.restore();
        }
      }
    }
  }

  /**
   * Renders dynamic combat visual effects for current tick and recent events.
   * Only called when enableVfx is TRUE.
   */
  public renderVfx(
    ctx: CanvasRenderingContext2D,
    frame: PublicFrame,
    events: CombatEvent[],
    currentTick: number,
    tier: QualityTier = 'high'
  ): void {
    // 1. Blade Active Slash Arc
    for (const actorId of ['A', 'B'] as const) {
      const actor = frame.actors[actorId];
      const core = actor.modules.find((m: PublicModule) => m.catalogId === 'core') ?? actor.modules[0];
      if (!core) continue;

      const actorX = actor.pose.x / 1000;
      const actorY = actor.pose.y / 1000;
      const actorHeading = (actor.pose.heading * Math.PI) / 2048;

      for (const m of actor.modules) {
        if (m.catalogId === 'blade' && m.phase === 'active') {
          ctx.save();
          ctx.translate(actorX, actorY);
          ctx.rotate(actorHeading);
          const modRelX = m.x - core.x - 1 + 0.5;
          const modRelY = m.y - core.y - 1 + 0.5;
          ctx.translate(modRelX, modRelY);

          // Sweeping crescent blade slash
          ctx.strokeStyle = THEME.CERAMIC_LIT;
          ctx.lineWidth = 0.16;
          ctx.beginPath();
          ctx.arc(0, 0, 2.6, -Math.PI / 4, Math.PI / 4);
          ctx.stroke();

          if (tier === 'high') {
            ctx.strokeStyle = THEME.TEXT_PRIMARY;
            ctx.lineWidth = 0.06;
            ctx.beginPath();
            ctx.arc(0, 0, 2.7, -Math.PI / 5, Math.PI / 5);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    }

    // 2. Render recent combat events (time window: max 24 ticks / 400ms)
    const recentWindow = 24;
    for (const evt of events) {
      const ageTicks = currentTick - evt.tick;
      if (ageTicks < 0 || ageTicks > recentWindow) continue;

      const progress = ageTicks / recentWindow; // 0 (just happened) to 1 (expired)
      const alpha = Math.max(0, 1 - progress);

      const targetActor = evt.actor === 'A' || evt.actor === 'B' ? frame.actors[evt.actor] : undefined;
      const px = targetActor ? targetActor.pose.x / 1000 : 0;
      const py = targetActor ? targetActor.pose.y / 1000 : 0;

      if (evt.kind === 'hit' || evt.kind === 'blocked') {
        ctx.save();
        ctx.translate(px, py);

        if (evt.kind === 'blocked') {
          // Shield ripple wave
          ctx.strokeStyle = `rgba(101, 200, 212, ${alpha * 0.8})`;
          ctx.lineWidth = 0.1;
          ctx.beginPath();
          ctx.arc(0, 0, 0.5 + progress * 1.5, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // Ceramic impact fracture flash
          ctx.fillStyle = `rgba(241, 234, 220, ${alpha * 0.9})`;
          ctx.beginPath();
          ctx.arc(0, 0, 0.2 + (1 - progress) * 0.3, 0, Math.PI * 2);
          ctx.fill();

          // Ceramic chip debris (deterministic outward scatter)
          const chipCount = tier === 'high' ? 6 : 3;
          ctx.fillStyle = `rgba(217, 212, 200, ${alpha * 0.75})`;
          for (let i = 0; i < chipCount; i++) {
            const angle = ((evt.tick * 13 + i * 37) % 360) * (Math.PI / 180);
            const dist = 0.3 + progress * 1.2;
            const cx = dist * Math.cos(angle);
            const cy = dist * Math.sin(angle);
            ctx.fillRect(cx - 0.04, cy - 0.04, 0.08, 0.08);
          }
        }
        ctx.restore();
      } else if (evt.kind === 'destroyed' || evt.kind === 'detached') {
        ctx.save();
        ctx.translate(px, py);

        // Burst of ceramic shards
        const shardCount = tier === 'high' ? 8 : 4;
        ctx.fillStyle = `rgba(217, 212, 200, ${alpha})`;
        for (let i = 0; i < shardCount; i++) {
          const angle = ((evt.tick * 17 + i * 43) % 360) * (Math.PI / 180);
          const dist = 0.2 + progress * 1.8;
          const sx = dist * Math.cos(angle);
          const sy = dist * Math.sin(angle);
          ctx.fillRect(sx - 0.06, sy - 0.06, 0.12, 0.12);
        }

        // Dissipating smoke circle
        ctx.strokeStyle = `rgba(57, 67, 76, ${alpha * 0.5})`;
        ctx.lineWidth = 0.08;
        ctx.beginPath();
        ctx.arc(0, 0, 0.4 + progress * 1.2, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      }
    }

    // 3. Core Critical Alert (when Core HP < 30)
    for (const actorId of ['A', 'B'] as const) {
      const actor = frame.actors[actorId];
      const core = actor.modules.find((m: PublicModule) => m.catalogId === 'core');
      if (core && core.hp > 0 && core.hp <= 30) {
        const actorX = actor.pose.x / 1000;
        const actorY = actor.pose.y / 1000;

        // Harmonic pulse (period: 30 ticks = 0.5s at 60Hz, 2Hz frequency max)
        const pulse = 0.5 + 0.5 * Math.sin((currentTick / 30) * Math.PI * 2);

        ctx.save();
        ctx.translate(actorX, actorY);
        ctx.strokeStyle = `rgba(236, 106, 104, ${0.3 + pulse * 0.4})`;
        ctx.lineWidth = 0.08;
        ctx.beginPath();
        ctx.arc(0, 0, 1.6 + pulse * 0.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
}
