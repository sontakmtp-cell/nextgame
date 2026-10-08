import type { ArenaLayout } from '@prompt-chien/renderer3d';
// Projection of the pinned alpha-0 arena init. Regression tests compare these
// presentation dimensions against content authority; never send private replay.
export const replayArenaLayout: ArenaLayout = { width: 40, depth: 28, objective: { x: 0, z: 0, radius: 3 }, props: [
  { x: -21.4, z: -10, width: 1.4, depth: 3, height: 2.5 }, { x: 21.4, z: 10, width: 1.4, depth: 3, height: 2.5 }
] };
