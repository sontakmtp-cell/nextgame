// Presentation only: these heights never enter Body, colliders or simulation.
export const baseHoverHeight = (catalogId: string) => catalogId === 'core' ? 1 : 1.4;
export const hoverAmplitude = (_catalogId: string) => .1;
export function hoverHeight(catalogId: string, _moduleId: string, seconds: number) {
  const isCore = catalogId === 'core', period = 4;
  // All satellite modules share the Core's period with a fixed half-second lag.
  const time = Math.max(0, seconds - (isCore ? 0 : .5));
  return baseHoverHeight(catalogId) + hoverAmplitude(catalogId) * Math.min(1, time / .3) * Math.sin(time * Math.PI * 2 / period);
}
