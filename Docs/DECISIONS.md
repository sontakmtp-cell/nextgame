# Sổ quyết định kiến trúc và thiết kế

**Baseline v2:**01/10/2026. Quyết định `accepted-for-prototype` đã được chọn trong quyền tái thiết kế người dùng; không có kết quả gameplay/benchmark để gắn validated. Thay đổi cần ADR nối tiếp, không xóa lý do cũ.

| ADR | Quyết định | Phương án bỏ / tradeoff | Gate hoặc trigger xét lại |
|---|---|---|---|
| D01 | Modular square grid, core riêng, active weapons | RPS triangle/contact dễ prototype nhưng hạn chế creative mechanics; mesh tùy ý quá khó validate | G1counterplay,G4shape diversity |
| D02 |60 Hz sim /10Hz Brain, telegraph≥300 ms ở slice |30 Hz visual nội suy vẫn được nhưng60Hz CCD/timing tốt hơn;60 Hz Brain tốn CPU và mờ lựa chọn | T04/T10 compute và T08 cảm giác |
| D03 | Typed FSM DSL+compiled skills | Arbitrary JS/ranked sandbox tăng attack surface; FSMv1 move/turn hẹp |3 same-body Brain pairs; thiếu sensor/operator tạo ABI ADR |
| D04 | Deterministic TS core, integer intermediates | Rust/WASM tối ưu nhưng tăng compiler/cross-platform burden | p95fullleg>5s sau profiling→WASM spike parity |
| D05 | React DOM + PixiJS8 renderer | Canvas2Ddebug giữ; Phaser loop trùng custom sim; Unity/Godot export lớn và integration khó | low-tier readability/frame budget/mobile |
| D06 | Node modular application +PG +object +isolated worker | VPS SQLite đơn giản demo nhưng locks/jobs/rating data cần transactions chuẩn; Workers/D1 không CPU sim authority | DB contention/job throughput measured→queue adapter,không split sớm |
| D07 | Private Brain, public pose replay + signed result | Full public re-sim cần source nên conflict privacy; public hash không giải điều đó | Privacy projection and audited exact verifier |
| D08 | Two preset-slot counterbalanced legs/one series rating | One match tiết kiệm compute nhưng spawn bias; bo3 dễ xem nhưng third leg lệch sampling | Side-swap symmetry+series wait/cost |
| D09 | Center objective +late ring +fixed score | Ép sandbox dummy melee giết turret/kiter; damage-only score khuyến khích farm | Ablation/endgame strategy metrics |
| D10 | Elo alpha with pairK zero-sum | Glicko2 tốt uncertainty nhưng complexity chưa cần dữ liệu; package MMR reset dễ smurf | Stable population and need inactivity uncertainty |
| D11 | Modern MCP2 +isolated optional Apps bridge | SDKv1 app deps không cast vào server2; host legacy cần verified separate adapter | Wire2026 actual+named host matrix |
| D12 | Human web intent cho ranked package | OAuth scope/AI confirmation không đủ quyết định công bố+thi đấu | Forgery/expiry/consume race gates |
| D13 | Same-origin auth/API and explicit scopes | Cross-site cookie reliability kém; custom OAuth too risky | T09provider spike+actual OAuth host |
| D14 | Reviewed versioned mechanics registry | User can creative logic freely; custom mechanics không nhận arbitrary code ranked | Laboratory→sandbox/balance/security→season promotion |
| D15 | Prototype Blade/Burst/Shield before full5 active modules | Full catalog early tăng variables trước biết core vui | G1fun; Lance/Breaker T13 mandatory alpha |

## Giả thuyết chưa kiểm chứng

Module ngân sách100/max24 có đủ độ tự do; energy/heat không trùng ý nghĩa; ring không lấn át positional play; frame/readability trên mobile đủ; counterbalanced cost acceptable; low-pop queue24h đủ người đấu; khách hàng muốn tinh chỉnh Brain thay vì chỉ xem AI chơi; palette/material06 đủ khác biệt. Mỗi giả thuyết có gate01/02/08/09 hoặc experiment; không suy “AAA” bằng adjectives.

## Giới hạn đã chọn

Alpha không multi-body/drone, không arbitrary code, không realtime ranked control/MCP sampling, không skins ảnh hưởng collider, không cosmetics shop trước retention, không fake live. Các giới hạn này tạo đường triển khai nhỏ có thể chứng minh, không thay bốn yêu cầu cốt lõi. Khi mở rộng, update sources+contract+fixtures+registry/season policy đồng bộ.

## D16 — Freeze nền G0

Node24.18.0/pnpm10.34.6/TS5.9.3/Fastify5.12.5/React19.3.0/Vite8.3.2/Ajv8.20.0/Vitest5.0.3 được pin exact trong manifests/lockfile, dựa trên installed runtime và publisher registry đã kiểm. Giữ D05: không thêm Phaser hoặc renderer trước T08. MCP peer plan giữ server2.2.0 + Fastify adapter2.0.0 (peer Fastify^5.2.0/server^2.0.0); chúng chưa cài ở G0 và không có host integration claim.

Chốt DSL skill/state parameters và nested DAG theo03; đây là làm rõ cú pháp thiếu trong baseline, không thêm sensor/action vào alpha. Canonical IR dùng ordinals và source maps ngoài gameplay hash. Compiler identity hash cả nguồn contracts dependencies. Registry body kits đầy đủ được giữ dưới dạng planned fixtures; catalog active vẫn không bật Lance/Breaker trướcT13.

MinIO image cũ pull không được; local compose build release nguồn chính thức2025-10-15 với SHA256 archive/base image digests, thay đường lấy binary, không thay object-storage contract. G0 không dùng domain/credentials/deployment lịch sử. Snapshot revision dùng khi workspace chưa có Git; remote CI/production/load gates không được coi đã chạy.

## Làm rõ D08 sau QA

Với 1.225 preset khởi tạo của tài liệu 02, leg thứ hai đổi hai bot vào hai pose slots cố định, giữ tọa độ y và heading jitter của từng slot. Không xoay thêm toàn bộ arena. Phép xoay toàn bộ thế giới 180° trong sân đối xứng tạo trận tương đương, nên chỉ dùng làm metamorphic fixture để kiểm tra engine. Series vẫn là BO2; cách gán slot được khóa trước khi triển khai.
