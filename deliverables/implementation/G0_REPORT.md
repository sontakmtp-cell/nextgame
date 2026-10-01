# G0 — bàn giao T01–T03

**Ngày:** 2026-10-02 00:19:53 (Asia/Saigon).

**Revision:** snapshot SHA256 `ec3d604f21905e5ccadc8372864a75fbe2453ac48ad8daec34aa982de621419f`. Workspace ban đầu không có `.git`; không invent commit/PR/remote CI. [Inventory với hash từng file](T01/ec3d604f21905e5c/snapshot.json) có 110 files nguồn/config/docs/fixtures. Generated build outputs và evidence nằm ngoài snapshot.

**Kết quả:** gates G0 đã chạy qua trên revision này. T01 workspace local; T02 contracts/content/hash; T03 compiler/VM được bàn giao. Đây chưa là combat proof, game hoàn chỉnh, fun/balance gate hay alpha launch. Next dependent ticket: **T04**.

| Gate | Kết quả thực chạy | Evidence |
|---|---|---|
| Frozen install + strict references + build | Windows và clean Linux container, exit0 | [Windows](T01/ec3d604f21905e5c/build.json), [Linux toàn pipeline](T01/ec3d604f21905e5c/linux-clean.json) |
| Lint/boundaries/cycles/no host I/O | check exit0; injected Node I/O/clock/cross-package import bị reject | [Check](T01/ec3d604f21905e5c/check.json), [negative selfcheck](T01/ec3d604f21905e5c/boundary-negative.json) |
| Contracts/Brain positive/negative | **134 tests pass trên Windows và Linux**;4 files Vitest5.0.3 | [Windows unit log](T03/ec3d604f21905e5c/unit.json), Linux pipeline phía trên |
| Canonical bytes/package hash |40 golden vectors gồm32 bot packages +8 byte vectors khớp Node/Windows/Linux/Chrome154 | [Browser result](T02/ec3d604f21905e5c/browser-parity.json), [screenshot](T02/ec3d604f21905e5c/browser-parity.png) |
| Local API/web/readiness | API+Vite+proxy; real PG/MinIO ready; start/stop/restart2 lượt | [Smoke](T01/ec3d604f21905e5c/smoke-restart.json) |
| DB empty/repeat/no drift | DB tạm trống → migration → repeat; schema/rows giữ nguyên; sửa digest bị reject exit3 expected; DB tạm đã xóa | [Commands/SQL/exits](T01/ec3d604f21905e5c/migration-empty-repeat.json), [runnable check](T01/ec3d604f21905e5c/migration-empty-repeat.mjs) |
| Compile sandbox | Mẫu72 points/42 IR nodes; input sai schema bị reject; uid nonroot/read-only/network none/no credentials/no capabilities thực kiểm; cleanup containers pass | [Sandbox positive/negative/guards](T03/ec3d604f21905e5c/sandbox-positive-negative-guards.json) |
| Service lifecycle | Postgres/MinIO stop/start healthy/stop; volume dữ liệu giữ | [Restart](T01/ec3d604f21905e5c/service-restart.json), [stop](T01/ec3d604f21905e5c/service-finish-stop.json) |
| Windows CLI CI | Ubuntu/Windows matrix và CLI cấu hình; **remote CI unrun** | [Workflow](../../.github/workflows/g0.yml) |

Source of truth/setup: [G0 Development](../../Docs/G0_DEVELOPMENT.md). Exact Node24.18.0/pnpm10.34.6 và dependencies trong manifests + frozen lockfile. Node mặc định PowerShell đúng24.18.0; pnpm shim của Codex dùng Node24.19.0/pnpm11.25.0 nên không dùng shim để install; hướng dẫn dùng npx pnpm10 giữ môi trường toàn máy. [MCP peer metadata đã kiểm](T01/ec3d604f21905e5c/mcp-peer-plan.json); chưa cài SDK/auth/extensions trước T11.

T02 có15 JSON Schemas2020-12 + strict TS types/API, duplicate/poison/unknown-field/type/byte/nesting caps, Body budget/overlap/connectivity/core/radius/catalog/ranked checks, encoder NFC-key sort+SHA256. Fixture Mantis gốc đã validate (72 points,37 mass); không sửa fixture để pass. Content có catalog alpha-0, offline LUT4096, units,1225 lexicographic presets,128-bit seed→scenario mapping và suite100 tuning/200 holdout với300 distinct/disjoint scenario IDs. Sáu planned Body kits được kiểm với full catalog; Lance/Breaker vẫn disabled trong slice.

[Content/schema/compiler manifest](T02/ec3d604f21905e5c/content-manifest.json), [suite manifest](T02/ec3d604f21905e5c/suite.json). Compiler digest `2fafc70e15f577f697c4224d00da9a5c1e353ee43815e965b8a869ae3c4983ee`; catalog `d8fe55474692a49ed5daa6d7dac62f635630a9e447a85ba683c0765bf535885d`; ruleset `19ef0b984d12a34796ea2058bb9971421674671fd4cc76b8cf694e80f03d2f14`. Source/symbol maps nằm ngoài gameplay hash; metadata/presentation riêng; rule order vẫn có nghĩa.

T03 có typed expressions/all opcodes/all sensors, FSM priority+next-decision transitions, snapshot simultaneous writes, bounded hygienic skill DAG/inlining, source maps/pointers, gas/short circuit/saturating int32+BigInt arithmetic, div0/clamp fault rollback,10 consecutive fault flag, geometry-order module events, aim limits/rejections, held movement với activation edges riêng. VM4096/4097 stress deliberately bypass compiler2048 cap để kiểm fence độc lập, không cấp phép oversized package. Compiler preflight/source/IR/depth/edges/work caps thực có negative tests. Sandbox supervisor deadline2s sauREADY, startup10s; process timeout là infraFailure.

**Phần không chạy/giới hạn cần giữ rõ:**

- GitHub hosted CI chưa chạy; Linux container clean install/build/check/tests/CLI đã chạy thật, không dùng nó giả danh GitHub run. Không có git commit/push/deploy.
- G1 engine/collision/resources/cooldown/shield/weapon/draw/outcome/replay chưa tồn tại. VM chỉ tạo/sort intents; T05 phải xử lý resource availability và policy. test:sim/verify:replay exit1 deferred, không pass giả.
- reference kit Brains là idle schema fixtures; chưa có archetype balance, adaptive match improvements, confidence computation hay statistical proof. Experiment confidence DTO dùng đơn vị explicit; analysis ở T10/T13.
- Suite local versioned+digest, chưa ký official release; signed release provenance T14. Contracts/auth/Ratings schemas không tạo quyền hay results authority.
- Enforced process256MiB là budget khác interpreter256KiB. VM state/inputs/depth được cap cấu trúc; chưa benchmark peak native heap của mọi full-leg/max-complexity VM trên các browser. Capacity/performance proof phải ghi riêng ở T04/T10, không suy từ sample RSS của compile process.
- Deadline2s đã cấu hình và compile mẫu chạy trong guard; chưa fault-inject timeout/OS OOM. Full simulation job isolation/fencing/retry/crash matrix ở T10.
- Browser đã chạy HeadlessChrome154 trên Windows; Firefox/Safari/mobile/AI host/UI/game playtest chưa chạy. No art/audio/render/fun gate claim.
- MinIO image cũ Quay/DockerHub pull fail; đã chuyển build từ archive nguồn official2025-10-15 khóa SHA256+base digests, thực build/start/check. Sandbox image ban đầu thiếu Ajv do filter install; đã fix included contracts và reverify. Test fixture cost expectation và stress parse/class identity lỗi ở lượt đầu đã sửa và verify; chỉ logs revision hiện tại là evidence bàn giao.

Dọn trạng thái cuối: services dự án và temporary compiler containers đã dừng/cleanup; volumes local/.env được giữ, credentials không in vào evidence. Các containers TrendRadar có trước vẫn chạy; không thao tác chúng.
