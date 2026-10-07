# G2 — Bàn giao Workshop, Brain Lab và Arena local

**Ngày:** 02/10/2026. **Trạng thái:** T07/T08 đã có implementation và evidence local; **G2 chưa đạt nghiệm thu**. Gate frame desktop strict đang fail. Thử người thật, review art độc lập, thiết bị tham chiếu và một phần accessibility/browser matrix chưa chạy. Không gọi bản này là ranked alpha, game hoàn chỉnh hoặc “AAA”.

Đã đọc README, G0_REPORT, G1_REPORT và nguồn 01/02/03/04/06/08/09. Áp dụng plugin **Game Studio**, các hướng dẫn Foundations, Game UI Frontend và Game Playtest. Giữ lựa chọn React + PixiJS 8 của dự án; dùng engine/compiler/replay G1 trong browser worker. Không thay physics, gameplay, ABI, catalog hay các giới hạn numeric D17/D18 để làm gate pass.

## 1. Revision và bằng chứng

- Source revision local: **`d08248f7a64ccb90`**.
- SHA256 inventory: `d08248f7a64ccb90a98245ddf1cb51033d8eea7bb220774e0632b4d678e95fc2`.
- Git HEAD gốc: `dd115b4c4ab1cf8ad1ed827f2258daff72749bac`. Đây là working tree chưa commit, không phải release được ký.
- [Tổng hợp máy đọc được](G2_EVIDENCE.json).
- [T07 snapshot và source inventory](T07/d08248f7a64ccb90/snapshot.json), [command exits/output](T07/d08248f7a64ccb90/commands/).
- [Chrome QA](T07/d08248f7a64ccb90/browser-qa.json), [Edge QA](T07/d08248f7a64ccb90/edge-qa.json).
- [T08 snapshot](T08/d08248f7a64ccb90/snapshot.json), [screenshots](T08/d08248f7a64ccb90/screenshots/), [profile cuối](T08/d08248f7a64ccb90/profile.json), [asset budget](T08/d08248f7a64ccb90/budget.json), [font check](T08/d08248f7a64ccb90/fontcheck.json).

Inventory hash được tính từ đường dẫn và SHA256 nội dung source đã sắp xếp. Loại compiled output, dependencies, `.local`, secrets và `deliverables` khỏi identity; mỗi file tham gia có hash trong snapshot. Tài liệu bàn giao không làm identity tự tham chiếu. Command logs giữ lệnh, thời gian, stdout/stderr và exit thật; profile exit 1 được giữ nguyên vì gate fail. Sau các lượt unit/Linux/browser/profile, chỉ bỏ một dòng trắng cuối HTML; đã build và đo budget lại. Toàn bộ JS/CSS/worker chunk hashes giữ nguyên; không chạy lại stress 120 s chỉ cho whitespace này. Thư mục evidence 8caa3924ea1a20b1 là snapshot trước chỉnh whitespace; revision cuối để review là d08248f7a64ccb90.

| Input | Digest giữ nguyên từ G1 |
|---|---|
| Engine | `2a7ab7b39b03a7de65aea1d2a918815502d3942ec3722e7bc6cbf961259e5d78` |
| Compiler | `95b374ad1965a84ef51b11bb068bcc26b4feaf5b66fb6c1863308eee06fe9aea` |
| Catalog | `d8fe55474692a49ed5daa6d7dac62f635630a9e447a85ba683c0765bf535885d` |
| Ruleset | `19ef0b984d12a34796ea2058bb9971421674671fd4cc76b8cf694e80f03d2f14` |

## 2. T07 đã triển khai

**Workshop:** grid 12×12, palette đúng enabled catalog G1, đặt/di chuyển/quay/xóa module, 50 bước undo/redo, keyboard arrows/Enter và Ctrl+Z/Ctrl+Shift+Z. Hiển thị cost/mass, gọi validator chung và giữ JSON pointer lỗi. Cảnh báo Burst tự che nòng là heuristic theo hướng cardinal, không thay collision authority. Template/import có diff để Apply/Discard; JSON parser bounded, từ chối duplicate keys và file quá 256 KiB. Buffer chưa Apply được giữ qua chuyển tab và bảo vệ khỏi thao tác ghi đè.

**Brain Lab:** sửa initial state, thêm state/rule, xóa/sắp xếp rule, chỉnh trường số thường dùng. Rule JSON và whole-bot JSON cung cấp đường sửa đầy đủ condition/intent/variables/skills/nextState. Compile và source-map dùng G1. Behavior Card lưu hypothesis/weakness; debrief liên kết event với hypothesis và parent package hash.

**Local storage:** IndexedDB lưu revision bất biến và head có CAS. Hai tab cùng sửa không thể âm thầm ghi đè head mới; draft bị conflict vẫn còn để fork Synth khác. My Synths khôi phục revision cũ thành bản mới. Lưu chủ động, có cảnh báo trước khi đóng khi còn sửa chưa lưu; export JSON để sao lưu. localStorage chỉ chứa preference hiển thị/âm thanh.

**Experiment:** khóa baseline, chọn opponent và 1/3/10 tuning scenarios tương ứng 4/12/40 legs, chạy baseline/candidate cùng seeds và cả hai slot assignments trong worker. Kết quả có package/input/seed hashes, từng leg và mean paired delta; confidence `null`, local/unofficial. Cancel dừng worker; lỗi infrastructure có Retry cùng snapshot. Replay cũ được đánh dấu stale khi draft thay đổi.

**Trace và privacy:** renderer chỉ nhận public frames. UI nhận riêng trace/resource của bot A do người dùng sở hữu; không gửi Brain/private resource của B qua public projection. Thử nghiệm local đã giữ đúng split này; không suy ra đã đạt ACL/server privacy của G3. Engine không nằm trên main thread; boundary check từ chối engine import trực tiếp hoặc eager worker import vào UI.

**Mobile:** summary/import/validate/experiment/replay/debrief có layout 320/390 px không tràn ngang. Geometry editor được ghi rõ dùng desktop/tablet. Chưa có bằng chứng người dùng điện thoại thật hoàn thành loop.

## 3. T08 đã triển khai

Art gốc gồm ceramic plates/glyphs cho module, arena SVG, atlas 640×256 và 11 motif WAV tổng hợp; source/generated/runtime có license và hash manifest. Lance/Breaker chỉ có art chuẩn bị, vẫn không enabled gameplay. Không lấy kit placeholder G1 làm art công khai của G2. Inter và IBM Plex Mono self-host có OFL, nguồn font chính thức và hash bản WOFF2 chuyển đổi; 71 ký tự tiếng Việt được kiểm tra trong cả 4 font.

PixiJS **8.22.0** dựng pose/module/projectile/objective từ public snapshots, chỉ interpolate presentation giữa hai frame liền nhau. Team A/B có shape/pattern riêng khi grayscale. Blade/Burst phase và shield vẫn hiện khi VFX off. Module art nằm trong footprint; hit FX xác định đúng module nạn nhân từ event dùng actor là attacker. Seek dựng lại cosmetic state theo tick, không tích lũy trails hay phát lại audio cũ. Có event gallery, debrief và HUD owner riêng.

High/medium/low giới hạn cosmetic flashes 64/24/8; sự kiện authoritative, trạng thái và telegraph không bị loại. DPR cap 2, low cap 1,5. Renderer 60 Hz tách khỏi React; HUD cập nhật 10 Hz. Resize vẽ lại paused tick. WebGL context loss thực sự được thử bằng extension: pause, phục hồi texture rồi vẽ lại cùng tick. Khi không có WebGL/asset load fail, DOM timeline/result/trace và lỗi rõ vẫn dùng được.

Audio kích hoạt sau thao tác người dùng, có mute/volume riêng cho UI và Arena. Native WebAudio giới hạn 15 Arena voices cộng 1 UI voice, mỗi loại tối đa 2; master gain bảo thủ và compressor. Hit pan theo vị trí nạn nhân. Pause/seek dừng transient; speed 2×/4× tắt dense cues. Reduced motion, grayscale, quality và VFX là presentation, không đổi simulation hash.

Ảnh đã được người triển khai xem trực tiếp để sửa layout và kiểm tra overflow. **Đây không phải review art độc lập hoặc chứng minh readability qua người thật.**

## 4. Kết quả kiểm tra thực tế

| Kiểm tra | Kết quả ở revision bàn giao |
|---|---|
| Windows build, type/lint/boundaries | PASS, exit 0 |
| Boundary negative self-check | PASS: Node I/O/clock/cross-package và main-thread engine/eager worker bị từ chối |
| Windows unit | **161 tests / 8 files**, PASS |
| Clean Linux frozen install/build/check/unit/CLI validation | PASS, **161 tests**, Node 24.18.0; container riêng đã dọn |
| Chrome 154.0.8037.93 | **18 checks**, PASS; không page/console error |
| Edge 154.0.4258.53 | **18 checks**, PASS; không page/console error |
| Import lỗi/pointer, edit/undo, keyboard, IndexedDB reload/two-tab CAS | PASS automation |
| Actual worker fault, cancel/retry, WebGL context loss | PASS automation |
| Nonlinear seek pixel equivalence, VFX off/low/grayscale hash | PASS automation |
| 100 random warm local seeks | p95 **49,29 ms**, gồm browser round-trip và wait 30 ms; không phải cold/network seek |
| Owner trace → hypothesis → lưu revision | PASS automation |
| Mobile viewport 320/390, reduced motion | PASS kiểm tra DOM/layout; thiết bị thật chưa chạy |
| Asset/license/font checks | PASS ở phạm vi kiểm tra dưới đây |
| Desktop strict frame p95 ≤16,7 ms | **FAIL: 16,8 ms** |

Lệnh chính, chi tiết và exit có trong thư mục commands: frozen build; `pnpm check`; `pnpm test:unit`; `node scripts/boundary-selfcheck.mjs`; `node scripts/linux-check.mjs`; `node scripts/g2-qa.mjs` cho Chrome và Edge; `node scripts/g2-budget.mjs`; `node scripts/g2-profile.mjs`. Dùng pnpm 10.34.6 qua `npx --yes pnpm@10.34.6`; không dựa vào global shim khác version.

### A/B đã đo, không suy ra improvement

Automation chỉnh Mantis `returnToRing` thrust từ 1000 sang 900 qua structured editor rồi 850 qua JSON, compile snapshot mới và chạy tuning scenarios **0/1/2**, tổng **12 legs**. Seeds và mỗi simulation hash nằm trong Chrome QA `localExperiment.comparison.rows`. Baseline/candidate package hashes khác nhau; mỗi scenario mean score đều 0,5 và **mean paired delta = 0**. Một số toàn bộ output hashes thay đổi do package binding; kết quả gameplay trong mẫu này không chứng minh Brain tốt hơn hoặc quyết định khác đi. Không dùng mẫu tuning này thay 200 holdout/cặp hay gate intelligence/counterplay.

### Budget và performance

Shell gzip (UI + worker + CSS + runtime + HTML) **159.152 bytes**, khoảng 155,4 KiB; lazy Arena/Pixi không bị tính giả là shell. Cận trên toàn bộ art/audio/fonts đầu vào **467.789 bytes**. Atlas 640×256 dưới cap 2048; WAV peak khoảng −7,68 đến −7,39 dBFS, thấp hơn trần −3 dBFS. Network request timing của browser có cache/transfer encoding, không thay phép cộng byte budget từ file build.

Profile cuối dùng **120.004,8 ms thực**, **7.143 frames**, high tier, viewport 1600×1100, DPR 1. Host Windows: AMD Ryzen 5 7600, 12 logical CPUs, khoảng 32 GB RAM, **RTX 5060 Ti / ANGLE D3D11**, Chrome 154. Fixture là stress **render-only** từ Body 21 module/bot trong point budget, thêm 128 projectiles + 256 events/tick; không phải trận ranked hợp lệ và không thay engine.

| Metric | Đo được | Kết luận |
|---|---:|---|
| CPU draw p95 / p99 | 1,4 / 1,8 ms | CPU submit tốt hơn sau cosmetic cap; không phải GPU timer |
| rAF frame interval p95 / p99 | 16,8 / 16,8 ms | p95 **fail strict ≤16,7**; p99 đạt ≤33,3 trên host này |
| JS heap sau 10 rebuilds + CDP GC | tăng 404.308 bytes | Đạt ngưỡng JS heap đã kiểm tra; không chứng minh GPU memory |
| Low desktop mobile emulation, 390×844, 15 s | p95 ~16,7 ms | Chỉ tham khảo; không pass actual mobile gate |

Trước cosmetic cap, cùng harness ghi CPU draw p95 64,6 ms và frame p95 66,7 ms; [profile trước sửa](T08/d08248f7a64ccb90/profile-before-cap.json) được giữ để audit. Sau sửa không hạ target, không làm tròn 16,8 thành pass. Màn hình 60 Hz/rAF timing có thể ảnh hưởng sát ngưỡng nhưng chưa có GPU timing hoặc reference-host evidence để đóng gate.

## 5. Fail, unrun và điểm dừng

| Gate còn thiếu | Trạng thái / bằng chứng cần bổ sung |
|---|---|
| Desktop frame performance | **FAIL** trên recorded host; tiếp tục profile/optimize và đo lại đúng 120 s, giữ target |
| Beginner usability | **UNRUN**: 10 người mới, ≥8/10 hoàn thành ≤15 phút, ghi cả trợ giúp và đọc một khác biệt |
| Readability/counterplay | **UNRUN**: ít nhất 12 người, ≥80% từng task nhận đội/windup/module mất/bước ngoặt, normal/low không log |
| Independent art QA | **UNRUN**: reviewer độc lập đánh giá screenshots/flow, không dùng artist tự chấm |
| Device performance | **UNRUN**: integrated-GPU reference host và Android thật; controls/thermal/DPR/GPU-memory cần ghi |
| Accessibility/browser coverage | Keyboard/layout cơ bản đã thử; contrast audit đầy đủ, assistive tech, Safari/Firefox, locale switching chưa có evidence |
| G1 fun/numeric signoff | Các thiếu sót trong G1_REPORT và D17/D18 giữ nguyên; G2 UI không đóng thay |
| Remote CI/release/production | Chưa chạy remote CI cho patch này, chưa commit/push/deploy/sign release |

Protocol và phiếu trống ở [G2_PLAYTEST.md](G2_PLAYTEST.md); không điền kết quả giả. T07/T08 vẫn **incomplete acceptance**. Không bắt đầu Ranked T12 bằng cách coi G2 đã pass; T09–T16 không được triển khai trong lần này.

## 6. Chạy và bàn giao

Theo [G2_DEVELOPMENT](../../Docs/G2_DEVELOPMENT.md) để install/build/start và làm vòng: template → sửa → validate → khóa baseline/A-B → replay/trace → hypothesis → revision. Local web không cần tài khoản, API, Postgres hoặc MinIO. Dev server của phiên này chạy tại `http://127.0.0.1:5173`; đây là server local, không phải deployment công khai.

`packages/engine`, `brain`, `contracts`, `content`, `replay` và G0/G1 reports không bị sửa. Chín thư mục T06 `private/` untracked có sẵn được giữ nguyên. Chỉ container/server kiểm tra do lần này tạo được dọn; không thao tác dịch vụ hoặc dữ liệu unrelated. Source và report sẵn để review, chưa stage/commit/push.
