# U3D-03 — Workshop và giao diện chung

**CHƯA HOÀN TẤT NGHIỆM THU.** Phần code và đường sử dụng Workshop 3D đã triển khai, có kiểm tra tự động và ảnh render thật. Chưa có đánh giá mỹ thuật/readability độc lập; chưa chứng minh gate hiệu năng 120 giây/48 module, GPU tích hợp hoặc Android thật. U3D-02 cũng còn gate chất lượng chưa ký duyệt. Không tự đóng G1/G2/U3D-07 và không chuyển mặc định sang 3D.

Ngày bàn giao: 08/10/2026. Checkout đầu vào: `remake-ui3d`, HEAD `5ba0a7cddbc6e9fba7d002c856019736828a7dd1`. Node 24.18.0, pnpm 10.34.6. Đọc PLAN-UI3D, UI3D_IMPLEMENTATION, báo cáo U3D-02, Docs sản phẩm/gameplay/Brain/kiến trúc/art/QA/decisions và concept Workshop. Kiểm tra, chụp Brain Lab và ghi trận mẫu trước khi sửa. Không commit, push, deploy, đổi branch, reset hay stash.

## Phạm vi code

- `apps/web/src/useSynthSession.ts`: một vòng đời cho bot, JSON Body/Brain chưa áp dụng, undo/redo, worker, A/B, draft/revision và IndexedDB. Đổi màn/chế độ không tạo lại App/worker hoặc thay bot. Undo/redo dọn chẩn đoán cũ; phím tắt tôn trọng buffer chưa áp dụng; kết quả kiểm tra lỗi thuộc draft cũ không ghi đè trạng thái mới.
- `apps/web/src/App.tsx`: điều phối màn, lazy-load Workshop3D, nối editing vào `change` và validator worker hiện hành; drawer import/export/mẫu/A/B/audio, khóa camera khi nhập liệu hoặc mở drawer, Escape/Tab/focus return. Markup Brain Lab và theme pixel được giữ.
- `apps/web/src/Workshop3D.tsx`: bàn xưởng từ renderer U3D-02, thư viện bên phải, inspector, ngân sách và hành động phía dưới; hover/ghost cyan chỉ là preview; click chọn và xác nhận/double-click mới lắp. Di chuyển cũng cần xác nhận; xoay/xóa qua editing cũ. Lưới chuẩn có roving focus, phím mũi tên/Enter và danh sách module. Catalog quyết định footprint/cost/enabled; Lance/Breaker tiếp tục bị khóa.
- `apps/web/src/workshop-intent.ts`: dựng edit bất biến bằng `newModule`/`editModule`; không tạo luật kiểm tra mới. Overlap, ngoài lưới, budget, thiếu Core, mất kết nối vẫn do validator hiện hành quyết định. Draft lỗi được giữ để sửa/undo.
- `apps/web/src/presentation.css`: theme `.ui3d-shell` chỉ ở Workshop khi yêu cầu 3D, font Inter/IBM Plex Mono self-host, vật liệu sáng/graphite, điểm nhấn cyan/cam. Panel thư viện thu gọn dưới 1024 px; dưới 768 px dùng preview/tham số thay lưới hình học. Brain Lab tiếp tục CSS pixel cũ.

Không sửa engine, Brain VM/compiler, contracts/catalog, replay, worker/protocol, model editing cũ, drafts/schema IndexedDB, runtime renderer3d, dependency/lockfile hoặc GLB/PNG nguồn. Renderer nhận **Body-only**, manifest, footprint và callback; không nhận BotDefinition/Brain/trace riêng.

Arena và My Synths đang dùng trình bày 2D có thông báo rõ khi yêu cầu 3D; tích hợp hai màn này thuộc **U3D-04/U3D-05**. U3D-03 chuẩn bị trạng thái chung và giữ chúng tương thích, không mở rộng sang các ticket đó. Không gọi cảnh nền Arena của U3D-02 là replay 3D hoàn chỉnh.

## Tài nguyên và tái tạo

U3D-03 không sinh model/texture mới. Dùng lại `/assets/ui3d/u3d01` và floor U3D-02; chỉ tải LOD tối ưu, Medium trước rồi High của các loại đang dùng, không tải cả mười bộ High. Một canvas cho Workshop; thumbnail là ảnh đã sinh, không tạo canvas mỗi thẻ.

`node scripts/u3d03-assets.mjs` đọc/giải mã lại **30 model**, đếm tam giác thực, kiểm hash model/nguồn/texture/thumbnail/decoder và kích thước KTX2. Kết quả: tối đa **29.900 tam giác**, model lớn nhất **2.472.712 byte**; cả ba mức giữ ngân sách U3D-01. Chi tiết từng loại/mức và assetRevision trong [assets.json](../deliverables/implementation/UI3D/U3D-03/assets.json).

Recipe nguồn vẫn là `scripts/u3d01-build.mjs <catalogId>` (toolchain ở `tools/u3d01`, `scripts/u3d01-setup.mjs`) và `scripts/u3d02-assets.mjs` cho floor. Không chạy lại những script ghi evidence U3D-01/02 trong ticket này. Runtime requests đã kiểm chỉ lấy GLB ở `/assets/ui3d/u3d01/modules/`; không lấy GLB nguồn 500.000 tam giác. [recipe](../deliverables/implementation/UI3D/U3D-03/recipe) giữ bản các file thuộc ticket và [seal.json](../deliverables/implementation/UI3D/U3D-03/seal.json) khóa hash working tree; đây không phải commit.

## Kiểm tra đã thực hiện

Baseline và final: typing app/tests, boundaries và negative boundary selfcheck, **180 unit tests / 12 files** ở final, corpus 10 record với checkpoint verification, production build. Các lệnh/exit/stdout/stderr/thời gian ở [final/checks.json](../deliverables/implementation/UI3D/U3D-03/final/checks.json) và `final/commands/`; tất cả exit 0 ở bản final.

Chrome và Edge: một canvas 3D thật, High/Medium/Low, hai viewport PC 1600×1100/1920×1080; responsive 1024/768/390/320. Chụp full page, nên chiều cao PNG có thể lớn hơn viewport. Đã xem ảnh render PC và responsive, không nghiệm thu bằng DOM assertions đơn thuần.

Ảnh bàn giao: [High 1600](../deliverables/implementation/UI3D/U3D-03/final/chrome/workshop-high-1600.png), [High 1920](../deliverables/implementation/UI3D/U3D-03/final/chrome/workshop-high-1920.png), [Medium](../deliverables/implementation/UI3D/U3D-03/final/chrome/workshop-medium.png), [Low](../deliverables/implementation/UI3D/U3D-03/final/chrome/workshop-low.png), [hover ghost](../deliverables/implementation/UI3D/U3D-03/final/chrome/hover-ghost.png), [tablet 768](../deliverables/implementation/UI3D/U3D-03/final/chrome/responsive-768.png), [mobile 320](../deliverables/implementation/UI3D/U3D-03/final/chrome/responsive-320.png), [Brain trước](../deliverables/implementation/UI3D/U3D-03/baseline/chrome/brain-1600.png), [Brain sau](../deliverables/implementation/UI3D/U3D-03/final/chrome/brain-1600.png).

- Canvas hover/click chỉ chọn/xem trước, không đổi Body; lắp đủ bốn hướng qua xác nhận, undo giữ Brain.
- Chọn module bằng proxy 3D; xoay, preview di chuyển rồi xác nhận, xóa, undo/redo; lưới chuẩn có keyboard focus và Enter.
- Worker báo `OVERLAP`, `SCHEMA` với ô 12, và `DISCONNECTED`; mỗi draft lỗi undo được. Unit fixture dùng validator thật kiểm `BUILD_BUDGET` và Core 2×2.
- Body/Brain JSON chưa áp dụng giữ nguyên qua Workshop/Brain Lab/Arena/My Synths và đổi 2d/3d. Brain Lab không có canvas 3D.
- Save/reload đúng Body/Brain; database vẫn `prompt-chien-local` **version 1**, stores `heads`/`revisions`. Hai tab: CAS từ chối stale revision, giữ draft chưa lưu. Mọi thử nghiệm dùng context tạm, không mở profile/IndexedDB người dùng.
- Drawer export JSON đúng nội dung, import phải qua validation; JSON lỗi giữ buffer và hiển thị diagnostic, A/B một scenario/bốn legs giữ baseline/candidate/seed/hai slots; candidate giống baseline cho delta 0.
- Chuột phải orbit đổi ảnh render, reset camera được kiểm bằng target/azimuth/elevation/zoom; ảnh pixel reset được ghi riêng vì ghost hover có thể khác. Thiếu manifest cho chuyển 2D và giữ draft.
- Trận practice mặc định trước/sau và Chrome/Edge giữ đúng manifest/result/simulation/replay/public frames/thứ tự sự kiện. Simulation hash `4ebd80218b53bf01271d8ac9d92eaf348301565123e6d0e8448436eb2c7376c2`; public replay hash `29bf01b2db3f4f1e2f685be1d1f1673b678a6d59927092947f8703767614c140`.

Chrome: Brain Lab tại cả 1600/1920 **byte-identical** với ảnh baseline checkout. Edge có ảnh hiện hành và kiểm no-canvas; không có baseline pixel trước sửa cùng Edge, không dùng khác biệt raster giữa Chrome/Edge để kết luận regression. [Chrome report](../deliverables/implementation/UI3D/U3D-03/final/chrome/browser.json), [Edge report](../deliverables/implementation/UI3D/U3D-03/final/msedge/browser.json).

## Số đo và giới hạn

Số đo hiện hành nằm trong `profile/chrome/profile.json` và `profile/msedge/profile.json`: cold asset/body bytes, gzip shell, browser/GPU/DPR/viewport, rAF 10 giây mỗi mức và JS heap sau 10 vòng Workshop↔Brain Lab. CPU Ryzen 5 7600, GPU thực do browser báo RTX 5060 Ti, DPR 1. Đây là mẫu trên PC này, không suy ra GPU tích hợp/Android.

| Số đo | Chrome | Edge |
|---|---:|---:|
| Browser | 154.0.8037.98 | 154.0.4258.62 |
| Shell gzip | 94.38 KiB | 94.38 KiB |
| Asset trước High bổ sung | 4.64 MiB | 4.64 MiB |
| High tải bổ sung | 11.05 MiB | 11.05 MiB |
| Tổng cold asset sau High | 15.69 MiB | 15.69 MiB |
| Navigation → graphics ready (round trip) | 2520.86 ms | 2542.35 ms |
| JS heap drift / 10 vòng, có GC | 2.55 MiB | 2.49 MiB |

| Browser / mức | Số mẫu rAF | p95 (ms) | p99 (ms) | Max (ms) |
|---|---:|---:|---:|---:|
| chrome / high | 600 | 16.7 | 16.8 | 16.8 |
| chrome / medium | 600 | 16.8 | 16.8 | 16.8 |
| chrome / low | 600 | 16.8 | 16.8 | 16.8 |
| msedge / high | 600 | 16.8 | 16.8 | 16.8 |
| msedge / medium | 600 | 16.8 | 16.8 | 16.8 |
| msedge / low | 553 | 16.8 | 76.4 | 84.0 |

**Mẫu Edge Low có p99 76,4 ms / max 84 ms, vượt mục tiêu desktop p99 33,3 ms.** Không suy ra nguyên nhân từ một mẫu rAF; không coi performance gate đã đạt. Đo lại và điều tra ở U3D-07 với fixture/120 giây/thiết bị đã quy định. Profile command exit 0 nghĩa là thu được số đo, không có nghĩa mọi ngân sách đạt.


Đếm tải đầu loại phần High bổ sung nhưng gồm decoder/font/floor/thumbnail; tổng cold sau High ghi riêng. Shell gồm HTML/CSS/entry JS/static imports; tách lazy 3D/Arena/worker/assets. Không gọi thời gian rAF là GPU render completion. Bộ nhớ là **CDP Runtime.getHeapUsage usedSize**, ép GC như nhau trước/sau, không phải VRAM/RSS. Báo rõ khi CDP không trả body response của decoder worker và dùng HTTP Content-Length của Vite local làm số đo thay thế.

## Đánh giá hình ảnh và tiêu chí còn thiếu

Quan sát nội bộ: bố cục có thanh điều hướng, sân lớn, thư viện/inspector phải và ngân sách/hành động dưới; robot ghép đúng Body sáu module thay vì bắt chước topology trong concept; gốm ngà/kim loại tối, đèn ấm, sét cyan và bóng có thật. Chưa có chấm mỹ thuật/readability độc lập theo năm tiêu chí. Khoảng trên dành cho tên/trạng thái và inspector có thể làm page cao hơn concept ở desktop. Không coi kiểm tra tự động là bằng chứng gate người mới.

Chưa chạy/chưa đạt bằng chứng đầy đủ: review mỹ thuật độc lập, 8/10 người mới và readability; stress 120 giây/48 module với projectile/events; GPU tích hợp Medium, Android thật Low; VRAM, thiếu texture/mạng chậm/context loss/tab hidden của **app tích hợp**; vòng Brain→A/B→debrief→hypothesis→save đầy đủ và pixel baseline Edge trước sửa. Những tiêu chí thuộc U3D-04–07 không bị tự đóng. **Ticket vẫn chưa hoàn tất nghiệm thu.**

## Bảo toàn checkout

[baseline/snapshot.json](../deliverables/implementation/UI3D/U3D-03/baseline/snapshot.json), [final/snapshot.json](../deliverables/implementation/UI3D/U3D-03/final/snapshot.json) và [preservation.json](../deliverables/implementation/UI3D/U3D-03/preservation.json) ghi hash từng file, trạng thái Git và phần thay đổi thuộc ticket.

Trong lúc thực hiện, `Docs/U3D-02_REPORT.md` và `deliverables/implementation/UI3D/U3D-02/hover-phase.json` có thay đổi quan sát được ngoài tập file do U3D-03 ghi. Giữ nguyên chúng, ghi before/after riêng ở `outsideScopeObserved`; không tuyên bố chúng không đổi, không copy/revert/stage chúng. Các thay đổi U3D-02 đã có lúc bắt đầu, `.workbuddy-ai/` và fixtures private T06 được giữ.

## Lệnh tái kiểm tra

Chạy từ `D:\AI\nextgame`, trên checkout đã có dependency/toolchain U3D-01/02:

```powershell
node scripts/u3d03-evidence.mjs final
node scripts/u3d03-assets.mjs
node scripts/u3d03-browser.mjs final
$env:U3D_BROWSER='msedge'
node scripts/u3d03-browser.mjs final
node scripts/u3d03-profile.mjs
Remove-Item Env:U3D_BROWSER
node scripts/u3d03-profile.mjs
node scripts/u3d03-evidence.mjs seal
```

`baseline` là dữ liệu trước sửa và từ chối ghi đè. Lệnh profile chỉ đo, không tự ký gate hiệu năng. Để mở Workshop: `pnpm dev`, chọn **3D · đang phát triển** hoặc thêm `?presentation=3d`; không query vẫn là 2D. Ảnh ở `deliverables/implementation/UI3D/U3D-03/final/{chrome,msedge}/`.
