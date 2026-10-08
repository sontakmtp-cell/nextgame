import { expect, test } from 'vitest';
import { placementCandidate } from '../apps/web/src/workshop-intent.js';
import { sliceKits, catalog } from '../packages/content/src/index.js';
import { validateBody } from '../packages/contracts/src/body.js';

test('confirmed placement retains Brain and immutable draft, supports four headings and Core footprint', () => {
  const bot = structuredClone(sliceKits[0]!);
  const before = structuredClone(bot);
  for (const orientation of [0, 1, 2, 3] as const) {
    const added = placementCandidate(bot, 'armor', { x: 8, y: 5 }, orientation, null);
    expect(bot).toEqual(before);
    expect(added.brain).toEqual(bot.brain);
    expect(added.body.modules.at(-1)).toMatchObject({ catalogId: 'armor', cell: { x: 8, y: 5 }, orientation });
    validateBody(added.body, catalog);
    const core = bot.body.modules.find(m => m.catalogId === 'core')!;
    const moved = placementCandidate(bot, 'armor', { x: 10, y: 10 }, orientation, core.id);
    expect(moved.body.modules.find(m => m.id === core.id)).toMatchObject({ catalogId: 'core', cell: { x: 10, y: 10 }, orientation });
    expect(moved.body.modules.length).toBe(bot.body.modules.length);
  }
});

test('edit intent leaves authoritative validation to existing contracts', () => {
  const bot = structuredClone(sliceKits[0]!), core = bot.body.modules.find(m => m.catalogId === 'core')!;
  for (const [cell, code] of [[core.cell, 'OVERLAP'], [{ x: 12, y: 5 }, 'GRID_BOUNDS'], [{ x: 0, y: 0 }, 'DISCONNECTED']] as const) {
    expect(() => validateBody(placementCandidate(bot, 'armor', cell, 0, null).body, catalog)).toThrow(code);
  }
  const invalid = structuredClone(bot);
  // Explicit budget fixture without overlaps, all cells attached to Core.
  const occupied = new Set([`${core.cell.x},${core.cell.y}`, `${core.cell.x + 1},${core.cell.y}`, `${core.cell.x},${core.cell.y + 1}`, `${core.cell.x + 1},${core.cell.y + 1}`]);
  invalid.body.modules = [core];
  for (let y = 3; y <= 7; y++) for (let x = 3; x <= 7; x++) if (!occupied.has(`${x},${y}`)) invalid.body.modules.push({ id: `armor${x}${y}`, catalogId: 'armor', orientation: 0, cell: { x, y } });
  expect(() => validateBody(invalid.body, catalog)).toThrow('BUILD_BUDGET');
});
