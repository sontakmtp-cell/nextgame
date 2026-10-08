import type { BotDefinition, Placement } from '@prompt-chien/contracts';
import { editModule, newModule } from './model.js';

// UI admission check using catalog footprints. Full Body/Brain validation still
// belongs to the existing worker; blocked edits never enter the undo history.
export function placementOverlap(bot: BotDefinition, catalogId: string, cell: { x: number; y: number }, footprints: Readonly<Record<string, number>>, excludeId: string | null = null): Placement | undefined {
  const size = footprints[catalogId] ?? 1;
  return bot.body.modules.find(module => {
    if (module.id === excludeId) return false;
    const otherSize = footprints[module.catalogId] ?? 1;
    return cell.x < module.cell.x + otherSize && cell.x + size > module.cell.x && cell.y < module.cell.y + otherSize && cell.y + size > module.cell.y;
  });
}

export function bodyEditOverlap(before: BotDefinition, after: BotDefinition, footprints: Readonly<Record<string, number>>): Placement | undefined {
  for (const module of after.body.modules) {
    const original = before.body.modules.find(m => m.id === module.id);
    if (original && original.catalogId === module.catalogId && original.cell.x === module.cell.x && original.cell.y === module.cell.y) continue;
    const blocker = placementOverlap(after, module.catalogId, module.cell, footprints, module.id);
    if (blocker) return blocker;
  }
  return undefined;
}

// Construct an immutable, confirmed edit; the unchanged worker remains validator.
export function placementCandidate(bot: BotDefinition, catalogId: string, cell: { x: number; y: number }, orientation: Placement['orientation'], moving: string | null): BotDefinition {
  if (moving) return editModule(bot, moving, { cell: { ...cell }, orientation });
  const next = newModule(bot, catalogId, cell.x, cell.y);
  next.body.modules.at(-1)!.orientation = orientation;
  return next;
}
