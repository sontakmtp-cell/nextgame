import { BotDefinition, ValidationReport, ValidationError, SensorName } from './types.js';

export const CATALOG_COSTS: Record<string, { cost: number; mass: number; footprint: { w: number; h: number } }> = {
  core: { cost: 20, mass: 12, footprint: { w: 2, h: 2 } },
  thruster: { cost: 6, mass: 3, footprint: { w: 1, h: 1 } },
  armor: { cost: 4, mass: 4, footprint: { w: 1, h: 1 } },
  blade: { cost: 14, mass: 5, footprint: { w: 1, h: 1 } },
  lance: { cost: 18, mass: 6, footprint: { w: 1, h: 1 } },
  burst: { cost: 16, mass: 5, footprint: { w: 1, h: 1 } },
  shield: { cost: 12, mass: 4, footprint: { w: 1, h: 1 } },
  breaker: { cost: 12, mass: 4, footprint: { w: 1, h: 1 } },
  capacitor: { cost: 8, mass: 2, footprint: { w: 1, h: 1 } },
  radiator: { cost: 6, mass: 2, footprint: { w: 1, h: 1 } },
};

export const ALLOWED_SENSORS: Set<SensorName> = new Set([
  'clock.tick',
  'clock.decision',
  'clock.stateAge',
  'self.energy',
  'self.heat',
  'self.coreHpPermille',
  'self.overheated',
  'self.speed',
  'self.x',
  'self.y',
  'self.heading',
  'enemy.distance',
  'enemy.bearing',
  'enemy.speed',
  'enemy.heading',
  'enemy.coreHpPermille',
  'enemy.telegraph',
  'arena.centerBearing',
  'arena.centerDistance',
  'arena.controlOwner',
  'arena.ringRadius',
  'self.outsideRing',
]);

export function validateBotDefinition(bot: BotDefinition): ValidationReport {
  const errors: ValidationError[] = [];
  const modules = bot.body?.modules || [];

  // Check Core
  const coreModules = modules.filter(m => m.catalogId === 'core');
  const coreFound = coreModules.length === 1;

  if (coreModules.length === 0) {
    errors.push({
      type: 'error',
      code: 'CORE_MISSING',
      message: 'Thiếu Core 2x2. Mỗi Synth bắt buộc phải có đúng một Core.',
    });
  } else if (coreModules.length > 1) {
    errors.push({
      type: 'error',
      code: 'CORE_MULTIPLE',
      message: 'Chỉ được phép có duy nhất 1 Core 2x2.',
    });
  }

  // Total module cap <= 24
  if (modules.length > 24) {
    errors.push({
      type: 'error',
      code: 'MODULE_COUNT_EXCEEDED',
      message: `Vượt quá giới hạn tối đa 24 module (${modules.length}/24).`,
    });
  }

  // Cell occupancy & overlap checks
  const occupied = new Map<string, string>();
  let totalCost = 0;
  let totalMass = 0;
  let thrusterCount = 0;
  let weaponCount = 0;
  let shieldCount = 0;
  let capacitorCount = 0;
  let radiatorCount = 0;

  let coreCenter = { x: 6, y: 6 };

  for (const m of modules) {
    const info = CATALOG_COSTS[m.catalogId];
    if (!info) {
      errors.push({
        type: 'error',
        code: 'UNKNOWN_CATALOG_ID',
        message: `Module "${m.id}" có catalogId không tồn tại: "${m.catalogId}".`,
      });
      continue;
    }

    totalCost += info.cost;
    totalMass += info.mass;

    if (m.catalogId === 'thruster') thrusterCount++;
    if (['blade', 'lance', 'burst', 'breaker'].includes(m.catalogId)) weaponCount++;
    if (m.catalogId === 'shield') shieldCount++;
    if (m.catalogId === 'capacitor') capacitorCount++;
    if (m.catalogId === 'radiator') radiatorCount++;

    if (m.catalogId === 'core') {
      coreCenter = { x: m.cell.x + 1, y: m.cell.y + 1 };
    }

    const w = info.footprint.w;
    const h = info.footprint.h;

    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        const cx = m.cell.x + dx;
        const cy = m.cell.y + dy;

        // Check grid boundary 0..11
        if (cx < 0 || cx > 11 || cy < 0 || cy > 11) {
          errors.push({
            type: 'error',
            code: 'OUT_OF_BOUNDS',
            message: `Module ${m.id} vượt ngoài lưới 12x12 tại ô (${cx}, ${cy}).`,
            cell: { x: cx, y: cy },
          });
        }

        const key = `${cx},${cy}`;
        if (occupied.has(key)) {
          errors.push({
            type: 'error',
            code: 'CELL_OVERLAP',
            message: `Ô (${cx}, ${cy}) bị chồng lấn bởi nhiều module (${m.id} và ${occupied.get(key)}).`,
            cell: { x: cx, y: cy },
          });
        } else {
          occupied.set(key, m.id);
        }
      }
    }
  }

  // Budget points <= 100
  if (totalCost > 100) {
    errors.push({
      type: 'error',
      code: 'BUDGET_EXCEEDED',
      message: `Vượt quá ngân sách điểm build points (${totalCost}/100).`,
    });
  }

  // Catalog limits
  if (weaponCount > 3) {
    errors.push({
      type: 'error',
      code: 'TOO_MANY_WEAPONS',
      message: `Quá số lượng vũ khí tối đa (${weaponCount}/3).`,
    });
  }
  if (shieldCount > 1) {
    errors.push({
      type: 'error',
      code: 'TOO_MANY_SHIELDS',
      message: `Chỉ được lắp tối đa 1 Khiên Shield (${shieldCount}/1).`,
    });
  }
  if (capacitorCount > 2) {
    errors.push({
      type: 'error',
      code: 'TOO_MANY_CAPACITORS',
      message: `Chỉ được lắp tối đa 2 Tụ Capacitor (${capacitorCount}/2).`,
    });
  }
  if (radiatorCount > 2) {
    errors.push({
      type: 'error',
      code: 'TOO_MANY_RADIATORS',
      message: `Chỉ được lắp tối đa 2 Lá tản nhiệt Radiator (${radiatorCount}/2).`,
    });
  }
  if (thrusterCount > 6) {
    errors.push({
      type: 'error',
      code: 'TOO_MANY_THRUSTERS',
      message: `Chỉ được lắp tối đa 6 Động cơ Thruster (${thrusterCount}/6).`,
    });
  }

  // Ranked minimums
  if (thrusterCount < 2) {
    errors.push({
      type: 'warning',
      code: 'MIN_THRUSTERS_MISSING',
      message: `Ranked yêu cầu tối thiểu 2 Thrusters để đảm bảo cơ động (hiện có: ${thrusterCount}).`,
    });
  }
  if (weaponCount < 1) {
    errors.push({
      type: 'warning',
      code: 'MIN_WEAPONS_MISSING',
      message: `Ranked yêu cầu tối thiểu 1 vũ khí gây sát thương (hiện có: ${weaponCount}).`,
    });
  }

  // Connectivity check via 4-directional BFS
  let isConnected = true;
  if (coreFound) {
    const visited = new Set<string>();
    const queue: { x: number; y: number }[] = [];
    const core = coreModules[0];

    for (let dx = 0; dx < 2; dx++) {
      for (let dy = 0; dy < 2; dy++) {
        const k = `${core.cell.x + dx},${core.cell.y + dy}`;
        visited.add(k);
        queue.push({ x: core.cell.x + dx, y: core.cell.y + dy });
      }
    }

    const dirs = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const d of dirs) {
        const nx = curr.x + d.x;
        const ny = curr.y + d.y;
        const nk = `${nx},${ny}`;
        if (occupied.has(nk) && !visited.has(nk)) {
          visited.add(nk);
          queue.push({ x: nx, y: ny });
        }
      }
    }

    for (const [key, modId] of occupied) {
      if (!visited.has(key)) {
        isConnected = false;
        errors.push({
          type: 'error',
          code: 'DISCONNECTED_MODULE',
          message: `Module "${modId}" tại ô (${key}) không liên thông với Core. Mọi module phải liên kết cạnh với Core.`,
        });
        break;
      }
    }
  } else {
    isConnected = false;
  }

  // Bounding radius <= 6500 milli-units (6.5 units)
  let maxRadiusMilli = 0;
  if (coreFound) {
    for (const [key] of occupied) {
      const [cx, cy] = key.split(',').map(Number);
      const corners = [
        { x: cx, y: cy },
        { x: cx + 1, y: cy },
        { x: cx, y: cy + 1 },
        { x: cx + 1, y: cy + 1 },
      ];
      for (const c of corners) {
        const dx = (c.x - coreCenter.x) * 1000;
        const dy = (c.y - coreCenter.y) * 1000;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxRadiusMilli) {
          maxRadiusMilli = dist;
        }
      }
    }

    if (maxRadiusMilli > 6500) {
      errors.push({
        type: 'error',
        code: 'BOUNDING_RADIUS_EXCEEDED',
        message: `Bán kính bao (${(maxRadiusMilli / 1000).toFixed(2)} units) vượt quá 6.5 units (6500 milli-units) từ tâm Core.`,
      });
    }
  }

  // Brain validation
  if (bot.brain) {
    if (bot.brain.states.length > 32) {
      errors.push({
        type: 'error',
        code: 'TOO_MANY_STATES',
        message: `Brain có quá nhiều trạng thái (${bot.brain.states.length}/32).`,
      });
    }
    const stateIds = new Set(bot.brain.states.map(s => s.id));
    if (!stateIds.has(bot.brain.initialState)) {
      errors.push({
        type: 'error',
        code: 'INITIAL_STATE_NOT_FOUND',
        message: `Trạng thái khởi đầu "${bot.brain.initialState}" không tồn tại trong danh sách states.`,
      });
    }
    for (const st of bot.brain.states) {
      if (st.rules.length > 32) {
        errors.push({
          type: 'error',
          code: 'TOO_MANY_RULES',
          message: `Trạng thái "${st.id}" có quá nhiều rules (${st.rules.length}/32).`,
        });
      }
    }
  }

  const drive = Math.min(1000, Math.floor((8 * thrusterCount * 1000) / Math.max(1, totalMass)));
  const vMax = Math.floor((6000 * drive) / 1000);
  const wMax = thrusterCount > 0 ? 180 : 0;
  const energyCap = 1000 + 250 * capacitorCount;
  const heatDissipation = 60 + 60 * radiatorCount;

  const isValid = errors.filter(e => e.type === 'error').length === 0;

  return {
    isValid,
    totalModules: modules.length,
    totalCost,
    totalMass,
    boundingRadiusMilli: Math.round(maxRadiusMilli),
    coreFound,
    isConnected,
    weaponCount,
    thrusterCount,
    vMax,
    wMax,
    energyCap,
    heatDissipation,
    errors,
  };
}
