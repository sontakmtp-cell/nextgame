import type { BotDefinition, Placement } from '@prompt-chien/contracts';
import { editModule, newModule } from './model.js';

// Construct an immutable, confirmed edit; the unchanged worker remains validator.
export function placementCandidate(bot: BotDefinition, catalogId: string, cell: { x: number; y: number }, orientation: Placement['orientation'], moving: string | null): BotDefinition {
  if (moving) return editModule(bot, moving, { cell: { ...cell }, orientation });
  const next = newModule(bot, catalogId, cell.x, cell.y);
  next.body.modules.at(-1)!.orientation = orientation;
  return next;
}
