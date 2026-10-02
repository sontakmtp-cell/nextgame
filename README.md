# PROMPT Chiến — xây dựng trí tuệ, chứng minh trên đấu trường

Bộ đặc tả sản phẩm **v2, ngày 01/10/2026**. Người chơi cùng AI qua MCP thiết kế cơ thể và lập trình trí tuệ cho bot; bot tự chiến đấu trong web game 2D, tiến hóa qua thử nghiệm và thi đấu xếp hạng.

Đây là **baseline thiết kế để triển khai**, chưa phải game hoàn chỉnh hoặc alpha được nghiệm thu. Checkout có nền **G0 (T01–T03)** và implementation prototype **G1 (T04–T06)**: engine headless, Blade/Burst/Shield, ba archetype, CLI và replay. Chạy G1 ở [G1 Development](Docs/G1_DEVELOPMENT.md), xem gate/giới hạn thực tế ở [G1 report](deliverables/implementation/G1_REPORT.md); G0 setup/evidence vẫn ở [G0 Development](Docs/G0_DEVELOPMENT.md) và [G0 report](deliverables/implementation/G0_REPORT.md). “Cảm giác AAA” là mục tiêu phải kiểm chứng, chưa là chất lượng đã đạt.

## Bộ tài liệu chính thức

| Đọc theo thứ tự | Nội dung và nguồn quyết định |
|---|---|
| [01 — Sản phẩm](Docs/01_PRODUCT.md) | Định vị, vòng lặp, phạm vi, tiêu chí hấp dẫn |
| [02 — Gameplay và chiến đấu](Docs/02_GAMEPLAY.md) | Cơ thể, module, luật chiến đấu, công thức, thứ tự tick |
| [03 — Bot và Brain](Docs/03_BOT_BRAIN.md) | Schema logic, ngôn ngữ trí tuệ, ABI, mở rộng cơ chế |
| [04 — Kiến trúc](Docs/04_ARCHITECTURE.md) | Stack, monorepo, dữ liệu, worker, replay, vận hành |
| [05 — MCP và nền tảng AI](Docs/05_MCP_PLATFORM.md) | Hợp đồng tools, đồng sáng tạo, OAuth, tương thích host |
| [06 — Mỹ thuật và UX](Docs/06_ART_UX.md) | Art direction, bảng màu, layout, chuyển động, âm thanh |
| [07 — Ranked và LiveOps](Docs/07_RANKED_LIVEOPS.md) | Ghép trận, rating, leaderboard, mùa giải, công bằng |
| [08 — Kế hoạch Agent](Docs/08_IMPLEMENTATION.md) | DAG công việc, quyền sở hữu, đầu ra, gate và prompt giao việc |
| [09 — Chất lượng và bảo mật](Docs/09_QUALITY_SECURITY.md) | Test matrix, threat model, release, điều kiện dừng |
| [Sổ quyết định](Docs/DECISIONS.md) | Quyết định đã chọn, phương án bỏ, giả thuyết cần đo |
| [Đọc và chuyển đổi tài liệu cũ](Docs/SOURCE_REVIEW.md) | Nguồn đã đọc, mâu thuẫn, map v1 → v2 |

Để bắt đầu giao Agent: đọc 01 → 02 → 03 → 04, rồi nhận đúng ticket trong 08. Đối với AI tích hợp sản phẩm, đọc thêm 05. Tài liệu tham chiếu chéo thay cho sao chép luật sang nhiều nơi.

## Quy tắc sử dụng

- **Nguồn luật:** 02; **nguồn hợp đồng Bot/Brain:** 03; **nguồn tool:** 05; **nguồn ranked:** 07; **nguồn giao diện:** 06. Nếu có xung đột, dừng ticket liên quan và sửa nguồn cùng người phụ trách, không tự chọn hai phiên bản khác nhau.
- `alpha-0` là bộ số để dựng prototype, phải qua fun/balance gate trước ranked. Mọi thay đổi luật tạo digest mới và đánh giá lại bot; không sửa trận đã khóa.
- G0 có build/schema/Brain/smoke/hash-parity checks; G1 có combat/replay/differential harness và Canvas debug. Trạng thái từng gate theo G1 report; balance, art premium, AI host và ranked chưa được nghiệm thu. Không thừa kế các trạng thái “M1/M2/M3 đã đạt” trong tài liệu lịch sử.
- Bốn bất biến: đồng sáng tạo qua MCP; autonomous combat 2D; ranked + leaderboard; bot có ngôn ngữ hành vi và đường mở rộng cơ chế.

