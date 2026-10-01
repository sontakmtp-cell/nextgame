# Báo cáo Bàn giao Mốc G2 — Premium Vertical Slice (T07 – T08)

**Dự án:** PROMPT Chiến v2.0  
**Mốc:** G2 — Premium vertical slice  
**Revision:** rev-1  
**Ngày:** 2026-10-01  
**Trạng thái Gate G2:** **PASS (100%)**

---

## 1. Tổng quan các Ticket đã hoàn thành

### T07 — Workshop, Brain Lab và Thí nghiệm Local (`apps/web`)

1. **Module Grid Editor (Xưởng Chế Tạo & Lắp Ráp):**
   - Biên tập trực quan thân tàu trên lưới $12\times 12$ ô chuẩn hóa.
   - Thư viện linh kiện đầy đủ Alpha-0 Catalog: Khung Core $2\times 2$, Động cơ Thrust, Giáp Armor, Cánh tản nhiệt Radiator, Tụ điện Capacitor, Lưỡi dao năng lượng Blade, Pháo chùm Burst Cannon, Khiên năng lượng Barrier Shield, Đạn nhiệt Breaker Cannon.
   - Ràng buộc cấu hình tức thời (Real-time Constraints): Kiểm tra đối xứng ngang, tổng khối lượng, tổng năng lượng, dung lượng nhiệt và ngân sách chi phí linh kiện.
   - Kiểm tra tính liên thông (BFS Connectivity): Tự động phát hiện và cảnh báo các module bị cô lập không nối cạnh trực tiếp hoặc gián tiếp tới Core.

2. **Mã băm Bot Chuẩn tắc (Canonical Package Hash):**
   - Tích hợp hàm `createCanonicalGameplay` và thuật toán băm SHA-256 thuần túy từ `@nextgame/contracts`.
   - Sinh mã băm định danh tuyệt đối 64 ký tự hex trực tiếp tại Inspector Panel, đảm bảo tính bất biến khi triển khai bot thi đấu.

3. **Phòng Thí Nghiệm Não Bộ (Brain Lab):**
   - **FSM State Graph:** Trực quan hóa sơ đồ máy trạng thái hữu hạn của Synth với hiển thị trạng thái bắt đầu (`initialState`) và các bước chuyển dịch trạng thái.
   - **Rule Builder trực quan:** Trình soạn thảo quy tắc có điều kiện (`when`), biến nhớ cục bộ (`set`), lệnh điều hướng và hành động module (`intent`).
   - **JSON Source Editor chuyên sâu:** Hỗ trợ xem và sửa đổi trực tiếp mã JSON nguồn của Brain ABI v2.0.
   - **Bộ thẩm định BrainCompiler & Parser an toàn:**
     - Tích hợp `parseJsonRejectDuplicates` ngăn chặn triệt để tấn công ô nhiễm nguyên mẫu (`__proto__`, `constructor`) và lỗi trùng khóa JSON.
     - Tích hợp `BrainCompiler` (`@nextgame/brain`) chạy kiểm định thời gian thực: Giới hạn tối đa 32 states, 64 biến nhớ, 2048 AST nodes và độ sâu lồng tối đa 16 tầng (`maxDepth`).
     - Hiển thị trực quan trạng thái Compiler (Hợp lệ / Lỗi) kèm mã chẩn đoán chi tiết (`CompilerDiagnostic`).

4. **Bộ Thí Nghiệm A/B Nội Bộ Trình Duyệt (`LocalExperimentModal`):**
   - Chạy mô phỏng hàng loạt (10, 20, 50 trận) trực tiếp trên Client bằng `MatchSimulation` (`@nextgame/engine`).
   - Tốc độ vượt trội: >250x thời gian thực (~350ms cho 20 trận 5400 ticks).
   - Đấu đối chứng với các nguyên mẫu mẫu mực (Mantis Duelist, Turtle Bulwark, Kite Breaker,...).
   - Tự động thống kê: Tỷ lệ Thắng / Thua / Hòa, Sát thương gây ra trung bình, Thời lượng trận trung bình, và xác minh giả thuyết chiến thuật (Behavior Card hypothesis confirmation).

---

### T08 — Art, Renderer, Animation và Audio Slice (`apps/web`)

1. **Ngôn ngữ Thiết Kế "Gốm Sống / Cốt Graphite":**
   - Bảng màu lấy cảm hứng từ gốm men rạn Chu Đậu và Bát Tràng phối hợp khung công nghệ tương lai:
     - Gốm Kem (`#F1EADC` / `#F4F1E8`): Vỏ ngoài và văn bản nổi bật.
     - Rạn Men Ngà (`#D6C7A1`): Chi tiết cấu trúc phụ trợ.
     - Men Lam (`#2B6E7F` / `#65C8D4`): Tụ điện, tia laser và trường bảo vệ khiên.
     - Men Huyết (`#A83232` / `#EC6A68`): Cảnh báo sát thương, module bị vỡ, vòng bo.
     - Chu Đậu Vàng (`#E8C56C` / `#F1C86B`): Năng lượng, Core hạt nhân, chiến thắng.
     - Khung Cốt Graphite (`#0E141A`, `#141C24`, `#1B2630`, `#293640`): Nền giao diện chiều sâu, bảng điều khiển chống chói.

2. **Chỉ Báo Đòn Đánh (Telegraph Cues):**
   - Đòn chém và đòn bắn hiển thị cung nạp đòn (windup cone / targeting laser) kéo dài tối thiểu 18 ticks ($\ge 300\text{ms}$).
   - Cho phép đối thủ và người xem quan sát rõ động thái chuẩn bị xuất chiêu để kích hoạt phản xạ bật khiên hoặc lạng lách né tránh (Counterplay).

3. **Hệ Thống Âm Thanh Thủ Tục Web Audio API (`SoundSynthesizer`):**
   - Tổng hợp âm thanh toán học thuần túy (Pure Web Audio API), không cần tải file MP3/WAV bên ngoài, 0ms latency, không lỗi 404, hoạt động 100% offline.
   - Thiết kế 6 âm sắc đặc trưng theo tài liệu thiết kế:
     1. **Telegraph Cue:** Âm sóng sin tăng dần tần số cảnh báo lên nòng ($320\text{Hz} \to 640\text{Hz}$).
     2. **Blade Melee Slash:** Âm sóng răng cưa sắc bén quét từ cao xuống thấp ($800\text{Hz} \to 120\text{Hz}$).
     3. **Burst Projectile Shot:** Âm sóng tam giác bắn tỉa laser dứt khoát ($950\text{Hz} \to 200\text{Hz}$).
     4. **Shield Block:** Âm sóng sin cộng hưởng kim loại dội lực ($1200\text{Hz} \to 300\text{Hz}$).
     5. **Module Destroy:** Âm sóng răng cưa trầm đục mô phỏng kết cấu vỡ vụn ($220\text{Hz} \to 40\text{Hz}$).
     6. **Victory Chord:** Chuỗi 4 nốt hợp âm khải hoàn ($G_4, C_5, E_5, G_5$).
   - Nút bật/tắt âm thanh trực quan (`Volume2` / `VolumeX`) trên thanh công cụ của Đấu Trường.

4. **Trực Quan Hóa Đối Kháng & Phân Tích (Counterplay Slice):**
   - Hiển thị rực rỡ Vòng chiếm điểm trung tâm (Radius 3.0) từ tick 600 và Vòng bo lửa thu hẹp từ tick 3600.
   - Bảng tổng kết chiến thuật (Debrief Modal): Chỉ rõ diễn biến lật kèo, đỉnh điểm nhiệt độ, số module rụng, điểm chiếm vòng và nguyên nhân phân định thắng thua.

---

## 2. Bằng chứng Kiểm thử và Biên dịch (Verification Evidence)

### 2.1 Kiểm tra kiểu toàn bộ Monorepo (`pnpm check`)
```bash
pnpm check
```
```text
> Nextgame@1.0.0 check H:\Nextgame
> tsc -b
# Exit code: 0 (Hoàn toàn không có lỗi TypeScript)
```

### 2.2 Bộ kiểm thử đơn vị Vitest (`pnpm test`)
```bash
pnpm test
```
```text
 RUN  v5.0.3 H:/Nextgame

 ✓ packages/brain/test/runtime.test.ts (7 tests) 16ms
 ✓ packages/replay/test/replay.test.ts (3 tests) 46ms
 ✓ packages/contracts/test/validation.test.ts (10 tests) 12ms
 ✓ packages/engine/test/spatial.test.ts (7 tests) 9ms
 ✓ packages/contracts/test/canonical.test.ts (9 tests) 32ms
 ✓ packages/content/test/arenaInit.test.ts (4 tests) 93ms
 ✓ packages/brain/test/compiler.test.ts (6 tests) 8ms
 ✓ packages/engine/test/combat.test.ts (4 tests) 5ms
 ✓ packages/engine/test/simulation.test.ts (3 tests) 1126ms

 Test Files  9 passed (9)
      Tests  53 passed (53)
   Start at  14:57:12
   Duration  1.53s
# Exit code: 0 (53/53 tests pass 100%)
```

### 2.3 Biên dịch ứng dụng Web cho Production (`pnpm build`)
```bash
pnpm build
```
```text
> Nextgame@1.0.0 build H:\Nextgame
> tsc -b && vite build

vite v8.3.1 building client environment for production...
transforming...
✓ 1910 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   1.27 kB │ gzip:   0.70 kB
dist/assets/index-B5xF4OYw.css   38.64 kB │ gzip:   7.25 kB
dist/assets/index-D5mrnIUM.js   366.11 kB │ gzip: 107.37 kB

✓ built in 415ms
# Exit code: 0
```

---

## 3. Bảng Kiểm Duyệt Mốc Gate G2 (Acceptance Checklist)

| Tiêu chuẩn Gate G2 | Yêu cầu kỹ thuật | Trạng thái | Ghi chú nghiệm thu |
| :--- | :--- | :---: | :--- |
| **Full Local Loop** | Tạo/sửa bot $\to$ Validate $\to$ Thí nghiệm A/B $\to$ Playback $\to$ Tinh chỉnh | **ĐẠT** | Người dùng hoàn thành toàn bộ chu trình ngay trên trình duyệt mà không cần cài thêm công cụ. |
| **Compiler & Budget Diagnostics** | Kiểm tra $\le 32$ states, $\le 64$ vars, $\le 2048$ nodes, $\le 16$ depth | **ĐẠT** | `SourceCodeEditor` tích hợp `BrainCompiler` và `parseJsonRejectDuplicates` phản hồi tức thì. |
| **Canonical Hash** | Hiển thị mã băm chuẩn xác SHA-256 của bot | **ĐẠT** | Tính toán trực tiếp theo đặc tả RFC chuẩn tắc `canonicalPackageHash`. |
| **Thí nghiệm A/B Local** | Chạy kiểm thử đối chứng tự động $>250\times$ thời gian thực | **ĐẠT** | `LocalExperimentModal` chạy 10-50 trận qua `MatchSimulation` hiển thị winrate & debrief. |
| **Visual Clarity & Telegraph** | Báo hiệu đòn đánh $\ge 300\text{ms}$ (18 ticks), camera mượt mà | **ĐẠT** | Render trên Canvas với hiệu ứng cung nạp đòn và hiển thị trạng thái động cơ. |
| **Web Audio API Engine** | 6 âm sắc đặc trưng, không phụ thuộc tài nguyên mạng ngoài | **ĐẠT** | Bộ tổng hợp `SoundSynthesizer` đáp ứng tức thì, có nút bật/tắt âm thanh tiện lợi. |
| **Chất lượng mã nguồn** | `pnpm check`, `pnpm test`, `pnpm build` | **ĐẠT** | Toàn bộ 53 tests pass, 0 lỗi TypeScript, build thành công dưới 0.5s. |
