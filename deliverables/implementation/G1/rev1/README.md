# Báo cáo Bàn giao Mốc G1 — Combat Proof (T04 – T06)

**Dự án:** PROMPT Chiến v2.0  
**Mốc:** G1 — Combat proof  
**Revision:** rev-1  
**Ngày:** 2026-10-01  
**Trạng thái Gate G1:** **PASS (100%)**

---

## 1. Tổng quan các Ticket đã hoàn thành

### T04 — Spatial và Motion Deterministic (`@nextgame/engine`)
- **Toán học số nguyên thuần túy (Zero Float):**
  - Tọa độ milli-units ($1\text{ world unit} = 1000\text{ milli-units}$). Vận tốc milli-units/s.
  - Bảng tra lượng giác góc quay (LUT): 4096 bước góc ($0..4095$ đại diện cho $0..2\pi$), scale $1,000,000$.
  - Hàm số nguyên: `isqrt` floor (Newton's method trên BigInt), `normalizeAngle`, `relativeBearing` (khoảng đối xứng $[-2048..2047]$), `integerAtan2`, `rotateVector` với BigInt 64-bit trung gian chống tràn số.
- **Hình học và Colliders (`geometry.ts`):**
  - Chuẩn hóa tọa độ module theo tâm Core $2\times 2$.
  - Biến đổi hệ tọa độ thân sang hệ tọa độ thế giới theo heading của bot.
  - Hộp bao thế giới (World AABB) phục vụ broad-phase.
  - **Va chạm liên tục (CCD):** Kiểm tra giao cắt đoạn thẳng với ô vuông (`segmentIntersectsCell`) chống hiện tượng đạn xuyên tường/xuyên ô (tunneling) ở tốc độ cao.
- **Động học Kinematics & Solver va chạm (`physics.ts`):**
  - Khối lượng khóa $M$, lực đẩy $N$ động cơ sống: $v_{\max} = \lfloor 6000 \cdot \text{drive} / 1000 \rfloor$, $\text{accel} = \lfloor 12000 \cdot \text{drive} / 1000 \rfloor$.
  - Mô-men xoắn theo vị trí cánh tay đòn $\text{lever}_i = \min(4000, \text{isqrt}(dx^2 + dy^2))$.
  - Tích phân vận tốc và góc quay giữ lại phần dư nguyên (fractional remainders) chống trôi sai số (no drift truncation).
  - Giảm tốc khi thả ga: $6000/60 = 100\text{ mU/tick}$.
  - Va chạm tường sân đấu $40\times 28$ unit ($[-20000..20000] \times [-14000..14000]$ mU).
  - Va chạm thân bot (Body vs Body): Phân bổ vị trí theo khối lượng tương ứng, phản lực pháp tuyến không đàn hồi (inelastic normal response), bảo lưu thành phần vận tốc tiếp tuyến, không gây sát thương do va chạm thân.

---

### T05 — Combat Slice và Objective (`@nextgame/engine`)
- **Tài nguyên chiến đấu (`combat.ts`):**
  - Năng lượng: Dung lượng $1000 + 250 \times \text{Capacitors}$, hồi phục $+2/\text{tick}$ ($120/\text{s}$). Bật khiên tiêu tốn 1 năng lượng/tick upkeep.
  - Nhiệt lượng: $0..1000$, tản nhiệt cơ bản $1/\text{tick} + 1/\text{tick} \times \text{Radiators}$.
  - Quá nhiệt (Overheat): Khi nhiệt độ $\ge 1000$, bot rơi vào trạng thái quá nhiệt (`isOverheated = true`), cấm kích hoạt vũ khí/khiên và tự tắt khiên ngay lập tức. Phục hồi khi nhiệt độ giảm xuống $\le 600$.
- **Máy trạng thái vũ khí (Weapon FSM):**
  - Chu kỳ: $\text{idle} \to \text{windup} \to \text{active} \to \text{recovery} \to \text{idle}$.
  - **Blade:** Chi phí 140 năng lượng / 180 nhiệt. Chu kỳ $18/6/30$ ticks. Vùng sát thương hình quạt 90° phía trước, bán kính 1.5 units ($1500\text{ mU}$), sát thương 90. Một lần kích hoạt chỉ gây sát thương 1 module.
  - **Burst:** Chi phí 180 năng lượng / 220 nhiệt. Chu kỳ $18/9/45$ ticks. Bắn 3 viên đạn ở các tick active 0, 4, 8. Tốc độ đạn $18\text{ units/s}$, tầm bắn 12 units ($12000\text{ mU}$), sát thương 32/viên.
  - **Shield:** Chi phí 40 năng lượng / 20 nhiệt. Upkeep 1 năng lượng/tick. Cung chắn 90° ($\pm 512$ đơn vị góc) từ tâm Core. Chặn tối đa $700/1000$ sát thương thô, chuyển hóa thành tổn hao năng lượng $\lceil \text{blocked}/2 \rceil$. Khóa 30 ticks sau khi tắt trước khi được bật lại.
- **Giáp và Cơ chế hủy diệt:**
  - Module Armor giảm $30\%$ sát thương động năng nhận vào (còn $700/1000$).
  - Module tụt HP về 0 sẽ bị phá hủy.
  - Thuật toán BFS kiểm tra tính liên thông: Bất kỳ module nào mất đường nối cạnh tới Core sẽ lập tức bị rụng (detached) và mất tác dụng.
- **Mục tiêu và Điểm số (`objective.ts`):**
  - Trận đấu tối đa $90\text{ giây} = 5400\text{ ticks}$ (60 Hz).
  - Vòng kiểm soát (Control Circle): Bán kính 3 units ($3000\text{ mU}$) tại tâm sân $(0, 0)$, kích hoạt từ tick 600 (10s). Mỗi tick chỉ có đúng 1 Core nằm trong vòng được $+1\text{ controlTick}$.
  - Vòng bo (Ring Shrink): Báo hiệu trước ở tick 3480 (58s), bắt đầu thu hẹp từ tick 3600 (60s) đến tick 5400 từ bán kính 25,000 xuống 6,000 mU. Sát thương ngoài bo: $50/1000 \times \text{maxCoreHP}$ mỗi giây trực tiếp vào Core.
  - Xử thắng/thua/hòa:
    - Core bị phá hủy trước $\implies$ đối phương thắng. Cả hai cùng chết tick đó $\implies$ Hòa.
    - Chuỗi 10 lỗi liên tiếp (Brain budget) $\implies$ xử thua.
    - Hết 5400 ticks tính điểm: $\text{score} = 5 \times C + 3 \times D + 2 \times H$. Chênh lệch $\le 100$ điểm $\implies$ Hòa.

---

### T06 — Replay, CLI và Reproducibility
- **Gói `@nextgame/replay`:**
  - Cấu trúc Chunks công khai: 60 ticks/chunk ($1\text{ giây/chunk}$).
  - Lọc dữ liệu công khai (Public Projection): Loại bỏ toàn bộ biến nội bộ / Brain private.
  - Tính năng tua nhanh (Seek): Tra cứu trực tiếp theo số tick `seekReplayTick(replay, tick)` trả về chính xác frame tương ứng playback tuần tự.
  - Kiểm tra tính toàn vẹn (Integrity Verifier): Tính mã băm SHA-256 từng chunk và `publicReplayHash` tổng thể, phát hiện ngay lập tức bất kỳ frame nào bị sửa đổi.
- **Công cụ dòng lệnh `@nextgame/cli`:**
  - `nextgame validate <bot.json>`: Thẩm định hợp lệ của bot và sinh `packageHash`.
  - `nextgame simulate [botA] [botB] [--seed <hex>] [--out <replay.json>]`: Chạy mô phỏng không giao diện, in chi tiết kết quả và xuất replay.
  - `nextgame experiment [--count <N>]`: Thực thi so sánh hàng loạt trên các seed khác nhau với tốc độ siêu việt (>250x thời gian thực).
  - `nextgame verify <replay.json>`: Xác thực tính toàn vẹn và khớp hash của file replay.

---

## 2. Bằng chứng Kiểm thử (Test Evidence)

### 2.1 Kiểm tra kiểu toàn bộ Monorepo (`pnpm check`)
```bash
pnpm check
# Output: Exit code 0
```

### 2.2 Bộ kiểm thử đơn vị Vitest (`pnpm test`)
```bash
pnpm test
# Kết quả: 9/9 test files, 53/53 tests PASSED (100%)
```
```text
 ✓ packages/brain/test/runtime.test.ts (7 tests)
 ✓ packages/contracts/test/validation.test.ts (10 tests)
 ✓ packages/contracts/test/canonical.test.ts (9 tests)
 ✓ packages/replay/test/replay.test.ts (3 tests)
 ✓ packages/engine/test/combat.test.ts (4 tests)
 ✓ packages/engine/test/spatial.test.ts (7 tests)
 ✓ packages/content/test/arenaInit.test.ts (4 tests)
 ✓ packages/brain/test/compiler.test.ts (6 tests)
 ✓ packages/engine/test/simulation.test.ts (3 tests)

 Test Files  9 passed (9)
      Tests  53 passed (53)
```

### 2.3 Thực thi mô phỏng và kiểm tra Replay qua CLI
```bash
# 1. Chạy 1 trận đấu và xuất replay:
node apps/cli/dist/index.js simulate --out replay.json
# Output:
# Total Ticks: 5400 / 5400 (90.0s)
# Winner: botA (Reason: timeoutScore)
# Replay written to replay.json (Public Hash: 594124d5873c9a4ad0ff6300cc091ca2d0f1068a35b626aa2360fd0f9157da30)

# 2. Xác thực tính toàn vẹn replay:
node apps/cli/dist/index.js verify replay.json
# Output:
# Replay integrity VERIFIED: valid chunk hashes and public hash (594124d5873c9a4ad0ff6300cc091ca2d0f1068a35b626aa2360fd0f9157da30)

# 3. Thí nghiệm cân bằng tự động 20 trận:
node apps/cli/dist/index.js experiment --count 20
# Output: 20 matches executed in ~7s (~350ms/90s match = 257x realtime)
```

---

## 3. Tiêu chí Đạt chuẩn Gate G1 (Gate Checklist)

| Tiêu chí Gate G1 | Trạng thái | Minh chứng |
|---|:---:|---|
| **Determinism & CCD** | **PASS** | Đạn bay tốc độ cao không xuyên ô; kiểm thử bit-parity 100% qua các lần chạy cùng seed; toán số nguyên không phụ thuộc nền tảng. |
| **Order & Combat Slice** | **PASS** | Chu kỳ 18 windup Blade/Burst, offset đạn 0/4/8, quạt chém 90°, hấp thụ sát thương khiên, giảm sát thương giáp, cắt cụt module rời rạc bằng BFS. |
| **Replay & Seek Parity** | **PASS** | Chunks 60 ticks/s, seek tới bất kỳ tick nào trùng khớp hoàn toàn, phát hiện gian lận qua băm SHA-256 từng chunk. |
| **CLI Headless Tool** | **PASS** | Cung cấp đầy đủ 4 lệnh `validate`, `simulate`, `experiment`, `verify`. |
| **Hiệu năng mô phỏng** | **PASS** | Đạt tốc độ $>250\times$ thời gian thực (khoảng 350ms cho 1 trận 90 giây / 5400 ticks). |

---

## 4. Sẵn sàng cho Mốc tiếp theo
- Mốc tiếp theo: **G2 — Premium vertical slice** (Tickets T07–T08: Workshop + Brain Lab + Arena integration, Art pipeline, renderer PixiJS, audio, experiments).
