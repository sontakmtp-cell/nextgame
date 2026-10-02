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

## D17 — G1 spatial fixtures trước damage

T04 dùng continuous separating-axis sweep trên từng ô, normals từ heading LUT, thời gian nguyên scale 1.000.000. Integer corner truncation và heading normals là numeric fixture prototype: sweep theo các projected intervals, có thể conservative sát biên milli; không tuyên bố analytic exact polygon TOI. Rotation dùng conservative inflation `ceil(lockedRadius × abs(deltaHeading) × 7 / 4096)`, chặn trước mọi vertex arc (7 > 2π); không thay sang float physics. Bốn lượt solver cố định; mọi contact cùng TOI được phản hồi, inelastic normal impulse chia theo locked mass, giữ tangent. Remainder theo pose geometry, không nhãn A/B. Nếu không giải hết hoặc final overlap/tường, giữ pose đã kiểm/pose trước tick và emit `collisionFallback`.

**Giới hạn prototype có chủ ý:** inflation có thể dừng rotation sớm khi hai thân rất sát nhau; initial exact overlap không có hướng hình học duy nhất thì freeze đối xứng. Không gọi đây là exact curved rotational TOI. Fixtures phải bao gồm body tốc độ cao, góc tường, rotation gần ô, nhiều contact, overlap và half-turn/relabel/rename trước triển khai damage. Nếu playtest thấy thân kẹt, thay inflation bằng bounded angular conservative advancement với cùng fixtures+engine digest mới; không tăng solver iterations tùy máy. Gate T04 cần ghi riêng giới hạn này.

## D18 — G1 weapon sweep và replay codec

Burst point-projectile (alpha-0 chưa định nghĩa radius cho Burst) dùng slab CCD trong frame tương đối của từng ô, gồm chuyển động thân cùng tick; rotation inflation theo D17. Blade clip convex cell bằng wedge 90° và kiểm integer segment-circle; sweep thứ tự thời gian bằng pose interpolation theo lattice tối đa một milli-unit vertex travel, cap1024 samples/tick (vượt là infraFailure). Earliest lattice contact, rồi khoảng cách muzzle và geometry ordinal; không hit lại cùng activation. Đây là numeric fixture prototype, không tuyên bố analytic curved TOI: tiếp xúc grazing dưới một milli-unit còn là giới hạn cần xác minh trước T04/T05 signoff chính thức.

Replay PCG1 v2 có version + uint32/int32 little-endian words, index60 ticks/chunk, typed projection chỉ pose/HP/phase/public events. Immutable Body metadata được ghi một lần/chunk, dynamic state vẫn có mỗi boundary: full90s hai Body21 modules hợp lệ không vượt8MiB. Prototype v1 lặp metadata mỗi frame đã fail capacity fixture và bị thay trước bàn giao; không có official v1 release. Gzip chỉ ở CLI storage adapter (stdlib Node); browser giải bằng DecompressionStream khi cần. Không thêm compression dependency/zstd trước đo. Public decoder reject tràn quota/truncation/unknown version/field/out-of-range/trailing bytes; envelope hash khóa match+index+result. Chưa ký official release/result trước T14: tất cả G1 artifacts phải ghi local/unofficial. Checkpoint suffix proof dùng restore từng đoạn đến checkpoint kế và equality nối tiếp tới final, không chạy O(n²) suffix đầy đủ cho mọi checkpoint.

Checkpoint chứa toàn bộ mutable simulation/VM state, không lặp compiled IR trong mỗi file: code được deep-freeze, chia sẻ chỉ phần immutable trong RAM và lưu source một lần trong private inputs. MatchManifest package/compiler hashes khóa code; full verifier tái compile nguồn đã bind, so snapshot với trusted resimulation trước restore. Hai Brain64 variables/1.836 IR nodes từng vượt canonical cap khi lặp IR; regression kiểm hai bot lớn, alias mutable độc lập, private file256KiB/leg16MiB và full verify. Simulation hash dùng dynamic checkpoint + manifest bindings; parity harness tái dựng hash trước thay đổi để kiểm gameplay không drift.

## D19 — T04 profile và projection cache

Stress Body17 module/98 points, Brain64 variables/1.836 IR nodes bộc lộ lặp corner rotation và dot products trong mỗi cell pair. Cache **trong một solver pass** vertices/projected intervals, dùng lại cho pairs và wall checks; không cache state xuyên tick, không đổi normal/TOI/order/iterations. Broadphase AABB thêm thử nghiệm đã bị loại vì thay đổi kết quả scenario10 dưới numeric truncation của D17. Final corpus phải so toàn bộ final gameplay state với bản trước (chuẩn hóa duy nhất engine digest trong parity harness), rồi Windows/Linux/browser trên engine digest mới. Không coi hash cũ là bằng chứng bản mới.

Hash riêng full ordered combat events bổ sung cho final simulation state hash trong1.000 differential rows và100 browser rows. Profile serial12 samples mới phải ghi cạnh profile trước, chỉ sampled RSS/heap/serialized VM; chưa là bound chứng minh peak native interpreter hoặc T10 OS isolation. Nếu profile tối ưu vẫn không đạt mục tiêu5s, dùng D04 WASM spike; không thay float physics/giảm checks để chữa throughput.
