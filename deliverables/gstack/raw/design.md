# GStack Designer — raw design report

**Dự án:** PROMPT Chiến v2  
**Ngày:** 2026-10-01  
**Vai trò:** gstack-designer  
**Trạng thái:** Đặc tả thiết kế đã ghi; preview, render và QA chưa chạy  
**Artifact chính:** [06_ART_UX.md](../../../docs/v2/06_ART_UX.md)

## Kết quả

Đã tạo đặc tả art direction và UX cho Workshop, Brain Lab, Arena/Replay, Ranked và Leaderboard. Hướng được chọn là **Gốm Sống / Cốt Graphite**: giáp gốm sáng trên khung hợp kim than chì, silhouette ghép module dễ đọc, ánh sáng tiết chế cho telegraph, Core, objective và trạng thái nguy hiểm.

Đặc tả dùng React/Vite cho UI và PixiJS 8/WebGL2 cho sân theo kiến trúc v2 hiện có. Renderer đọc authoritative snapshots/public events; không quyết định va chạm hay kết quả. Official Alpha hiển thị replay đã tính; Brain trace và exact resource của đối thủ vẫn private.

## Đọc nguồn và giữ phạm vi

Đã đọc toàn bộ sáu tài liệu gốc được giao: BRAIN.md, PLAN.md, can_bang.md, gameplay.md, ky_thuat_my_thuat.md và spec_demo.md. Chúng phản ánh thiết kế v1: lưới tam giác, Búa–Kéo–Bao, 30 Hz và visual direction Dark Cyber/fluid. Nội dung v1 đã có bản lưu trong [archive/v1](../../../docs/archive/v1/).

Thiết kế mới tuân thủ nguồn v2 do Gu chốt: grid vuông 12 × 12, Core footprint 2 × 2, trần 24 module, catalog module có bản sắc cơ khí, mô phỏng 60 Hz, Brain 10 Hz, vũ khí có windup/telegraph. Sau QA, ranked BO2 được chốt là đổi bot vào hai pose slots cố định; đề xuất quay arena 180° của pass trước đã được thay thế. Các hợp đồng liên quan đã được rà trong 01/02/03/04/05/07/08/09. Chỉ tiêu combat, rating và privacy không được định nghĩa lại trong 06.

## Ba hướng đã cân nhắc

| Hướng | Ưu điểm | Đánh đổi | Kết luận |
|---|---|---|---|
| **Gốm Sống / Cốt Graphite** | Hợp với Synth cơ khí, dễ đọc silhouette/module ở kích thước nhỏ, cân bằng giữa craft và telemetry | Nếu plate vuông lặp lại thiếu seam/negative space, bot trông như xe tăng | **Chọn làm hướng chính** |
| **Hồ Quang Kỷ Luật** | Nhịp Arena mạnh, cảnh báo nổi, nhận diện tech rõ | Glow/lưới có thể lấn bot, telegraph và tương phản; dễ nặng render | Chỉ giữ điểm sáng cho trạng thái chiến thuật |
| **Bàn Thử Tác Chiến** | Tốt cho Workshop/Brain Lab và người mới | Arena dễ thiếu căng thẳng; cần chuyển cảnh giữa studio và combat | Mượn khả năng giải thích trong các công cụ tạo bot |

Lý do chọn hướng thứ nhất: sản phẩm bán trải nghiệm tạo một trí tuệ có cơ thể. Vật liệu gốm/graphite cho thấy các mảng có thể lắp, hỏng và thay đổi, còn silhouette vẫn là trọng tâm khi bốn hướng thông tin cùng hiện trên màn hình: bot, module, weapon phase, energy/heat.

## Quyết định thiết kế đáng chú ý

- Dùng cùng vật liệu gốm/hợp kim cho mọi module; phân biệt module bằng glyph/notch/tên, đội bằng màu và pattern riêng.
- Giữ 10 loại catalog module; Core được vẽ như tâm 2 × 2. Bộ đếm module đọc từ validation report, không suy ra từ số ô.
- Có topology gợi ý như mũi giáo, càng kép, vành đai, khiên lệch, móc bất đối xứng và sinh thể đa nhánh; mẫu reference lấy Mantis, Bastion, Kestrel, Ram, Wisp, Chimera từ 02.
- Workshop/Brain Lab ưu tiên desktop và tablet. Mobile tập trung xem trận, debrief, leaderboard và chỉnh tham số; geometry editor báo rõ giới hạn trên điện thoại.
- AI đề xuất tối đa ba phương án, giải thích hypothesis/diff/trade-off, nhưng không tự ghi đè draft hoặc Ranked submit.
- BO2 UI giữ identity A/B khi bot đổi slot; arena giữ nguyên, không lật topology nội tại của bot. Đây là mapping cuối sau QA.
- Telegraph theo public weapon phase, tối thiểu 300 ms; Blade baseline lấy 18 ticks ở 60 Hz từ 02. Cues vẫn rõ khi VFX off.
- Không dùng frame-based slow motion hoặc spring/history drift. VFX seek được tái dựng từ public pose chunks/events; không cần private checkpoint và không lộ Brain địch.
- Chọn font Inter/Noto Sans có glyph tiếng Việt, font monospace cho Brain/dữ liệu; contrast/accessibility cần đo trên render thật.

## Tham khảo và bằng chứng

Nghiên cứu ngoài bị giới hạn bởi môi trường: không có công cụ web search; truy vấn Google/DuckDuckGo và truy cập trực tiếp một số trang tham khảo trả HTTP 403. Tôi không ghi các kết quả tìm kiếm hoặc case study chưa xác minh thành evidence. Quyết định hiện dựa trên product bible, gameplay/architecture/quality docs và baseline người giao việc.

Các thông số performance/usability trong 06 là target đã thống nhất ở 01/09, không phải số đo. Gate đọc trận yêu cầu ít nhất 80% trong tối thiểu 12 người thử nhận đúng đội, telegraph, module bị phá và bước ngoặt khi không xem log; 8/10 người mới cần hoàn thành loop trong 15 phút. Performance mục tiêu dùng cấu hình máy cụ thể của 09 và phải đo lại trên build thật.

## Chưa kiểm chứng

- Chưa tạo HTML, app, image-gen asset hoặc screenshot preview theo phạm vi chỉ định.
- QA spot-check contrast trên Surface 3 tìm thấy hai token chưa đạt; Line và Text muted đã được tăng trong 06. Chưa có full contrast audit mọi trạng thái/render, xác minh WOFF2 glyph/license, browser/device matrix, keyboard/AT, grayscale hay user test.
- Chưa có recording frame time, seek latency, memory, asset bundle size hoặc replay parity.
- Chưa có screenshot chứng minh typography/spacing/render quality. Tài liệu không tuyên bố sản phẩm đã đạt “AAA”; các mục 15–16 trong 06 là acceptance target.
- Các key/event cụ thể phải khớp schema/runtime sau khi T02/T06/T08 triển khai; không giả vờ interface đã chạy.

## Handoff

UI Agent/Technical Art Agent có thể dùng [06_ART_UX.md](../../../docs/v2/06_ART_UX.md) làm source of truth cho visual system, screen layout, VFX/audio, accessibility và asset handoff. Cần nối các field/event thực từ [02_GAMEPLAY.md](../../../docs/v2/02_GAMEPLAY.md), [03_BOT_BRAIN.md](../../../docs/v2/03_BOT_BRAIN.md), [04_ARCHITECTURE.md](../../../docs/v2/04_ARCHITECTURE.md) và [07_RANKED_LIVEOPS.md](../../../docs/v2/07_RANKED_LIVEOPS.md).
