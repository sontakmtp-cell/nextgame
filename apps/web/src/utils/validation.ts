import { BotDefinition, PlacedModule, ValidationReport, ValidationError } from '../types/game';
import { MODULE_CATALOG } from '../data/catalog';

export function validateSynth(bot: BotDefinition): ValidationReport {
  const errors: ValidationError[] = [];
  const modules = bot.body.modules;

  // 1. Check Core existence and uniqueness
  const coreModules = modules.filter(m => m.catalogId === 'core');
  const coreFound = coreModules.length === 1;

  if (coreModules.length === 0) {
    errors.push({
      type: 'error',
      code: 'CORE_MISSING',
      message: 'Thiếu Lõi Năng Lượng (Core). Mỗi Synth bắt buộc phải có đúng một Core 2x2.',
    });
  } else if (coreModules.length > 1) {
    errors.push({
      type: 'error',
      code: 'CORE_MULTIPLE',
      message: 'Chỉ được phép có duy nhất 1 Core 2x2.',
    });
  }

  // 2. Total modules count check (max 24)
  const totalModules = modules.length;
  if (totalModules > 24) {
    errors.push({
      type: 'error',
      code: 'MODULE_COUNT_EXCEEDED',
      message: `Vượt quá giới hạn module (${totalModules}/24 module).`,
    });
  }

  // 3. Grid overlap & range check (0..11)
  const occupiedCells = new Map<string, string>(); // "x,y" => moduleId
  let totalCost = 0;
  let totalMass = 0;
  let thrusterCount = 0;
  let weaponCount = 0;
  let shieldCount = 0;
  let capacitorCount = 0;
  let radiatorCount = 0;

  let coreCenter = { x: 6, y: 6 }; // default if no core

  for (const m of modules) {
    const catalogItem = MODULE_CATALOG[m.catalogId];
    if (!catalogItem) continue;

    totalCost += catalogItem.cost;
    totalMass += catalogItem.mass;

    if (m.catalogId === 'thruster') thrusterCount++;
    if (['blade', 'lance', 'burst', 'breaker'].includes(m.catalogId)) weaponCount++;
    if (m.catalogId === 'shield') shieldCount++;
    if (m.catalogId === 'capacitor') capacitorCount++;
    if (m.catalogId === 'radiator') radiatorCount++;

    const w = catalogItem.footprint.w;
    const h = catalogItem.footprint.h;

    if (m.catalogId === 'core') {
      coreCenter = { x: m.cell.x + 1, y: m.cell.y + 1 };
    }

    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        const cx = m.cell.x + dx;
        const cy = m.cell.y + dy;

        // Check bounds
        if (cx < 0 || cx > 11 || cy < 0 || cy > 11) {
          errors.push({
            type: 'error',
            code: 'OUT_OF_BOUNDS',
            message: `Module "${catalogItem.name}" đặt ngoài phạm vi lưới 12x12 tại ô (${cx}, ${cy}).`,
            cell: { x: cx, y: cy },
          });
        }

        const key = `${cx},${cy}`;
        if (occupiedCells.has(key)) {
          errors.push({
            type: 'error',
            code: 'CELL_OVERLAP',
            message: `Xung đột vị trí: ô (${cx}, ${cy}) bị chồng lấn bởi nhiều module.`,
            cell: { x: cx, y: cy },
          });
        } else {
          occupiedCells.set(key, m.id);
        }
      }
    }
  }

  // 4. Build points budget check (max 100)
  if (totalCost > 100) {
    errors.push({
      type: 'error',
      code: 'BUDGET_EXCEEDED',
      message: `Vượt quá ngân sách điểm chế tạo (${totalCost}/100 Build Points).`,
    });
  }

  // 5. Catalog restrictions
  if (weaponCount > 3) {
    errors.push({
      type: 'error',
      code: 'TOO_MANY_WEAPONS',
      message: `Quá số lượng vũ khí tối đa (${weaponCount}/3 vũ khí).`,
    });
  }
  if (shieldCount > 1) {
    errors.push({
      type: 'error',
      code: 'TOO_MANY_SHIELDS',
      message: `Tối đa chỉ được lắp 1 Khiên Barrier Shield (${shieldCount}/1).`,
    });
  }
  if (capacitorCount > 2) {
    errors.push({
      type: 'error',
      code: 'TOO_MANY_CAPACITORS',
      message: `Tối đa chỉ được lắp 2 Tụ Capacitor (${capacitorCount}/2).`,
    });
  }
  if (radiatorCount > 2) {
    errors.push({
      type: 'error',
      code: 'TOO_MANY_RADIATORS',
      message: `Tối đa chỉ được lắp 2 Lá Tản Nhiệt Radiator (${radiatorCount}/2).`,
    });
  }
  if (thrusterCount > 6) {
    errors.push({
      type: 'error',
      code: 'TOO_MANY_THRUSTERS',
      message: `Tối đa chỉ được lắp 6 Động cơ Thruster (${thrusterCount}/6).`,
    });
  }

  // 6. Ranked minimums
  if (thrusterCount < 2) {
    errors.push({
      type: 'warning',
      code: 'MIN_THRUSTERS_MISSING',
      message: `Tiêu chuẩn Ranked yêu cầu tối thiểu 2 Động cơ Thruster để đảm bảo cơ động (hiện có: ${thrusterCount}).`,
    });
  }
  if (weaponCount < 1) {
    errors.push({
      type: 'warning',
      code: 'MIN_WEAPONS_MISSING',
      message: `Tiêu chuẩn Ranked yêu cầu tối thiểu 1 Vũ khí gây sát thương (Blade/Lance/Burst/Breaker).`,
    });
  }

  // 7. Connectivity check via BFS from Core
  let isConnected = true;
  if (coreFound) {
    const visited = new Set<string>();
    const queue: { x: number; y: number }[] = [];

    // Core 2x2 cells
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
        if (occupiedCells.has(nk) && !visited.has(nk)) {
          visited.add(nk);
          queue.push({ x: nx, y: ny });
        }
      }
    }

    // Verify if all occupied cells are visited
    for (const [key] of occupiedCells) {
      if (!visited.has(key)) {
        isConnected = false;
        const [cx, cy] = key.split(',').map(Number);
        errors.push({
          type: 'error',
          code: 'DISCONNECTED_MODULE',
          message: `Module tại ô (${cx}, ${cy}) không kết nối liền mạch với Core. Mọi module phải liên kết cạnh với Core.`,
          cell: { x: cx, y: cy },
        });
        break;
      }
    }
  } else {
    isConnected = false;
  }

  // 8. Bounding radius check <= 6500 milli-units (6.5 units) from Core center
  let maxRadiusMilli = 0;
  if (coreFound) {
    for (const [key] of occupiedCells) {
      const [cx, cy] = key.split(',').map(Number);
      // Corners of this cell: (cx, cy), (cx+1, cy), (cx, cy+1), (cx+1, cy+1)
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
        message: `Bán kính bao (${(maxRadiusMilli / 1000).toFixed(2)} units) vượt quá giới hạn 6.5 units (6500 milli-units) từ tâm Core. Cần thu gọn hoặc căn giữa Core.`,
      });
    }
  }

  // Derived combat specs
  const drive = Math.min(1000, Math.floor((8 * thrusterCount * 1000) / Math.max(1, totalMass)));
  const vMax = Math.floor((6000 * drive) / 1000); // milli-units / sec

  let leverSum = 0;
  for (const m of modules) {
    if (m.catalogId === 'thruster') {
      const dx = (m.cell.x + 0.5 - coreCenter.x) * 1000;
      const dy = (m.cell.y + 0.5 - coreCenter.y) * 1000;
      const lever = Math.min(4000, Math.floor(Math.sqrt(dx * dx + dy * dy)));
      leverSum += (1000 + lever);
    }
  }
  const wMax = thrusterCount > 0 ? Math.floor(1024 * Math.min(1000, Math.floor(leverSum / Math.max(1, totalMass)))) / 1000 : 0;

  const energyCap = 1000 + 250 * capacitorCount;
  const heatDissipation = 60 + 60 * radiatorCount;

  const isValid = errors.filter(e => e.type === 'error').length === 0;

  return {
    isValid,
    totalModules,
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
