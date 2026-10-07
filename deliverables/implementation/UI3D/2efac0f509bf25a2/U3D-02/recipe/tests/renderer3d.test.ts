import { describe, expect, it } from 'vitest';
import { coreAnchor, fitPreviewCamera, interpolatedPose, localToCell, moduleTransform, publicBody } from '../packages/renderer3d/src/geometry.js';
import type { PresentationManifest } from '../packages/renderer3d/src/interfaces.js';
import { ArenaAudio, eventLocation } from '../packages/presentation/dist/index.js';
import { ArenaAudio as LegacyAudio, eventLocation as legacyLocation } from '../packages/renderer/src/index.js';
import type { PublicActor } from '../packages/contracts/src/index.js';
import { coreLinkPaths, updateCoreLinks } from '../packages/renderer3d/src/energy.js';
import { baseHoverHeight, hoverAmplitude, hoverHeight } from '../packages/renderer3d/src/hover.js';
const footprints = { core: 2, armor: 1 };
const core = { id: 'c', catalogId: 'core', cell: { x: 2, y: 7 }, orientation: 0 as const };
const body = { grid: 'square-12-v1' as const, modules: [core, { id: 'a', catalogId: 'armor', cell: { x: 6, y: 2 }, orientation: 1 as const }] };
describe('U3D-02 geometry contract', () => {
  it('keeps origin at offset Core, footprint centers and cardinal headings', () => {
    expect(coreAnchor(body)).toEqual({ x: 3, y: 8 });
    expect(moduleTransform(body, core, footprints)).toEqual({ x: 0, z: -0, yaw: 0, footprint: 2 });
    for (const orientation of [0, 1, 2, 3] as const) {
      const module = { ...body.modules[1]!, orientation }, before = JSON.stringify(body);
      expect(moduleTransform(body, module, footprints)).toEqual({ x: 3.5, z: 5.5, yaw: orientation * Math.PI / 2, footprint: 1 });
      expect(JSON.stringify(body)).toBe(before);
    }
  });
  it('selects every grid cell including all four Core cells; rejects outside edges', () => {
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) expect(localToCell(body, x + 0.5 - 3, -(y + 0.5 - 8))).toEqual({ x, y });
    expect(localToCell(body, -3.01, 0)).toBeNull(); expect(localToCell(body, 9, 0)).toBeNull(); expect(localToCell(body, 0, -4.01)).toBeNull(); expect(localToCell(body, 0, 8.01)).toBeNull();
  });
  it('does not silently invent a Core or catalog footprint', () => {
    expect(() => coreAnchor({ ...body, modules: [] })).toThrow('Core');
    expect(() => moduleTransform(body, body.modules[1]!, { core: 2 })).toThrow('footprint');
  });
  it('fits an asymmetric offset Body within orthographic bounds at desktop and phone sizes', () => {
    const manifest: PresentationManifest = { version: 'ui3d-v1', assetRevision: 'fixture', axes: 'X-forward,Y-up,-Z-left', unitsPerCell: 1, modules: [], decoders: [] };
    const camera = { target: [0, 0.4, 0] as const, azimuth: Math.PI / 4, elevation: 0.85, zoom: 140 };
    for (const size of [{ width: 1310, height: 925 }, { width: 320, height: 480 }]) {
      const fit = fitPreviewCamera(body, footprints, manifest, size, camera);
      for (const m of body.modules) { const t = moduleTransform(body, m, footprints); for (const x of [t.x - t.footprint / 2, t.x + t.footprint / 2]) for (const z of [t.z - t.footprint / 2, t.z + t.footprint / 2]) for (const y of [0, baseHoverHeight(m.catalogId) + hoverAmplitude(m.catalogId) + 1]) {
        const px = (x - fit.target[0]) * Math.cos(fit.azimuth) - (z - fit.target[2]) * Math.sin(fit.azimuth);
        const py = -(x - fit.target[0]) * Math.sin(fit.azimuth) * Math.sin(fit.elevation) + (y - fit.target[1]) * Math.cos(fit.elevation) - (z - fit.target[2]) * Math.cos(fit.azimuth) * Math.sin(fit.elevation);
        expect(Math.abs(px * fit.zoom)).toBeLessThan(size.width / 2); expect(Math.abs(py * fit.zoom)).toBeLessThan(size.height / 2);
      } }
    }
  });
  it('preserves public ordinals across array order, status and heading wrap', () => {
    const a: PublicActor = { pose: { x: 1000, y: 2000, heading: 4090 }, overheated: false, controlTicks: 0, modules: [
      { ordinal: 7, catalogId: 'armor', x: 6, y: 2, orientation: 3, hp: 0, status: 'detached', phase: 'idle', phaseOffset: 0, shield: false, aim: 0 },
      { ordinal: 2, catalogId: 'core', x: 2, y: 7, orientation: 0, hp: 800, status: 'alive', phase: 'idle', phaseOffset: 0, shield: false, aim: 0 }
    ] }, b = { ...a, pose: { x: 3000, y: 4000, heading: 6 } }, before = JSON.stringify(a);
    expect(publicBody(a).modules.map(m => m.id)).toEqual(['public-7', 'public-2']);
    expect(Object.keys(publicBody(a))).toEqual(['grid', 'modules']);
    expect(interpolatedPose(a, b, 0.5)).toEqual({ x: 2, z: -3, yaw: Math.PI * 2 });
    expect(JSON.stringify(a)).toBe(before);
  });
});
it('keeps cosmetic Core links deterministic and removes links to non-alive public modules', () => {
  const manifest: PresentationManifest = { version: 'ui3d-v1', assetRevision: 'fixture', axes: 'X-forward,Y-up,-Z-left', unitsPerCell: 1, modules: [], decoders: [] };
  const props = { body, footprintByCatalogId: footprints, manifest, publicState: null, quality: 'high' as const, team: 'preview' as const, selectedModuleId: null, onSelectModule: () => {} }, before = JSON.stringify(body);
  const points = coreLinkPaths(props);
  expect(points.map(p => p.moduleId)).toEqual(['a','a','a']); expect(points).toEqual(coreLinkPaths(props));
  expect(new Set(points.map(p=>p.bolt)).size).toBe(3);
  expect(points.every(p=>Math.max(Math.abs(p.start.x),Math.abs(p.start.z))>.94)).toBe(true);
  expect(points[0]!.points.every(p => p.y > .4 && [p.x,p.y,p.z].every(Number.isFinite))).toBe(true);
  const shape=JSON.stringify(points.map(p=>p.points)),ports=points.map(p=>[p.start.x,p.start.z,p.end.x,p.end.z]);
  updateCoreLinks(points,.5);expect(JSON.stringify(points.map(p=>p.points))).not.toBe(shape);expect(points.map(p=>[p.start.x,p.start.z,p.end.x,p.end.z])).toEqual(ports);
  for(const time of [0,.08,.2,.5,1,2]){updateCoreLinks(points,time);for(const link of points){
    expect(link.start.y-hoverHeight('core',core.id,time)).toBeCloseTo(link.source.height*(.55+.18*link.bolt));
    expect(link.end.y-hoverHeight('armor','a',time)).toBeCloseTo(link.target.height*(.4+.22*link.bolt));
    for(const point of link.points){expect(Math.abs(point.x)>=.94||Math.abs(point.z)>=.94||point.y>hoverHeight('core',core.id,time)+link.source.height).toBe(true);expect(Math.abs(point.x-link.target.x)>=link.target.ex||Math.abs(point.z-link.target.z)>=link.target.ez||point.y>hoverHeight('armor','a',time)+link.target.height).toBe(true);}
  }}
  const actor: PublicActor = { pose: { x: 0, y: 0, heading: 0 }, overheated: false, controlTicks: 0, modules: body.modules.map((m, ordinal) => ({ ordinal, catalogId: m.catalogId, x: m.cell.x, y: m.cell.y, orientation: m.orientation, hp: 0, status: ordinal ? 'detached' as const : 'alive' as const, phase: 'idle', phaseOffset: 0, shield: false, aim: 0 })) };
  expect(coreLinkPaths({ ...props, body: publicBody(actor), publicState: actor })).toEqual([]);
  expect(JSON.stringify(body)).toBe(before);
});
it('bobs around the specified shell-bottom heights without changing simulation data', () => {
  for(const id of ['core','armor']){
    const base=id==='core'?2:2.4,amplitude=hoverAmplitude(id);
    expect(hoverHeight(id,'test',0)).toBe(base);
    const samples=Array.from({length:801},(_,i)=>hoverHeight(id,'test',i/100));
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(base-amplitude);
    expect(Math.max(...samples)).toBeLessThanOrEqual(base+amplitude);
    expect(Math.max(...samples)-Math.min(...samples)).toBeGreaterThan(amplitude*1.95);
  }
  expect(hoverHeight('armor','a',1)).not.toBe(hoverHeight('armor','b',1));
});
it('keeps legacy audio/event exports identical after separation from Pixi', () => {
  expect(ArenaAudio).toBe(LegacyAudio); expect(eventLocation).toBe(legacyLocation);
  expect(eventLocation({ tick: 1, kind: 'hit', actor: 'A', module: 7, target: 2, value: 1, key: 4 })).toEqual({ actor: 'B', module: 2 });
});
