# Báo Cáo Nghiệm Thu Ticket T07 — Workshop, Brain Lab và Thí Nghiệm Local

**Ngày hoàn thành:** 02/10/2026, Asia/Saigon  
**Revision:** `bebf0a62b6718007`  
**Snapshot SHA256:** `bebf0a62b671800702c850df51504ec87a2a5dfc113ea3390776cb7818788277`  
**Parent Git Commit:** `79cad69e4c47c7e49294565a3023dbee1456e374`  
**Owner:** Frontend Agent  
**Trạng thái:** Hoàn thành đầy đủ (Acceptance passed 100%)  
**Next Dependent Ticket:** T08 (Technical Art, renderer, animation và audio slice)  

---

## 1. Input Digests & Assumptions

### 1.1. Input Digests
Bản triển khai kế thừa và bảo toàn 100% các digest bất biến từ G0 và G1:
- **Engine Digest:** `2a7ab7b39b03a7de65aea1d2a918815502d3942ec3722e7bc6cbf961259e5d78`
- **Catalog Digest:** `d8fe55474692a49ed5daa6d7dac62f635630a9e447a85ba683c0765bf535885d`
- **Ruleset Digest:** `19ef0b984d12a34796ea2058bb9971421674671fd4cc76b8cf694e80f03d2f14`
- **Compiler Digest:** `95b374ad1965a84ef51b11bb068bcc26b4feaf5b66fb6c1863308eee06fe9aea`
- **Capability Digest:** `183be2a086910659afdd918061d22fd3289f9a6ce9bb0644872f5997e83cd353`
- **Arena Init Digest:** `213af97e3969c88fce81f28e1055c18af8549bbf5bd37e72079f1d301d4ba510`
- **LUT Digest:** `749eadf6445c275c6b7cc7a2fc3fa1012775af6bdab7853753a28ae378336de1`

### 1.2. Assumptions & Architectural Boundaries
1. **Cô lập luồng Engine (No full main thread engine import):**
   - Tuân thủ nghiêm ngặt nguyên tắc `04_ARCHITECTURE.md` và `scripts/boundaries.mjs`: bundle chính của client web (`index-*.js`) không bao giờ import `@engine`, `@brain`, hay `@prompt-chien/engine`.
   - Toàn bộ tác vụ biên dịch bot (`freezeBot`), mô phỏng combat (`simulate`), trích xuất replay (`encodeReplay`), và chạy paired batch A/B testing chạy 100% trong Web Worker chuyên biệt (`apps/web/src/worker.ts`).
2. **Lưu trữ Draft cục bộ an toàn:**
   - Sử dụng IndexedDB (`prompt_chien_drafts_v1`) thay vì `localStorage` hay server database.
   - Kiểm soát đồng thời bằng CAS (Compare-And-Swap) với `expectedRevision`. Phát hiện xung đột (Conflict 409) và yêu cầu người dùng xác nhận ghi đè hoặc phân nhánh, gắn cờ bắt buộc `isUnofficial: true`.
3. **Phát hiện lỗi JSON với Pointer:**
   - Lỗi cú pháp và schema JSON được phân tích chính xác vị trí dòng và cột (`line:col`) cùng đường dẫn JSON pointer (`/modules/2/x`), hỗ trợ highlight trực quan trong editor.
4. **Phục hồi Worker:**
   - Bridge quản lý vòng đời worker tự động khởi tạo lại instance mới khi worker gặp lỗi chết đột ngột (crash/unhandled termination), đảm bảo không làm mất dữ liệu người dùng đang thao tác.

---

## 2. Danh Sách Files & Thay Đổi Triển Khai (Owned Paths)

### 2.1. Mã Nguồn Web Frontend (`apps/web/src/`)
1. **`apps/web/src/tokens.ts`**: Hệ thống Design Tokens theo chủ đề Gốm Sống / Cốt Graphite (bảng màu, khoảng cách, font, bo góc, trạng thái cảnh báo/thành công).
2. **`apps/web/src/style.css`**: CSS responsive cho 3 chế độ xem (Desktop 3-column, Tablet 2-column, Mobile summary card), bố cục 12x12 grid, hiệu ứng focus và hover trực quan.
3. **`apps/web/src/design-system.tsx`**: Tập hợp các DOM components trợ năng (Button, Card, Badge, Input, Select, TextArea, Modal, Tabs, Slider, AlertBanner).
4. **`apps/web/src/types.ts`**: Định nghĩa kiểu dữ liệu cho toàn bộ Workshop, Brain Lab, Replay telemetry, Worker RPC request/response, và Local draft metadata.
5. **`apps/web/src/presets.ts`**: 3 archetype bots khởi đầu hợp lệ (Mantis, Bastion-lite, Kestrel) và 6 thẻ hành vi mẫu (Behavior Cards) phân loại theo Kiting, Brawler, Turtle, v.v.
6. **`apps/web/src/storage.ts`**: Lớp lưu trữ IndexedDB với cơ chế CAS concurrency, theo dõi `isDirty`, hỗ trợ gắn tag `isUnofficial: true` và lưu bản sao revision bất biến.
7. **`apps/web/src/validation.ts`**: Bộ chẩn đoán bot cấu trúc:
   - Thuật toán BFS kiểm tra tính liên thông vật lý qua các module liền kề.
   - Kiểm tra occlusion: góc cung chém Blade, đường bắn Burst line, hướng xả khí Thruster.
   - Kiểm tra Brain FSM: các trạng thái không thể chạm tới (unreachable states), luật không bao giờ thỏa mãn (dead rules), chia cho 0.
   - Parser JSON với định vị dòng/cột và JSON pointer.
8. **`apps/web/src/worker.ts`**: Web Worker cô lập hoàn toàn engine, xử lý 3 loại yêu cầu: `validate`, `simulate`, `experiment` (paired A/B testing hoán đổi slot across N seeds).
9. **`apps/web/src/worker-bridge.ts`**: Quản lý giao tiếp bất đồng bộ qua Web Worker, cơ chế timeout, hủy bỏ tác vụ (cancel), và tự động tạo lại worker khi bị crash.
10. **`apps/web/src/workshop.tsx`**: Trình soạn thảo lưới 12x12:
    - Thao tác kéo/đặt module, xoay module (`R`), xóa module (`Del`), nhân bản module (`D`).
    - Lịch sử Undo / Redo (`Ctrl+Z`, `Ctrl+Y`).
    - HUD hiển thị tức thời điểm tải trọng (points), số vũ khí, trạng thái liên thông, và cảnh báo occlusion.
    - Hộp thoại Import / Export JSON với bộ chỉ điểm lỗi.
    - Chế độ Mobile Summary Flow hiển thị thẻ rút gọn khi độ rộng màn hình < 768px.
11. **`apps/web/src/brain-lab.tsx`**: Trình biên tập trạng thái/luật Brain trực quan:
    - Quản lý danh sách state và rule theo thứ tự ưu tiên (lên/xuống).
    - Tab mã nguồn JSON có khả năng chỉ điểm lỗi syntax/pointer.
    - Cột scrubber theo dõi decision trace 10Hz trong trận mô phỏng.
12. **`apps/web/src/arena.tsx`**: Canvas Replay Viewer 2D:
    - Điều khiển phát/tạm dừng (`Space`), tua khung hình (`ArrowLeft` / `ArrowRight`), thanh trượt seek.
    - HUD hiển thị telemetry hai bot, sự kiện chiến đấu có thể click để tua đến thời điểm diễn ra, và kiểm tra private trace.
13. **`apps/web/src/experiment.tsx`**: Trình chạy thử nghiệm A/B cục bộ:
    - Lựa chọn 2 cấu hình bot, thiết lập số lượng seed (mặc định 10-50).
    - Chạy song song trong worker, hiển thị tiến độ thời gian thực (progress bar).
    - Bảng thống kê tỉ lệ thắng (Win Rate), thời gian trận trung bình, và lượng sát thương gây ra.
14. **`apps/web/src/debrief.tsx`**: Bảng phân tích 3 điểm ngoặt then chốt (Turning Points):
    - Tự động trích xuất các pha giao tranh lớn hoặc gãy module quan trọng.
    - Cho phép nhảy trực tiếp đến tick diễn ra sự kiện.
    - Trình tạo giả thuyết (Hypothesis Builder) để ghi chú và đối chiếu cho lần tinh chỉnh kế tiếp.
15. **`apps/web/src/app.tsx`**: App Shell kết hợp toàn bộ các tab Workshop, Brain Lab, Arena Replay, và A/B Experiment; thanh công cụ lưu CAS, chuyển đổi draft, và tạo trận đấu tập nhanh.
16. **`apps/web/src/main.tsx`**: Điểm gắn kết React root vào DOM.
17. **`apps/web/vite.config.ts`**: Cấu hình tách chunk riêng biệt cho worker và main UI.

### 2.2. Kiểm Thử Hệ Thống (`tests/t07.test.ts`)
18. **`tests/t07.test.ts`**: Bộ kiểm thử tự động toàn diện gồm 16 kịch bản kiểm tra:
    - Tính hợp lệ của 3 preset bots.
    - Phát hiện cụm module tách rời (disconnected islands).
    - Phát hiện góc che khuất (occlusions).
    - Định vị lỗi JSON pointer chính xác dòng/cột.
    - Lưu trữ IndexedDB CAS, bắt lỗi ConflictError khi `expectedRevision` không khớp.
    - Đóng băng revision bất biến.
    - Phân tích FSM Brain: phát hiện state không thể đến được và phép chia 0.
    - Kiểm tra cô lập bundle: xác nhận file `index-*.js` không chứa engine và `worker-*.js` chứa toàn bộ logic mô phỏng.
    - Vòng lặp người dùng hoàn chỉnh (Create → Edit → Validate → Experiment → Replay → Revision).
    - Bản đồ phím tắt bàn phím và khả năng tương thích di động.

---

## 3. Kết Quả Chạy Kiểm Thử & Các Lệnh Bắt Buộc

| Lệnh Kiểm Tra | Exit Code | Kết Quả Chi Tiết |
|---|---|---|
| `pnpm check` | **0** | `tsc -b`, `tsc -p tests`, `tsc -p tests/g1-browser`, `boundaries.mjs`: Strict types + package boundaries passed |
| `pnpm build` | **0** | TypeScript build + Vite build hoàn tất; tách chunk `worker-*.js` (264 kB) và `index-*.js` (440 kB) |
| `pnpm test:unit` | **0** | **175 tests pass** (8/8 test files), 0 fail, 0 skipped, 0 unrun |
| `node scripts/smoke.mjs` | **0** | Round 1 & Round 2 kiểm tra HTTP server, API health/ready, proxy, và web HTML đều pass |
| `pnpm test:sim` | **0** | 19 tests pass; 10 corpus records khớp hoàn toàn golden digest |
| `pnpm verify:replay` | **0** | 6 tests pass; codec roundtrip, seek arbitrary, checkpoint restore đều bảo toàn determinism |

### Chi Tiết Phân Phối Test Unit:
- **Passed:** 175 tests (100%)
  - `tests/t07.test.ts`: 16 tests
  - `tests/brain.test.ts`: 87 tests
  - `tests/contracts.test.ts`: 42 tests
  - `tests/combat.test.ts`: 15 tests
  - `tests/replay.test.ts`: 6 tests
  - `tests/spatial.test.ts`: 4 tests
  - `tests/schemas.test.ts`: 4 tests
  - `tests/parity.test.ts`: 1 test
- **Failed:** 0
- **Skipped:** 0
- **Unrun:** 0

---

## 4. Bằng Chứng Đạt Acceptance Criteria của Ticket T07

1. **Fresh user creates → edit → validate → experiment → replay → revision:**
   - Đã được chứng minh bằng test tự động tích hợp trong `tests/t07.test.ts` (test case `completes the entire end-to-end user loop with determinism and replay verification`).
   - Người dùng bắt đầu với draft Mantis, chỉnh sửa module và luật Brain, chạy kiểm tra hợp lệ, kích hoạt 10 seed A/B experiment, xem lại replay từ artifact binary, và đóng băng thành revision `rev-001`.
2. **Conflict-safe unsaved edits:**
   - Cơ chế lưu trữ IndexedDB CAS (`saveDraft`) từ chối mọi thao tác ghi đè khi `expectedRevision` không khớp, ném lỗi `ConflictError`. Mọi bản ghi draft đều có `isUnofficial: true` để tránh nhầm lẫn với dữ liệu xếp hạng chính thức.
3. **JSON errors pointer:**
   - Hàm `parseJsonWithPointer` phân giải chính xác chỉ số dòng và cột cho cả lỗi cú pháp JSON và lỗi schema của `@prompt-chien/contracts`, cho phép tô đậm trực tiếp vị trí lỗi.
4. **Worker crash clear:**
   - `WorkerBridge` lắng nghe sự kiện `error` của Web Worker, tự động thu dọn và tạo lại instance mới, đồng thời gửi thông báo lỗi thân thiện tới người dùng mà không làm mất trạng thái của màn hình.
5. **Keyboard controls:**
   - Toàn bộ phím tắt theo đặc tả được gắn kết đầy đủ:
     - `Space`: Phát / Tạm dừng Replay.
     - `ArrowLeft` / `ArrowRight`: Lùi / Tiến từng frame.
     - `R`: Xoay module đang chọn trong Workshop.
     - `Delete` / `Backspace`: Xóa module.
     - `D`: Nhân bản module.
     - `Ctrl+Z` / `Ctrl+Y`: Hoàn tác / Làm lại.
     - `Ctrl+S`: Lưu draft tức thời.
6. **No full main thread engine import:**
   - Đã kiểm tra trực tiếp trên build output production: tệp `apps/web/dist/assets/index-*.js` không chứa bất kỳ tham chiếu hay mã máy nào từ gói engine. Toàn bộ logic engine nằm riêng trong `worker-*.js`.
7. **Mobile summary flow and no hidden disabled CTA:**
   - Khi màn hình nhỏ (< 768px), giao diện tự động chuyển sang hiển thị thẻ tóm tắt (`summary-card`) thay vì ẩn giấu hoặc vô hiệu hóa các nút bấm chính. Các nút hành động đều có giải thích lý do rõ ràng khi chưa thỏa điều kiện (ví dụ: hiển thị lý do bot chưa hợp lệ thay vì nút bấm mờ không thông tin).

---

## 5. Artifacts Bàn Giao Theo Revision `bebf0a62b6718007`

- `deliverables/implementation/T07/bebf0a62b6718007/snapshot.json`: Danh mục 171 tệp nguồn cùng mã băm SHA256 tương ứng.
- `deliverables/implementation/T07/bebf0a62b6718007/acceptance.json`: Trạng thái nghiệm thu chi tiết từng tiêu chí và thời gian thực thi các lệnh.
- `deliverables/implementation/T07/bebf0a62b6718007/commands/check.json`: Bắt log và exit code của `pnpm check`.
- `deliverables/implementation/T07/bebf0a62b6718007/commands/build.json`: Bắt log và exit code của `pnpm build`.
- `deliverables/implementation/T07/bebf0a62b6718007/commands/unit.json`: Bắt log và exit code của `pnpm test:unit`.
- `deliverables/implementation/T07/bebf0a62b6718007/commands/smoke.json`: Bắt log và exit code của `node scripts/smoke.mjs`.
- `deliverables/implementation/T07/bebf0a62b6718007/commands/sim.json`: Bắt log và exit code của `pnpm test:sim`.
- `deliverables/implementation/T07/bebf0a62b6718007/commands/replay.json`: Bắt log và exit code của `pnpm verify:replay`.
- `deliverables/implementation/latest.json`: Cập nhật liên kết chỉ mục trỏ tới revision `bebf0a62b6718007`.

---

## 6. Blockers & Next Dependent Ticket

- **Blockers:** Không có blocker kỹ thuật nào. Mọi ràng buộc phân tách kiến trúc (architectural boundaries), kiểm tra kiểu nghiêm ngặt (strict types), và zero explicit any đều được thỏa mãn 100%.
- **Next Dependent Ticket:** **T08 — Art, renderer, animation và audio slice** (Technical Art Agent). T08 sẽ tiếp quản phần kết nối Canvas2D / WebGL renderer cao cấp, bổ sung VFX/audio motifs, và hoàn thiện asset gallery cho bot kits dựa trên nền tảng Workshop và Arena đã dựng tại T07.
