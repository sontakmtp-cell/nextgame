# U3D-05 — My Synths và thumbnail

Ngày bàn giao: 08/10/2026 (Asia/Saigon). **Đã triển khai chức năng; ticket CHƯA HOÀN TẤT nghiệm thu.** Cadence desktop High chưa đạt p95 ≤16,7 ms; chưa có thiết bị Android/GPU tích hợp và đánh giá mỹ thuật độc lập. Không đổi mặc định 2D hoặc đóng các gate G2/U3D-07.

## Checkout và phạm vi

Làm trên nhánh `remake-ui3d`, HEAD đầu vào `5ba0a7cddbc6e9fba7d002c856019736828a7dd1`. Checkout có thay đổi U3D-02/03/04 và các dữ liệu untracked trước khi bắt đầu. `baseline/snapshot.json` khóa SHA256 **5.011 file đầu vào** trước sửa ứng dụng; đối chiếu cuối tại `preservation.json`, `seal.json` và `final/snapshot.json` trong `deliverables/implementation/UI3D/U3D-05`. App đầu vào đúng SHA với recipe U3D-04: ticket thêm 22/bỏ 7 dòng trong App, phần Workshop/Arena/Brain có sẵn được giữ.

File sản phẩm được sửa/tạo:

- `apps/web/src/MySynths3D.tsx`, `mysynths3d.css`, `synth-thumbnail.ts`: thư viện ba cột, preview, lịch sử, hàng đợi và cache ảnh.
- `packages/renderer3d/src/SynthThumbnail.tsx`, thêm một export trong `index.ts`: một viewport dùng chung để dựng PNG Body-only.
- `apps/web/src/App.tsx`: lazy route/theme My Synths và callbacks mở/khôi phục với revision head hiện hành. `App-input.diff` đối chiếu với **App đúng SHA đầu vào**, không dùng toàn bộ diff so với HEAD để nhận công việc U3D-03/04 là của ticket này.
- `tests/synth-thumbnail.test.ts`, `scripts/u3d05-*`, báo cáo này và evidence/recipe U3D-05.

Không sửa engine, Brain, catalog/content, contracts, replay, worker/protocol, `useSynthSession`, `drafts.ts`, database schema, model/editing, Brain components/CSS, GLB/PNG nguồn, dependencies hoặc lockfile. Không commit, push, deploy hay mở profile browser của người dùng.

## Hành vi bàn giao

Trong chế độ `?presentation=3d`, Workshop/Arena dùng các implementation U3D-03/04 có sẵn; My Synths dùng cảnh 3D thật. Brain Lab giữ 2D pixel art. UI My Synths: danh sách bên trái, robot và camera ở giữa, lịch sử bên phải; mở/khôi phục/lưu ở thanh dưới. Danh sách dài cuộn riêng. Thanh hành động hiện đủ trong viewport PC 1600×1100 và 1920×1080. Tablet/mobile chuyển bố cục; robot không bị crop. CSS/font mới chỉ áp dụng màn My Synths 3D.

Chọn Synth/revision chỉ thay preview, không thay bot, Brain, metadata, undo, buffer JSON hoặc ghi database. Mở/khôi phục là hành động riêng, bị khóa khi draft/buffer chưa lưu, worker đang chạy hoặc đang lưu. Preview vẫn được phép khi draft chưa lưu. Cảnh báo beforeunload và nút export giữ nguyên draft hiện tại. Export không tự xóa trạng thái chưa lưu; phải lưu hoặc xử lý buffer trước khi mở/khôi phục.

Khôi phục lấy đầy đủ definition/giả thuyết/điểm yếu/parent của phiên bản đã chọn, gắn **ID Synth đã chọn và revision head hiện hành** để lần lưu tạo revision tiếp theo. Không ghi vào revision cũ. Hai tab tiếp tục dùng CAS của `saveDraft`: tab có revision cũ bị từ chối, nội dung đang sửa được giữ; có thể lưu thành Synth mới bằng ID mới. Nút làm mới đọc lại heads/history; không tự tải head mới vào draft.

Mất context thật: giữ lựa chọn Body và camera, remount viewport/cache khi khôi phục. Manifest/model/decoder lỗi hoặc WebGL không mở được: danh sách, lịch sử, lưu và chuyển 2D vẫn dùng được. CacheStorage bị từ chối dùng cache bộ nhớ có giới hạn. Lỗi đồ họa không được biến thành lỗi lưu Synth.

## Thumbnail và tài nguyên tái tạo

Cache key SHA256 gồm Body allowlist có thứ tự chuẩn, `assetRevision`, footprint catalog và recipe `synth-medium-256x192-ceramic-static-no-links-v2`. Không dùng tên Synth, Brain, ngày lưu, revision hay ghi chú làm key. Hai Synth có cùng Body dùng chung ảnh; đổi hình học/hướng, footprint hoặc asset revision đổi key.

Hàng đợi nối tiếp, gộp job trùng, snapshot Body lúc enqueue và hủy khi đóng màn. Tối đa **một canvas preview + một canvas thumbnail**, không canvas mỗi thẻ. PNG 256×192/DPR1, Medium, ánh sáng/sàn/góc camera chung, vật thể đứng yên. Thumbnail bỏ sét trang trí để hình nhỏ ổn định; preview thật giữ sét/lơ lửng U3D-02. Encode ngay sau render, đợi model graphs gắn vào scene; không chụp placeholder.

CacheStorage riêng `prompt-chien-synth-thumbnails-v1` và cache RAM giới hạn 128 ảnh. Không service worker, không đổi `prompt-chien-local` version **1**, không thêm/sửa stores `heads` / `revisions`. Nút **Dựng lại thumbnail** đợi queue cũ dừng, chỉ xóa cache này, tạo queue mới; không xóa Synth/lịch sử. Blob URLs được thu hồi khi thẻ đóng.

Reuse U3D-01 revision `2a1d71151d96c87b`: Meshopt/KTX2, decoder tự host, Medium trước rồi High của catalog ID đang dùng. Re-measure cả 30 model ở `assets.json`: tối đa **29.900 tam giác**, **2.472.712 byte/model**; source/model/texture/thumbnail/decoder hashes và texture dimensions kiểm lại. Không sinh hay copy GLB nguồn nặng vào runtime. Floor U3D-02 và hình học scene hiện có giữ nguyên.

Source recipe cuối ở `recipe/`; `seal.json` khóa source hash của working tree, không phải commit. Chạy browser script dựng fixture từ worker init templates trong context tạm, xuất `fixture.json`, PNG từng revision và `cold-*`/`rebuilt-*` của mỗi Body. `u3d05-profile` dựng fixture 24 module có provenance riêng: **render-only, vượt budget gameplay**, không dùng để chứng minh bot hợp lệ/balance. Muốn tái tạo LOD đã dùng xem `scripts/u3d01-build.mjs` và recipe U3D-01; ticket này không thay pipeline nguồn.

PNG có thể khác rất nhỏ giữa GPU/browser hoặc sau context rebuild. Kiểm tái tạo so key và pixel đã giải mã với ngưỡng ≤1/255 trên ≤0,1% pixel; ghi số khác thực trong browser report. Final Edge là 0 pixel khác; một lượt phát triển có 10/49.152 pixel lệch 1 mức màu. Không cam kết SHA PNG giống nhau giữa Chrome và Edge.

## Bằng chứng kiểm tra

- `final/commands` + `checks.json`: typing ứng dụng/test, boundaries + negative injection, **193 tests / 14 files**, corpus 10 seeds, build đều exit 0. Năm test thumbnail kiểm identity/invalidation, nối tiếp/dedup/cache, immutable snapshot, phục hồi lỗi và hủy ở cả render/cache lookup.
- `final/chrome/browser.json`: Brain Lab full screenshots 1600/1920 **byte-identical với baseline checkout**; simulation hash, replay hash, public frame hash, toàn bộ ordered events và result practice khớp chính xác. Source Brain/pixel CSS được bảo toàn; buffer Rule JSON giữ qua Brain → My Synths → Brain; không canvas trong Brain.
- `final/chrome/synths/browser.json` và `final/msedge/synths/browser.json`: production build thật, 11 nhóm kiểm tra/browser. Fixture 3 Synth/5 revision, 3 Body riêng; preview từng r1/r2/r3 khác nhau đúng dữ liệu. Export khi đang preview r1 vẫn là draft r3. Database byte/structure bằng đầu vào sau khi chỉ xem và dựng lại cache.
- Từ Kestrel khôi phục Mantis r1 → lưu Mantis r4; full definition đúng và r1–r3 giữ nguyên. Hai page/tab thực cùng revision: tab một lưu r5; tab hai bị CAS từ chối và giữ tên/nội dung chưa lưu; lưu thành Synth mới không ghi đè ID cũ.
- 1024/768/390/320: ảnh thật, không horizontal overflow; đây là desktop resize. PC High đã ready; có thêm ảnh đúng viewport và full page. Thumbnails có kích thước/bytes thật, cache tồn tại qua teardown và xóa/dựng lại không thay database.
- `faults/faults.json`: cold route không tải Pixi hoặc source GLB; cache denied, missing manifest/model/decoder, no-WebGL vẫn xem danh sách/lịch sử, lưu r2 và chuyển 2D. Fault errors được ghi riêng. Context loss/restore dùng `WEBGL_lose_context` thật trong cả hai browser suites.

## Số đo

Windows; Node 24.18.0, pnpm 10.34.6; AMD Ryzen 5 7600, NVIDIA RTX 5060 Ti qua ANGLE/D3D11. Chrome 154.0.8037.98, Edge 154.0.4258.62; headless 1600×1100/DPR1. Không chạy test/browser nặng khác đồng thời trong stress cuối. Không coi mẫu này là GPU tích hợp hoặc Android.

- Shell static entry JS/CSS/preload: **96.388 byte gzip**, dưới 409.600 byte; 3D tải riêng, không cộng worker/asset vào tên shell.
- Cold unique font/Medium/floor/decoder response bodies lọc bỏ High: **4.623.940 byte = 4,410 MiB**, dưới 8 MiB. Đây là URL-filtered sum, không phải timestamp chính xác trước first paint. Tổng đến High: **16.214.604 byte = 15,463 MiB**; High tải bổ sung theo cảnh. Không claim toàn bộ High ≤8 MiB.
- Chrome: từ chuyển My Synths sang 3D đến High scene + 3 card ready **2.263,733 ms**; Edge **2.197,034 ms**, gồm host/browser round trip.
- PNG Chrome **83.448–83.755 byte**, Edge **85.381–85.565 byte**, mỗi ảnh 256×192; 6 thẻ chia sẻ 3 key Body.
- JS heap sau forced GC, 10 vòng mode teardown: Chrome **2,030 MiB**, Edge **2,055 MiB** drift, dưới 10 MiB. Chỉ CDP `Runtime.getHeapUsage.usedSize`; không GPU/native/process memory. Số raw trước/sau và từng vòng có trong browser reports.

Số stress 24 module cuối được ghi trong `profile/profile.json`; bảng cuối bên dưới phải đọc cùng loại phép đo: browser rAF interval + actual WebGL draw calls/triangles, có cả shadow passes, **không GPU completion timing**. High đo 120 giây; Medium/Low chỉ 10 giây, không gọi là bài stress 120 giây hoặc mobile.

| Quality | Thời gian thực | Mẫu interval | p95 | p99 | Draw calls mẫu | Tam giác mẫu |
|---|---:|---:|---:|---:|---:|---:|
| High | 120,016 s | 7.200 | 16,800 ms | 16,800 ms | 115 | 1.463.690 |
| Medium | 10,013 s | 600 | 16,700 ms | 16,800 ms | 115 | 407.422 |
| Low | 10,009 s | 600 | 16,800 ms | 16,800 ms | 115 | 112.912 |

**High p95 16,800 >16,7 ms: strict FAIL**, p99 dưới 33,3 ms. JSON lưu số raw và mọi interval. Medium sample raw 16.70000000001164 ms và chỉ 10 giây; không dùng làm gate desktop/mobile pass. Draw counts là một rAF interval có draw, có shadow pass; không phải số unique triangles hoặc thời gian GPU.

## Ảnh render đã xem

[PC High 1600×1100](../deliverables/implementation/UI3D/U3D-05/final/chrome/synths/mysynths-viewport-1600.png) · [PC High 1920×1080](../deliverables/implementation/UI3D/U3D-05/final/chrome/synths/mysynths-viewport-1920.png) · [Full page](../deliverables/implementation/UI3D/U3D-05/final/chrome/synths/mysynths-high-1600.png) · [Low/grayscale](../deliverables/implementation/UI3D/U3D-05/final/chrome/synths/mysynths-low-gray.png) · [390 px](../deliverables/implementation/UI3D/U3D-05/final/chrome/synths/mysynths-responsive-390.png) · [r1](../deliverables/implementation/UI3D/U3D-05/final/chrome/synths/revision-1.png) · [r2](../deliverables/implementation/UI3D/U3D-05/final/chrome/synths/revision-2.png) · [r3](../deliverables/implementation/UI3D/U3D-05/final/chrome/synths/revision-3.png) · [Brain nền](../deliverables/implementation/UI3D/U3D-05/final/chrome/brain-1600.png).

Tự xem render thật: bố cục ba cột, lựa chọn cyan, vật liệu sáng/graphite, ánh sáng ấm và silhouette Body đúng. Nút mở/lưu hiện đủ viewport PC; lịch sử cuộn. Robot trong concept có hình học/Body khác bot mẫu thật; không dùng concept làm nền hay giả robot. Mức khớp concept/chất lượng bề mặt của asset đã tối ưu vẫn chưa có reviewer độc lập ký duyệt. Các PNG ở `development/thumbnail-links-debug` là lượt thử trước recipe v2, không là ảnh bàn giao cuối.

## Lệnh tái hiện

Từ `D:\AI\nextgame`, dùng browser context tạm. Chrome/Edge phải được cài; `PLAYWRIGHT_MODULE` có thể trỏ runtime Playwright của máy khác. Không ghi đè baseline đã bàn giao. `baseline` chỉ dùng trước khi sửa trên checkout đầu vào mới.

```powershell
node scripts/u3d05-evidence.mjs final
node scripts/u3d05-baseline-browser.mjs final
node scripts/u3d05-browser.mjs
$env:U3D_BROWSER='msedge'
node scripts/u3d05-browser.mjs
Remove-Item Env:U3D_BROWSER
node scripts/u3d05-faults.mjs
# Chạy riêng, không đồng thời với browser/check nặng:
$env:U3D_STRESS_SECONDS='120'
node scripts/u3d05-profile.mjs
Remove-Item Env:U3D_STRESS_SECONDS
node scripts/u3d05-assets.mjs
node scripts/u3d05-budget.mjs
node scripts/u3d05-evidence.mjs seal
```

Các script kiểm tra trên đã chạy, exit 0; profile exit 0 nghĩa đo thành công, **không** nghĩa strict gate đạt. Build có cảnh báo chunk 3D lớn của Vite; shell budget tính riêng và lazy load đã kiểm. Các lệnh raw/exits và artifact status lưu trong evidence.

Tài liệu API đã đối chiếu: [R3F hooks/render loop](https://r3f.docs.pmnd.rs/api/hooks), [Canvas toBlob](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob), [CacheStorage Cache](https://developer.mozilla.org/en-US/docs/Web/API/Cache).

## Tiêu chí còn thiếu

**Ticket chưa hoàn tất.** Strict desktop p95 ≤16,7 ms chưa đạt trong phép đo cadence; không làm tròn 16,800 thành 16,7. Chưa có GPU completion timing, GPU/native/process memory, GPU tích hợp, Android thật/Low p95 ≤33,3 ms, reviewer concept/readability hoặc người thử độc lập. Stress 48 module hai bot, replay seek và toàn bộ vòng lifecycle U3D-07 không thuộc công việc My Synths này và chưa được nhận là đã chạy lại. Các gate thiếu của U3D-01/02/03/04 và G2 không tự trở thành đạt.
