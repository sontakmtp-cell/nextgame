# Workshop: lắp bằng một lần nhấp, chặn chồng và xóa module

Ngày kiểm tra: 2026-10-08. Hoàn tất yêu cầu bổ sung của Khầy.

- Nhấp ô trống trên cảnh 3D hoặc lưới 2D: lắp module đang chọn trong thư viện ngay. Nhấp module/ô đã có module: chỉ chọn. Nhấp đúp không lắp hai lần.
- Chặn lắp và di chuyển chồng theo toàn bộ diện tích từ catalog, bao gồm Core 2×2. Thao tác bị chặn không sửa bản nháp hoặc thêm bước hoàn tác. Các ô sát cạnh vẫn hợp lệ.
- Nút **Xóa module** trên thanh công cụ 3D; 2D giữ nút trong phần thông tin module. Xóa, hoàn tác và làm lại giữ nguyên Brain.
- Di chuyển: chọn module, bấm **Di chuyển module**, nhấp ô trống. Nút lắp/xác nhận bằng tham số vẫn dùng được nhưng không cần cho thao tác chuột.
- Khi đang kiểm tra hoặc có JSON chưa áp dụng, thao tác sửa bị khóa. Các điều kiện khác của Body/Brain tiếp tục do worker hiện có kiểm tra.

Phạm vi code: `apps/web/src/App.tsx`, `Workshop3D.tsx`, `workshop-intent.ts`, `tests/workshop3d.test.ts`. Không sửa engine, contracts, Brain, catalog, replay, worker, dữ liệu IndexedDB hoặc tài nguyên 3D. Không commit, push hoặc deploy.

## Kết quả thực

- TypeScript ứng dụng và tests: qua.
- Ranh giới package: qua.
- Unit: **196/196 tests, 14/14 files**, 15.94 giây.
- Build production: qua; có cảnh báo kích thước chunk lớn đã tồn tại trước thay đổi này.
- Chrome **154.0.8037.98** và Edge **154.0.4258.62**: mỗi trình duyệt qua 7 nhóm kiểm tra thực, không lỗi console/page trong lượt này.
- Cảnh WebGL thật: hover giữ nguyên bot; nhấp một lần tăng số module từ **6 lên 7**; nhấp module không tăng số lượng; xóa trở lại **6**; hoàn tác/làm lại khôi phục đúng JSON.
- Chặn di chuyển Core tới ô trống `(4,3)` vì phần còn lại của diện tích 2×2 đè lên module khác. Chặn cả chuyển tọa độ trong 2D vào Core. Lịch sử hoàn tác không bị thêm bước do thao tác bị chặn.
- Di chuyển Giáp bằng một lần nhấp đến `(7,4)` giữ ID và Brain; hoàn tác khôi phục đúng bản đầu.
- Brain Lab không có canvas 3D. Ảnh **1600×1100** mỗi trình duyệt giống từng byte với ảnh cùng trình duyệt của U3D-06; **0 pixel thay đổi**.

Ảnh và kết quả JSON nằm trong `deliverables/implementation/WORKSHOP-CLICK/chrome/` và `msedge/`. `browser.json` ghi phiên bản, thời điểm, thời gian và từng kiểm tra; `preservation.json` ghi so sánh SHA-256 với checkout trước lần sửa này. Ảnh `single-click-installed.png` và `overlap-blocked.png` là ảnh ứng dụng thật.

## Lệnh tái kiểm tra (PowerShell, tại thư mục gốc)

```powershell
node node_modules/typescript/bin/tsc -b
node node_modules/typescript/bin/tsc -p tests/tsconfig.json
node scripts/boundaries.mjs
node node_modules/vitest/vitest.mjs run
node apps/web/node_modules/vite/bin/vite.js build apps/web
node scripts/workshop-click-browser.mjs
$env:U3D_BROWSER='msedge'
node scripts/workshop-click-browser.mjs
```

Script trình duyệt dùng Playwright của Codex (hoặc đường dẫn `PLAYWRIGHT_MODULE`), Chrome/Edge cài trên máy, cổng preview 5217 và hồ sơ thử riêng. Nó tự đóng trình duyệt/server do chính nó tạo, không dùng IndexedDB trong hồ sơ của người dùng. Ảnh Brain đối chiếu với bằng chứng U3D-06 có sẵn trong checkout.

Mở nhanh ứng dụng bằng `Khoi-dong.cmd` ở thư mục gốc. Không có tiêu chí bổ sung nào còn chưa đạt trong phạm vi yêu cầu này; kết quả trên không thay thế các bằng chứng của ticket trước.
