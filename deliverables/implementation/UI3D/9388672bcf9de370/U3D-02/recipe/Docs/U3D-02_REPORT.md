# U3D-02 — Renderer và cảnh mẫu

**Trạng thái: CHƯA HOÀN TẤT NGHIỆM THU.** Code/cảnh mẫu, tài nguyên tái tạo, ảnh và kiểm tra bên dưới đã bàn giao. Chưa có review mỹ thuật/readability độc lập; chưa chạy bài stress 120 giây với 48 module và projectile/event; chưa thử Android thật. Không đánh dấu các gate này đạt. Quan sát ngắn lúc sét chạy có p95 cao hơn mục tiêu 16,7 ms, đặc biệt High trên GPU tích hợp. Không tự đóng thiếu sót G1/G2.

Checkout đầu vào: `remake-ui3d`, HEAD `c0955b8`. Node 24.18.0, pnpm 10.34.6, React 19.3.0, TypeScript 5.9.3. Đã đọc Docs và chụp baseline trước khi sửa. `.workbuddy-ai/` và chín thư mục fixture private T06 có sẵn được giữ. Không commit, push, deploy hay đổi branch. Revision bàn giao là hash working tree trong [seal.json](D:/AI/nextgame/deliverables/implementation/UI3D/U3D-02/seal.json), không phải commit.

## Code đã có

- `packages/renderer3d`: SceneViewport, SynthVisual, SynthPreview, WorkshopScene, nền ArenaScene, camera/footprint/picking, cache model/texture và phục hồi context. Pin Three 0.186.1, Fiber 9.8.1, Drei 10.7.9, meshoptimizer 1.3.0, types/three 0.186.0.
- Body dùng footprint từ catalog; Core 2×2 là gốc tọa độ. Đủ bốn hướng, Core lệch và fixture 24 module bất đối xứng. Model U3D-01 đã bake normalization, không áp transform lần thứ hai. Vùng chọn dùng hộp footprint; model không tham gia raycast hàng trăm nghìn tam giác.
- Model và ghost lơ lửng: đáy Y=0,4 đơn vị ô. Bóng thật từ đèn chính, shadow catcher opacity 0,55; PCF radius 3; map High/Medium/Low = 2048/1024/512. Low có bóng. Không đổi vị trí/collider của simulation.
- Theo bổ sung cuối của Khầy, **mỗi module có ba tia sét chuyển động độc lập** qua khoảng trống giữa mép vỏ module và mép vỏ Core. Không đi vào tâm Core. Port theo bounds và orientation; rung được clamp ngoài vỏ, đường dài nâng qua vật thể xen giữa. Có lõi trắng/quầng cyan, A dùng cam. Mantis: 5 module ngoài Core → 15 tia; fixture 24 → 69 tia. Đây là trang trí, không phải luật nối hay sự kiện gameplay.
- Sét cập nhật buffer ngay trong renderer, không cập nhật React toàn ứng dụng mỗi frame. Ba lớp geometry được gộp thành ba draw call mỗi robot, không thêm GLB/texture. Animation chạy khi bật sét; `reducedMotion` giữ tia đứng yên; tắt VFX/ẩn tab/mất context/không còn tia thì không duy trì loop. Đây là ngoại lệ cho yêu cầu cảnh tĩnh do Khầy trực tiếp yêu cầu chuyển động. Seed hình theo ID, thời gian mỹ thuật không thuộc replay ABI. Kiểm tab ẩn bằng thiết bị/browser thực chưa chạy riêng.
- Cache một viewport dùng chung promise, geometry, material và texture cho module trùng loại, hai robot, ghost và LOD. High mở bằng Medium trước, chỉ nâng các loại model cần dùng. Dọn decoder worker/listener/GPU khi đóng; cache chết còn bỏ mảng attribute/index/mipmap CPU để graph cũ của React không giữ dữ liệu lớn. Không tạo canvas cho từng thẻ.
- Tách ArenaAudio/eventLocation sang `packages/presentation` chỉ phụ thuộc contracts; renderer 2D re-export nguyên API cũ. Renderer3d không kéo Pixi/engine/Brain vào runtime.

`ArenaSceneProps.layout` bổ sung dữ liệu trình bày width/depth/objective/props do app chiếu từ arena/ruleset đã pin; PublicFrame không có các kích thước này. Không thay ABI. Cảnh sân mẫu 40×28, objective radius 3, ring lấy `frame.ringRadius`, props có chiều cao đặt ngoài sân gameplay. Bàn/sân dùng geometry, mép gốm, khung tối, đèn cam; mặt sàn instanced.

App chính vẫn ở trạng thái U3D-00. Nối Workshop/Arena/My Synths vào App thuộc U3D-03–05. Arena nền chưa có phase/telegraph/projectile/shield/VFX chiến đấu/replay controls/random seek; thuộc U3D-04. Brain Lab chính giữ 2D pixel art. Không sửa engine, Brain, catalog, replay, worker, drafts, App/CSS hay nguồn asset.

## Render thật và tài nguyên

[High](D:/AI/nextgame/deliverables/implementation/UI3D/U3D-02/renders/chrome-release-final/workshop-high-1600.png) · [Medium](D:/AI/nextgame/deliverables/implementation/UI3D/U3D-02/renders/chrome-release-final/workshop-medium-1600.png) · [Low](D:/AI/nextgame/deliverables/implementation/UI3D/U3D-02/renders/chrome-release-final/workshop-low-1600.png) · [Bốn hướng](D:/AI/nextgame/deliverables/implementation/UI3D/U3D-02/renders/chrome-release-final/four-directions.png) · [24 module](D:/AI/nextgame/deliverables/implementation/UI3D/U3D-02/renders/chrome-release-final/asymmetric-24.png) · [Toàn bàn](D:/AI/nextgame/deliverables/implementation/UI3D/U3D-02/renders/chrome-release-final/workshop-table-geometry.png) · [Arena nền](D:/AI/nextgame/deliverables/implementation/UI3D/U3D-02/renders/chrome-release-final/arena-high.png) · [Preview](D:/AI/nextgame/deliverables/implementation/UI3D/U3D-02/renders/chrome-release-final/synth-preview-high.png).

[Clip sét chuyển động](D:/AI/nextgame/deliverables/implementation/UI3D/U3D-02/renders/animation/core-three-live.mp4): ghi browser production thật, 1600×1100, 25 fps, 2,96 giây; số frame video là tốc độ ghi, không phải FPS renderer. [animation.json](D:/AI/nextgame/deliverables/implementation/UI3D/U3D-02/animation.json) có hash, lệnh FFmpeg/ffprobe, port và mẫu buffer trước/sau. Các ảnh thử trước khi sửa port/số tia được giữ để tra lịch sử, không dùng làm bản cuối.

Runtime dùng asset revision U3D-01 `2a1d71151d96c87b`. Không tải/copy GLB nguồn nặng vào public. Bổ sung duy nhất: `floor.webp`, 256×256, lossless, **41.310 byte**. Crop `floor-02.png` tại (18,18), 165×155; bỏ viền/alpha, mirror average seam 4 px trước/sau resize. Cạnh đối diện sau giải mã lệch RGB tối đa **0**, không alpha, không objective/ring baked. SHA256 `c183742efaae9f4993b7366e023c974ae9d3542ab097d2f1c3031ff95819eb67`. Recipe ở cạnh asset, Sharp 0.35.5 trong toolchain U3D-01. Chạy sinh floor/fixture hai lần được cùng hash: [reproduction.json](D:/AI/nextgame/deliverables/implementation/UI3D/U3D-02/reproduction.json).

## Số đo và kiểm tra

Nguồn đầy đủ: [measurements.json](D:/AI/nextgame/deliverables/implementation/UI3D/U3D-02/measurements.json), [Chrome](D:/AI/nextgame/deliverables/implementation/UI3D/U3D-02/browser-chrome-release-final.json), [Edge](D:/AI/nextgame/deliverables/implementation/UI3D/U3D-02/browser-edge-release-final.json), [live-profile.json](D:/AI/nextgame/deliverables/implementation/UI3D/U3D-02/live-profile.json), [faults.json](D:/AI/nextgame/deliverables/implementation/UI3D/U3D-02/faults.json). Desktop headless, 1600×1100, DPR 1; không giả Android bằng resize.

| Dữ liệu Mantis 6 module, 5 loại riêng | High | Medium | Low |
|---|---:|---:|---:|
| GLB cần tải, KTX2 đã nhúng | 11.590.664 B | 3.439.940 B | 1.058.412 B |
| Tam giác model theo số placement | 179.400 | 47.374 | 11.393 |
| Tam giác renderer báo, gồm sân/sét/shadow pass | 372.410 | 108.358 | 34.956 |

Tải đầu quan sát: **4.237.993 B = 4,04 MiB**, gồm Medium, font, floor, manifest, decoder và fixture public; ≤8 MiB. High bổ sung **11.590.664 B = 11,05 MiB** sau Medium; không tải tất cả mười loại High. GLB nhúng KTX2 nên không cộng sidecar lần nữa. Hai Thruster chỉ tải một model mỗi LOD. HEAD decoder không cộng thành payload thứ hai. Meshopt runtime nằm trong JS.

Shell App chính (UI + worker + CSS + runtime + HTML): **171.131 B gzip = 167,12 KiB**, chưa tích hợp 3D. Harness tất cả 3D trong một entry: JS **417.194 B gzip = 407,42 KiB**, ngoài ra CSS 890 B và decoder JS 15.169 B gzip. Harness vượt 400 KiB nếu tính nó là shell; **chưa đạt cấu trúc mã 3D tải riêng**. U3D-03 phải lazy-load 3D, không dùng số shell 2D để tuyên bố shell 3D đã đạt. Vite vẫn báo chunk >500 kB; không tắt warning.

Chrome 154.0.8037.98 dùng RTX 5060 Ti; Edge 154.0.4258.62 dùng AMD Radeon tích hợp. Mẫu dưới đây quan sát **120 khoảng cách frame thực khi sét chạy** (~2 giây/mẫu), không gọi render thủ công; không phải GPU timestamp, không phải bài stress 120 giây/48 module.

| Browser / số module | High p95 / p99 | Medium p95 / p99 | Low p95 / p99 |
|---|---:|---:|---:|
| Chrome / 6 | 16,90 / 17,00 ms | 16,90 / 17,00 ms | 16,90 / 17,00 ms |
| Chrome / 24 | 17,00 / 17,40 ms | 17,10 / 17,50 ms | 17,00 / 17,20 ms |
| Edge / 6 | 16,90 / 17,10 ms | 16,90 / 17,10 ms | 16,90 / 17,00 ms |
| Edge / 24 | 19,80 / 21,50 ms | 17,00 / 17,20 ms | 16,90 / 17,00 ms |

Không gắn pass cho mục tiêu p95 ≤16,7 ms từ các mẫu này. Profile submission CPU riêng (120 lần render, giảm chuyển động): Chrome p95 High/Medium/Low 0,60/0,70/0,60 ms; Edge 0,50/0,50/0,50 ms. Chúng không đo thời gian GPU hoàn thành. Giảm chuyển động: **0 frame mới trong 1.200 ms**. Khi bật sét: Chrome 31, Edge 30 frame mới trong 500 ms; buffer geometry thay đổi, ports giữ nguyên.

Sau **10 vòng Arena → My Synths → Workshop**, luôn một canvas. Forced GC: JS usedSize 8.772.348 → 16.358.908 B, drift **7.586.560 B = 7,24 MiB**, đạt ≤10 MiB cho loại bộ nhớ này. External backingStorage 82.309.222 → 82.310.053 B, tăng **831 B**. Chưa đo GPU/process memory. Lượt trước khi bỏ CPU arrays tăng external ~160 MiB; evidence trước sửa được giữ trong `faults-before-cpu-release.json`.

Đã qua: model thiếu 404, decoder thiếu 404, GLB bị sửa hash, mạng High chậm vẫn vẽ Medium trước, context loss/restore; chọn mọi module với bốn orientation và bốn ô Core; chọn/xác nhận ô trống và ghost chỉ phát callback; orbit phải/wheel/reset/khóa camera; 24 module/Core lệch; grayscale/Low; Arena tắt VFX mất sét; 1920/1024/768/390/320 không tràn ngang. Cảnh mẫu không ghi IndexedDB.

App chính: [app-smoke.json](D:/AI/nextgame/deliverables/implementation/UI3D/U3D-02/app-smoke.json) pass, 0 lỗi, 0 yêu cầu GLB. Brain Lab tại 1600 và 1920 khớp byte ảnh U3D-00 baseline, không canvas. Lưu/reload revision 1 trong browser context mới; IndexedDB vẫn v1 với `heads`/`revisions`, không đụng DB của Khầy. Trận practice qua worker giữ nguyên manifest/result/event order/public frames và hash:

- Simulation: `4ebd80218b53bf01271d8ac9d92eaf348301565123e6d0e8448436eb2c7376c2`.
- Public replay: `29bf01b2db3f4f1e2f685be1d1f1673b678a6d59927092947f8703767614c140`.
- B thắng do Core tại tick 2602, điểm A/B 885/5002, 2603 frames; khớp bản nền.

Baseline: 169 tests/10 files. Cuối: **176 tests/11 files**, gồm 7 kiểm tra geometry/fit/public pose/âm thanh/sét; corpus 10 trận khớp. Toàn bộ typing (workspace/test/G1/G2/cảnh), boundary/negative boundary, unit/corpus, main build và scene build exit **0**. Frozen install exit 0. Log lệnh/exit/thời gian ở [final/commands](D:/AI/nextgame/deliverables/implementation/UI3D/U3D-02/final/commands) và các JSON tương ứng. Các thử thất bại trước sửa vẫn được giữ; lỗi JSX trong test được sửa bằng tách hàm đường sét khỏi TSX, idle test chờ camera reset kết thúc trước đo, probe bóng dùng ancestor module thay vì đoán tên GLB.

## Tái tạo và chạy cảnh

Chạy tại checkout dự án; cần Node 24.18.0. Dùng pnpm 10.34.6 vì pnpm hệ thống là phiên bản khác. Sharp lấy từ toolchain `tools/u3d01`, Playwright mặc định lấy từ runtime Codex; máy khác đặt `PLAYWRIGHT_MODULE` đến package Playwright đã cài và có Chrome/Edge. Clip dùng FFmpeg/ffprobe trong PATH, có thể đặt `FFMPEG`/`FFPROBE`. Không cần Blender hay sinh GLB nguồn mới.

```powershell
npx --yes pnpm@10.34.6 install --frozen-lockfile
# Nếu toolchain U3D-01 chưa được cài:
npm ci --prefix tools/u3d01
node node_modules/typescript/bin/tsc -b
node scripts/u3d02-reproduce.mjs
node scripts/u3d02-evidence.mjs final
$env:U3D_ATTEMPT='chrome-release-final'
node scripts/u3d02-browser.mjs
$env:U3D_BROWSER='msedge'
$env:U3D_ATTEMPT='edge-release-final'
node scripts/u3d02-browser.mjs
node scripts/u3d02-faults.mjs
node scripts/u3d02-profile-live.mjs
node scripts/u3d02-animation.mjs
node scripts/u3d02-app-smoke.mjs
node scripts/u3d02-summary.mjs
# Mở cảnh mẫu ở http://127.0.0.1:5196
node apps/web/node_modules/vite/bin/vite.js --config tests/u3d02/vite.config.mjs
```

Các script browser tự mở/đóng preview port riêng, dùng context mới và không đọc profile trình duyệt người dùng. `final` không tự tạo chứng cứ bảo toàn nếu thiếu baseline. Khi áp dụng trên checkout khác, chạy `node scripts/u3d02-evidence.mjs baseline` trước khi sửa; baseline hiện hành được bảo vệ khỏi ghi đè. Sau khi hoàn tất report/evidence, `node scripts/u3d02-evidence.mjs seal` kiểm hash các file đầu vào và chỉ cho phép thay đổi phạm vi ticket; copy evidence và recipe code vào thư mục revision. Kết quả cuối ở [preservation.json](D:/AI/nextgame/deliverables/implementation/UI3D/U3D-02/preservation.json).

Các phần còn mở: review chất lượng cơ sở độc lập; stress 120 giây/48 module + event/projectile; Android thật; GPU memory; các gate readability/human; mã 3D tải riêng khi tích hợp App. U3D-03/04/05/06/07 chưa được thực hiện trong ticket này. Warm/cached seek và random seek chưa có replay 3D để nghiệm thu. Không đổi default sang 3D.

Tham khảo kỹ thuật đã đối chiếu: [Fiber — demand rendering](https://r3f.docs.pmnd.rs/advanced/scaling-performance), [Three — GLTFLoader](https://threejs.org/docs/#examples/en/loaders/GLTFLoader), [Drei — controls](https://drei.docs.pmnd.rs/controls/introduction).
