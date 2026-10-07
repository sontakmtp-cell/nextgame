import { createContext, useContext } from 'react';
import { Mesh, Texture, TextureLoader, SRGBColorSpace } from 'three';
import type { Group, WebGLRenderer, Material } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'meshoptimizer';
import type { ModulePresentation, PresentationManifest, Quality } from './interfaces.js';

function disposeModel(scene: Group) {
  const textures = new Set<Texture>(), materials = new Set<Material>();
  scene.traverse(o => { if (o instanceof Mesh) {
    o.geometry.dispose();
    // dispose() releases GPU buffers, not their CPU arrays. This cache is dead:
    // remove arrays even if React's previous fiber still holds a graph clone.
    for (const name of Object.keys(o.geometry.attributes)) o.geometry.deleteAttribute(name);
    o.geometry.setIndex(null);
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) { materials.add(m); for (const v of Object.values(m)) if (v instanceof Texture) textures.add(v); }
  } });
  textures.forEach(t => { t.dispose(); t.mipmaps = []; t.source.data = null; }); materials.forEach(m => m.dispose());
}
// One cache per viewport: all robot instances, ghosts and scenes share immutable
// geometry/material/texture objects. Clones only own their transforms.
export class SceneAssetCache {
  private models = new Map<string, Promise<Group>>();
  private textures = new Map<string, Promise<Texture>>();
  private loaders = new Map<string, { gltf: GLTFLoader; ktx: KTX2Loader }>();
  private decoderReadiness = new Map<string, Promise<void>>();
  private dead = false;
  private users = 0;
  constructor(private renderer: WebGLRenderer) {}
  retain() { this.users++; }
  release() { this.users--; queueMicrotask(() => { if (!this.users) this.dispose(); }); }
  loadModel(manifest: PresentationManifest, module: ModulePresentation, quality: Quality): Promise<Group> {
    const level = module.levels[quality], key = `${manifest.assetRevision}/${level.modelSha256}`;
    let pending = this.models.get(key);
    if (!pending) {
      const decoder = manifest.decoders.find(d => d.kind === 'ktx2');
      if (!decoder || !decoder.url.startsWith('/assets/ui3d/')) throw Error('Thiếu decoder KTX2 nội bộ');
      const base = decoder.url.slice(0, decoder.url.lastIndexOf('/') + 1);
      let readiness = this.decoderReadiness.get(base);
      if (!readiness) {
        readiness = Promise.all(manifest.decoders.filter(d => d.kind === 'ktx2').map(async d => {
          const response = await fetch(d.url, { method: 'HEAD', signal: AbortSignal.timeout(30000) });
          if (!response.ok) throw Error(`Không tải được decoder KTX2 (${response.status})`);
        })).then(() => {});
        this.decoderReadiness.set(base, readiness);
      }
      let loaders = this.loaders.get(base);
      if (!loaders) {
        const ktx = new KTX2Loader().setTranscoderPath(base).setWorkerLimit(2).detectSupport(this.renderer);
        loaders = { ktx, gltf: new GLTFLoader().setKTX2Loader(ktx).setMeshoptDecoder(MeshoptDecoder) }; this.loaders.set(base, loaders);
      }
      const loader = loaders.gltf;
      pending = (async () => {
        if (!level.modelUrl.startsWith('/assets/ui3d/') || level.bytes > 3 * 1048576) throw Error('Asset chạy thật phải là model tối ưu');
        await readiness;
        const response = await fetch(level.modelUrl, { signal: AbortSignal.timeout(30000) }); if (!response.ok) throw Error(`Không tải được model (${response.status})`);
        const bytes = await response.arrayBuffer();
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
        if (bytes.byteLength !== level.bytes || hash !== level.modelSha256) throw Error('Model không khớp manifest');
        if (this.dead) throw Error('Viewport đã đóng');
        let expired = false, timer: ReturnType<typeof setTimeout> | undefined;
        const parsed = loader.parseAsync(bytes, level.modelUrl.slice(0, level.modelUrl.lastIndexOf('/') + 1)).then(result => {
          if (expired) { disposeModel(result.scene); throw Error('Model đến sau thời hạn giải mã'); } return result;
        });
        const timeout = new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { expired = true; reject(Error('Giải mã model/texture quá 30 giây')); }, 30000); });
        const result = await Promise.race([parsed, timeout]).finally(() => { if (timer) clearTimeout(timer); });
        if (this.dead) { disposeModel(result.scene); throw Error('Viewport đã đóng'); }
        result.scene.traverse(o => { if (o instanceof Mesh) { o.castShadow = true; o.receiveShadow = true; o.raycast = () => {}; } });
        return result.scene;
      })().catch(error => { this.models.delete(key); throw error; });
      this.models.set(key, pending);
    }
    return pending;
  }
  loadTexture(url: string): Promise<Texture> {
    let pending = this.textures.get(url);
    if (!pending) {
      pending = new TextureLoader().loadAsync(url).then(texture => { texture.colorSpace = SRGBColorSpace; texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy()); if (this.dead) { texture.dispose(); throw Error('Viewport đã đóng'); } return texture; }).catch(error => { this.textures.delete(url); throw error; });
      this.textures.set(url, pending);
    }
    return pending;
  }
  dispose() {
    this.dead = true;
    this.models.forEach(p => { void p.then(disposeModel).catch(() => {}); });
    this.textures.forEach(p => { void p.then(t => t.dispose()).catch(() => {}); });
    this.loaders.forEach(l => l.ktx.dispose());
    this.models.clear(); this.textures.clear(); this.loaders.clear();
    this.decoderReadiness.clear();
  }
}
export const AssetContext = createContext<SceneAssetCache | null>(null);
export function useAssetCache(): SceneAssetCache { const cache = useContext(AssetContext); if (!cache) throw Error('Cần SceneViewport'); return cache; }
