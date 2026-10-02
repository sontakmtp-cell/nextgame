# G1 — chạy combat proof local

G1 có engine headless TypeScript, Blade/Burst/Shield, ba archetype Mantis/Bastion-lite/Kestrel, hai Brain variants mỗi Body, replay public/private và CLI offline. Đây là prototype số nguyên theo D17/D18, chưa phải Workshop/Brain Lab/art G2 hoặc ranked. Báo cáo gate thực chạy ở [G1_REPORT](../deliverables/implementation/G1_REPORT.md); thử độ vui phải có người thật, không suy từ test tự động.

Node **24.18.0**, pnpm **10.34.6** như G0. Không cần bật Postgres/MinIO để chạy G1:

```powershell
npx --yes pnpm@10.34.6 install --frozen-lockfile
npx --yes pnpm@10.34.6 build
npx --yes pnpm@10.34.6 test:g1:browser
```

Mở `http://127.0.0.1:5175`, chọn bot/Brain → **Tính trận** → **Phát lại** hoặc kéo timeline. Trận tính trong Web Worker; main thread chỉ xem pose công khai. Space phát/dừng khi focus ngoài form; Home về đầu. Đây là Canvas2D debug, ô là collider; viền vàng là windup, cung sáng là Blade active, cung tím là Shield. Chưa có art/audio/G2 UX. Ctrl+C dừng đúng server G1 đang chạy.

```powershell
node apps/cli/dist/index.js validate packages/content/data/g1/Mantis.bot.json
node apps/cli/dist/index.js simulate packages/content/data/g1/Mantis.bot.json packages/content/data/g1/Kestrel.bot.json output/my-first-match
node apps/cli/dist/index.js verify output/my-first-match
node apps/cli/dist/index.js verify output/my-first-match --full
node apps/cli/dist/index.js seek output/my-first-match 120
```

Output directory cuối phải **chưa tồn tại**; CLI không ghi đè trận cũ. Seed128 tùy chọn sau directory, dùng 32 ký tự hex lowercase. Thêm `--swap` đổi hai Body vào các spawn slots cố định (BO2), không xoay cả arena. Các lệnh trả exit1 khi input/binding/integrity sai.

Archive gồm `manifest.json` + `chunk-*.bin.gz` công khai; `private/` có hai Bot sources đã được chủ dữ liệu cho phép, VM/resources/remainders, checkpoint và decision trace. Không chia sẻ `private/`. Mọi archive ghi **local/unofficial, unsigned**. Public verify kiểm integrity/index/pose continuity; `--full` có cả nguồn mới tái mô phỏng, kiểm version/seed bindings, từng checkpoint interval và final hashes. Chưa có official signature/ACL service trước các giai đoạn sau.

PCG1 v2 codec typed binary little-endian: Body metadata một lần/chunk, full dynamic state mỗi frame; gzip Node stdlib ở storage adapter. Public decoder không có trường Brain/variables/intents/private energy. Chunks60 ticks, initial boundary0, committed boundaryN sau tickN−1. Pose seek không chạy lại Brain địch. Private checkpoint mỗi60 ticks; nối các đoạn restore tới checkpoint tiếp theo chứng minh mọi suffix tới cùng final, tránh kiểm O(n²).

Checkpoint chỉ ghi mutable state; mã Brain immutable được lưu một lần trong hai private inputs và khóa bằng package/compiler hashes. Khi sửa engine/freeze, restart đúng server G1 rồi mở worker mới trước đối chiếu; watcher có thể giữ module cũ, engine digest hiển thị mới riêng lẻ chưa đủ chứng minh đã nạp toàn bộ mã mới.

```powershell
node apps/cli/dist/index.js experiment packages/content/data/g1/Mantis.passive.bot.json packages/content/data/g1/Mantis.bot.json packages/content/data/g1/Kestrel.bot.json
npx --yes pnpm@10.34.6 check
npx --yes pnpm@10.34.6 test:unit
npx --yes pnpm@10.34.6 test:sim
npx --yes pnpm@10.34.6 verify:replay
node scripts/g1-corpus.mjs --compare tests/g1/corpus.json --out output/windows-corpus.json
node scripts/g1-linux.mjs output/linux-g1-new
```

Experiment mặc định10 tuning scenarios, cả hai slot, mean paired score; confidence cố ý `null`, không phải chứng minh cải tiến/cân bằng. Có thể truyền file JSON array seed128 cuối lệnh; repeated scenario IDs bị từ chối. Không dùng corpus determinism làm sample balance/holdout.

`test:sim` chạy fixtures spatial/combat và10 golden scenarios. Corpus full là1.000 scenario IDs khác nhau, cùng engine/version/package bindings trên Windows/Linux; browser có100 representative rows trải trên corpus. Seed/result/hash manifest ở `tests/g1/corpus.json`, browser subset ở `tests/g1-browser/corpus.json`. Nút **Kiểm tra100 seed** chạy engine thật trong browser worker; lỗi hiện rõ. Firefox/Safari chưa được suy là đạt từ Chrome.

`scripts/g1-fixtures.mjs <new-root>` tạo9 archives (3 archetype ×3 seeds) và full verify từng archive. `scripts/g1-behavior.mjs` ghi same-Body paired action traces/results. `scripts/g1-profile.mjs` đo serial sample, gồm Body17 module/98 points và Brain64 variables/1.836 IR nodes; sampled heap/RSS/serialized VM không chứng minh peak native interpreter≤256KiB hay OS process isolation.

Engine nguồn luật 02; không bật Lance/Breaker. Trước sửa gameplay: cập nhật ADR/fixtures khi cần, build → `contracts:freeze` nếu shared contracts/Brain đổi → regenerate `scripts/parity-vectors.mjs` → `engine:freeze` → tạo lại corpus bằng `node scripts/g1-corpus.mjs --count 1000 --write tests/g1/corpus.json` → Windows/Linux/browser verification. Không sửa hash/golden bằng tay để che regression.

Giới hạn cần giữ: conservative rotation có thể dừng sớm khi sát thân; Blade TOI trên milli-lattice, chưa analytic curved/grazing proof. Fun/readability/balance/OS isolation và toàn bộ G2–G4 gates chưa được chứng minh chỉ bởi G1 prototype.
