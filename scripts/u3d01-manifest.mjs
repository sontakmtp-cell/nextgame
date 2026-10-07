import { readFile } from 'node:fs/promises';
import { ids, json, save, sha, out, evidence, sourcePath, levels } from './u3d01-lib.mjs';
const modules=[];
for(const id of ids){const lods={};for(const quality of Object.keys(levels)){const row=await json(`${out}/modules/${id}/${quality}/measurement.json`);const{modelUrl,modelSha256,bytes,triangles,textures}=row;lods[quality]={modelUrl,modelSha256,bytes,triangles,textures};}
 const thumb=await readFile(`${out}/thumbnails/${id}.png`);
 modules.push({catalogId:id,source:{path:sourcePath(id),sha256:sha(await readFile(sourcePath(id))),license:'Project-supplied generated asset; external 3D generator terms not recorded in checkout',attribution:`PNG provenance and authoring prompt: assets/concepts/modules/${id}-image-to-3d-v1.prompt.txt`},thumbnail:{url:`/assets/ui3d/u3d01/thumbnails/${id}.png`,sha256:sha(thumb),bytes:thumb.length},levels:lods,normalization:await json(`.local/u3d01/build/${id}-normalization.json`)});
}
const decoders=await json(`${evidence}/decoders.json`);
const assetRevision=sha(JSON.stringify({modules,decoders,settings:await json('scripts/u3d01-settings.json'),toolchain:await json('tools/u3d01/package-lock.json')})).slice(0,16);
await save(`${out}/manifest.json`,{version:'ui3d-v1',assetRevision,unitsPerCell:1,axes:'X-forward,Y-up,-Z-left',modules,decoders});
await save(`${out}/provenance.json`,{version:'u3d01-provenance-v1',assetRevision,textureStorage:'GLB embeds KTX2. Sidecar .ktx2 files are byte-identical extraction artifacts; do not load both at runtime.',normalization:'Baked once into vertices, mount is node origin. Manifest transform describes source-to-output; renderer must not apply it twice. Meshopt quantization creates decode transforms that GLTFLoader applies.',toolchain:await json('tools/u3d01/package.json'),ktx:await json('.local/u3d01/ktx/provenance.json'),settings:await json('scripts/u3d01-settings.json'),sources:await Promise.all(ids.map(async id=>({id,pngSha256:sha(await readFile(`assets/concepts/modules/${id}-image-to-3d-v1.png`)),promptSha256:sha(await readFile(`assets/concepts/modules/${id}-image-to-3d-v1.prompt.txt`))}))),licenseStatus:'Decoder licenses bundled. PNG prompt records built-in ImageGen; external GLB generation terms are absent. Do not infer CC0 or release clearance.'});
console.log({assetRevision,modules:modules.length});
