import type { PublicActor } from '@prompt-chien/contracts';
import type { CameraState, CellSelection, DeepReadonly, PresentationManifest, SynthPreviewProps } from './interfaces.js';
import { baseHoverHeight, hoverAmplitude } from './hover.js';
type Body = SynthPreviewProps['body'];
export const TAU = Math.PI * 2;
export function coreAnchor(body: Body): CellSelection {
  const core = body.modules.find(m => m.catalogId === 'core');
  if (!core) throw Error('Body cần Core để xác định tâm hiển thị');
  return { x: core.cell.x + 1, y: core.cell.y + 1 };
}
export function moduleTransform(body: Body, module: Body['modules'][number], footprints: Readonly<Record<string, number>>) {
  const core = coreAnchor(body), footprint = footprints[module.catalogId];
  if (!footprint || !Number.isFinite(footprint)) throw Error(`Thiếu footprint: ${module.catalogId}`);
  return { x: module.cell.x + footprint / 2 - core.x, z: -(module.cell.y + footprint / 2 - core.y), yaw: module.orientation * Math.PI / 2, footprint };
}
export function localToCell(body: Body, x: number, z: number): CellSelection | null {
  const core = coreAnchor(body), cell = { x: Math.floor(x + core.x), y: Math.floor(-z + core.y) };
  return cell.x >= 0 && cell.x < 12 && cell.y >= 0 && cell.y < 12 ? cell : null;
}
export function publicBody(actor: DeepReadonly<PublicActor>): Body {
  return { grid: 'square-12-v1', modules: actor.modules.map(m => ({ id: `public-${m.ordinal}`, catalogId: m.catalogId, cell: { x: m.x, y: m.y }, orientation: m.orientation as 0 | 1 | 2 | 3 })) };
}
export function interpolatedPose(a: DeepReadonly<PublicActor>, b: DeepReadonly<PublicActor>, fraction: number) {
  const f = Math.max(0, Math.min(1, fraction)), dh = ((b.pose.heading - a.pose.heading + 6144) % 4096) - 2048;
  return { x: (a.pose.x + (b.pose.x - a.pose.x) * f) / 1000, z: -(a.pose.y + (b.pose.y - a.pose.y) * f) / 1000, yaw: (a.pose.heading + dh * f) * TAU / 4096 };
}
export function fitPreviewCamera(body: Body, footprints: Readonly<Record<string, number>>, manifest: PresentationManifest, size: { readonly width: number; readonly height: number }, camera: CameraState): CameraState {
  const transforms = body.modules.map(m => moduleTransform(body, m, footprints));
  const minX = Math.min(...transforms.map(t => t.x - t.footprint / 2)), maxX = Math.max(...transforms.map(t => t.x + t.footprint / 2));
  const minZ = Math.min(...transforms.map(t => t.z - t.footprint / 2)), maxZ = Math.max(...transforms.map(t => t.z + t.footprint / 2));
  const height = Math.max(1, ...body.modules.map(m => baseHoverHeight(m.catalogId) + hoverAmplitude(m.catalogId) + (manifest.modules.find(a => a.catalogId === m.catalogId)?.normalization.bounds.max[1] ?? 1)));
  const sin = Math.abs(Math.sin(camera.azimuth)), cos = Math.abs(Math.cos(camera.azimuth));
  const projectedWidth = cos * (maxX - minX) + sin * (maxZ - minZ);
  const projectedHeight = Math.sin(camera.elevation) * (sin * (maxX - minX) + cos * (maxZ - minZ)) + Math.cos(camera.elevation) * height;
  return { ...camera, target: [(minX + maxX) / 2, height / 2, (minZ + maxZ) / 2], zoom: Math.max(12, Math.min(camera.zoom, size.width / (projectedWidth + 2), size.height / (projectedHeight + 2))) };
}
