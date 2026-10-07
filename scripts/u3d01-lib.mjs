import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const requireTool = createRequire(resolve('tools/u3d01/package.json'));
export const tool = name => import(pathToFileURL(name === 'three' ? resolve('tools/u3d01/node_modules/three/build/three.module.js') : requireTool.resolve(name)).href);
export const { NodeIO } = await tool('@gltf-transform/core');
export const { ALL_EXTENSIONS } = await tool('@gltf-transform/extensions');
export const { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } = await tool('meshoptimizer');
export const functions = await tool('@gltf-transform/functions');
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
export const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
export const sharp = requireTool('sharp');
export const sha = data => createHash('sha256').update(data).digest('hex');
export const json = async path => JSON.parse(await readFile(path, 'utf8'));
export const save = async (path, value) => { await mkdir(resolve(path, '..'), { recursive: true }); await writeFile(path, JSON.stringify(value, null, 2) + '\n'); };
export const sourcePath = id => `assets/concepts/modules/${id}-image-to-3d-v1.glb`;
export const ids = ['core', 'armor', 'thruster', 'blade', 'burst', 'lance', 'shield', 'breaker', 'capacitor', 'radiator'];
export const levels = { high: { triangles: 30000, texture: 2048, bytes: 3 * 1048576 }, medium: { triangles: 8000, texture: 1024, bytes: .75 * 1048576 }, low: { triangles: 2000, texture: 512, bytes: .25 * 1048576 } };
export const out = 'apps/web/public/assets/ui3d/u3d01';
export const evidence = 'deliverables/implementation/UI3D/U3D-01';
export const triangles = doc => doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((s, p) => s + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0), 0);
export async function describe(path) {
  const bytes = await readFile(path), doc = await io.read(path), root = doc.getRoot();
  const textures = await Promise.all(root.listTextures().map(async t => { const image = t.getImage(); const meta = t.getMimeType() === 'image/ktx2' ? { width: Buffer.from(image).readUInt32LE(20), height: Buffer.from(image).readUInt32LE(24) } : await sharp(image).metadata(); return { name: t.getName(), mime: t.getMimeType(), width: meta.width, height: meta.height, bytes: image.length, sha256: sha(image) }; }));
  return { path, bytes: bytes.length, sha256: sha(bytes), triangles: triangles(doc), textures, bounds: functions.getBounds(root.listScenes()[0]), nodes: root.listNodes().map(n => ({ name: n.getName(), translation: n.getTranslation(), rotation: n.getRotation(), scale: n.getScale() })), meshes: root.listMeshes().length, materials: root.listMaterials().length, animations: root.listAnimations().length };
}
