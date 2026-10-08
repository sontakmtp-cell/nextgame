# U3D-06 — Bảo toàn Brain Lab pixel art

**Hoàn tất phạm vi kỹ thuật U3D-06.** CSS Brain đã được tách và giới hạn theo màn; ảnh nền, thao tác Brain và buffer qua màn được kiểm trên Chrome/Edge. Không đóng các gate mỹ thuật, thiết bị, hiệu năng hoặc nghiệm thu tổng thể của U3D-01–05/U3D-07/G1/G2. Đợt chuyển UI3D vẫn chưa hoàn tất nghiệm thu tổng thể.

Ngày bàn giao: **08/10/2026**, Asia/Saigon. Nhánh đầu vào/cuối: `remake-ui3d`; HEAD giữ `5ba0a7cddbc6e9fba7d002c856019736828a7dd1`. Đã đọc PLAN-UI3D, UI3D_IMPLEMENTATION, UI3D_REPORT, U3D-03_REPORT, tài liệu Brain/kiến trúc/art/QA và D20/D21 trước sửa. Game Studio / Game UI Frontend / Game Playtest; không chia agent. Checkout có nhiều thay đổi U3D-02–05 và file untracked của người khác; làm tiếp trên đầu vào này, không reset/stash/clean/commit/push/deploy.

## Code và giới hạn sửa

- `apps/web/src/brain-lab.css`: chuyển nguyên các khai báo màu, font, khung, node, dây SVG, thư viện và responsive của Brain từ stylesheet chung. Selector bắt đầu bằng `:where(.brain-lab-shell)`; phần scope có specificity bằng 0, giữ độ ưu tiên của selector cũ. Keyframe giữ tên `n8n-*`. Không thêm theme/concept 3D vào Brain.
- `apps/web/src/style.css`: bỏ các khai báo Brain đã chuyển; tách selector dùng chung với thẻ Bot mẫu để thẻ đó giữ các khai báo cũ. Token/base pixel chung vẫn giữ cho các màn 2D.
- `apps/web/src/main.tsx`: import stylesheet Brain sau base stylesheet.
- `apps/web/src/App.tsx`: chỉ thêm class `brain-lab-shell` khi `view === 'Brain Lab'`. Phần thay đổi của ticket trong App đúng một dòng điều kiện class; không sửa markup/editor/state hoặc lazy-load ba màn 3D.
- `scripts/u3d06-{evidence,browser,renders}.mjs`: khóa đầu vào, kiểm tra/bảo toàn, chụp và đo pixel, chạy thao tác thực, tạo ảnh so sánh có thể tái tạo.

Giữ nguyên `N8nCanvas.tsx`, `NodeLibrary.tsx`, `brain-library.ts`, `useSynthSession.ts`, engine/Brain/catalog/contracts/replay, worker/protocol, drafts/IndexedDB, renderer3d và asset nguồn/sinh sẵn. Workshop/Arena/My Synths vẫn dùng 3D khi chọn `presentation=3d`; không đổi mặc định 2D đã chốt. Buffer không được đưa vào renderer. Không thêm dependency hoặc sửa lockfile.

## Bằng chứng nghiệm thu U3D-06

| Tiêu chí của ticket | Kết quả hiện hành |
|---|---|
| CSS pixel riêng, không chịu theme 3D | Đạt; scope chỉ ở Brain. Probe gắn class `n8n-node n8n-node-action` vào shell 3D có position `static`, shadow `none`, không nhận style đồ thị |
| Ảnh so với nền U3D-00 | Chrome 1600×1100 và 1920×1080: **0 pixel khác**, PNG byte-identical với `U3D-00/baseline-stable` và đầu vào ticket |
| Đối chiếu cùng trình duyệt ở Edge | Hai viewport PC: **0 pixel khác**, PNG byte-identical với baseline Edge mới của checkout đầu vào; không dùng raster Chrome làm baseline Edge |
| Sau Workshop/Arena/My Synths 3D | Mỗi browser: Brain sau Workshop và sau cả ba lazy CSS chunks có **0 pixel khác** so với trạng thái Brain trước chuyển màn |
| Đồ thị và dây nối | Pan nền; wheel, +/− và 1:1; auto-layout; kéo node và kiểm endpoint SVG đổi. Mẫu mặc định có **11 node / 10 dây** |
| Thư viện/editor/thứ tự luật | Search, nhóm, empty state; thêm memory/transition qua compiler thật; chọn/thêm state và initialState; thêm/xóa/chọn luật; tăng ưu tiên; sửa ID, ngưỡng, forward/strafe/turn/nextState; JSON lỗi giữ buffer, JSON hợp lệ áp dụng qua worker; Ctrl+Z/Ctrl+Shift+Z |
| Buffer qua vòng màn yêu cầu | Workshop → Brain Lab → Arena → Brain Lab giữ nguyên JSON Brain và Body chưa áp dụng, thử riêng ở cả 2d/3d. Dùng cả chuỗi JSON sai để bảo đảm không tự parse/apply; không phát worker request trong vòng điều hướng, không đổi bot |
| Save/reload | Thứ tự `restU3D06`, `cooled` trong state mẫu đã sửa được lưu và tải lại đúng; Body giữ nguyên. IndexedDB vẫn **version 1**, stores **heads/revisions** |
| Tương thích dữ liệu/kết quả | Init worker, manifest, result, simulation/replay hashes, 2.603 public frames và ordered events khớp baseline mới trong cả Chrome/Edge |

Browser context tạm độc lập; không kết nối profile hoặc IndexedDB của người dùng. Chụp full page nên chiều cao PNG lớn hơn viewport. Đã xem ảnh render thật của so sánh PC, thư viện, editor sau sửa và 320 px; không chỉ dùng DOM assertions. Có ảnh responsive ở 1024/768/390/320; đây là resize trên PC, không phải Android thật.

Ảnh nền PC được chụp theo cùng thao tác với U3D-00. Khi so sau các màn 3D, dùng reduced motion và đặt con trỏ về cùng vị trí trước chụp: nút Brain chuyển giữa menu ngang và menu dọc nên hover khác nhau nếu giữ vị trí click. Không mask/crop hoặc đặt ngưỡng sai khác để tạo pass.

Ảnh: [so sánh 1600](../deliverables/implementation/UI3D/U3D-06/renders/brain-comparison-1600.png), [so sánh 1920](../deliverables/implementation/UI3D/U3D-06/renders/brain-comparison-1920.png), [Brain sau ba màn 3D](../deliverables/implementation/UI3D/U3D-06/final/chrome/brain-after-all-3d.png), [buffer chưa áp dụng](../deliverables/implementation/UI3D/U3D-06/final/chrome/brain-buffer-3d.png), [thư viện](../deliverables/implementation/UI3D/U3D-06/final/chrome/brain-library.png), [sửa luật](../deliverables/implementation/UI3D/U3D-06/final/chrome/brain-edited.png), [320 px](../deliverables/implementation/UI3D/U3D-06/final/chrome/brain-responsive-320.png). Bản full-resolution và metadata gốc giữ riêng; ảnh so sánh chỉ resize giống nhau và thêm nhãn.

## Kiểm tra và số đo thực

Baseline/final đều exit 0: app typing, tests typing, G1 browser typing, G2 viewer typing, import boundaries và negative boundary selfcheck, **193 unit tests / 14 files**, Vite production build. Không thêm test unit chỉ để lặp lại thay đổi CSS; browser/render checks trực tiếp kiểm hành vi và hình ảnh. Lệnh, exit, stdout/stderr, thời gian ở [final/checks.json](../deliverables/implementation/UI3D/U3D-06/final/checks.json) và `final/commands/`.

CPU AMD Ryzen 5 7600; Node **24.18.0**, lockfile pnpm **10.34.6** giữ nguyên. WebGL browser báo **NVIDIA GeForce RTX 5060 Ti / ANGLE D3D11**, DPR **1**.

| Số đo final | Chrome 154.0.8037.98 | Edge 154.0.4258.62 |
|---|---:|---:|
| Khác pixel PC so input, từng viewport | 0 | 0 |
| Khác pixel sau toàn bộ CSS 3D tải | 0 | 0 |
| GLB request khi chỉ mở Brain từ app 2D mới | 0 | 0 |
| App worker trước reload | 1 | 1 |
| Vòng điều hướng với buffer Brain, mode 3D | 146,11 ms | 147,96 ms |
| Vòng điều hướng với buffer Brain, mode 2D | 174,65 ms | 183,30 ms |
| GLB response đọc trong toàn bộ harness | 24 / 35.556.776 byte | 34 / 50.587.380 byte |
| Request hủy lúc tháo/đổi màn | 5 | 7 |
| Page exception / console error mới | 0 / 0 | 0 / 0 |

Thời gian vòng điều hướng là một mẫu wall-clock gồm thao tác Playwright và browser round trip, **không** là p95 render/seek/GPU completion. GLB byte là tổng response body đọc được qua nhiều lần đổi màn, có tải lặp/cache; **không** phải tải đầu hay network transfer budget. Tất cả GLB URL ghi nhận thuộc `/assets/ui3d/u3d01/modules/`; không tải GLB nguồn nặng. Request hủy đều ghi `net::ERR_ABORTED`, không có lỗi mạng khác trong lần final. Không dùng các số này để đóng gate hiệu năng U3D-07.

Trận mẫu giữ simulation hash `4ebd80218b53bf01271d8ac9d92eaf348301565123e6d0e8448436eb2c7376c2`, public replay hash `29bf01b2db3f4f1e2f685be1d1f1673b678a6d59927092947f8703767614c140`; result B thắng/Core/tick 2602 và thứ tự sự kiện giữ nguyên. Chi tiết các digest/frames ở [Chrome browser.json](../deliverables/implementation/UI3D/U3D-06/final/chrome/browser.json) và [Edge browser.json](../deliverables/implementation/UI3D/U3D-06/final/msedge/browser.json).

## Cảnh báo có sẵn và phạm vi chưa nghiệm thu

Baseline và final của mỗi browser đều có đúng **một** console warning/error: `Unable to preventDefault inside passive event listener invocation.` Nó xuất hiện khi thử wheel trên N8nCanvas cũ: zoom đổi được nhưng `preventDefault` của React passive wheel listener không chặn cuộn trang gốc. Source N8nCanvas được giữ hash nguyên trạng. Đây là vấn đề có sẵn trước U3D-06, không phải regression do theme/tái cấu trúc; không tự sửa ngoài yêu cầu "chỉ sửa vấn đề do đợt tái cấu trúc gây ra". Harness ghi nguyên message/count và từ chối console error mới, không âm thầm bỏ qua lỗi. Không tuyên bố Brain Lab không có mọi lỗi UX.

Các lần thử baseline script chưa đạt được giữ tại `baseline/chrome-attempt1`…`chrome-attempt6`: nhãn chờ sai; trạng thái transition/hover chưa ổn định hoặc con trỏ ở hai vị trí menu; đọc buffer trước React effect hoàn tất; và console wheel warning có sẵn. Script cuối chờ trạng thái thật/worker response/buffer effect, đặt con trỏ thống nhất, so pixel đúng trạng thái. Không sửa app để làm các assertions đó pass. Build pre-edit được giữ suốt các lần browser baseline; harness xác nhận baseline không có class Brain mới và ảnh vẫn khớp U3D-00. Snapshot/checks baseline ban đầu không được chạy lại/ghi đè.

Không chạy stress 48 module/120 giây, GPU tích hợp/Android thật, VRAM, human readability/art review hay đóng các gate G1/G2 và các ticket khác. Những phần đó vẫn thuộc U3D-07 và báo cáo hiện hành của từng ticket. U3D-06 chỉ nghiệm thu bảo toàn pixel và hành vi Brain đã nêu; không phải tuyên bố toàn dự án đạt release.

## Tài nguyên, tái tạo và bảo toàn

Không tạo model/texture/font mới. Dùng asset tối ưu U3D-01 và renderer hiện có; recipe model vẫn `scripts/u3d01-build.mjs <catalogId>`, toolchain `tools/u3d01` / `scripts/u3d01-setup.mjs`. Không chạy lại pipeline ghi đè asset/evidence các ticket trước trong U3D-06. CSS/code và script ảnh của ticket được đóng gói tại [recipe](../deliverables/implementation/UI3D/U3D-06/recipe); ảnh so sánh có input/output SHA256 và cách resize ở [renders/recipe.json](../deliverables/implementation/UI3D/U3D-06/renders/recipe.json).

[baseline/snapshot.json](../deliverables/implementation/UI3D/U3D-06/baseline/snapshot.json) khóa **5.138 file Git-visible**, gồm các thay đổi tracked/untracked, asset và deliverable cũ của người khác. [preservation.json](../deliverables/implementation/UI3D/U3D-06/preservation.json) / [seal.json](../deliverables/implementation/UI3D/U3D-06/seal.json) đối chiếu hash và nhánh/HEAD; chỉ source/script/Docs của U3D-06 thay đổi. Không claim hash các phần Git-ignored như dependencies/build outputs/công cụ local riêng. Ba file shared App/main/style có bản trước sửa và diff đúng đầu vào ở evidence; không lấy diff so HEAD để nhận công của U3D-03–05. Seal là inventory working tree, không phải commit.

Tái kiểm trên checkout đã có dependencies, từ `D:\AI\nextgame`:

```powershell
node scripts/u3d06-evidence.mjs final
node scripts/u3d06-browser.mjs final
$env:U3D_BROWSER='msedge'
node scripts/u3d06-browser.mjs final
Remove-Item Env:U3D_BROWSER
node scripts/u3d06-renders.mjs
node scripts/u3d06-evidence.mjs seal
```

`baseline` chỉ dành cho checkout/build trước sửa và từ chối ghi đè baseline đã có. Browser harness dùng Playwright/PNGJS trong bundled runtime, `PLAYWRIGHT_MODULE` có thể trỏ Playwright khác khi tái tạo. Script ảnh dùng Sharp cùng bundled runtime. Chạy `pnpm dev`, mở `?presentation=3d` để xem ba màn 3D; Brain Lab luôn pixel, không có lựa chọn presentation hoặc canvas 3D.
