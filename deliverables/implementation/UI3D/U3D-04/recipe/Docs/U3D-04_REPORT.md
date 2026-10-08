# U3D-04 — Arena và replay 3D

**CHƯA HOÀN TẤT NGHIỆM THU.** Code Arena/replay 3D đã bàn giao, có ảnh WebGL thật và kiểm tra chức năng. Không đóng U3D-04 khi còn gate hiệu năng/thiết bị/mỹ thuật chưa đạt hoặc chưa được review; giữ mặc định 2D. Không đóng G1/G2/U3D-07. My Synths 3D thuộc U3D-05, không được thực hiện trong ticket này.

Bàn giao 08/10/2026, nhánh `remake-ui3d`, HEAD `5ba0a7cddbc6e9fba7d002c856019736828a7dd1`. Đã đọc PLAN-UI3D, UI3D_IMPLEMENTATION, U3D-02/03_REPORT và Docs gameplay/Brain/architecture/art/implementation/quality/decisions; xem concept Arena. Checkout đầu vào có sửa tracked và untracked của U3D-02/U3D-03, `.workbuddy-ai/` và fixture private T06. Không commit/push/deploy, reset/stash/clean, đổi nhánh hoặc tạo worktree.

## Phạm vi và cách mở

`http://127.0.0.1:5173/?presentation=3d` → Thử trận → Arena; hoặc đổi **Chế độ trình bày** từ Arena đang có replay. Mặc định không có query vẫn 2D. Workshop 3D giữ implementation U3D-03. Brain Lab luôn 2D pixel art. My Synths giữ fallback 2D hiện hành và thông báo U3D-05.

- `apps/web/src/Arena.tsx`: một playhead/controller cho 2D/3D, play/pause/seek/step/speed/audio. App HUD cập nhật tối đa khoảng 10 Hz; ref fractional đi riêng vào renderer. Chuyển chế độ không remount controller hoặc reset playhead. Audio import trực tiếp từ presentation shared; Pixi chỉ import động khi mở 2D. Trace, resources A, result, timeline và tạo giả thuyết vẫn là DOM của ứng dụng.
- `Arena3D.tsx`, `arena-layout.ts`, `arena3d.css`: lazy wrapper nhận **public frames**, footprint/HP từ catalog, thông số hình ảnh và callbacks nhỏ. Camera trực giao có reset/zoom/orbit giới hạn và khóa khi nhập/kéo timeline. Layout chiếu alpha-0 40×28, objective radius 3; unit test đối chiếu với ruleset gốc. Arena dùng theme chung đã có qua class riêng; CSS mới chỉ áp dụng Arena. A/B chuyển vào details thu gọn, giữ chức năng.
- `renderer3d/ArenaScene.tsx`, `ArenaCombat.tsx`, `arena-sample.ts`: vị trí/góc nội suy theo public pose; trạng thái sống/phá/tách, HP, phase, shield, ring/objective chuyển tại boundary dưới. Telegraph Burst và Blade vẫn hiện khi VFX off/Low/reduced; tiến độ windup dùng **phaseOffset + duration từ event activation của engine**, không dùng clock wall time hay thời lượng animation tự đặt. Aim điều khiển hướng telegraph/muzzle; GLB giữ nguyên khối, có recoil toàn module, không giả định xương/nòng/rotor.
- Cosmetic hover/sét dùng thời gian replay; flash/debris có seed theo event và tuổi từ boundary. Không có hàng đợi hiệu ứng tích lũy phụ thuộc hướng tua. Tra ordinal bằng ID, không index mảng. Dấu đội A tròn, B lục giác; HP có thanh DOM và dấu scene. Đạn và mảnh vỡ gom instanced geometry để giảm draw calls; flash có cap High/Medium/Low 64/24/8, không cắt public events hoặc telegraph.
- `SynthVisual.tsx`/`CoreLinks.tsx`: thêm clock replay tùy chọn; Workshop/My Synths giữ nhịp mỹ thuật trước đó. `SceneViewport.tsx` chỉ thêm zoom bounds tùy chọn để Arena vừa sân trên màn nhỏ. Mất context dừng play/audio, giữ fractional ref và camera; khi restore, wrapper remount viewport/cache, tải lại model/texture/decoder, chỉ phát tiếp sau khi người chơi bấm Phát. Không mở được 3D vẫn có kết quả/timeline/trace và nút Chuyển 2D.
- App sửa nhỏ tại route/class/banner/props của Arena; thêm dependency shared presentation và 3 dòng lockfile. Không sửa engine, Brain, content/catalog, contracts, replay codec, protocol worker, local.worker, useSynthSession, model/editing, drafts/IndexedDB, Brain components/CSS hoặc GLB/PNG nguồn.

## Tài nguyên tái tạo

Không sinh/copy GLB nguồn nặng. Reuse manifest U3D-01 revision `2a1d71151d96c87b`, LOD Meshopt/KTX2 và decoder self-host; floor U3D-02 41.310 byte, hash `c183742efaae9f4993b7366e023c974ae9d3542ab097d2f1c3031ff95819eb67`. High mở Medium rồi nâng **các catalog ID đang dùng**, không tải cả 10 bộ High.

VFX/telegraph/projectile/debris là geometry từ source TSX, không thêm texture hoặc binary asset. `scripts/u3d04-fixture.mjs` tái tạo public replay ranged và ring từ engine hiện hành, fixed seeds, và fixture render-only 48 module/128 projectile/256 event mỗi boundary. Không gọi fixture stress là trận hợp lệ/balance proof. Practice lấy public frames từ baseline worker bàn giao. Fixture chỉ nằm `.local/u3d04` và test harness; không đưa 69,85 MB JSON test vào web production public.

Recipe source nằm `deliverables/implementation/UI3D/U3D-04/recipe`; hash tài nguyên, fixture provenance và reconstruction ở `assets.json`, `fixture-provenance.json`, `reproduction.json`. `seal.json` khóa hash working tree; không là commit.

## Bằng chứng thực thi

- `final/checks.json` và `final/commands`: type/build, test typing, boundaries + negative injection, **188 unit tests/13 files**, corpus 10 seeds đều exit 0. Các test simulation/spatial/combat/replay được chạy trong suite; không thay expected gameplay hashes.
- `final/chrome/browser.json` và `final/msedge/browser.json`: actual production build. Cùng practice snapshot/seed/opponent cho simulation hash, replay hash, public frames hash, full ordered events hash và result giống baseline. 100 random seek mỗi browser: quay về tick 142 với cùng camera/Medium/VFX on/motion cho canvas PNG byte-identical. Không chỉ kiểm DOM.
- Brain full screenshots ở 1600/1920 trước practice trên Chrome byte-identical với checkout baseline. Brain panel trước/sau Arena byte-identical trong cùng browser; full page sau trận có status/result text khác là dữ liệu đúng, không dùng full page khác trạng thái để giả chứng minh pixel parity. Không canvas 3D trong Brain. Buffer Rule JSON chưa áp dụng giữ qua Brain → Arena → Brain trong `memory/memory.json`.
- `render/chrome`: engine replay ranged có activation/shot/shieldOn/blocked/hit/shieldOff/destroyed/detached/result; engine replay passive có ringNotice/shrink/ringDamage/objective/result. Chụp state thực và probe scene; model High được xác nhận đã tải xong. Có ảnh stress High/Medium/Low.
- `faults/faults.json`: missing GLB, missing decoder, no-WebGL — timeline/trace/result vẫn đọc được, giữ tick khi chọn fallback. Cold 3D route không tải Pixi chunk. WebAudio thật có voice khi play, không phát lại event khi seek, âm dày không phát ở 2×; unit test thêm cursor/duplicate event. Context loss/restore bằng WEBGL_lose_context thật trong browser suites, tick được giữ và tài nguyên tải lại.
- Responsive 1024/768/390/320: ảnh thật, không horizontal overflow. Đây là desktop resize, **không** kiểm mobile GPU/thiết bị thật. Ảnh High cả 1600×1100 và 1920×1080 là full page, chiều cao có thể vượt viewport; chưa có review độc lập mức giống concept.

## Lệnh kiểm tra / tái tạo

Chạy từ `D:\AI\nextgame`, Node 24.18.0, pnpm 10.34.6. Playwright dùng runtime Codex đã có; override `PLAYWRIGHT_MODULE` nếu máy khác. Chrome/Edge phải được cài. Dùng browser context tạm, không mở profile/IndexedDB của người dùng.

```powershell
npx --yes pnpm@10.34.6 install --frozen-lockfile --offline
node scripts/u3d04-evidence.mjs final
node node_modules/typescript/bin/tsc -p tests/u3d04/tsconfig.json
node scripts/u3d04-fixture.mjs
node apps/web/node_modules/vite/bin/vite.js build --config tests/u3d04/vite.config.mjs
node scripts/u3d04-browser.mjs final
$env:U3D_BROWSER='msedge'
node scripts/u3d04-browser.mjs final
Remove-Item Env:U3D_BROWSER
node scripts/u3d04-faults.mjs
node scripts/u3d04-memory.mjs
$env:U3D_STRESS_SECONDS='120'
node scripts/u3d04-render.mjs
Remove-Item Env:U3D_STRESS_SECONDS
node scripts/u3d04-assets.mjs
node scripts/u3d04-evidence.mjs seal
```

Baseline đã có trước sửa và không được ghi đè. Khi tái hiện trên checkout mới chưa sửa mới dùng `u3d04-evidence baseline` + `u3d04-baseline-browser baseline`. Bản bàn giao chứa baseline để so sánh.

## Tiêu chí còn thiếu / giới hạn

- Desktop p95 strict ≤16,7 ms: phép đo cuối ghi bên dưới; không làm tròn xuống để báo đạt. rAF/render callback cadence không phải GPU completion timing.
- Chưa có Android thật/Low p95≤33,3 ms, GPU tích hợp, review mỹ thuật/readability/người dùng độc lập. Robot còn khá nhỏ khi camera bao toàn sân; bố cục có chiều cao full-page, chưa được ký duyệt mức khớp concept.
- Seek số đo là round trip qua browser/HUD + các rAF settle và kiểm ảnh. Chưa đóng gate cached decode seek ≤500 ms, GPU/native/process memory hoặc U3D-07 full lifecycle QA.
- Nguồn baseline/protocol/IndexedDB được bảo toàn theo hash; không migration, không ghi bot của người dùng. Không tự đổi default 3D. Ticket chỉ được đóng khi các tiêu chí bắt buộc còn thiếu đã được chứng minh.

## Số đo cuối

Máy Windows, CPU AMD Ryzen 5 7600 6-Core Processor, GPU `ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Ti (0x00002D04) Direct3D11 vs_5_0 ps_5_0, D3D11)`; Chrome 154.0.8037.98, desktop headless 1600×1100, DPR 1. Không chạy browser/test nặng khác đồng thời trong bài stress cuối. Đo callback render thực, không gọi manual render để thay thế cadence.

| Quality | Thời gian | Mẫu interval | p95 | p99 | Draw calls tại sample | Triangles tại sample |
|---|---:|---:|---:|---:|---:|---:|
| high | 120 s | 7206 | 16.800 ms | 19.200 ms | 526 | 2,945,426 |
| medium | 10 s | 602 | 16.800 ms | 17.100 ms | 446 | 830,286 |
| low | 10 s | 602 | 16.800 ms | 16.800 ms | 414 | 239,922 |

**High p95 16.800 > 16,7 ms: FAIL strict desktop.** High p99 19.200 ms so với ≤33,3 ms. Medium/Low là quan sát 10 giây, không giả là 120 giây hoặc mobile. Geometry/textures cache giữ Medium rồi High trong cùng viewport; counts không là byte GPU memory.

- Shell static closure JS/CSS/preload: **96,151 byte gzip** (≤409.600). Chunk 3D tải riêng; không cộng worker hay asset vào tên shell.
- Cold request bodies trước High, gồm font/Medium/floor/decoder đã quan sát: **5,787,159 byte = 5.519 MiB**, dưới 8 MiB. Đây là sum unique URLs lọc High, không phải timestamp chính xác trước khi scene đầu tiên xuất hiện. Tổng unique asset qua đến High: **21,545,703 byte = 20.548 MiB**; High tải bổ sung theo cảnh, không claim tổng High ≤8 MiB.
- 100 random seek Chrome p95 **104.037 ms**, Edge p95 **104.969 ms**. Bao gồm host→browser/UI và sáu rAF settle, không là riêng replay decode/GPU completion. Canvas target Medium/VFX on/motion ở tick 142 giống hệt sau mỗi lượt.
- JS heap sau forced GC: trước **19,383,132**, sau **24,917,380 byte**, drift **5.278 MiB** sau 10 vòng mode teardown. Chỉ CDP `Runtime.getHeapUsage.usedSize`, không GPU/native/total process memory; dưới ngưỡng 10 MiB của phép đo này.

Ảnh chính: [Arena High 1600](../deliverables/implementation/UI3D/U3D-04/final/chrome/arena-high-1600.png), [High 1920](../deliverables/implementation/UI3D/U3D-04/final/chrome/arena-high-1920.png), [VFX off](../deliverables/implementation/UI3D/U3D-04/final/chrome/arena-vfx-off.png), [Low grayscale reduced](../deliverables/implementation/UI3D/U3D-04/final/chrome/arena-low-gray-reduced.png), [Shield](../deliverables/implementation/UI3D/U3D-04/render/chrome/ranged-shieldOn.png), [Ring](../deliverables/implementation/UI3D/U3D-04/render/chrome/ring-damage-objective.png), [Brain sau Arena](../deliverables/implementation/UI3D/U3D-04/final/chrome/brain-after-arena.png).

Các ảnh `failure-scene.png` trong thư mục là ảnh thử lỗi lúc phát triển, không phải bản render bàn giao cuối; báo cáo browser cuối và các link trên xác định bản đã kiểm.

## Đối chiếu bảo toàn

`preservation.json`: **4,853 file đầu vào giữ nguyên SHA256**, 10 file thay đổi và 20 file mới đều thuộc whitelist U3D-04; không thiếu file, không có thay đổi ngoài phạm vi, HEAD/branch giữ nguyên. Các thay đổi U3D-02/U3D-03 có sẵn, engine/Brain/catalog/contracts/replay/worker/IndexedDB code và nguồn GLB/PNG được giữ. Recipe chụp file sở hữu ở trạng thái cuối, có thể chứa phần App đã có từ owner trước; không coi toàn bộ diff so với HEAD là phần do U3D-04 viết.
