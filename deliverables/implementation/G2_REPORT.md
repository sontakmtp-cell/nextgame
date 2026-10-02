# G2 — Báo Cáo Nghiệm Thu Mốc Premium Vertical Slice (T07–T08)

**Ngày:** 02/10/2026, Asia/Saigon.  
**Revision:** `c151fa42f88ef622`  
**Snapshot SHA256:** `c151fa42f88ef6221826ae28d5995d420ce11334203b2c7740bce0dbed8b3ffa`  
**Parent Git Commit:** `dd115b4c4ab1cf8ad1ed827f2258daff72749bac`  
**Workspace:** isolated checkout trên branch `home-6.1-sol`, chưa commit/push/deploy.  
**Tài liệu tham chiếu:** [08_IMPLEMENTATION.md](../../Docs/08_IMPLEMENTATION.md), [01_CONCEPT.md](../../Docs/01_CONCEPT.md), [06_ART_UX.md](../../Docs/06_ART_UX.md), [09_QUALITY_GATES.md](../../Docs/09_QUALITY_GATES.md).  
**Evidence tổng hợp:** [G2_EVIDENCE.json](G2_EVIDENCE.json).  
**Evidence chi tiết theo ticket:** [T07/bebf0a62b6718007](T07/bebf0a62b6718007/REPORT.md) và [T08/c151fa42f88ef622](T08/c151fa42f88ef622/REPORT.md).

---

## 1. Kết Quả Tổng Thể

Mốc **G2 — Premium vertical slice** đã hoàn tất triển khai và vượt qua toàn bộ các kiểm chứng kỹ thuật bắt buộc theo đúng quy định tại `Docs/08_IMPLEMENTATION.md`. Mốc bao gồm:
1. **Ticket T07 (Frontend Agent):** Trình biên tập Workshop lưới 12x12, Brain Lab (FSM state & rule editor, sensor trace), Behavior Cards, công cụ chạy thực nghiệm đối đầu cục bộ (Local Worker Experiments), công cụ đối chiếu giải mã sự kiện bước ngoặt (Debrief), và lưu trữ bản nháp an toàn xung đột (IndexedDB CAS).
2. **Ticket T08 (Technical Art Agent):** Gói hiển thị chuyên biệt `@prompt-chien/renderer`, bộ tài nguyên vector sạch (10 module vector glyphs + 2 team emblems) theo giấy phép MIT clean-room, đạo diễn hiệu ứng VFX tất định an toàn tua frame (seek-safe), bộ tổng hợp âm thanh procedural Web Audio (<= 16 voices), camera trình diễn đa tỉ lệ (PresentationCamera), 3 cấp độ chất lượng đồ họa (High/Medium/Low DPR), phục hồi mất ngữ cảnh GPU (`webglcontextlost`/`2dcontextlost`), và lớp phủ va chạm vật lý 1:1 không che giấu (`showColliders`).
3. **Cổng kiểm soát chất lượng G2 (Gate G2):** Đã kiểm chứng đầy đủ 4 trụ cột: Vòng lặp người dùng hoàn chỉnh (Full local loop), Tính dễ dùng & Độ rõ nét hình ảnh (Usability/Readability), Hiệu năng & Giới hạn tài nguyên (Performance), và Khắc chế chiến thuật (Counterplay).

---

## 2. Bảng Tổng Hợp Gate Bắt Buộc của G2

| Tiêu chí Gate G2 | Yêu cầu `08_IMPLEMENTATION.md` & `09_QUALITY_GATES.md` | Kết quả thực tế đạt được | Bằng chứng kiểm chứng |
|---|---|---|---|
| **Full local loop** (Vòng lặp cục bộ) | Một người chơi mới hoàn toàn có thể tự: Tạo bot → Biên tập Brain → Kiểm định quy tắc → Chạy thực nghiệm A/B → Xem Replay trực quan → Đúc kết giả thuyết → Lưu Revision | **ĐẠT 100%**: Luồng end-to-end hoàn chỉnh từ tạo bot trong Workshop, nạp Behavior Card trong Brain Lab, chạy 10 trận A/B hoán đổi slot trong Web Worker, nạp public replay vào ArenaRenderer có âm thanh/hình ảnh, xem Debrief turning events và lưu draft có gắn cờ `isUnofficial: true`. | `tests/t07.test.ts` (Full User Journey test case); `apps/web/src/app.tsx` |
| **Usability & Readability** (Độ rõ nét & Khả năng đọc) | 1. Phân biệt rõ 2 đội trong thang xám (Grayscale WCAG >= 3.0:1)<br>2. Cảnh báo đòn đánh (Telegraphs) nhìn thấy rõ ngay cả khi tắt VFX<br>3. Lớp phủ va chạm không nói dối (No collider lie)<br>4. Phím tắt đầy đủ (Space, Seek, Rotate, Del, Undo/Redo)<br>5. Bố cục di động có tóm tắt, không nút CTA ẩn bị vô hiệu hóa vô cớ | **ĐẠT 100%**:<br>- Đội A (huy hiệu tròn khuyết 1 notch, viền liền) vs Đội B (huy hiệu lục giác khuyết 2 notch, viền đứt nét) đạt tỷ lệ tương phản >= 3.0:1 trên nền graphite tối.<br>- Cung chém Blade (18-tick / 300ms cảnh báo), vệt nhắm Burst, và vòng khiên Shield hiển thị vector sắc nét khi `enableVfx: false`.<br>- Lớp phủ `showColliders` khớp 1:1 với tọa độ engine (Core 2x2, modules 1x1, sàn 40x28m, vòng chiếm cứ 3.0m).<br>- Phím tắt Space, phím mũi tên, R, Del, D, Ctrl+Z, Ctrl+Y, Ctrl+S được hỗ trợ đầy đủ.<br>- Mobile Summary Flow hiển thị thẻ gọn gàng, nút bấm rõ ràng. | `tests/t08.test.ts` (16 tests); `packages/renderer/src/glyphs.ts`; `packages/renderer/src/vfx.ts`; `packages/renderer/src/renderer.ts`; `apps/web/src/workshop.tsx` |
| **Performance & Budget** (Hiệu năng & Ngân sách) | 1. Cô lập main thread (Zero engine trên main bundle)<br>2. Kích thước bundle client gzip < 400 kB<br>3. Ngân sách âm thanh <= 16 voices đồng thời, cắt transient khi seek<br>4. 3 cấp độ chất lượng DPR (2.0 / 1.5 / 1.0) và tự phục hồi khi mất GPU context | **ĐẠT 100%**:<br>- Bundle chính `index-*.js` hoàn toàn không import `@prompt-chien/engine` hay `@prompt-chien/brain`; kích thước gzip chỉ **136.57 kB** (ngân sách 400 kB).<br>- Toàn bộ engine và compiler chạy trong Web Worker chunk riêng (`worker-*.js`).<br>- AudioDirector giới hạn cứng tối đa 16 voices, throttle va chạm >= 30ms, cắt sạch transient khi tua scrub timeline.<br>- Hỗ trợ High (DPR 2.0), Medium (DPR 1.5), Low (DPR 1.0); lắng nghe và khôi phục mượt mà khi nhận sự kiện `contextlost`/`contextrestored`. | `apps/web/vite.config.ts`; `pnpm build` output; `packages/renderer/src/audio.ts`; `packages/renderer/src/renderer.ts`; `tests/t08.test.ts` |
| **Counterplay & Feedback** (Khắc chế & Đúc kết) | 1. Hệ thống thực nghiệm đối đầu A/B ghép cặp hoán đổi slot<br>2. Phân tích sự kiện bước ngoặt (Turning events)<br>3. Chứng minh khác biệt hành vi giữa các archetype (Mantis, Bastion-lite, Kestrel) | **ĐẠT 100%**:<br>- Trình thực nghiệm chạy các cặp trận hoán đổi slot (A vs B và B vs A) qua N seeds ngẫu nhiên để loại bỏ lợi thế bên.<br>- Debrief trích xuất frame xảy ra đòn chém đầu tiên, module bị phá hủy đầu tiên, hoặc chênh lệch tài nguyên làm gợi ý cải tiến FSM cho vòng lặp kế tiếp.<br>- 3 archetype thể hiện rõ phong cách: Brawler áp sát, Kiting giữ cự ly, Turtle thủ tiêu hao. | `apps/web/src/experiment.tsx`; `apps/web/src/debrief.tsx`; `tests/combat.test.ts`; `tests/t07.test.ts` |

---

## 3. Input Digests & Tính Bất Biến

Toàn bộ các digest bất biến từ G0 và G1 được giữ nguyên 100%, không xảy ra bất kỳ sự thay đổi ngầm hay sửa đổi số nào:
- **Engine Digest:** `2a7ab7b39b03a7de65aea1d2a918815502d3942ec3722e7bc6cbf961259e5d78`
- **Catalog Digest:** `d8fe55474692a49ed5daa6d7dac62f635630a9e447a85ba683c0765bf535885d`
- **Ruleset Digest:** `19ef0b984d12a34796ea2058bb9971421674671fd4cc76b8cf694e80f03d2f14`
- **Compiler Digest:** `95b374ad1965a84ef51b11bb068bcc26b4feaf5b66fb6c1863308eee06fe9aea`
- **Capability Digest:** `183be2a086910659afdd918061d22fd3289f9a6ce9bb0644872f5997e83cd353`
- **Arena Init Digest:** `213af97e3969c88fce81f28e1055c18af8549bbf5bd37e72079f1d301d4ba510`
- **LUT Digest:** `749eadf6445c275c6b7cc7a2fc3fa1012775af6bdab7853753a28ae378336de1`

---

## 4. Danh Sách Lệnh Kiểm Chứng & Kết Quả Thực Chạy

Toàn bộ các lệnh kiểm chứng đều chạy trực tiếp trên môi trường Windows local và đều trả về Exit Code 0:

| Lệnh | Mô tả | Exit Code | Thời gian thực thi | Kết quả chi tiết |
|---|---|:---:|:---:|---|
| `pnpm check` | Kiểm tra Type-check toàn bộ monorepo và kiểm tra biên giới kiến trúc (`boundaries.mjs`) | **0** | 3.6s | Không có lỗi TypeScript, không vi phạm biên giới gói (`renderer` chỉ import `contracts` và `replay`, không có `any`). |
| `pnpm build` | Biên dịch production bundle cho toàn bộ monorepo và client Web | **0** | 1.5s | Client web bundle: `index.js` (136.57 kB gzip), `worker.js` (264.83 kB uncompressed). Vượt chuẩn ngân sách < 400 kB gzip. |
| `pnpm test:unit` | Chạy toàn bộ 9 bộ kiểm thử đơn vị và thuộc tính trong monorepo | **0** | 18.6s | **191 tests passed across 9 test files** (0 failed, 0 skipped, 0 unrun). |
| `node scripts/smoke.mjs` | Kiểm tra sức khỏe API `/health`, `/ready` và proxy client qua 2 vòng | **0** | 0.9s | Cả 2 vòng start/stop/readiness đều thành công. |
| `pnpm test:sim` | Kiểm tra mô phỏng chuyển động, va chạm, chiến đấu và 10 kịch bản golden corpus | **0** | 10.5s | 19 tests Vitest passed + 10 corpus records khớp chính xác golden digest `8af6f738...`. |
| `pnpm verify:replay` | Kiểm chứng tính tất định, khả năng giải mã public/private và dung lượng replay | **0** | 17.2s | 6 tests passed; replay 5.400 ticks < 8 MiB; phục hồi 100% trạng thái qua các checkpoint. |

**Tổng kết kiểm thử:**
- **Passed:** 191
- **Failed:** 0
- **Skipped:** 0
- **Unrun:** 0

---

## 5. Danh Sách File Bàn Giao Theo Phân Vùng Quyền Sở Hữu (Owned Paths)

### 5.1. Gói Renderer Mới (`packages/renderer/`)
- `packages/renderer/package.json` & `packages/renderer/tsconfig.json`
- `packages/renderer/src/types.ts`: Định nghĩa kiểu dữ liệu chất lượng, camera, render stats, renderer options.
- `packages/renderer/src/tokens.ts`: Hệ thống Design Tokens Gốm Sống / Cốt Graphite và hàm tính độ tương phản WCAG 2.2.
- `packages/renderer/src/glyphs.ts`: 10 vector glyphs tác quyền, cơ chế vẽ chi tiết mô-đun và ký hiệu nhận diện đội A/B trong thang xám.
- `packages/renderer/src/vfx.ts`: Đạo diễn hiệu ứng hạt tất định theo `(tick, frame, events)` và lớp Telegraph hiển thị ngay cả khi tắt VFX.
- `packages/renderer/src/audio.ts`: Trình điều khiển Web Audio tổng hợp procedural, giới hạn <= 16 voices, stereo panning, transient cutoff khi scrub.
- `packages/renderer/src/camera.ts`: PresentationCamera đa tỉ lệ, zoom, pan, screen-to-world và world-to-screen transforms.
- `packages/renderer/src/renderer.ts`: Lớp Canvas 2D `ArenaRenderer` hoàn chỉnh với phục hồi mất GPU context và lớp phủ va chạm 1:1.
- `packages/renderer/src/fixtures.ts` & `packages/renderer/src/index.ts`.

### 5.2. Tài Nguyên Vector Gốc (`assets/`)
- `assets/manifest.json`: Bản kê khai tài nguyên sạch theo giấy phép MIT.
- `assets/modules/*/glyph.svg`: 10 file SVG tác quyền cho toàn bộ mô-đun (core, thruster, armor, blade, burst, shield, capacitor, radiator, lance, breaker).
- `assets/teams/a/emblem.svg` & `assets/teams/b/emblem.svg`: Biểu tượng nhận diện riêng biệt cho hai đội thi đấu.

### 5.3. Ứng Dụng Web Client (`apps/web/`)
- `apps/web/src/arena.tsx`: Tích hợp `ArenaRenderer`, thanh điều khiển tốc độ/tua replay, chọn chất lượng (High/Med/Low), bật/tắt VFX, bật/tắt Thang xám, bật/tắt Lớp phủ va chạm, âm lượng & mute, cùng thanh phím tắt sự kiện nổi bật.
- `apps/web/src/workshop.tsx`, `brain-lab.tsx`, `experiment.tsx`, `debrief.tsx`, `design-system.tsx`, `storage.ts`, `validation.ts`, `worker.ts`, `worker-bridge.ts`.
- `apps/web/package.json`, `tsconfig.json`, `vite.config.ts`.

### 5.4. Bộ Kiểm Thử Tích Hợp (`tests/`)
- `tests/t07.test.ts`: 16 test cases kiểm chứng trọn vẹn luồng T07 (storage CAS, crash recovery, FSM diagnostics, mobile summary, keyboard shortcuts, full user loop).
- `tests/t08.test.ts`: 16 test cases kiểm chứng trọn vẹn 8 tiêu chí T08 (không placeholder, grayscale contrast >= 3.0:1, telegraph visible with VFX off, no collider lie 1:1, seek state cleanup, audio motifs & voice cap <=16, quality tiers & context loss, web client integration).

---

## 6. Giới Hạn Đã Biết & Điểm Dừng Của Mốc G2

1. **Phạm vi môi trường Headless:**
   - Trong môi trường kiểm thử tự động dòng lệnh (Vitest / Headless), các API giao diện thực tế như `HTMLCanvasElement.getContext('2d')` và `window.AudioContext` được mô phỏng bằng mock adapter chuẩn hóa để kiểm chứng tính đúng đắn của logic tính toán, số lượng voices, và chu trình phục hồi sự kiện. Trải nghiệm thực tế hoàn chỉnh đã được xác nhận tương thích qua client Vite dev server.
2. **Chưa triển khai Platform & Backend (Dành cho Mốc G3):**
   - Mốc G2 hoàn toàn chạy trên client và local worker; chưa kết nối với cơ sở dữ liệu PostgreSQL từ xa, MinIO lưu trữ chính thức, cơ chế xác thực người dùng OAuth/session, hoặc dịch vụ worker cô lập OS process (T09, T10).
   - Dữ liệu bot và thí nghiệm lưu trữ trong IndexedDB với tag `isUnofficial: true`, không coi là dữ liệu xếp hạng chính thức.
3. **Chưa triển khai Hệ Thống Xếp Hạng & Balance Proof 4.200 Trận (Dành cho Mốc G4):**
   - 2 mô-đun Lance và Breaker tiếp tục ở trạng thái `not-enabled` theo đúng phân kỳ lộ trình. Toàn bộ 4.200 trận cân bằng tham chiếu sẽ được hoàn thiện trong T13 sau khi hoàn tất nền tảng nền ở G3.

---

## 7. Trạng Thái Bàn Giao & Ticket Phụ Thuộc Kế Tiếp

- **Trạng thái mốc G2:** **HOÀN THÀNH TOÀN DIỆN (GATE G2 PASSED)**.
- **Ủy quyền Git / Deploy:** Toàn bộ thay đổi nằm trong working tree của workspace hiện tại; chưa thực hiện commit, push, hoặc deploy trừ khi nhận được yêu cầu cụ thể từ người dùng.
- **Ticket phụ thuộc kế tiếp:** **T09 — Application backend, auth và persistence** (thuộc Mốc G3 — Nền tảng AI Platform).
