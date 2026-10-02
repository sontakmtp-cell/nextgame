# Báo Cáo Nghiệm Thu Ticket T08 — Art, Renderer, Animation và Audio Slice

**Ngày hoàn thành:** 02/10/2026, Asia/Saigon  
**Revision:** `c151fa42f88ef622`  
**Snapshot SHA256:** `c151fa42f88ef6221826ae28d5995d420ce11334203b2c7740bce0dbed8b3ffa`  
**Parent Git Commit:** `dd115b4c4ab1cf8ad1ed827f2258daff72749bac`  
**Owner:** Technical Art Agent  
**Trạng thái:** Hoàn thành đầy đủ (Acceptance passed 100%)  
**Milestone:** G2 — Premium Vertical Slice  
**Next Dependent Ticket:** T09 (Platform Agent — Application backend, auth và persistence)  

---

## 1. Input Digests & Giả Định (Assumptions)

### 1.1. Input Digests Bất Biến
Bản triển khai kế thừa và giữ nguyên 100% các digest cốt lõi từ G0 và G1, không sửa đổi bất kỳ quy tắc hay ABI nào:
- **Engine Digest:** `2a7ab7b39b03a7de65aea1d2a918815502d3942ec3722e7bc6cbf961259e5d78`
- **Catalog Digest:** `d8fe55474692a49ed5daa6d7dac62f635630a9e447a85ba683c0765bf535885d`
- **Ruleset Digest:** `19ef0b984d12a34796ea2058bb9971421674671fd4cc76b8cf694e80f03d2f14`
- **Compiler Digest:** `95b374ad1965a84ef51b11bb068bcc26b4feaf5b66fb6c1863308eee06fe9aea`
- **Capability Digest:** `183be2a086910659afdd918061d22fd3289f9a6ce9bb0644872f5997e83cd353`
- **Arena Init Digest:** `213af97e3969c88fce81f28e1055c18af8549bbf5bd37e72079f1d301d4ba510`
- **LUT Digest:** `749eadf6445c275c6b7cc7a2fc3fa1012775af6bdab7853753a28ae378336de1`

### 1.2. Giả Định và Biên Giới Kiến Trúc (Architectural Boundaries)
1. **Tuân thủ phân cấp gói (scripts/boundaries.mjs):**
   - `@prompt-chien/renderer` chỉ phụ thuộc vào `@prompt-chien/contracts` và `@prompt-chien/replay`. Tuyệt đối không import trực tiếp `@prompt-chien/engine` hay `@prompt-chien/brain`.
   - Client web `@prompt-chien/web` phụ thuộc vào `@prompt-chien/renderer`, `@prompt-chien/contracts` và `@prompt-chien/design-system`.
   - Không chứa bất kỳ từ khóa `any` nào trong toàn bộ mã nguồn của gói mới.
2. **Quyền độc lập của presentation:**
   - Presentation là tầng đọc một chiều (read-only adapter). Renderer và VFX Director nhận dữ liệu authoritative từ `PublicFrame` và `CombatEvent`. Tuyệt đối không can thiệp ngược trở lại mô phỏng logic hay thay đổi kết quả trận đấu.
3. **Mô phỏng hiệu ứng tất định (Deterministic & Seek-Safe VFX):**
   - Mọi hoạt ảnh và hiệu ứng hạt (particles) là hàm toán học tất định theo `(tick, frame, events)`. Không sử dụng `Math.random()` hay bộ đếm thời gian wall-clock `Date.now()`, bảo đảm tua tiến/lùi (seek) luôn tái dựng chính xác cùng một trạng thái hình ảnh.
4. **Quyền riêng tư trong Replay Công Khai:**
   - Bộ hiển thị Replay công khai chỉ đọc các trường public (tọa độ, module, phase, HP, events), không hiển thị các trường riêng tư (private energy, heat cụ thể, mã máy Brain đối thủ).

---

## 2. Danh Sách Files & Thay Đổi Triển Khai (Owned Paths)

### 2.1. Gói Renderer Mới (`packages/renderer/`)
1. **`packages/renderer/package.json`**: Cấu hình package ESM cho `@prompt-chien/renderer` với exports và dependencies.
2. **`packages/renderer/tsconfig.json`**: Cấu hình TypeScript kế thừa `tsconfig.base.json` với references `../contracts` và `../replay`.
3. **`packages/renderer/src/types.ts`**: Định nghĩa kiểu dữ liệu cho Quality Tier (`high`, `medium`, `low`), CameraState, RenderStats, RendererOptions, và EventGalleryItem.
4. **`packages/renderer/src/tokens.ts`**: Hệ thống Design Tokens màu sắc chuẩn Gốm Sống / Cốt Graphite (06_ART_UX.md §4), kèm hàm tính tỷ lệ tương phản WCAG 2.2 (`contrastRatio`) và chuyển đổi sang thang xám (`toGrayscaleHex`).
5. **`packages/renderer/src/glyphs.ts`**: Bộ vẽ vector chi tiết cho toàn bộ 10 module catalog (Core 2x2, Thruster, Armor, Blade, Burst, Shield, Capacitor, Radiator, Lance, Breaker), khung hợp kim titan tối, chốt tán cạnh tấm giáp, vết nứt sát thương, và huy hiệu nhận diện đội (Đội A hình tròn khuyết 1 notch + viền liền; Đội B hình lục giác khuyết 2 notch + viền đứt nét).
6. **`packages/renderer/src/vfx.ts`**: VFX Director tất định:
   - Lớp Telegraph độc lập: vẽ cung cảnh báo chém của Blade (18 ticks / 300ms, góc 60 độ), làn ngắm đạn Burst, và vòng bảo vệ Shield. Hoạt động sắc nét ngay cả khi tắt toàn bộ hiệu ứng hạt (`enableVfx: false`).
   - Hiệu ứng chiến đấu: vệt chém lưỡi gốm, tia đạn năng lượng, sóng chấn động khi khiên chặn đòn, mảnh vỡ gốm khi module bị phá hủy (tự triệt tiêu trong <= 400ms), nhịp đập điều hòa khi Core nguy cấp (<30 HP).
7. **`packages/renderer/src/audio.ts`**: Trình điều khiển âm thanh tổng hợp Web Audio (AudioDirector):
   - Tạo các âm sắc cơ khí theo 06_ART_UX.md §12: click cơ khí, cảnh báo, xác nhận, servo kéo Blade (300ms) → vung kiếm → va chạm gốm, 3 nhịp đạn Burst, hum từ trường Shield, vỡ vụn module.
   - Giới hạn cứng tối đa 16 voices đồng thời; điều tiết va chạm liên tiếp (impact throttle >= 30ms).
   - Stereo panning theo tọa độ trục X trên sàn đấu (-20m đến +20m).
   - Cắt tức thời mọi âm thanh chuyển tiếp (`stopAllTransients()`) khi người dùng tua frame trên thanh timeline.
8. **`packages/renderer/src/camera.ts`**: PresentationCamera hỗ trợ nội suy mượt giữa các tick, zoom (0.5x - 3.0x), pan, fit vừa sàn đấu 40m x 28m, và chuyển đổi hai chiều giữa tọa độ thế giới (mét) và điểm ảnh (pixels).
9. **`packages/renderer/src/renderer.ts`**: `ArenaRenderer` quản lý toàn bộ chu trình vẽ canvas 2D, các chế độ chất lượng (High/Medium/Low), xử lý phục hồi sự kiện mất ngữ cảnh GPU (`contextlost`/`contextrestored`), kiểm tra lớp va chạm không nói dối (`showColliders`), và chế độ thang xám (`grayscale`).
10. **`packages/renderer/src/fixtures.ts`**: Dữ liệu fixture mẫu chuẩn hóa cho phòng trưng bày sự kiện (Event Gallery) và ảnh chụp kiểm thử trực quan.
11. **`packages/renderer/src/index.ts`**: Xuất toàn bộ API công khai của gói.

### 2.2. Tài Nguyên Mỹ Thuật Đã Biên Soạn (`assets/`)
12. **`assets/manifest.json`**: Danh mục tài nguyên chính thức, quy định giấy phép tác giả MIT sạch, kích thước sân 40m x 28m, thông số hai đội, và bảng tra cứu 10 module.
13. **`assets/modules/core/glyph.svg`**: Vector SVG Ý Thức Tâm (Core 2x2, vòng vàng đồng tâm và vạch căn chỉnh).
14. **`assets/modules/thruster/glyph.svg`**: Vector SVG Động Cơ Đẩy (hai khe thoát khí song song).
15. **`assets/modules/armor/glyph.svg`**: Vector SVG Tấm Giáp Gốm (hai lớp gốm xếp tầng và chốt đinh tán).
16. **`assets/modules/blade/glyph.svg`**: Vector SVG Lưỡi Chém Gốm (lưỡi vát chéo và gân gia cường).
17. **`assets/modules/burst/glyph.svg`**: Vector SVG Pháo Bắn Đợt (ba nòng phóng đạn song song).
18. **`assets/modules/shield/glyph.svg`**: Vector SVG Khiên Từ Trường (cung bảo vệ kép uốn cong).
19. **`assets/modules/capacitor/glyph.svg`**: Vector SVG Tụ Trữ Năng (ba thanh tích trữ điện môi).
20. **`assets/modules/radiator/glyph.svg`**: Vector SVG Lá Tản Nhiệt (ba lá tản nhiệt đối lưu).
21. **`assets/modules/lance/glyph.svg`**: Vector SVG Thương Đột Kích (mũi thương nhọn kéo dài).
22. **`assets/modules/breaker/glyph.svg`**: Vector SVG Khối Phá Giáp (khối va đập bị tách đôi bởi rãnh nứt).
23. **`assets/teams/a/emblem.svg`**: Biểu trưng Đội A (hình tròn 1 notch).
24. **`assets/teams/b/emblem.svg`**: Biểu trưng Đội B (hình lục giác 2 notch).

### 2.3. Tích Hợp Frontend Web (`apps/web/`)
25. **`apps/web/package.json`**: Thêm dependency `@prompt-chien/renderer: "workspace:*"`.
26. **`apps/web/tsconfig.json`**: Thêm project reference và path alias tới `packages/renderer`.
27. **`apps/web/vite.config.ts`**: Thêm module alias trỏ tới `@prompt-chien/renderer`.
28. **`apps/web/src/arena.tsx`**: Nâng cấp toàn diện giao diện Arena:
    - Nhúng `ArenaRenderer` thay cho canvas nguyên thủy cũ.
    - Bổ sung thanh công cụ điều khiển kỹ thuật mỹ thuật G2:
      - Hộp chọn chất lượng hiển thị: Cao (High Tier), Vừa (Medium Tier), Thấp (Low Tier).
      - Nút bật/tắt VFX (để kiểm chứng telegraph rõ ràng khi tắt VFX).
      - Nút bật/tắt Thang xám (Grayscale test).
      - Nút bật/tắt Khung va chạm vật lý (No Collider Lie overlay).
      - Nút bật/tắt Telegraph độc lập.
      - Nút tắt tiếng và thanh trượt âm lượng tích hợp AudioDirector.
    - Hàng nút nhảy nhanh tới 4 sự kiện chiến đấu tiêu biểu (Windup Blade, Ngắm Burst, Khiên chặn đòn, Phá vỡ module).

### 2.4. Bộ Kiểm Thử Nghiệm Thu (`tests/t08.test.ts`)
29. **`tests/t08.test.ts`**: 16 kịch bản kiểm thử bao phủ toàn bộ 8 tiêu chí nghiệm thu của T08:
    - Tính hoàn chỉnh của tài nguyên, giấy phép MIT, không còn placeholder.
    - Độ tương phản màu sắc WCAG 2.2 và phân biệt đội trong thang xám.
    - Telegraph lưỡi chém hiển thị đúng 18 ticks (300ms) khi tắt VFX.
    - Khung va chạm khớp 1:1 với kích thước vật lý của contracts.
    - Tính tất định khi tua tiến/lùi (seek reconstruction) và ngắt âm thanh chuyển tiếp.
    - Quản lý ngân sách âm thanh (tối đa 16 voices, điều tiết va chạm liên tiếp).
    - Phép biến đổi không gian camera chiếu (tọa độ mét ↔ pixel).
    - Bộ 3 bậc chất lượng đồ họa và thư viện sự kiện mẫu.

---

## 3. Kết Quả Thực Thi & Lệnh Bắt Buộc

| Lệnh Kiểm Tra | Exit Code | Thời Gian | Kết Quả Chi Tiết |
|---|---|---|---|
| `pnpm check` | **0** | 3.797 ms | `tsc -b`, kiểm tra strict types các gói và `boundaries.mjs`: Strict types + package boundaries passed |
| `pnpm build` | **0** | 1.468 ms | Vite production build hoàn tất; bundle UI `index-*.js` đạt 136.57 kB gzip (tiết kiệm hơn nhiều so với ngân sách 400 kB); tách biệt hoàn toàn worker |
| `pnpm test:unit` | **0** | 19.293 ms | **191 tests pass** trên toàn bộ 9 tệp test; 0 failed; 0 skipped; 0 unrun |
| `node scripts/smoke.mjs` | **0** | 916 ms | 2 vòng khởi động/dừng server API (:3001) và Web client (:5173); kiểm tra /api/health và /api/ready passed |
| `pnpm test:sim` | **0** | 13.142 ms | 19 tests mô phỏng vượt qua; 10 kịch bản golden corpus khớp hoàn toàn digest `2a7ab7b3...` |
| `pnpm verify:replay` | **0** | 18.033 ms | 6 tests codec và determinism passed; kiểm tra dung lượng replay 5.400 ticks < 8 MiB |

### Chi Tiết Phân Phối 191 Tests Unit:
- `tests/t08.test.ts`: **16 tests** (T08 Art, Renderer, Animation và Audio)
- `tests/t07.test.ts`: **16 tests** (T07 Workshop, Brain Lab, Local Experiments)
- `tests/brain.test.ts`: **87 tests** (Brain VM, OpCodes, Sensors, Gas)
- `tests/contracts.test.ts`: **42 tests** (Contracts, Schemas, Presets)
- `tests/combat.test.ts`: **15 tests** (Blade, Burst, Shield, Resources)
- `tests/replay.test.ts`: **6 tests** (Replay binary codec, Checkpoint restore)
- `tests/spatial.test.ts`: **4 tests** (CCD, Movement, Collision solver)
- `tests/schemas.test.ts`: **4 tests** (JSON schema validation)
- `tests/parity.test.ts`: **1 test** (Cross-runtime hash parity)
- **Tổng cộng:** **191 passed, 0 failed, 0 skipped, 0 unrun.**

---

## 4. Bằng Chứng Đạt Đầy Đủ Acceptance Criteria Ticket T08

1. **Full flow has no placeholder:**
   - Toàn bộ 10 module trong catalog đều có định nghĩa vector SVG và logic vẽ chi tiết với đầy đủ các chi tiết cơ khí (chốt tán, đường gân, rãnh xả, buồng điện môi).
   - Hai đội A và B có biểu trưng và hoa văn viền độc lập. Bản vẽ sân có đầy đủ vạch lưới, tường biên và tâm objective.
   - Thư mục `assets/` có tệp kê khai `manifest.json` ghi rõ giấy phép tác giả MIT.
2. **Shapes distinguish two teams in grayscale:**
   - Đội A sử dụng biểu trưng hình tròn (1 notch ở đỉnh) cùng đường viền giáp liền mạch.
   - Đội B sử dụng biểu trưng hình lục giác (2 notch ở hai bên) cùng đường viền giáp đứt đoạn.
   - Khi chuyển sang chế độ thang xám (`toGrayscaleHex`), tỷ lệ tương phản giữa màu nhận diện hai đội và nền sân tối (#0E141A) đạt >= 3.0:1 (thỏa mãn tiêu chuẩn WCAG 2.2 cho đối tượng đồ họa trực quan). Người xem phân biệt được hai đội hoàn toàn dựa trên hình học và cấu trúc mà không cần phụ thuộc vào sắc màu.
3. **Telegraphs visible with VFX off:**
   - Lớp hiển thị telegraph trong `VfxDirector.renderTelegraphs()` được xây dựng độc lập hoàn toàn với cờ bật/tắt VFX.
   - Đòn chém Blade có cung cảnh báo 60 độ hiển thị chính xác trong 18 sim ticks (300ms tại 60 Hz).
   - Vũ khí Burst hiển thị 3 đường ngắm đạn hướng thẳng về phía trước.
   - Ngay cả khi người chơi tắt VFX (`enableVfx: false`), toàn bộ các hình học cảnh báo này vẫn hiển thị rõ ràng trên sân.
4. **Overlays no collider lie:**
   - Lớp kiểm tra khung va chạm (`drawColliders`) vẽ trực tiếp kích thước footprint theo hợp đồng authoritative của engine: Core chiếm đúng 2m x 2m, các module chiếm đúng 1m x 1m, sân thi đấu 40m x 28m.
   - Không có bất kỳ sự biến dạng mỹ thuật (visual skew/stretch) nào làm sai lệch vị trí của hitbox/collider thực tế.
5. **Seek reconstruct cosmetic state without persistent trails/audio:**
   - Tất cả hiệu ứng hình ảnh (tia lửa gốm, mảnh vỡ module, sóng chấn động) là hàm toán học tất định theo tick của sự kiện. Không có mảng lưu trữ hạt dùng chung giữa các frame.
   - Khi người dùng tua thanh timeline (seek tiến hoặc lùi), hàm `audio.stopAllTransients()` lập tức ngắt toàn bộ các âm sắc đang phát dở. Không bị hiện tượng chồng âm hoặc rò rỉ vệt hạt từ quá khứ sang tương lai.
6. **Frametime / DPR / memory asset budget (09_QUALITY_SECURITY.md):**
   - App shell gzip đạt 136.57 kB (vượt xa chỉ tiêu <= 400 KiB gzip).
   - Tổng dung lượng tài nguyên mỹ thuật ban đầu < 1 MiB (vượt xa chỉ tiêu <= 8 MiB).
   - Tốc độ render trên canvas đạt < 1 ms / frame trong môi trường kiểm thử (đạt mục tiêu p95 <= 16.7 ms cho 60 FPS).
   - Hỗ trợ giới hạn DPR theo bậc chất lượng: High (DPR 2.0), Medium (DPR 1.5), Low (DPR 1.0).
7. **Context-loss recovery & Browser / Keyboard controls:**
   - Bộ lắng nghe `contextlost` và `contextrestored` tự động bắt sự kiện mất GPU context và khởi tạo lại trạng thái vẽ mà không làm vỡ vòng lặp Replay.
   - Hỗ trợ đầy đủ các phím tắt bàn phím: `Space` (Phát/Dừng), `Home` (Về đầu), `ArrowLeft`/`ArrowRight` (Tua lùi/tiến từng tick).

---

## 5. Artifacts Bàn Giao Theo Revision `c151fa42f88ef622`

- `deliverables/implementation/T08/c151fa42f88ef622/snapshot.json`: Danh mục kiểm kê 197 tệp nguồn cùng mã băm SHA256 tương ứng.
- `deliverables/implementation/T08/c151fa42f88ef622/acceptance.json`: Trạng thái nghiệm thu chi tiết từng tiêu chí và thời gian thực thi các lệnh.
- `deliverables/implementation/T08/c151fa42f88ef622/commands/check.json`: Bắt log và exit code của `pnpm check`.
- `deliverables/implementation/T08/c151fa42f88ef622/commands/build.json`: Bắt log và exit code của `pnpm build`.
- `deliverables/implementation/T08/c151fa42f88ef622/commands/unit.json`: Bắt log và exit code của `pnpm test:unit`.
- `deliverables/implementation/T08/c151fa42f88ef622/commands/smoke.json`: Bắt log và exit code của `node scripts/smoke.mjs`.
- `deliverables/implementation/T08/c151fa42f88ef622/commands/sim.json`: Bắt log và exit code của `pnpm test:sim`.
- `deliverables/implementation/T08/c151fa42f88ef622/commands/replay.json`: Bắt log và exit code của `pnpm verify:replay`.

---

## 6. Blockers & Next Dependent Ticket

- **Blockers:** Không có blocker kỹ thuật nào. Mọi ràng buộc phân tách kiến trúc (package boundaries), kiểm tra kiểu nghiêm ngặt (strict types), không dùng `any`, và định hướng mỹ thuật Gốm Sống / Cốt Graphite đều được thỏa mãn 100%.
- **Next Dependent Ticket:** **T09 — Application backend, auth và persistence** (Platform Agent). T09 sẽ xây dựng tầng API chia sẻ giữa Web và MCP, quản lý phiên người dùng, CAS drafts, lưu trữ package bất biến, và kết nối với worker mô phỏng T10.
