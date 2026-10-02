import { THEME, toGrayscaleHex } from './tokens.js';
import type { QualityTier } from './types.js';

export interface ModuleDrawOptions {
  catalogId: string;
  status: 'alive' | 'destroyed' | 'detached';
  isDamaged?: boolean;
  phase?: 'idle' | 'windup' | 'active' | 'recovery';
  team: 'A' | 'B';
  size: number; // 1 for 1x1, 2 for Core 2x2
  isSelected?: boolean;
  grayscale?: boolean;
  tier?: QualityTier;
}

/**
 * Renders an authored Synth module with living ceramic armor and alloy chassis.
 * Follows 06_ART_UX.md §3-§5 specifications.
 */
export function drawModule(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  opts: ModuleDrawOptions
): void {
  const {
    catalogId,
    status,
    phase = 'idle',
    team,
    size,
    isSelected = false,
    grayscale = false,
    tier = 'high',
  } = opts;

  ctx.save();
  ctx.translate(x, y);

  const teamColor = grayscale
    ? team === 'A'
      ? '#D0D0D0'
      : '#808080'
    : team === 'A'
    ? THEME.TEAM_A
    : THEME.TEAM_B;

  const ceramicColor = grayscale
    ? toGrayscaleHex(THEME.CERAMIC)
    : THEME.CERAMIC;
  const ceramicLitColor = grayscale
    ? toGrayscaleHex(THEME.CERAMIC_LIT)
    : THEME.CERAMIC_LIT;
  const alloyColor = grayscale ? toGrayscaleHex(THEME.ALLOY) : THEME.ALLOY;
  const coreGold = grayscale ? '#B0B0B0' : THEME.CORE;
  const warningColor = grayscale ? '#E0E0E0' : THEME.WARNING_HEAT;

  const padding = 0.05;
  const w = size - padding * 2;
  const h = size - padding * 2;
  const r = size === 2 ? 0.2 : 0.08;

  // 1. Alloy Sub-chassis
  ctx.fillStyle = alloyColor;
  ctx.beginPath();
  roundRect(ctx, padding, padding, w, h, r);
  ctx.fill();

  if (status === 'destroyed' || status === 'detached') {
    // Shattered core frame remains
    ctx.strokeStyle = '#202020';
    ctx.lineWidth = 0.05;
    ctx.stroke();
    // Jagged debris lines
    ctx.beginPath();
    ctx.moveTo(padding + 0.2, padding + 0.2);
    ctx.lineTo(padding + w - 0.2, padding + h - 0.2);
    ctx.moveTo(padding + 0.2, padding + h - 0.2);
    ctx.lineTo(padding + w - 0.2, padding + 0.2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // 2. Ceramic Armor Plate
  const plateInset = 0.08;
  const pw = w - plateInset * 2;
  const ph = h - plateInset * 2;

  ctx.fillStyle = isSelected ? ceramicLitColor : ceramicColor;
  ctx.beginPath();
  roundRect(ctx, padding + plateInset, padding + plateInset, pw, ph, r * 0.8);
  ctx.fill();

  // 3. Team Applique & Silhouette Accent
  ctx.strokeStyle = teamColor;
  ctx.lineWidth = 0.06;
  if (team === 'A') {
    // Team A: Solid continuous boundary stripe
    ctx.beginPath();
    roundRect(ctx, padding + plateInset, padding + plateInset, pw, ph, r * 0.8);
    ctx.stroke();
  } else {
    // Team B: Segmented / dashed stripe
    ctx.save();
    ctx.setLineDash([0.2, 0.1]);
    ctx.beginPath();
    roundRect(ctx, padding + plateInset, padding + plateInset, pw, ph, r * 0.8);
    ctx.stroke();
    ctx.restore();
  }

  // 4. Team Badge Indicator (In corner: Team A circle badge vs Team B hex badge)
  drawTeamBadge(ctx, padding + 0.2, padding + 0.2, team, teamColor);

  // 5. Fastener Studs / Plate Chamfers (for High / Medium tiers)
  if (tier !== 'low') {
    ctx.fillStyle = alloyColor;
    const studR = 0.03;
    const corners = [
      [padding + plateInset + 0.1, padding + plateInset + 0.1],
      [padding + w - plateInset - 0.1, padding + plateInset + 0.1],
      [padding + plateInset + 0.1, padding + h - plateInset - 0.1],
      [padding + w - plateInset - 0.1, padding + h - plateInset - 0.1],
    ];
    for (const [cx, cy] of corners) {
      if (cx !== undefined && cy !== undefined) {
        ctx.beginPath();
        ctx.arc(cx, cy, studR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 6. Module Glyph (Engraved icon at center)
  const centerX = padding + w / 2;
  const centerY = padding + h / 2;
  drawModuleGlyph(ctx, catalogId, centerX, centerY, size, {
    coreGold,
    alloyColor,
    teamColor,
    tier,
  });

  // 7. Damage cracks if damaged
  if (opts.isDamaged) {
    ctx.strokeStyle = '#303030';
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    ctx.moveTo(centerX - 0.3, centerY - 0.2);
    ctx.lineTo(centerX + 0.1, centerY);
    ctx.lineTo(centerX + 0.35, centerY + 0.3);
    ctx.stroke();
  }

  // 8. Weapon Windup Phase Highlight
  if (phase === 'windup') {
    ctx.strokeStyle = warningColor;
    ctx.lineWidth = 0.12;
    ctx.beginPath();
    roundRect(ctx, padding - 0.02, padding - 0.02, w + 0.04, h + 0.04, r + 0.02);
    ctx.stroke();
  } else if (phase === 'active') {
    ctx.strokeStyle = teamColor;
    ctx.lineWidth = 0.14;
    ctx.beginPath();
    roundRect(ctx, padding - 0.02, padding - 0.02, w + 0.04, h + 0.04, r + 0.02);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draws the distinctive team badge:
 * Team A: Circle with single top notch
 * Team B: Hexagon with dual lateral notches
 * Guarantees 100% grayscale identifiability without relying on color!
 */
export function drawTeamBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  team: 'A' | 'B',
  color: string
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 0.04;

  if (team === 'A') {
    // Circle with top notch
    ctx.beginPath();
    ctx.arc(0, 0, 0.12, 0, Math.PI * 2);
    ctx.stroke();
    // Top notch protrusion
    ctx.beginPath();
    ctx.moveTo(0, -0.12);
    ctx.lineTo(0, -0.18);
    ctx.stroke();
  } else {
    // Hexagon with dual notches
    ctx.beginPath();
    const hexR = 0.13;
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const hx = hexR * Math.cos(angle);
      const hy = hexR * Math.sin(angle);
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.stroke();
    // Lateral notches
    ctx.beginPath();
    ctx.moveTo(-hexR, 0);
    ctx.lineTo(-hexR - 0.06, 0);
    ctx.moveTo(hexR, 0);
    ctx.lineTo(hexR + 0.06, 0);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Module glyphs according to 06_ART_UX.md §3 table:
 * Core: concentric circles with gold highlight in 2x2 footprint
 * Thruster: pair of exhaust nozzle slits
 * Armor: double plate steps and edge bolts
 * Blade: angled cutting wedge and hone line
 * Burst: triple radiant emitter prongs
 * Shield: concave double arc curving inward
 * Capacitor: triple charge bars
 * Radiator: triple cooling leaf fins
 * Lance: elongated spearhead
 * Breaker: bifurcated impact block with fissure
 */
function drawModuleGlyph(
  ctx: CanvasRenderingContext2D,
  catalogId: string,
  cx: number,
  cy: number,
  _size: number,
  colors: { coreGold: string; alloyColor: string; teamColor: string; tier: QualityTier }
): void {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.strokeStyle = colors.alloyColor;
  ctx.fillStyle = colors.alloyColor;
  ctx.lineWidth = 0.06;

  switch (catalogId) {
    case 'core': {
      // 2x2 Concentric gold discs with cross alignment
      ctx.strokeStyle = colors.coreGold;
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.arc(0, 0, 0.55, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.arc(0, 0, 0.35, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = colors.coreGold;
      ctx.beginPath();
      ctx.arc(0, 0, 0.16, 0, Math.PI * 2);
      ctx.fill();

      // Alignment ticks
      ctx.beginPath();
      ctx.moveTo(-0.65, 0);
      ctx.lineTo(-0.45, 0);
      ctx.moveTo(0.45, 0);
      ctx.lineTo(0.65, 0);
      ctx.moveTo(0, -0.65);
      ctx.lineTo(0, -0.45);
      ctx.moveTo(0, 0.45);
      ctx.lineTo(0, 0.65);
      ctx.stroke();
      break;
    }

    case 'thruster': {
      // Two parallel exhaust nozzle slits at rear
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.moveTo(-0.16, -0.28);
      ctx.lineTo(-0.16, 0.28);
      ctx.moveTo(0.16, -0.28);
      ctx.lineTo(0.16, 0.28);
      ctx.stroke();

      // Rear chamber housing
      ctx.beginPath();
      ctx.moveTo(-0.25, -0.28);
      ctx.lineTo(0.25, -0.28);
      ctx.stroke();
      break;
    }

    case 'armor': {
      // Two overlapping plate layers and central bevel
      ctx.lineWidth = 0.07;
      ctx.strokeRect(-0.28, -0.28, 0.56, 0.56);
      ctx.strokeRect(-0.15, -0.15, 0.3, 0.3);
      break;
    }

    case 'blade': {
      // Angled diagonal slash wedge & chamfered facet
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.moveTo(-0.3, 0.3);
      ctx.lineTo(0.3, -0.3);
      ctx.stroke();

      // Wedge highlight
      ctx.beginPath();
      ctx.moveTo(-0.25, 0.35);
      ctx.lineTo(0.35, -0.25);
      ctx.lineTo(0.1, -0.35);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'burst': {
      // Three distinct forward projectile prongs
      ctx.lineWidth = 0.07;
      ctx.beginPath();
      // Left barrel
      ctx.moveTo(-0.22, -0.25);
      ctx.lineTo(-0.22, 0.25);
      // Center barrel
      ctx.moveTo(0, -0.32);
      ctx.lineTo(0, 0.32);
      // Right barrel
      ctx.moveTo(0.22, -0.25);
      ctx.lineTo(0.22, 0.25);
      ctx.stroke();
      break;
    }

    case 'shield': {
      // Concave double protective arc hugging inward
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.arc(0, 0.1, 0.35, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();

      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.arc(0, 0.15, 0.22, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
      break;
    }

    case 'capacitor': {
      // Three internal charge reservoir bars
      ctx.lineWidth = 0.06;
      ctx.strokeRect(-0.28, -0.28, 0.56, 0.56);
      ctx.fillStyle = colors.alloyColor;
      ctx.fillRect(-0.2, -0.18, 0.4, 0.06);
      ctx.fillRect(-0.2, -0.03, 0.4, 0.06);
      ctx.fillRect(-0.2, 0.12, 0.4, 0.06);
      break;
    }

    case 'radiator': {
      // Three parallel heat radiator fins
      ctx.lineWidth = 0.05;
      for (const yOffset of [-0.2, 0, 0.2]) {
        ctx.beginPath();
        ctx.moveTo(-0.3, yOffset);
        ctx.lineTo(0.3, yOffset);
        ctx.stroke();
      }
      // Central spine
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.moveTo(0, -0.28);
      ctx.lineTo(0, 0.28);
      ctx.stroke();
      break;
    }

    case 'lance': {
      // Long protruding sharp spearhead point
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.moveTo(0, -0.38);
      ctx.lineTo(-0.2, 0.3);
      ctx.lineTo(0.2, 0.3);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -0.38);
      ctx.lineTo(0, 0.3);
      ctx.stroke();
      break;
    }

    case 'breaker': {
      // Heavy block split by cleavage fissure
      ctx.lineWidth = 0.08;
      ctx.strokeRect(-0.26, -0.26, 0.52, 0.52);
      ctx.beginPath();
      ctx.moveTo(0, -0.26);
      ctx.lineTo(-0.08, 0);
      ctx.lineTo(0.08, 0.1);
      ctx.lineTo(0, 0.26);
      ctx.stroke();
      break;
    }

    default: {
      ctx.strokeRect(-0.2, -0.2, 0.4, 0.4);
      break;
    }
  }

  ctx.restore();
}

/**
 * Helper to draw a rounded rectangle
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
}
