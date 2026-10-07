# U3D — Đặc tả triển khai: mô phỏng 2D, hiển thị 3D; Brain Lab pixel art

Ngày chốt: 07/10/2026. Nguồn: [PLAN-UI3D](PLAN-UI3D.md), 02/03/04/06/08/09, DECISIONS D17–D21 và G2_REPORT. **U3D-00 khóa nền và giao diện; không dựng các cảnh thuộc U3D-01 trở đi.** Trạng thái nghiệm thu và số đo hiện hành ở [UI3D_REPORT](UI3D_REPORT.md). G1/G2 vẫn chưa đạt nghiệm thu toàn bộ.

## 1. Checkout và dữ liệu làm mốc

Nhánh gốc `home-6.1-sol`, HEAD `dd115b4c4ab1cf8ad1ed827f2258daff72749bac`; tạo nhánh đúng tên người dùng yêu cầu `remake-ui3d` từ working tree hiện tại. Không reset, stash, clean, commit, push hay deploy. Checkout đã có cả thay đổi tracked và file untracked; chúng là đầu vào phải giữ.

Script `scripts/u3d00-evidence.mjs` ghi trạng thái Git, hash SHA256 từng file, kích thước và kết quả lệnh. Inventory gồm source, Docs, lockfile, dữ liệu mẫu và toàn bộ asset nguồn; loại secrets, dependencies, compiled outputs, công cụ riêng của người dùng và evidence để không tạo hash tự tham chiếu. Snapshot baseline được lấy trước khi sửa source ứng dụng. Hai script evidence mới không là gameplay.

`scripts/u3d00-browser.mjs` chạy production preview và Chrome trong context tạm độc lập. Nó lưu init worker (catalog/bot mẫu), public frame mẫu, manifest/kết quả/hash trận practice và ảnh thực của Workshop, Brain Lab, Arena, My Synths ở viewport 1600×1100 và 1920×1080 (full page có thể cao hơn viewport). Không mở profile hoặc IndexedDB của người dùng. IndexedDB thật của ứng dụng vẫn là `prompt-chien-local` version 1, stores `heads` / `revisions`; không migration. Dữ liệu presentation không thêm vào BotDefinition, replay hay revision.

## 2. Lựa chọn chế độ ở U3D-00

Mở `http://127.0.0.1:5173/?presentation=2d` hoặc không có tham số: 2D mặc định. `?presentation=3d` yêu cầu chế độ phát triển. Select **Chế độ trình bày** hiện ở Workshop, Arena, My Synths; đổi select chỉ cập nhật URL bằng `replaceState` và state presentation, không remount App/worker, không gọi validation, save hay thay bot. Giữ query khác và fragment. URL giữ lựa chọn qua reload; không ghi thêm localStorage/IndexedDB. Giá trị sai quay về 2D.

**Chế độ yêu cầu khác chế độ thực đang vẽ:** ở U3D-00 chưa có runtime/asset 3D; yêu cầu 3D hiển thị thông báo rõ và tiếp tục dùng UI 2D hiện hành. Không gắn nhãn cảnh 2D là cảnh 3D. Brain Lab luôn 2D pixel art, không select/banner mới hay canvas 3D. Bot mẫu hiện giữ 2D. U3D-02/03/04/05 nối các scene thật theo chế độ yêu cầu; U3D-07 mới được đổi default nếu mọi gate đạt.

## 3. Ranh giới và giao diện đã chốt

Package mới `@prompt-chien/renderer3d` hiện **chỉ xuất type**, không cài Three hay tải asset. `src/interfaces.ts` là giao diện dùng chung; triển khai component ở U3D-02 phải dùng các props này, thay đổi cần cập nhật đặc tả và các bên dùng trước khi sửa.

| Giao diện | Đầu vào và trách nhiệm | Chủ sở hữu trạng thái |
|---|---|---|
| `SceneViewportProps` | Quality, camera trực giao, khóa camera, grayscale/reduced motion; callback ready/loading/lost/unavailable và chuyển 2D | Canvas/graphics/cache ở renderer; app giữ camera và tick khi lỗi |
| `SynthVisualProps` | Body-only readonly, footprint lấy từ catalog, public actor hoặc null, team, manifest/quality, module đang chọn; callback chọn bằng ID placement | Renderer ghép model; app sửa Body |
| `SynthPreviewProps` | Body-only, footprint, manifest, viewport; dùng chung Workshop/My Synths | Một cảnh xem trước; không canvas mỗi thẻ |
| `ArenaSceneProps` | Readonly public frames, fractional boundary index, viewport/quality/VFX/manifest/footprint | App sở hữu play/pause/seek/speed/audio; renderer nội suy/vẽ |
| `PresentationManifest` | `ui3d-v1`, assetRevision, unit/trục, mapping catalog ID, 3 LOD, nguồn/license, SHA256 nguồn/model/texture/thumbnail, bytes/triangles, decoder version/hash, transform/pivot/bounds | Chỉ trình bày; không cost/HP/damage/enabled hay luật |
| `WorkshopSceneProps` | Preview + selected ID, cursor, ghost; callbacks chọn module, ô, xác nhận lắp | Hover/ghost không mutate bot; app gọi edit/validator/undo sau confirm |

Callbacks trả dữ liệu nhỏ (`CellSelection`, `ModuleSelection`), không trả Three object, bot đầy đủ hoặc worker message. DeepReadonly chặn ghi trực tiếp qua type; không thay thế privacy filter hay validation runtime. App phải tạo DTO theo allowlist, truyền `bot.body`/`replay.frames`, **không spread BotDefinition, LocalReplay hay trace riêng** vào renderer. Public DTO giữ nguyên export từ contracts; không sao chép thành ABI gameplay mới. Khi Arena ghép từ public module, adapter dựng Body-only từ catalogId/cell/orientation và ID ổn định theo ordinal. Ordinal public phải giữ đúng thứ tự contract, không index từ thứ tự placement UI.

Import mới được lint: `web → renderer3d`, `renderer3d → contracts` chỉ dùng DTO; không engine, Brain, content authority, replay worker, Pixi hay renderer 2D. Replay decode và trace riêng vẫn ở ứng dụng, nên package mới không cần import replay codec. Worker giữ whitelist cũ. Negative injection kiểm cả static imports và kiểm tra đã có cho eager worker/main-thread engine. Không phát sinh chu kỳ.

Audio và `eventLocation` hiện còn export từ renderer Pixi. **U3D-02** tách sang package presentation dùng chung (contracts-only), giữ re-export từ package cũ để tương thích. Web Arena 3D chỉ import audio shared, không kéo Pixi vào chunk 3D. Đây là hợp đồng đã chốt, chưa claim việc tách đã triển khai ở U3D-00.

## 4. Tọa độ, chọn ô và camera

Một ô = một đơn vị. 3D X trước, Y cao, −Z trái. Core 2×2: tâm Core tại `(core.cell.x+1, core.cell.y+1)`; không dùng tâm bounds mesh. Tâm module footprint `f` ở 3D local:

```text
X = cell.x + f/2 - (core.cell.x + 1)
Y = chiều cao trình bày
Z = -(cell.y + f/2 - (core.cell.y + 1))
world pose = [pose.x/1000, chiều cao trình bày, -pose.y/1000]
yaw = heading * 2π/4096; orientation yaw = orientation * π/2
```

Footprint do app lấy từ catalog đang dùng, không suy từ bounds/mesh hay art manifest. Uniform scale + rotation + translation chuẩn hóa hướng +X và đáy Y=0. Proxy chọn module bám footprint, không raycast 500.000 tam giác nguồn. ID module là ID placement ở Workshop; public ordinal chỉ để Arena. Không đổi origin khi module bị phá, không thay collider hay sim trigonometry bằng Three.

Camera trực giao, mở bằng góc chéo cố định ở Workshop/My Synths, Arena bao trọn sân. Trái chọn, phải orbit, wheel zoom; nút reset đặt lại cả target/azimuth/elevation/zoom. App khóa camera khi input/modal/timeline đang thao tác. Khi context loss, app pause và giữ fractional position; restore vẽ đúng tick; unavailable vẫn giữ result/timeline/trace/đường chuyển 2D. Cảnh tĩnh dùng demand rendering; playback dùng loop bên renderer, không setState toàn App mỗi frame.

## 5. Toolchain và tài nguyên các ticket sau

Giữ Node 24.18.0, pnpm 10.34.6, React 19.3.0, TS 5.9.3 hiện tại. Bộ phiên bản **theo PLAN-UI3D**: Three 0.186.1, Fiber 9.8.1, Drei 10.7.9, types/three 0.186.0, glTF Transform CLI 4.5.1, meshoptimizer 1.3.0. U3D-01 pin công cụ asset, U3D-02 pin runtime và cập nhật lockfile; nếu package/peer thực tế không khớp thì báo evidence, không tự đổi React/Node/physics. Không thêm Rapier hay mô phỏng vật lý 3D.

Nguồn GLB/PNG giữ nguyên ở `assets`; không copy GLB nặng vào public hoặc import runtime. U3D-01 sinh LOD và manifest từ script có thể tái tạo, Meshopt + KTX2 và decoder self-host. High ≤30k triangles/3 MiB/model/2048²; Medium ≤8k/0,75 MiB/1024²; Low ≤2k/0,25 MiB/512². Cần ghi công cụ toktx/version/cách cài và review silhouette trước khi dùng. Core/Armor/Thruster/Blade thử trước, đủ 10 art nhưng catalog hiện hành vẫn quyết định module được lắp.

Workshop/Arena/My Synths đích dùng gốm sáng, khung graphite, đèn ấm và cyan theo concept. Theme chỉ gắn `.ui3d-*` ở các màn đó; không đổi global pixel CSS/Brain Lab. DOM text/nút dùng font self-host. U3D-00 không tạo model/texture mới vì thuộc U3D-01; nguồn tái tạo được trong ticket này là code/spec + script chụp ảnh/thu dữ liệu, không ảnh concept giả cảnh thật.

## 6. Quyền sở hữu file và thứ tự bàn giao

| Ticket | Quyền sửa |
|---|---|
| **U3D-00** | Docs/UI3D_IMPLEMENTATION.md, UI3D_REPORT.md; append DECISIONS, ghi chú 04_ARCHITECTURE; renderer3d package/type/config; presentation.ts/.css và select/banner nhỏ trong App; workspace reference/dependency/lock; boundaries/selfcheck; tests/presentation; scripts/u3d00-*; deliverables/implementation/UI3D |
| U3D-01 | Script/toolchain/asset sinh mới và manifest, không sửa nguồn GLB/PNG |
| U3D-02 | Runtime renderer3d/cảnh mẫu, audio shared và re-export cũ, runtime dependencies/lock (một owner tích hợp) |
| U3D-03 | App điều phối, Workshop, theme chung, nối callback vào editing hiện có |
| U3D-04 | ArenaScene và Arena UI/replay presentation; không worker/replay ABI |
| U3D-05 | My Synths presentation/thumbnail cache; không database schema |
| U3D-06 | Brain CSS isolation và sửa regression do chuyển đổi; không redesign Brain |
| U3D-07 | QA/profile/budget/ảnh/Docs bàn giao, tích hợp kiểm tra và đổi default sau gate |

U3D-00 chỉ chỉnh các file trên; engine/Brain/contracts/content/replay/worker/drafts/CSS hiện có/asset nguồn và các deliverable cũ được hash để kiểm bảo toàn. CSS mới chỉ gắn selector presentation trên ba màn, không theme Brain. Nếu chia agent ở ticket sau, một người giữ App/package.json/lock/CSS chung; owner khác gửi thay đổi qua giao diện trước, không revert việc của nhau. Đợt này không chia agent.

## 7. Kiểm tra và nghiệm thu

U3D-00 cần: snapshot/hash/checks mới; ảnh nền thật đặc biệt Brain; spec + ADR/import rules + quyền file; cách chọn 2d/3d có thông báo đúng trạng thái; kiểm giữ buffer, undo/revision và kết quả trận; báo cáo minh bạch gate chưa đạt. Compare pixels Brain Lab ở cùng viewport/state; kiểm hash source được bảo vệ, không chỉ nhìn git diff so với HEAD vì đầu vào đã dirty.

```powershell
npx --yes pnpm@10.34.6 install --frozen-lockfile --offline
npx --yes pnpm@10.34.6 check
npx --yes pnpm@10.34.6 test:unit
npx --yes pnpm@10.34.6 test:sim
npx --yes pnpm@10.34.6 verify:replay
npx --yes pnpm@10.34.6 build
node scripts/boundary-selfcheck.mjs
# Baseline chạy TRƯỚC khi sửa. Không ghi đè baseline đã bàn giao để tạo pass mới.
node scripts/u3d00-evidence.mjs final
node scripts/u3d00-baseline-preview.mjs
node scripts/u3d00-browser.mjs baseline-stable
node scripts/u3d00-browser.mjs final
node scripts/u3d00-evidence.mjs final --snapshot-only
node scripts/u3d00-seal.mjs
```

Để tái tạo từ checkout đầu vào khác, dùng `baseline` cho hai script trước khi sửa rồi `final` sau khi sửa. Lệnh final snapshot/check không tự chứng minh bảo toàn khi không có baseline.

U3D-07 bổ sung `test:ui3d`, `profile:ui3d`, `budget:ui3d` thật: tính model/texture/decoder/High streaming, 48 modules stress 120s, p95≤16,7/p99≤33,3ms, JS/GPU memory phân biệt, random seek 100 lần, loss/network/missing assets, responsive/keyboard/two-tab CAS và vòng Body→Brain→A/B→debrief→save. Không đổi tên script G2 để giả kiểm 3D. Giữ các human/readability/art/device gates và giới hạn numeric D17/D18; thiếu thì ghi chưa hoàn tất.
