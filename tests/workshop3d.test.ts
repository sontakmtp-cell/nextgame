import { expect, test } from 'vitest';
import { bodyEditOverlap, placementCandidate, placementOverlap } from '../apps/web/src/workshop-intent.js';
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

test('placement blocks every occupied Core cell and agrees with authoritative overlap validation', () => {
  const bot = structuredClone(sliceKits[0]!), core = bot.body.modules.find(m => m.catalogId === 'core')!;
  const footprints = Object.fromEntries(catalog.map(c => [c.id, c.footprint]));
  const before = structuredClone(bot);
  for (const orientation of [0, 1, 2, 3] as const) for (const dx of [0, 1]) for (const dy of [0, 1]) {
    const cell = { x: core.cell.x + dx, y: core.cell.y + dy };
    expect(placementOverlap(bot, 'armor', cell, footprints)?.id).toBe(core.id);
    const candidate = placementCandidate(bot, 'armor', cell, orientation, null);
    expect(bodyEditOverlap(bot, candidate, footprints)?.id).toBe(core.id);
    expect(() => validateBody(candidate.body, catalog)).toThrow('OVERLAP');
  }
  expect(bot).toEqual(before);
});

test('a large moving footprint cannot cover a module even when its anchor cell is empty', () => {
  const bot = structuredClone(sliceKits[0]!), core = structuredClone(bot.body.modules.find(m => m.catalogId === 'core')!);
  core.cell = { x: 5, y: 5 };
  bot.body.modules = [core, { id: 'neighbor', catalogId: 'armor', cell: { x: 7, y: 5 }, orientation: 0 }];
  const footprints = Object.fromEntries(catalog.map(c => [c.id, c.footprint]));
  const target = { x: 6, y: 4 };
  expect(placementOverlap(bot, 'core', core.cell, footprints, core.id)).toBeUndefined();
  expect(placementOverlap(bot, 'core', target, footprints, core.id)?.id).toBe('neighbor');
  const moved = placementCandidate(bot, 'core', target, 0, core.id);
  expect(bodyEditOverlap(bot, moved, footprints)?.id).toBe('neighbor');
  expect(() => validateBody(moved.body, catalog)).toThrow('OVERLAP');
  // Exact shared edges are legal, and moving a module excludes its old footprint.
  expect(placementOverlap(bot, 'armor', { x: 7, y: 6 }, footprints)).toBeUndefined();
  expect(placementOverlap(bot, 'armor', { x: 7, y: 5 }, footprints, 'neighbor')).toBeUndefined();
});

test('deleting and repairing an existing invalid draft remain possible', () => {
  const bot = structuredClone(sliceKits[0]!), core = bot.body.modules.find(m => m.catalogId === 'core')!;
  const footprints = Object.fromEntries(catalog.map(c => [c.id, c.footprint]));
  const invalid = placementCandidate(bot, 'armor', core.cell, 0, null), added = invalid.body.modules.at(-1)!;
  const deleted = structuredClone(invalid);
  deleted.body.modules = deleted.body.modules.filter(m => m.id !== added.id);
  expect(bodyEditOverlap(invalid, deleted, footprints)).toBeUndefined();
  expect(deleted.body).toEqual(bot.body);
  expect(deleted.brain).toEqual(bot.brain);
});
