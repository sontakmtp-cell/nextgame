# U3D-00 — Bàn giao khóa nền và đặc tả chuyển đổi

**Ngày:** 07/10/2026. **U3D-00 hoàn tất phạm vi khóa nền. Đợt chuyển 3D chưa hoàn tất; G1/G2 không được đánh dấu đạt thêm gate.** Ba cảnh 3D thật và asset tối ưu thuộc U3D-01–05, chưa triển khai ở ticket này. Brain Lab vẫn 2D pixel art. Dùng Game Studio, Foundations, React Three Fiber, Asset Pipeline và Game Playtest để chốt ranh giới và kiểm tra theo PLAN-UI3D; không chia agent.

Nhánh mới **`remake-ui3d`**, từ `home-6.1-sol`, giữ HEAD `dd115b4c4ab1cf8ad1ed827f2258daff72749bac`. Checkout ban đầu đã dirty. Không commit, push, deploy, reset, stash hay xóa nguồn. Quyền file và giao diện cụ thể: [UI3D_IMPLEMENTATION](UI3D_IMPLEMENTATION.md). ADR D21 nối tiếp lịch sử Pixi D05/D20, không xóa quyết định cũ.

## Code và cách dùng

- Package `@prompt-chien/renderer3d` chốt type của SceneViewport, SynthVisual, SynthPreview, ArenaScene, PresentationManifest, WorkshopScene; chỉ phụ thuộc contracts. Không có runtime Three/GLB trong ticket này.
- Boundary lint cho phép web dùng package mới và chặn renderer3d nhập engine/Brain/content/worker/Pixi/renderer cũ. Negative injection đã bị từ chối như mong đợi, runner exit 0.
- Chọn **Chế độ trình bày** ở Workshop/Arena/My Synths hoặc dùng `?presentation=2d|3d`. Không có tham số/giá trị sai → 2D. Chế độ 3D báo rõ chưa có cảnh và dùng 2D để tiếp tục làm việc. Không remount App/worker, không thay gameplay hay ghi preference vào IndexedDB.
- CSS mới chỉ áp dụng ô chọn chế độ trên ba màn; 320 px vẫn đọc được lựa chọn. Không sửa `style.css`, N8nCanvas, NodeLibrary, Brain hay drafts.ts. Brain Lab không hiện selector/banner mới và không có canvas 3D.

## Bằng chứng và tài nguyên tái tạo

Evidence làm việc: [UI3D/U3D-00](../deliverables/implementation/UI3D/U3D-00/). Bản đóng gói theo revision nằm ở `deliverables/implementation/UI3D/<revision>/U3D-00/`; revision cuối và đường dẫn xem [seal.json](../deliverables/implementation/UI3D/U3D-00/seal.json). Revision là SHA256 inventory working tree, **không phải commit/release**.

- [Snapshot trước sửa](../deliverables/implementation/UI3D/U3D-00/baseline/snapshot.json): 360 file có hash/kích thước, Git status từng file và cấu hình máy. Snapshot có script thu bằng chứng mới, nhưng được lấy trước khi sửa source ứng dụng. Source inventory nền `777dab8ea48ccd78`.
- [Snapshot cuối](../deliverables/implementation/UI3D/U3D-00/final/snapshot.json) và [kiểm bảo toàn](../deliverables/implementation/UI3D/U3D-00/preservation.json): 350 file nền giữ hash; 10 file nền thay đổi đều thuộc quyền U3D-00, không file mất hay thay đổi ngoài quyền. File mới được kiểm theo allowlist. Source engine/Brain/content/contracts/replay/worker/drafts/CSS hiện có và toàn bộ asset nguồn được bảo toàn trong inventory. Secrets/dependencies/compiled outputs/công cụ riêng/deliverables cũ loại khỏi inventory; không claim audit hash các phần bị loại.
- [Dữ liệu init mẫu](../deliverables/implementation/UI3D/U3D-00/baseline/sample-init.json), public frames mẫu, manifest/kết quả/hash trong browser.json. IndexedDB được thử trong context tạm; không đọc/xóa database của profile người dùng.
- Ảnh render thật: [Workshop](../deliverables/implementation/UI3D/U3D-00/final/screenshots/workshop-1600.png), [Arena](../deliverables/implementation/UI3D/U3D-00/final/screenshots/arena-1600.png), [My Synths](../deliverables/implementation/UI3D/U3D-00/final/screenshots/my-synths-1600.png), [Brain Lab](../deliverables/implementation/UI3D/U3D-00/final/screenshots/brain-lab-1600.png), [3D yêu cầu / 2D fallback](../deliverables/implementation/UI3D/U3D-00/final/screenshots/requested-3d-fallback-1600.png), [320 px](../deliverables/implementation/UI3D/U3D-00/final/screenshots/fallback-320.png). Có bản 1920 cho cả bốn màn và fallback, cùng ảnh 1024/768/390/320; ảnh full page có thể cao hơn viewport.
- Nguồn tái tạo: scripts `u3d00-evidence.mjs`, `u3d00-browser.mjs`, `u3d00-baseline-preview.mjs`, `u3d00-seal.mjs`. Model/texture mới không thuộc U3D-00. 10 GLB nguồn hiện có tổng **327.455.088 bytes (312,29 MiB)** được hash nhưng không tải vào app; browser ghi **0 request GLB**.

Ảnh Brain đầu tiên khác 632 pixel ở chữ của hai native select tại 1600 px; screenshot 1920 đầu chưa chờ resize/paint ổn định. Giữ log thất bại tại `final/browser-first-attempt.json`. Để kiểm lại mà không ghi đè source người khác, dựng UI gốc trong `.local/u3d00/baseline-web`; App tái dựng phải trùng SHA256 trước sửa `badf0ce2575328d8bdd7d7afc1f01897793f969e41270c3455a67ab1e6480436`, các source/public/index khác cũng được kiểm trùng hash. Chụp hai bản cùng cách chờ fonts, scroll và hai animation frames: **PNG Brain Lab trùng byte ở cả 1600 và 1920**. Không bỏ assertion hay dùng ngưỡng sai khác để pass. Bản nền lần đầu vẫn giữ.

Lượt browser thứ hai cố sửa Rule JSON khi Body JSON còn pending và bị app khóa đúng thiết kế cũ. Giữ `browser-second-attempt.json`; sửa quy trình test để kiểm từng buffer riêng, không sửa app để bỏ khóa này. Lượt cuối đạt toàn bộ check.

## Kết quả kiểm tra mới

Máy Windows/x64, Ryzen 5 7600 (12 logical CPUs), RTX 5060 Ti qua ANGLE D3D11; Chrome **154.0.8037.98**, WebGL2, DPR 1. Node **24.18.0**, pnpm **10.34.6**. Các số dưới đây là đo mới tại checkout này; không đại diện thiết bị tích hợp/Android.

| Kiểm tra | Nền | Sau sửa |
|---|---:|---:|
| Unit/property/replay suite | 167 tests, 9 files, exit 0 | **169 tests, 10 files, exit 0** |
| TS project + test/G1/G2 typing | exit 0 | exit 0 |
| Import boundaries / negative checks | exit 0 / exit 0 | exit 0 / exit 0 |
| Corpus đối chiếu fixture hiện có | 10 records, exit 0 | 10 records, exit 0 |
| Production build | exit 0 | exit 0 |
| Shell gzip gồm UI/worker/CSS/runtime/HTML | 170.781 bytes | **171.131 bytes** (167,12 KiB; +350 bytes) |
| Art/audio/font 2D, upper bound trên manifest | 500.895 bytes | **500.895 bytes** |
| 100 warm seek, p95 browser round trip | 4,89 ms | **4,68 ms** |
| Browser final | — | **7 nhóm kiểm tra đạt; 0 page/console error** |

Seek đo dispatch input timeline + browser round trip trên frames đã ở RAM, không phải network seek hay thời điểm GPU hoàn thành. Budget chỉ của build 2D hiện tại, chưa tính model/decoder/High streaming vì chưa có runtime 3D. Worker JS build giữ SHA256 đúng như nền.

Browser mới xác nhận: đổi 2D/3D và qua màn giữ Body/Brain buffer chưa apply (thử riêng), undo/redo giữ, revision 1 save/reload vẫn đọc đúng, mode giữ qua URL, giá trị mode sai về 2D. 1024/768/390/320 px document width đúng viewport, không tràn ngang; đây là giả lập trên PC. Đã xem ảnh render thực sau sửa, gồm Brain, các màn nền, fallback và mobile selector.

Default practice Mantis/đối thủ/seed/scenario giữ nguyên, B thắng do Core ở tick 2602, điểm A=885/B=5002, 2603 frames. Manifest/result và bốn hash dưới đây bằng nhau trước/sau:

| Dữ liệu | SHA256 |
|---|---|
| Simulation | `4ebd80218b53bf01271d8ac9d92eaf348301565123e6d0e8448436eb2c7376c2` |
| Public replay | `29bf01b2db3f4f1e2f685be1d1f1673b678a6d59927092947f8703767614c140` |
| Toàn bộ public frames JSON | `c6de202faacb45ababdf04ac03f193238f1ce7d80d457c696ff55ef2def2fcec` |
| Thứ tự sự kiện JSON | `e6844b657976b2468ec0ff69f72b9ab3822c38b151f8fa56ecd56fb368515693` |

Đây là parity baseline/đường fallback U3D-00; chưa là parity giữa renderer 3D thật và Pixi. Engine/compiler/catalog/ruleset digests trong manifest cũng giữ nguyên.

## Lệnh đã chạy và chạy lại

[Logs baseline](../deliverables/implementation/UI3D/U3D-00/baseline/commands/) và [logs final](../deliverables/implementation/UI3D/U3D-00/final/commands/) giữ command/stdout/stderr/exit/time thực. Runner thực thi `node .../tsc -b`, ba TS test configs, boundaries, negative injection, `vitest run`, corpus compare 10 records và `vite build apps/web`; cùng các bước của `check`, `test:unit`, `test:sim`, `build`, replay tests nằm trong unit suite. Install lockfile-only offline và frozen/offline đều exit 0; không thay bản runtime hay thêm package 3D ngoài workspace type mới.

```powershell
# Kiểm code và ghi logs mới (giữ baseline đã bàn giao)
node scripts/u3d00-evidence.mjs final
# Dựng bản nền đã khóa hash và chụp đối chiếu ổn định
node scripts/u3d00-baseline-preview.mjs
node scripts/u3d00-browser.mjs baseline-stable
node scripts/u3d00-browser.mjs final
# Sau khi báo cáo xong, lấy identity cuối và kiểm bảo toàn/đóng gói
node scripts/u3d00-evidence.mjs final --snapshot-only
node scripts/u3d00-seal.mjs
```

Browser script cần Chrome hoặc `U3D_BROWSER=msedge`; dùng Playwright đã có của repo/runtime Codex, có thể chỉ đường module bằng `PLAYWRIGHT_MODULE`. Port preview riêng 5193; script chỉ dừng server/context nó tạo. Baseline đã tồn tại thì script evidence từ chối ghi đè. Muốn dùng cho task mới cần evidence root mới; bản preview gốc chỉ tái dựng được khi App vẫn chỉ chứa thay đổi cộng thêm U3D-00 và hash đầu vào khớp.

## Tiêu chí và phần còn thiếu

| Tiêu chí U3D-00 | Trạng thái |
|---|---|
| Checkout/data/hash/checks nền mới | Đạt |
| Ảnh hiện tại và Brain làm mốc | Đạt; Brain giữ pixel ở hai viewport |
| Spec, quyền file, ADR và import rules | Đạt |
| Lựa chọn 2d/3d, mặc định 2D và thông báo thật | Đạt; chưa có runtime 3D |
| Bảo toàn dữ liệu/code ngoài quyền | Đạt trong phạm vi inventory; không động profile người dùng |
| Không coi gate G2 cũ là đã đạt | Giữ nguyên trạng thái chưa nghiệm thu |

**Các ticket U3D-01–07 chưa hoàn tất.** Chưa có LOD/model/decoder, cảnh 3D, audio shared, theme 3D hoặc thumbnail 3D. Chưa chạy stress 3D 48 modules/120 giây, memory drift/GPU memory, context/network failure với tài nguyên 3D, seek parity 3D thật, actual Android/integrated GPU, người dùng/readability/art QA độc lập và full accessibility/browser matrix. Không tạo script `profile:ui3d`/`budget:ui3d` giả trước khi có asset/runtime. G2 report vẫn ghi fail strict desktop p95 16,7 ms ở lần đo lịch sử; không có đo frame mới ở U3D-00 để đóng gate đó. Thực hiện tiếp theo thứ tự U3D-01 → U3D-02 trước khi tích hợp ba màn, không đổi default 3D sớm.
