# Báo cáo Bàn giao Mốc G0 — Foundation Contracts (T01 – T03)

**Dự án:** PROMPT Chiến v2.0  
**Mốc:** G0 — Nền contracts  
**Revision:** rev-1  
**Ngày:** 2026-10-01  
**Trạng thái Gate G0:** **PASS (100%)**

---

## 1. Tổng quan các Ticket đã hoàn thành

### T01 — Workspace và môi trường phát triển
- **Workspace Monorepo:** Cấu hình `pnpm-workspace.yaml` quản lý `packages/*` và `apps/*`.
- **TypeScript Project References:** `tsconfig.base.json` (ES2022, strict, composite, module NodeNext) và root `tsconfig.json` liên kết các package:
  - `packages/contracts` (`@nextgame/contracts`)
  - `packages/content` (`@nextgame/content`)
  - `packages/brain` (`@nextgame/brain`)
  - `packages/testkit` (`@nextgame/testkit`)
  - `apps/web` (`@nextgame/web`)
- **Docker Dev Compose:** `docker-compose.yml` định cấu hình sẵn PostgreSQL 17 và MinIO Object Storage cho các mốc backend.
- **Biến môi trường:** `.env.example` tài liệu hóa các biến cấu hình cần thiết.

### T02 — Contracts, Catalog và Canonical Encoder
- **Zero-I/O `@nextgame/contracts`:**
  - TypeScript types: `BotDefinition`, `BotBody`, `BrainSource`, `BrainIR`, `Intent`, `Observation`, `ValidationReport`, `MatchManifest`, `ReplayFrame`.
  - JSON Schema 2020-12: `BOT_DEFINITION_SCHEMA`, `MATCH_MANIFEST_SCHEMA`.
  - Pure Zero-Dependency SHA-256 (`sha256.ts`): Đảm bảo hash parity tuyệt đối trên Node, Linux, Windows, Browser và Web Workers mà không phụ thuộc `node:crypto`.
  - Strict JSON Parser (`parseJsonRejectDuplicates`): Từ chối ngay lập tức khi phát hiện duplicate keys hoặc poison keys (`__proto__`, `constructor`, `prototype`).
  - Canonical Stringifier (`stringifyCanonical`): Sắp xếp key từ điển (lexicographic), chuẩn hóa Unicode NFC, cấm số thực float/NaN/Infinity.
  - Geometry Ordinal Sort: Sắp xếp module theo `(cell.y, cell.x, catalogId, orientation)`. Remap module IDs sang `mod:0, mod:1...` và đồng bộ Brain references.
  - Bộ kiểm định tĩnh (`validateBotDefinition`): Kiểm tra Core 2x2, max 24 module, giới hạn ngân sách 100 điểm, liên thông BFS tới Core, bán kính bao <= 6500 milli-units, số lượng vũ khí/khiên/động cơ.
- **`@nextgame/content`:**
  - Danh mục `alpha-0` (`catalog.ts`): Thông số Core, Thruster, Armor, Blade, Burst, Shield, Radiator, Capacitor (Lance và Breaker đánh dấu `enabledInSlice: false`).
  - 1,225 Arena Presets (`arenaInit.ts`): Sinh toàn bộ 1,225 cấu hình Cartesian `(yLeft, yRight, jitterLeft, jitterRight)` và hàm `deriveScenarioFromSeed(seedBytes)` với công thức `firstUint32LE(SHA256(seed || "open-alpha-init-v1")) mod 1225`.
  - 6 Reference Archetypes (`referenceBots.ts`): Mantis, Bastion, Kestrel, Ram, Wisp, Chimera.

### T03 — Compiler và Brain VM
- **`@nextgame/brain` Compiler:**
  - Kiểm tra giới hạn AST: <= 2048 nút AST, độ sâu biểu thức <= 16, <= 32 trạng thái, <= 32 quy tắc/trạng thái, <= 64 biến nhớ.
  - Kiểm định logic FSM: Kiểm tra tồn tại của `initialState`, phát hiện `unknownNextState`.
- **`@nextgame/brain` Deterministic Runtime (BrainVM):**
  - Số học số nguyên thuần túy (Pure Integer Arithmetic) với `BigInt` trung gian cho phép nhân và chia, bão hòa int32 (`-2^31..2^31-1`), cắt phần thập phân về 0.
  - Xử lý lỗi chia cho 0: Sinh lỗi `divZeroFault`, zero-out thrust/turn/intents.
  - Bắt lỗi clamp: Khi `min > max`, sinh `clampFault`.
  - Đo lường Gas (Gas Metering): Ngưỡng trần cứng **4096 gas/decision**. Vượt quá 4096 lập tức kích hoạt `gasFault`.
  - Đánh giá Short-circuit: `all` dừng ngay khi gặp điều kiện `false`, `any` dừng ngay khi gặp điều kiện `true` (không kích hoạt lỗi của nhánh chưa duyệt).
  - Snapshot và đồng bộ biến: Đọc snapshot biến ở đầu quyết định, commit đồng thời toàn bộ `pendingWrites` ở cuối quyết định.
  - Fault Streak Tracker: Tăng streak khi gặp lỗi, reset về 0 khi có quyết định hợp lệ, ghi nhận ngưỡng 10 lỗi liên tiếp.

---

## 2. Bằng chứng Kiểm thử (Test Evidence)

### 2.1 Kiểm tra kiểu TypeScript (Typecheck)
Lệnh thực thi:
```bash
pnpm check
```
Kết quả (Exit Code: 0):
```text
> Nextgame@1.0.0 check H:\Nextgame
> tsc -b --noEmit
```

### 2.2 Bộ kiểm thử đơn vị Vitest (Unit Tests)
Lệnh thực thi:
```bash
pnpm test
```
Kết quả (Exit Code: 0, 36/36 passed):
```text
 RUN  v5.0.3 H:/Nextgame

 ✓ packages/brain/test/compiler.test.ts (6 tests) 7ms
 ✓ packages/brain/test/runtime.test.ts (7 tests) 12ms
 ✓ packages/contracts/test/canonical.test.ts (9 tests) 18ms
 ✓ packages/contracts/test/validation.test.ts (10 tests) 11ms
 ✓ packages/content/test/arenaInit.test.ts (4 tests) 62ms

 Test Files  5 passed (5)
      Tests  36 passed (36)
   Start at  14:32:52
   Duration  405ms
```

### 2.3 Biên dịch toàn bộ Monorepo và Web App (Build)
Lệnh thực thi:
```bash
pnpm build
```
Kết quả (Exit Code: 0):
```text
> Nextgame@1.0.0 build H:\Nextgame
> tsc -b && vite build

vite v8.3.1 building client environment for production...
transforming...
✓ 1910 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   1.27 kB │ gzip:   0.70 kB
dist/assets/index-DnGXictv.css   37.27 kB │ gzip:   7.12 kB
dist/assets/index-CEY7e9oa.js   366.11 kB │ gzip: 107.37 kB
✓ built in 399ms
```

---

## 3. Tiêu chí Đạt chuẩn Gate G0 (Gate Acceptance Checklist)

| Tiêu chuẩn bắt buộc Gate G0 | Trạng thái | Minh chứng |
|---|---|---|
| **Type/lint/boundaries** | **PASS** | `tsc -b --noEmit` hoàn thành sạch 100%, không cảnh báo, ranh giới packages rõ ràng. |
| **Positive/negative schemas** | **PASS** | 10 vector kiểm thử pass: 6 bot hợp lệ, bot thiếu core, trùng core, chồng ô, rời rạc, quá giá trị ngân sách, quá số module, quá bán kính bao, quá số vũ khí, quá số khiên. |
| **Canonical parity & zero-I/O** | **PASS** | Thử nghiệm hash SHA-256 độc lập, đảo thứ tự module, NFC/NFD tiếng Việt ("Chiến"), bẫy duplicate keys, bẫy `__proto__`. |
| **1,225 Arena Presets** | **PASS** | Sinh đủ 1,225 cấu hình duy nhất, giải thuật băm seed ra scenarioId xác định. |
| **IR semantics & Gas ceiling** | **PASS** | Ngưỡng gas 4096 vs 4097, lỗi chia 0, clamp lỗi, ngắt ngắn mạch (short-circuit), snapshot biến đồng thời, đếm chuỗi lỗi 10 liên tiếp. |
| **UI Demo khả dụng** | **PASS** | Giao diện React 19 tại `apps/web/` vẫn khởi chạy và build thành công. |

---

## 4. Sẵn sàng cho Mốc tiếp theo
- Mốc tiếp theo: **G1 — Combat proof** (Tickets T04–T06: Simulation spatial/motion deterministic, CCD, Combat slice, Replay and CLI).
