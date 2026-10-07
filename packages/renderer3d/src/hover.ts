// Presentation only: these heights never enter Body, colliders or simulation.
export const baseHoverHeight = (catalogId: string) => catalogId === 'core' ? 2 : 2.4;
export const hoverAmplitude = (catalogId: string) => catalogId === 'core' ? .1 : .14;
export function hoverHeight(catalogId: string, moduleId: string, seconds: number) {
  const seed = [...moduleId].reduce((n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
  const period = catalogId === 'core' ? 4 : 3.2 + (seed % 7) * .13;
  const phase = catalogId === 'core' ? 0 : (seed % 1024) / 1024 * Math.PI * 2;
  return baseHoverHeight(catalogId) + hoverAmplitude(catalogId) * Math.min(1, Math.max(0, seconds) / .3) * Math.sin(seconds * Math.PI * 2 / period + phase);
}
