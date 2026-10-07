# U3D-01 — Tài nguyên và công cụ xử lý

Ngày 07/10/2026. **U3D-01 hoàn tất trong phạm vi tài nguyên.** Có đủ 30 GLB, 90 KTX2, 10 thumbnail, manifest, decoder nội bộ và công cụ tái tạo; mọi ngân sách kỹ thuật đã đạt. Khầy đã chấp nhận chất lượng đồ họa của model Low hiện tại, gồm Core/Capacitor. Giữ nguyên model, số đo và ảnh đã bàn giao; xem [acceptance.json](assets/acceptance.json) và [xác nhận của Khầy](user-acceptance.json).

Nhánh `remake-ui3d`, HEAD `dd115b4c4ab1cf8ad1ed827f2258daff72749bac` giữ nguyên. 2714 file đầu vào giữ nguyên SHA256, không file cũ bị sửa/mất. Không sửa engine, Brain, contracts, catalog, replay, worker, IndexedDB, App hay CSS. Workshop/Arena/My Synths vẫn theo fallback U3D-00; nối cảnh thật thuộc U3D-02–05. Brain Lab giữ 2D pixel art. Không commit, push, deploy hoặc chia agent.

## Bộ bàn giao

- [Manifest](assets/manifest.json), revision **2a1d71151d96c87b**. Khớp PresentationManifest `ui3d-v1` của U3D-00; không chứa cost/HP/enabled hay luật. Lance/Breaker chỉ có art, không bật catalog.
- [Ảnh High đủ 10 module](renders/high-contact-sheet.png). Mỗi module có ảnh nguồn/High/Medium/Low ở hero, phía đối diện và top (+X lên phía trên), cùng camera trực giao, ánh sáng, exposure, DPR 1. [Core](renders/core-comparison.png), [Thruster](renders/thruster-comparison.png), [Capacitor](renders/capacitor-comparison.png); các module còn lại nằm cùng thư mục.
- [Kiểm kê nguồn](inventory.json), [số đo CSV](measurements.csv), [kiểm numeric](verification.json), [browser render](render-core-armor-thruster-blade-burst-lance-shield-breaker-capacitor-radiator.json), [tái tạo](reproducibility.json), [bảo toàn](preservation.json).
- Nguồn mới: `scripts/u3d01-*`, `tools/u3d01/package.json` và lockfile riêng. Không đổi package.json/lockfile của workspace. Intermediate và encoder riêng ở `.local/u3d01`; chạy script để dựng lại. Bản đóng gói có recipe, bake logs và ảnh tại `deliverables/implementation/UI3D/2a1d71151d96c87b/U3D-01`, tra [seal](seal.json).

## Cách dựng và giới hạn dữ liệu

GLB/PNG/prompt gốc giữ nguyên. Thử Core/Armor/Thruster/Blade trước rồi xử lý cả mười module. Meshoptimizer giảm lưới có trọng số cho normal/UV; scale đồng đều, đưa hướng về +X và đáy về Y=0. Core nằm trong 1,92 unit, các module khác trong 0,94 unit; đây là envelope mỹ thuật, footprint gameplay vẫn do catalog quyết định. Pivot là tâm ô ở đáy, không đổi tâm Core. Vũ khí +X, vòi Thruster −X, phía mở của Shield +X.

Medium/Low được nối lại seam, tạo UV mới và bake từ nguồn bằng Blender headless để sửa UV kéo méo. Color bake qua emission để không mất màu bề mặt kim loại. MikkTSpace tangents đi kèm normal map; sau giản lược có dịch Y rất nhỏ để đặt đáy chính xác, số đo từng mức ghi trong measurement.json. Transform manifest mô tả chuẩn hóa nguồn, đã bake vào model; renderer không áp dụng lại. Decode transforms của Meshopt do GLTFLoader xử lý.

Meshopt nén hình học; KTX2 có mipmaps, ETC1S cho màu/metallic-roughness, UASTC + Zstd cho normal XYZ RGB. Không dùng toktx normal_mode vì nó đổi sang XY cần shader riêng. Color dùng 2048/1024/512; normal dùng 1024/512/256; MR dùng 2048/512/256. Texture trong GLB là tài nguyên tải thật; các KTX2 sidecar trùng byte để kiểm/khai thác, **không tải cả GLB và sidecar**. Decoder Meshopt/Basis nằm trong public cùng ứng dụng, không phụ thuộc CDN. Harness so sánh được phép tải nguồn nặng từ route riêng /source; ứng dụng sản phẩm không tải nguồn này.

## Số đo thực

Nguồn: 327455088 bytes (312.286 MiB), 10 × 500.000 tam giác, mỗi model ba PNG 2048².

| Module | High: tam giác / MiB | Medium: tam giác / MiB | Low: tam giác / MiB |
|---|---:|---:|---:|
| core | 29900 / 2.266 | 7898 / 0.659 | 1900 / 0.201 |
| armor | 29900 / 2.101 | 7899 / 0.637 | 1900 / 0.195 |
| thruster | 29900 / 2.279 | 7892 / 0.671 | 1898 / 0.209 |
| blade | 29900 / 2.143 | 7899 / 0.647 | 1898 / 0.204 |
| burst | 29900 / 2.134 | 7891 / 0.650 | 1896 / 0.199 |
| lance | 29900 / 2.247 | 7900 / 0.654 | 1899 / 0.207 |
| shield | 29900 / 1.984 | 7900 / 0.641 | 1900 / 0.201 |
| breaker | 29900 / 2.358 | 7881 / 0.661 | 1881 / 0.198 |
| capacitor | 29896 / 1.841 | 7880 / 0.616 | 1880 / 0.204 |
| radiator | 29900 / 2.265 | 7894 / 0.667 | 1899 / 0.201 |

| Mức | Tổng 10 GLB (MiB) | Model lớn nhất (MiB) | Max tam giác | Min silhouette IoU, 3 góc |
|---|---:|---:|---:|---:|
| high | 21.617 | 2.358 | 29900 | 99.71% |
| medium | 6.502 | 0.671 | 7900 | 98.84% |
| low | 2.018 | 0.209 | 1900 | 96.79% |

30/30 model đạt ngưỡng 30k/8k/2k, 3/0,75/0,25 MiB và 2048/1024/512². GLB bytes đã bao gồm texture. Decoder tổng 613881 bytes; thumbnail tổng 426259 bytes. IoU đo pixel mask bằng cùng camera, chỉ chứng minh đường viền, không chứng minh vật liệu/chi tiết đã đạt.

Chrome 154.0.8037.98; ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Ti (0x00002D04) Direct3D11 vs_5_0 ps_5_0, D3D11); WebGL 2.0 (OpenGL ES 3.0 Chromium); DPR 1, canvas 400×400. 120 ảnh asset thật + 10 ảnh đối chiếu; không page/console error. 12 file Thruster trùng SHA256 khi chạy lại cả pipeline, gồm bake mới; không suy thành bằng chứng lặp cả 10 module hay mọi OS.

Khronos glTF validator không hiểu đầy đủ Meshopt/KTX2: giữ nguyên warnings trong verification.json, kiểm thêm bản giải nén geometry. Cả hai có 0 error; 90 texture được KTX validator `--gltf-basisu` kiểm trực tiếp, và browser giải mã thật. Không bỏ warnings để giả pass.

Shell hiện tại 171131 bytes gzip; app smoke ghi 0 request GLB. [Brain Lab](app/brain-lab-1600.png) trùng byte với nền U3D-00 ở 1600 và 1920. Chỉ đo shell 2D hiện hành, chưa nghiệm thu tải đầu 3D, streaming High, FPS/stress 120s, Android, memory drift hoặc readability/người thử. Các gate đó thuộc U3D-07; G1/G2 không đổi trạng thái.

## Toolchain và lệnh chạy lại

Giữ Node 24.18.0, pnpm 10.34.6, React 19.3.0, TS 5.9.3 của dự án. Công cụ asset pin glTF Transform 4.5.1, meshoptimizer 1.3.0, Three 0.186.1 (chỉ harness/decoder), mikktspace 1.1.1, Sharp 0.35.5, glTF validator 2.0.0-dev.3.10 và 7zip-bin-full 26.3.1. Blender recipe yêu cầu **5.2.0 LTS**; có thể chỉ đường exe bằng `U3D_BLENDER`. Playwright dùng runtime Codex hoặc đường module qua `PLAYWRIGHT_MODULE`; Chrome cài sẵn, đổi channel bằng `U3D_BROWSER`.

KTX-Software **4.4.2 Windows x64**, SHA256 installer `1f323b0fec19794f5e6c0425a61d4b1da396872a10be862d105f4f4b2d2957fe`. Setup tải bản Khronos và chỉ giải nén vào `.local/u3d01/ktx`; không chạy installer, ghi registry hoặc đổi PATH toàn máy. Hash/version sai thì dừng. Nếu mạng tải chậm, có thể dùng Invoke-WebRequest tải đúng URL trong script vào đúng file rồi chạy setup; vẫn bắt buộc kiểm hash.

```powershell
npm ci --prefix tools/u3d01 --no-audit --no-fund
node scripts/u3d01-setup.mjs
node scripts/u3d01-inventory.mjs
node scripts/u3d01-build.mjs core armor thruster blade
node scripts/u3d01-render.mjs core armor thruster blade
node scripts/u3d01-build.mjs
node scripts/u3d01-render.mjs
node scripts/u3d01-reproduce.mjs thruster
node scripts/u3d01-manifest.mjs
node scripts/u3d01-verify.mjs
node scripts/u3d01-checks.mjs
node scripts/u3d01-app-smoke.mjs
node scripts/u3d01-preserve.mjs
node scripts/u3d01-summary.mjs
node scripts/u3d01-preserve.mjs --seal
```

Preserve dùng baseline của checkout lúc bắt đầu ticket; không ghi đè baseline để tạo pass. Nếu chạy recipe ở checkout khác, chỉ dùng build/render/manifest/verify, không coi preservation của checkout này là của checkout mới. Summary giữ kết luận review trong `u3d01-review.json`; chỉ đổi sau khi sửa lỗi và xem ảnh mới hoặc khi người dùng trực tiếp chấp nhận chất lượng hiện tại; luôn lưu bằng chứng và revision được duyệt.

| Lệnh đã chạy | Exit |
|---|---:|
| node scripts/boundaries.mjs | 0 |
| node scripts/boundary-selfcheck.mjs | 0 |
| node apps/web/node_modules/vite/bin/vite.js build apps/web | 0 |
| node node_modules/typescript/bin/tsc -p tests/g1-browser/tsconfig.json | 0 |
| node node_modules/typescript/bin/tsc -p tests/g2-viewer/tsconfig.json | 0 |
| node node_modules/vitest/vitest.mjs run tests/replay.test.ts | 0 |
| node scripts/g1-corpus.mjs --compare tests/g1/corpus.json --count 10 | 0 |
| node node_modules/typescript/bin/tsc -p tests/tsconfig.json | 0 |
| node node_modules/typescript/bin/tsc -b | 0 |
| node node_modules/vitest/vitest.mjs run | 0 |

Unit: 169 tests / 10 files; corpus: 10 records; replay và boundary-negative đạt. Logs đầy đủ nằm trong evidence/commands. Build asset, render, reproduction, manifest, numeric verify, app smoke và preservation đều exit 0; **exit công cụ không đóng gate mỹ thuật**. Các lần thử lỗi đã dẫn đến sửa encode ETC1S, normal packing, UV bake và tangent; final artifacts không dùng bản texture raw vượt ngân sách.

## Nghiệm thu và phạm vi tiếp theo

**ART-01 — Khầy chấp nhận:** ngày 07/10/2026, Khầy xác nhận “tôi chấp nhận chất lượng đồ họa của model low”. Core/Capacitor Low vẫn có phản chiếu loang và chi tiết bề mặt kém sạch hơn nguồn; đây là sai khác đã được người dùng chấp nhận, không phải lỗi đã sửa. Không sửa/bake lại model. U3D-01 hoàn tất nghiệm thu tài nguyên và có thể làm đầu vào cho U3D-02. Chưa triển khai U3D-02; chưa có art QA độc lập. FPS/device/readability và các gate tích hợp giữ phạm vi U3D-07.

Nguồn PNG có ghi ImageGen trong prompt. Checkout không ghi rõ dịch vụ/điều khoản sinh GLB bên ngoài; manifest nêu đúng giới hạn, không tự gán CC0. License decoder MIT/Apache 2.0 được đóng kèm. Không coi provenance này là xác nhận quyền phát hành nguồn GLB.

Tài liệu công cụ: [glTF Transform](https://gltf-transform.dev/modules/functions/functions/simplify), [Meshoptimizer](https://github.com/zeux/meshoptimizer), [KTX-Software 4.4.2](https://github.com/KhronosGroup/KTX-Software/releases/tag/v4.4.2), [Blender glTF](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html).
