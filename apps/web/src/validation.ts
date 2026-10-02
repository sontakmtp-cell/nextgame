import type { BotDefinition, CatalogEntry, Placement } from '@prompt-chien/contracts';
import { decodeJson, ContractError } from '@prompt-chien/contracts';
import type { DiagnosticsResult } from './types.js';

export const CATALOG_ENTRIES: readonly CatalogEntry[] = [
  { id: 'core', cost: 0, mass: 1000, hp: 1000, enabled: true, damage: false, max: 1, footprint: 2 },
  { id: 'thruster', cost: 10, mass: 200, hp: 200, enabled: true, damage: false, max: 4, footprint: 1 },
  { id: 'armor', cost: 5, mass: 350, hp: 500, enabled: true, damage: false, max: 12, footprint: 1 },
  { id: 'blade', cost: 25, mass: 300, hp: 350, enabled: true, damage: true, max: 2, footprint: 1 },
  { id: 'burst', cost: 25, mass: 300, hp: 300, enabled: true, damage: true, max: 2, footprint: 1 },
  { id: 'shield', cost: 20, mass: 250, hp: 250, enabled: true, damage: false, max: 1, footprint: 1 },
  { id: 'radiator', cost: 15, mass: 150, hp: 150, enabled: true, damage: false, max: 2, footprint: 1 },
  { id: 'capacitor', cost: 15, mass: 200, hp: 200, enabled: true, damage: false, max: 2, footprint: 1 },
  // Disabled until G4
  { id: 'lance', cost: 25, mass: 300, hp: 300, enabled: false, damage: true, max: 2, footprint: 1 },
  { id: 'breaker', cost: 25, mass: 350, hp: 350, enabled: false, damage: true, max: 2, footprint: 1 },
];

export function getCatalogEntry(catalogId: string): CatalogEntry | undefined {
  return CATALOG_ENTRIES.find(c => c.id === catalogId);
}

export function validateBotStructure(bot: BotDefinition): DiagnosticsResult {
  const errors: { message: string; pointer?: string | undefined }[] = [];
  const entriesMap = new Map(CATALOG_ENTRIES.map(e => [e.id, e]));

  const modules = bot.body.modules;
  let pointCost = 0;
  let weaponsCount = 0;
  let totalMass = 0;
  let coreModule: Placement | undefined;

  const occupied = new Map<string, Placement>();
  const idSet = new Set<string>();

  // 1. Module checks
  for (let i = 0; i < modules.length; i++) {
    const m = modules[i]!;
    const pointer = `/body/modules/${i}`;

    if (idSet.has(m.id)) {
      errors.push({ message: `Trùng lặp ID module: "${m.id}"`, pointer: `${pointer}/id` });
    }
    idSet.add(m.id);

    const entry = entriesMap.get(m.catalogId);
    if (!entry) {
      errors.push({ message: `Không tìm thấy module: ${m.catalogId}`, pointer: `${pointer}/catalogId` });
      continue;
    }
    if (!entry.enabled) {
      errors.push({ message: `Module ${m.catalogId} chưa kích hoạt ở slice hiện tại`, pointer: `${pointer}/catalogId` });
    }

    if (entry.id === 'core') coreModule = m;
    if (entry.damage) weaponsCount++;
    pointCost += entry.cost;
    totalMass += entry.mass;

    for (let y = m.cell.y; y < m.cell.y + entry.footprint; y++) {
      for (let x = m.cell.x; x < m.cell.x + entry.footprint; x++) {
        if (x < 0 || x >= 12 || y < 0 || y >= 12) {
          errors.push({ message: `Module ${m.id} vượt ra ngoài lưới 12x12 (${x}, ${y})`, pointer: `${pointer}/cell` });
        }
        const key = `${x},${y}`;
        if (occupied.has(key)) {
          errors.push({ message: `Trùng lấn ô tại (${x}, ${y}) giữa module ${m.id} và ${occupied.get(key)!.id}`, pointer });
        }
        occupied.set(key, m);
      }
    }
  }

  if (!coreModule) {
    errors.push({ message: 'Bắt buộc phải có một module Core 2x2', pointer: '/body/modules' });
  }

  if (modules.length > 24) {
    errors.push({ message: `Vượt quá giới hạn 24 module (hiện tại: ${modules.length})`, pointer: '/body/modules' });
  }

  if (pointCost > 100) {
    errors.push({ message: `Vượt quá ngân sách 100 điểm xây dựng (hiện tại: ${pointCost})`, pointer: '/body/modules' });
  }

  if (weaponsCount > 3) {
    errors.push({ message: `Vượt quá tối đa 3 module vũ khí (hiện tại: ${weaponsCount})`, pointer: '/body/modules' });
  }

  // 2. Transitive Connectivity Check
  const disconnectedCells: string[] = [];
  let connected = true;

  if (coreModule) {
    const queue: string[] = [];
    const seen = new Set<string>();

    for (let y = coreModule.cell.y; y < coreModule.cell.y + 2; y++) {
      for (let x = coreModule.cell.x; x < coreModule.cell.x + 2; x++) {
        const key = `${x},${y}`;
        seen.add(key);
        queue.push(key);
      }
    }

    for (let i = 0; i < queue.length; i++) {
      const parts = queue[i]!.split(',').map(Number);
      const cx = parts[0]!;
      const cy = parts[1]!;

      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const neighbor = `${cx + dx},${cy + dy}`;
        if (occupied.has(neighbor) && !seen.has(neighbor)) {
          seen.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    if (seen.size !== occupied.size) {
      connected = false;
      for (const key of occupied.keys()) {
        if (!seen.has(key)) {
          disconnectedCells.push(key);
        }
      }
      errors.push({ message: 'Có module không nối liền mạch với Core', pointer: '/body/modules' });
    }
  }

  // 3. Occlusion Diagnostics
  const occlusions: DiagnosticsResult['occlusions'] = [];

  for (const m of modules) {
    if (m.catalogId === 'burst') {
      const deltas = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
      const [dx, dy] = deltas[m.orientation]!;
      let cx = m.cell.x + dx;
      let cy = m.cell.y + dy;
      while (cx >= 0 && cx < 12 && cy >= 0 && cy < 12) {
        const blocker = occupied.get(`${cx},${cy}`);
        if (blocker && blocker.id !== m.id) {
          occlusions.push({
            moduleId: m.id,
            catalogId: m.catalogId,
            cell: { x: cx, y: cy },
            warning: `Đường bắn Burst của ${m.id} bị cản bởi ${blocker.id} tại (${cx}, ${cy})`,
          });
          break;
        }
        cx += dx;
        cy += dy;
      }
    } else if (m.catalogId === 'blade') {
      const deltas = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
      const [dx, dy] = deltas[m.orientation]!;
      const fx = m.cell.x + dx;
      const fy = m.cell.y + dy;
      if (fx >= 0 && fx < 12 && fy >= 0 && fy < 12) {
        const blocker = occupied.get(`${fx},${fy}`);
        if (blocker && blocker.id !== m.id && blocker.catalogId !== 'blade') {
          occlusions.push({
            moduleId: m.id,
            catalogId: m.catalogId,
            cell: { x: fx, y: fy },
            warning: `Cung chém Blade của ${m.id} bị che khuất bởi ${blocker.id} tại (${fx}, ${fy})`,
          });
        }
      }
    } else if (m.catalogId === 'thruster') {
      const oppositeDeltas = [[-1, 0], [0, -1], [1, 0], [0, 1]] as const;
      const [dx, dy] = oppositeDeltas[m.orientation]!;
      const rx = m.cell.x + dx;
      const ry = m.cell.y + dy;
      if (rx >= 0 && rx < 12 && ry >= 0 && ry < 12) {
        const blocker = occupied.get(`${rx},${ry}`);
        if (blocker && blocker.id !== m.id) {
          occlusions.push({
            moduleId: m.id,
            catalogId: m.catalogId,
            cell: { x: rx, y: ry },
            warning: `Khe thoát khí Thruster của ${m.id} bị chặn bởi ${blocker.id} tại (${rx}, ${ry})`,
          });
        }
      }
    }
  }

  // 4. Brain Structural Diagnostics
  const brain = bot.brain;
  const unreachableStates: string[] = [];
  const deadRules: DiagnosticsResult['deadRules'] = [];

  const stateIds = new Set(brain.states.map(s => s.id));
  if (!stateIds.has(brain.initialState)) {
    errors.push({ message: `Initial state "${brain.initialState}" không tồn tại trong danh sách states`, pointer: '/brain/initialState' });
  }

  // Detect reachable states from initialState
  const reachable = new Set<string>([brain.initialState]);
  const queue = [brain.initialState];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const stateObj = brain.states.find(s => s.id === currentId);
    if (!stateObj) continue;

    for (const rule of stateObj.rules) {
      if ('nextState' in rule && rule.nextState) {
        const targetState = typeof rule.nextState === 'string' ? rule.nextState : rule.nextState.parameter;
        if (!reachable.has(targetState)) {
          if (stateIds.has(targetState)) {
            reachable.add(targetState);
            queue.push(targetState);
          } else {
            errors.push({
              message: `Quy tắc ${rule.id} chuyển đến trạng thái không tồn tại: "${targetState}"`,
              pointer: `/brain/states/${brain.states.indexOf(stateObj)}/rules/${stateObj.rules.indexOf(rule)}/nextState`,
            });
          }
        }
      }
    }
  }

  for (const s of brain.states) {
    if (!reachable.has(s.id)) {
      unreachableStates.push(s.id);
    }

    // Dead rules check: rules after an unconditional true condition
    let foundUnconditional = false;
    for (const [rIndex, r] of s.rules.entries()) {
      if (foundUnconditional) {
        deadRules.push({
          stateId: s.id,
          ruleId: r.id,
          reason: `Quy tắc này nằm sau một điều kiện luôn đúng (unconditional true) trong state ${s.id}`,
        });
      }
      if ('when' in r && r.when) {
        if (r.when.kind === 'bool' && r.when.value === true) {
          foundUnconditional = true;
        }
        checkExprForDivZero(r.when, s.id, r.id, rIndex, errors);
      }
      if ('intent' in r && r.intent) {
        if (r.intent.turn.kind === 'op' && r.intent.turn.op === 'div' && r.intent.turn.right.kind === 'const' && r.intent.turn.right.value === 0) {
          errors.push({
            message: `Lỗi chia cho 0 trong công thức turn của rule "${r.id}"`,
            pointer: `/brain/states/${brain.states.indexOf(s)}/rules/${rIndex}/intent/turn`,
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    moduleCount: modules.length,
    maxModules: 24,
    pointCost,
    maxCost: 100,
    weaponsCount,
    maxWeapons: 3,
    mass: totalMass,
    connected,
    disconnectedCells,
    occlusions,
    unreachableStates,
    deadRules,
    errors,
  };
}

function checkExprForDivZero(
  expr: unknown,
  stateId: string,
  ruleId: string,
  ruleIdx: number,
  errors: { message: string; pointer?: string | undefined }[]
): void {
  if (!expr || typeof expr !== 'object') return;
  const e = expr as Record<string, unknown>;
  if (e.kind === 'op' && e.op === 'div') {
    const right = e.right as Record<string, unknown> | undefined;
    if (right && right.kind === 'const' && right.value === 0) {
      errors.push({
        message: `Lỗi chia cho 0 trong điều kiện của rule "${ruleId}" (state "${stateId}")`,
        pointer: `/brain/states/${stateId}/rules/${ruleIdx}/when`,
      });
    }
  }
  if (Array.isArray(e.args)) {
    for (const child of e.args) checkExprForDivZero(child, stateId, ruleId, ruleIdx, errors);
  }
  if (e.left) checkExprForDivZero(e.left, stateId, ruleId, ruleIdx, errors);
  if (e.right) checkExprForDivZero(e.right, stateId, ruleId, ruleIdx, errors);
  if (e.value) checkExprForDivZero(e.value, stateId, ruleId, ruleIdx, errors);
}

export function parseJsonWithPointer(jsonText: string): { data?: unknown; error?: string; pointer?: string } {
  try {
    const data = decodeJson(jsonText);
    return { data };
  } catch (err) {
    if (err instanceof ContractError) {
      return { error: err.message, pointer: err.pointer };
    }
    return { error: String(err) };
  }
}
