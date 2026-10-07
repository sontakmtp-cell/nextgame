import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { ids, sourcePath, io, tool, functions as f, MeshoptSimplifier, MeshoptEncoder, sharp, sha, save, json, out, evidence, levels, requireTool, triangles } from './u3d01-lib.mjs';
const { Matrix4, Quaternion, Vector3 } = await tool('three');
const { KHRTextureBasisu } = await tool('@gltf-transform/extensions');
const { generateTangents } = await tool('mikktspace');
const settings = await json('scripts/u3d01-settings.json');
const selected = process.argv.slice(2).length ? process.argv.slice(2) : ids;
assert(selected.every(id => ids.includes(id)), 'Unknown module');
const ktx = resolve('.local/u3d01/ktx/bin/toktx.exe');
const ktxVersion = spawnSync(ktx, ['--version'], { encoding: 'utf8' });
assert.equal(ktxVersion.status, 0); assert.match(ktxVersion.stdout + ktxVersion.stderr, /4\.4\.2/);
const work = '.local/u3d01/build';
await mkdir(work, { recursive: true });
const measurements = [];
for (const id of selected) {
  const source = await readFile(sourcePath(id));
  const original = await io.readBinary(source);
  assert.equal(original.getRoot().listMeshes().length, 1, 'Review new source hierarchy before normalization');
  assert.equal(original.getRoot().listNodes().length, 1);
  assert.deepEqual(original.getRoot().listNodes()[0].getMatrix(), [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  const authored = settings.modules[id];
  const rot = new Matrix4().makeRotationY(authored.yaw);
  f.transformMesh(original.getRoot().listMeshes()[0], rot.elements);
  const rotated = f.getBounds(original.getRoot().listScenes()[0]);
  const scale = authored.span / Math.max(rotated.max[0] - rotated.min[0], rotated.max[2] - rotated.min[2]);
  const translation = [-(rotated.max[0]+rotated.min[0])/2*scale + authored.anchorX, -rotated.min[1]*scale, -(rotated.max[2]+rotated.min[2])/2*scale + authored.anchorZ];
  const matrix = new Matrix4().compose(new Vector3(...translation), new Quaternion(), new Vector3(scale,scale,scale));
  f.transformMesh(original.getRoot().listMeshes()[0], matrix.elements);
  original.getRoot().listNodes()[0].setName(`${id}:mount`);
  const normalization = { uniformScale: scale, rotationRadians: [0, authored.yaw, 0], translation, pivot: [0,0,0], bounds: f.getBounds(original.getRoot().listScenes()[0]), front: '+X', baseY: 0 };
  await io.write(`${work}/${id}-reference.glb`, original);
  await save(`${work}/${id}-normalization.json`, normalization);
  for (const [quality, budget] of Object.entries(levels)) {
    const start = performance.now();
    let doc = await io.read(`${work}/${id}-reference.glb`);
    await doc.transform(f.weld());
    const p = doc.getRoot().listMeshes()[0].listPrimitives()[0];
    const pos = p.getAttribute('POSITION').getArray(), normal = p.getAttribute('NORMAL').getArray(), uv = p.getAttribute('TEXCOORD_0').getArray();
    const attributes = new Float32Array(pos.length / 3 * 5);
    for (let i = 0; i < pos.length / 3; i++) { attributes.set(normal.subarray(i*3,i*3+3),i*5); attributes.set(uv.subarray(i*2,i*2+2),i*5+3); }
    const target = (budget.triangles - 100) * 3;
    const [indices, appearanceError] = MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(p.getIndices().getArray()), pos, 3, attributes, 5, settings.attributeWeights, null, target, 1, ['Permissive']);
    p.getIndices().setArray(indices);
    f.compactPrimitive(p);
    const lodBaseCorrectionY = -f.getBounds(doc.getRoot().listScenes()[0]).min[1];
    f.transformMesh(doc.getRoot().listMeshes()[0], new Matrix4().makeTranslation(0, lodBaseCorrectionY, 0).elements);
    const count = indices.length / 3;
    assert(count <= budget.triangles, `${id}/${quality}: simplification didn't reach budget`);
    if (quality !== 'high') {
      const geometry = resolve(`${work}/${id}-${quality}-geometry.glb`), baked = resolve(`${work}/${id}-${quality}-baked.glb`);
      await io.write(geometry, doc);
      const log = execFileSync(process.env.U3D_BLENDER ?? 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe', ['--background', '--factory-startup', '--python', resolve('scripts/u3d01-bake.py'), '--', resolve(`${work}/${id}-reference.glb`), geometry, baked, String(budget.texture)], { encoding: 'utf8', maxBuffer: 16 * 1048576 });
      await writeFile(`${work}/${id}-${quality}-bake.log`, log);
      doc = await io.read(baked);
    }
    const dir = `${out}/modules/${id}/${quality}`;
    await mkdir(dir, { recursive: true });
    const basis = doc.createExtension(KHRTextureBasisu).setRequired(true);
    const material = doc.getRoot().listMaterials()[0];
    const textures = [];
    for (const [slot, texture] of [['normal', material.getNormalTexture()], ['baseColor', material.getBaseColorTexture()], ['metallicRoughness', material.getMetallicRoughnessTexture()]]) {
      assert(texture, `${id}: missing source ${slot}`);
      const input = `${work}/${id}-${quality}-${slot}.png`, output = `${dir}/${slot}.ktx2`;
      // Color uses the full cap; UASTC normals and baked MR use half-resolution.
      const dimension = slot === 'normal' || (quality !== 'high' && slot === 'metallicRoughness') ? budget.texture / 2 : budget.texture;
      await sharp(texture.getImage()).resize(dimension, dimension, { fit: 'inside' }).png().toFile(input);
      const args = ['--t2', '--genmipmap', '--threads', '1', '--assign_oetf', slot === 'baseColor' ? 'srgb' : 'linear', '--assign_primaries', slot === 'baseColor' ? 'bt709' : 'none'];
      // UASTC keeps normal detail; ETC1S minimizes the other two maps. All levels have mipmaps.
      // glTF expects XYZ in RGB. toktx --normal_mode packs XY into RGB+A and
      // requires a custom reconstruction shader, so it must not be used here.
      if (slot === 'normal') args.push('--encode', 'uastc', '--uastc_quality', '2', '--uastc_rdo_l', '2', '--uastc_rdo_m', '--zcmp', '18');
      else args.push('--encode', 'etc1s', '--clevel', '2', '--qlevel', '192');
      args.push(output, input);
      const cachePath = `${work}/${id}-${quality}-${slot}-encoding.json`;
      const key = sha(Buffer.concat([await readFile(input), Buffer.from(JSON.stringify(args.slice(0,-2)))]));
      let cached = false;
      try { const previous = await json(cachePath); cached = previous.key === key && previous.sha256 === sha(await readFile(output)); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      if (!cached) execFileSync(ktx, args, { stdio: ['ignore','pipe','pipe'] });
      const bytes = await readFile(output);
      assert.equal(bytes.readUInt32LE(12), 0, 'Expected Basis-compressed KTX2, not raw Vulkan pixels');
      await save(cachePath, { key, sha256: sha(bytes), encoder: 'toktx-4.4.2' });
      texture.setImage(bytes).setMimeType('image/ktx2').setURI('').setName(`${id}:${quality}:${slot}`);
      textures.push({ url: `/assets/ui3d/u3d01/modules/${id}/${quality}/${slot}.ktx2`, sha256: sha(bytes), bytes: bytes.length, width: bytes.readUInt32LE(20), height: bytes.readUInt32LE(24), format: 'ktx2' });
    }
    if (quality === 'high') await doc.transform(f.unweld(), f.tangents({ generateTangents }), f.weld());
    // Blender exports MikkTSpace tangents with the baked Medium/Low maps.
    await doc.transform(f.prune(), f.meshopt({ encoder: MeshoptEncoder, level: 'high', quantizePosition: 16, quantizeNormal: 12, quantizeTexcoord: 16 }));
    // Embed maps in GLB for atomic cache entries; sidecars are exact extraction/check artifacts.
    const path = `${dir}/model.glb`;
    await io.write(path, doc);
    const bytes = await readFile(path);
    const row = { id, quality, modelUrl: `/assets/ui3d/u3d01/modules/${id}/${quality}/model.glb`, modelSha256: sha(bytes), bytes: bytes.length, triangles: triangles(doc), textures, appearanceError, lodBaseCorrectionY, elapsedMs: performance.now()-start };
    measurements.push(row);
    await save(`${dir}/measurement.json`, row);
    console.log(`${id}/${quality}: ${row.triangles} triangles, ${bytes.length} bytes, error ${appearanceError.toFixed(5)}`);
  }
}
const decoderFiles = [['meshopt','meshoptimizer','meshopt_decoder.module.js'], ['ktx2','three','examples/jsm/libs/basis/basis_transcoder.js'], ['ktx2','three','examples/jsm/libs/basis/basis_transcoder.wasm']];
const decoders = [];
await mkdir(`${out}/decoders`, { recursive: true });
for (const [kind, pkg, relative] of decoderFiles) {
  let src;
  if (pkg === 'three') src = resolve('tools/u3d01/node_modules/three', relative);
  else src = requireTool.resolve(`${pkg}/decoder`);
  const name = relative.split('/').at(-1), dst = `${out}/decoders/${name}`;
  await copyFile(src, dst); const data = await readFile(dst);
  decoders.push({ kind, url: `/assets/ui3d/u3d01/decoders/${name}`, sha256: sha(data), bytes: data.length, version: pkg === 'three' ? 'three-0.186.1' : '1.3.0' });
}
await copyFile('tools/u3d01/node_modules/three/LICENSE', `${out}/decoders/THREE-LICENSE.txt`);
await copyFile('tools/u3d01/node_modules/meshoptimizer/LICENSE.md', `${out}/decoders/MESHOPT-LICENSE.txt`);
await copyFile('tools/u3d01/BASIS-LICENSE.txt', `${out}/decoders/BASIS-LICENSE.txt`);
await copyFile('tools/u3d01/node_modules/three/examples/jsm/libs/basis/README.md', `${out}/decoders/BASIS-README.md`);
await save(`${evidence}/decoders.json`, decoders);
await save(`${evidence}/last-build.json`, { selected, command: `node scripts/u3d01-build.mjs ${process.argv.slice(2).join(' ')}`, measurements });
