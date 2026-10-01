import React, { useRef, useEffect } from 'react';
import { SimulationState } from '../../simulation/miniEngine';
import { MODULE_CATALOG } from '../../data/catalog';

interface ArenaCanvasProps {
  simState: SimulationState;
}

export const ArenaCanvas: React.FC<ArenaCanvasProps> = ({ simState }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Arena dimensions: 40 x 28 world units
  // Canvas size: 800 x 560 px (scale: 20 px per world unit)
  const SCALE = 20;
  const CANVAS_WIDTH = 40 * SCALE;
  const CANVAS_HEIGHT = 28 * SCALE;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Helper: World to Canvas coordinates
    // World origin (0, 0) is at center of canvas (CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
    const toCanvasX = (wx: number) => CANVAS_WIDTH / 2 + wx * SCALE;
    const toCanvasY = (wy: number) => CANVAS_HEIGHT / 2 - wy * SCALE; // World +Y is up

    // 1. Clear background (Arena Graphite #0E141A)
    ctx.fillStyle = '#0E141A';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 2. Arena subtle grid lines
    ctx.strokeStyle = '#1B2630';
    ctx.lineWidth = 1;
    for (let x = -20; x <= 20; x += 4) {
      ctx.beginPath();
      ctx.moveTo(toCanvasX(x), 0);
      ctx.lineTo(toCanvasX(x), CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let y = -14; y <= 14; y += 4) {
      ctx.beginPath();
      ctx.moveTo(0, toCanvasY(y));
      ctx.lineTo(CANVAS_WIDTH, toCanvasY(y));
      ctx.stroke();
    }

    // 3. Boundary Walls
    ctx.strokeStyle = '#39434C';
    ctx.lineWidth = 3;
    ctx.strokeRect(SCALE, SCALE, CANVAS_WIDTH - 2 * SCALE, CANVAS_HEIGHT - 2 * SCALE);

    // 4. Center Objective Circle (Radius 3, active from tick 600)
    const objActive = simState.tick >= 600;
    const objX = toCanvasX(0);
    const objY = toCanvasY(0);
    const objRadiusPx = 3 * SCALE;

    ctx.strokeStyle = objActive ? 'rgba(241, 200, 107, 0.4)' : 'rgba(85, 197, 138, 0.2)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(objX, objY, objRadiusPx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Center cross
    ctx.strokeStyle = '#293640';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(objX - 15, objY); ctx.lineTo(objX + 15, objY);
    ctx.moveTo(objX, objY - 15); ctx.lineTo(objX, objY + 15);
    ctx.stroke();

    if (objActive) {
      ctx.fillStyle = 'rgba(241, 200, 107, 0.6)';
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CONTROL OBJECTIVE', objX, objY - objRadiusPx - 6);
    }

    // 5. Ring of Fire (Vòng bo)
    if (simState.ringRadius < 25) {
      const ringPx = simState.ringRadius * SCALE;
      ctx.strokeStyle = 'rgba(236, 106, 104, 0.7)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.arc(objX, objY, ringPx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Outer hazard shading
      ctx.fillStyle = 'rgba(236, 106, 104, 0.08)';
      ctx.beginPath();
      ctx.arc(objX, objY, ringPx, 0, Math.PI * 2, true);
      ctx.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fill();
    }

    // Helper: Draw Synth
    const drawSynth = (bot: typeof simState.botA) => {
      const bx = toCanvasX(bot.x);
      const by = toCanvasY(bot.y);
      const angleRad = -(bot.heading / 4096) * Math.PI * 2; // World heading

      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(angleRad);

      const isTeamA = bot.team === 'A';
      const teamColor = isTeamA ? '#F27B59' : '#65C8D4';

      // 1. Draw modules relative to Core center
      const coreMod = bot.modules.find(m => m.catalogId === 'core');
      const coreX = coreMod ? coreMod.cell.x + 1 : 6;
      const coreY = coreMod ? coreMod.cell.y + 1 : 6;

      for (const m of bot.modules) {
        if (m.isDetached || (m.currentHp || 0) <= 0) continue;

        // Module center relative to Core center
        const relX = (m.cell.x + 0.5 - coreX) * SCALE * 0.8;
        const relY = -(m.cell.y + 0.5 - coreY) * SCALE * 0.8; // inverted Y

        const size = SCALE * 0.75;

        // Ceramic plate body
        ctx.fillStyle = m.catalogId === 'core' ? '#141C24' : '#D9D4C8';
        ctx.fillRect(relX - size / 2, relY - size / 2, size, size);

        // Alloy border
        ctx.strokeStyle = m.catalogId === 'core' ? '#F1C86B' : '#39434C';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(relX - size / 2, relY - size / 2, size, size);

        // Core Golden Dot
        if (m.catalogId === 'core') {
          ctx.fillStyle = '#F1C86B';
          ctx.beginPath();
          ctx.arc(relX, relY, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 2. Team Accent Ring & Nose Marker
      ctx.strokeStyle = teamColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 1.3 * SCALE, 0, Math.PI * 2);
      ctx.stroke();

      // Forward direction indicator (Nose needle)
      ctx.fillStyle = teamColor;
      ctx.beginPath();
      ctx.moveTo(1.3 * SCALE, -4);
      ctx.lineTo(1.8 * SCALE, 0);
      ctx.lineTo(1.3 * SCALE, 4);
      ctx.fill();

      // 3. Shield barrier arc (if active)
      if (bot.shieldActive) {
        ctx.strokeStyle = 'rgba(101, 200, 212, 0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        // 90 deg frontal arc
        ctx.arc(0, 0, 1.8 * SCALE, -Math.PI / 4, Math.PI / 4);
        ctx.stroke();
      }

      // 4. Weapon Telegraph (Windup)
      if (bot.activeTelegraph) {
        const tel = bot.activeTelegraph;
        const progress = tel.currentTick / tel.windupTicks;

        if (tel.type === 'blade') {
          // 90 deg forward sector
          ctx.fillStyle = `rgba(85, 197, 138, ${0.2 + progress * 0.3})`;
          ctx.strokeStyle = '#55C58A';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, 2.5 * SCALE, -Math.PI / 4, Math.PI / 4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (tel.type === 'lance') {
          // Long forward capsule
          ctx.fillStyle = `rgba(236, 106, 104, ${0.2 + progress * 0.4})`;
          ctx.strokeStyle = '#EC6A68';
          ctx.lineWidth = 2;
          ctx.strokeRect(1.4 * SCALE, -4, 3.5 * SCALE, 8);
          ctx.fillRect(1.4 * SCALE, -4, 3.5 * SCALE, 8);
        } else if (tel.type === 'burst' || tel.type === 'breaker') {
          // Projectile laser lanes
          ctx.strokeStyle = tel.type === 'burst' ? '#7EBBE8' : '#F0B85B';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(1.4 * SCALE, 0);
          ctx.lineTo(8 * SCALE, 0);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      ctx.restore();

      // Bot Name and Core HP floating overhead
      ctx.fillStyle = '#F4F1E8';
      ctx.font = 'bold 11px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`[${bot.team}] ${bot.botName}`, bx, by - 26);

      // Core HP mini bar
      const hpWidth = 36;
      const hpRatio = Math.max(0, bot.coreHp / 800);
      ctx.fillStyle = '#141C24';
      ctx.fillRect(bx - hpWidth / 2, by - 20, hpWidth, 4);
      ctx.fillStyle = isTeamA ? '#F27B59' : '#65C8D4';
      ctx.fillRect(bx - hpWidth / 2, by - 20, hpWidth * hpRatio, 4);
    };

    drawSynth(simState.botA);
    drawSynth(simState.botB);

    // 6. Draw Projectiles
    for (const p of simState.projectiles) {
      const px = toCanvasX(p.x);
      const py = toCanvasY(p.y);

      ctx.fillStyle = p.type === 'burst' ? '#7EBBE8' : '#F0B85B';
      ctx.beginPath();
      ctx.arc(px, py, p.type === 'burst' ? 3.5 : 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Tail
      ctx.strokeStyle = p.sourceTeam === 'A' ? 'rgba(242, 123, 89, 0.4)' : 'rgba(101, 200, 212, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - p.vx * 0.05 * SCALE, py + p.vy * 0.05 * SCALE);
      ctx.stroke();
    }
  }, [simState]);

  return (
    <div className="relative rounded-xl border border-[#293640] overflow-hidden bg-[#0E141A] shadow-2xl flex items-center justify-center p-2">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="block max-w-full h-auto rounded-lg shadow-inner"
      />
    </div>
  );
};
