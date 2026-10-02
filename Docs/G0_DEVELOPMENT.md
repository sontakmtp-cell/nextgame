# Chạy và kiểm tra G0

G0 triển khai nền T01–T03; chưa có trận đấu, Workshop, OAuth hoặc Ranked. Kiến trúc theo 04/D05: React DOM và mô phỏng thuần TypeScript; Pixi sẽ tích hợp ở T08. Game Studio được dùng cho ranh giới simulation/render/UI, không đổi sang Phaser.

Máy cần Node **24.18.0**, pnpm **10.34.6**, Docker Engine Linux/Compose. Windows dùng PowerShell. Nếu pnpm mặc định khác bản hoặc dùng Node riêng (như shim của Codex), dùng `npx --yes pnpm@10.34.6` thay cho `pnpm` trong các lệnh dưới đây; không cần đổi cài đặt toàn máy.

```powershell
npx --yes pnpm@10.34.6 install --frozen-lockfile
npx --yes pnpm@10.34.6 env:init
docker compose build minio
docker compose up -d --wait
npx --yes pnpm@10.34.6 db:migrate
npx --yes pnpm@10.34.6 dev
```

Mở `http://127.0.0.1:5173`. API health ở `/api/health`, readiness `/api/ready` kiểm tra DB và MinIO thật. `Ctrl+C` dừng hai tiến trình của `dev`. `docker compose stop`/`start` chỉ thao tác services của dự án này; `docker compose down` giữ dữ liệu trong volumes. Không dùng `down -v` nếu muốn giữ DB.

`env:init` tạo `.env` bị Git bỏ qua, bằng credentials ngẫu nhiên và không ghi chúng ra log; file đang có được giữ. `.env.example` chỉ có tên và giá trị không bí mật. Ports DB 15432, object API 19000, console 19001 đều bind loopback. API 3001 và web 5173 không được dùng đồng thời bởi phiên khác.

```powershell
pnpm build
pnpm check
pnpm test:unit
pnpm test:e2e
node apps/cli/dist/index.js validate Docs/examples/mantis.bot.json
pnpm test:linux
```

`test:unit` build packages rồi chạy Vitest; tests dùng đúng public JS/types được bàn giao. `check` gồm strict TS (cả tests), cấm import vượt package, cycles, Node/I/O/thời gian/ngẫu nhiên trong packages thuần, và explicit `any`. `test:e2e` hiện là **smoke HTTP local**, kiểm API/DB/object/proxy và stop/restart hai lượt. Đây chưa phải end-to-end gameplay. CI có Linux clean install/build/check/tests/local services và Windows CLI matrix; cần remote repository để chạy GitHub CI.

Contracts JSON Schema 2020-12 ở `packages/contracts/schemas/`; public TS/API ở `packages/contracts/src/index.ts`. Content/catalog, LUT đã sinh offline, 1.225 presets, sáu Body kits dự kiến, suite 100 tuning/200 holdout ở `packages/content/`. Bastion/Ram/Wisp chứa Lance/Breaker nên chỉ validate với full planned catalog; không được vào slice hiện tại. Brains của kits là idle fixtures, chưa có bằng chứng balance/counterplay. Suite local có version+digest, **chưa ký release**; khóa/signature official thuộc pipeline T14.

```powershell
pnpm contracts:freeze
node scripts/parity-vectors.mjs
pnpm test:unit
pnpm test:browser
```

Freeze ghi digests của schemas/catalog/ruleset/LUT/arena/compiler và regenerate data. Compiler digest bao gồm nguồn brain+contracts để thay đổi dependency không giữ sai identity. Sau freeze phải regenerate parity vectors và chạy checks; không sửa manifest bằng tay. `test:browser` phục vụ riêng `http://127.0.0.1:5174` với 40 shared vectors; trang tự đối chiếu hash bằng WebCrypto và compiler trong browser. Harness này không vào bundle web chính. Node/Linux dùng cùng golden vectors trong `tests/parity.test.ts`.

Compiler/VM API: `compile(source, modules)` → normalized IR, symbolMap, sourceMap và compiler digest; `initialVM(compiled)`; `decide(compiled, previous, sensorMap, modulesSortedByGeometry)` → atomic intent/state/trace fields. Engine phải truyền cùng snapshot đầu tick, modules theo geometry ordinal, dùng `heldIntent(state)` giữa các decision ticks và reset VM mỗi leg. Chỉ engine T05 xử lý resource availability/upkeep/cooldown/damage; VM trả events đã sort, không tự tiêu energy.

Sandbox compile mẫu:

```powershell
pnpm build
docker build -f dev/brain.Dockerfile -t nextgame-brain:g0 .
pnpm compile:sandbox Docs/examples/mantis.bot.json
```

Container unprivileged, filesystem read-only, network none, 1 CPU, 256 MiB RAM, 64 PIDs, drop capabilities. Supervisor bắt đầu deadline **2 giây** sau `READY`, bao gồm đọc input/parse/validate/compile; startup có cap riêng 10 giây. Timeout/process failure là infraFailure; không gán thua bot. CLI offline `validate` không cần Docker/network; full isolation của simulation jobs là T10.

Trong snapshot G0, `test:sim` và `verify:replay` là deferred exit1. Checkout hiện có đã thay chúng bằng G1 checks; xem [G1 Development](G1_DEVELOPMENT.md) và G1 report cho trạng thái hiện tại, không thay đổi evidence G0 lịch sử. `test:e2e` sẽ mở rộng ở T07. Không cài MCP SDK/auth/extensions ở G0: plan pin server2.2.0/fastify adapter2.0.0 đã kiểm metadata/peers, không trộn SDK1; thực thi/wire/AI host QA ở T11.

MinIO local được build từ [release nguồn chính thức](https://github.com/minio/minio/releases/tag/RELEASE.2025-10-15T17-29-55Z), khóa archive SHA256 và base image digests. Hai image registry cũ đã pull fail; không dùng image giả. Lần build đầu tải Go dependencies nên chậm hơn; đây là setup local, không deployment production.

Các bằng chứng theo snapshot revision nằm trong `deliverables/implementation/T01`, `T02`, `T03`. Workspace đầu vào không có `.git`; snapshot digest thay git revision và liệt kê từng file, không invent commit/CI result.
