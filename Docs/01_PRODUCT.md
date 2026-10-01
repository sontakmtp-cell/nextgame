# 01 — Product Bible

**Baseline:** v2 / 01-10-2026. **Tình trạng:** thiết kế được chọn để prototype, chưa xác minh bằng người chơi. Luật cụ thể ở [02](02_GAMEPLAY.md), pipeline bàn giao ở [08](08_IMPLEMENTATION.md).

## 1. Lời hứa sản phẩm

Bạn xây một trí tuệ có cơ thể. AI giúp biến ý tưởng thành cấu trúc, chiến thuật và thí nghiệm; đấu trường cho thấy ý tưởng đó hoạt động thế nào. Một bot có thể nhử vũ khí đối thủ, ghi nhớ nhịp bắn, đổi chiến thuật khi mất cánh và thắng nhờ hành vi người chơi đã dạy nó.

Tên làm việc giữ **PROMPT Chiến**; thế giới gọi những bot là **Synth** — sinh thể cơ khí có lõi ý thức, vỏ gốm và cơ cấu năng lượng. Tagline: **Build intelligence. Prove it in battle.** Không cần đổi thương hiệu trước thử nghiệm nhu cầu.

Giá trị đặc trưng không nằm ở việc AI tự tối ưu một bảng chỉ số: người chơi đặt giả thuyết, thấy khác biệt giữa phiên bản và quyết định chiến lược tiếp theo. Thành tích của bot gắn với tác giả, lineage và bằng chứng thử nghiệm.

## 2. Người chơi và rào cản

| Nhóm | Điều họ muốn | Sản phẩm đáp ứng |
|---|---|---|
| Người thích sáng tạo nhưng không code | Biến một ý tưởng thành bot có cá tính | Template hợp lệ, editor trực quan, AI giải thích diff |
| Người thích chiến thuật/optimization | Đo và khai thác matchup | Seed cố định, batch test, A/B, replay trace riêng |
| Lập trình viên/AI builder | Tự tạo thuật toán và công cụ | ABI rõ, DSL typed, CLI offline, MCP, luật công khai |
| Người xem | Đọc được cao trào và bản sắc bot | Silhouette, telegraph, phá module, replay đạo diễn |

MCP dùng AI host người chơi đã có; web vẫn tạo/sửa/thử bot bằng template và editor khi không có AI. Không yêu cầu API key cá nhân để vào game. Giá hoặc quota của host ngoài sản phẩm phải được giải thích trong help kết nối, không che dưới thông báo game.

## 3. Năm trụ thiết kế

1. **Trí tuệ nhìn thấy được:** cùng cơ thể, Brain khác tạo lựa chọn khác; trace chỉ ra điều kiện dẫn tới quyết định.
2. **Cơ thể mang chiến thuật:** vị trí module, góc vũ khí, đường nối và thiệt hại thay đổi khả năng thực tế.
3. **Thắng từ quyết định:** telegraph, nhịp tài nguyên, không gian và dự đoán tạo đối sách; tránh thắng tự động do chọn loại.
4. **Học có bằng chứng:** mỗi iteration lưu giả thuyết, diff, seed set, kết quả và mức bất định; thất bại có thể chuyển thành experiment.
5. **Thi đấu đáng tin:** không bán chỉ số, không LLM điều khiển ranked, package khóa, luật có version và kết quả tái lập được.

## 4. Vòng lặp và hành trình

```text
Ý tưởng → dựng Body + Brain → chẩn đoán → thí nghiệm → xem bằng chứng
  ↑                                                   ↓
  └── sửa một giả thuyết ← debrief ← ranked ← khóa phiên bản
```

**Phiên đầu, mục tiêu ≤15 phút (cần usability test):** chọn Synth mẫu → xem trận ngắn → AI/editor chỉnh một hành vi (“né lúc đối thủ lên nòng”) → chạy hai phiên bản cùng seeds → thấy ít nhất một quyết định thay đổi → lưu version đặt tên. Kết nối MCP là nhánh có hướng dẫn và có thể tiếp tục sau; không chặn tutorial vì OAuth host lỗi.

**Phiên 20–30 phút:** thử một matchup → xem ba bước ngoặt → thay một biến/hành vi → chạy holdout → chủ động xác nhận package vào ranked → xem series hai lượt → lưu ghi chú. Không đẩy người chơi vào hàng chờ khi bot chưa có dấu ấn của họ.

**Tuần đầu:** sở hữu 2–3 lineage cho các phong cách, học dự đoán telegraph và đánh đổi energy/heat. **Dài hạn:** skill library riêng, thử chiến thuật đối kháng meta, mùa giải catalog mới và chế độ Laboratory để đề xuất cơ chế.

## 5. Chiều sâu “xây trí tuệ”

Brain hỗ trợ state machine có biến nhớ, so sánh utility integer, kỹ năng tham số, cảm biến cục bộ, mục tiêu phụ và sự kiện. Thí dụ `bait → evade → punish → recover` có thể ghi tick phát hiện telegraph và ước lượng hồi chiêu. Editor và MCP cùng tạo DSL, compiler sinh cùng IR. Không gọi điều đó là “tự học” nếu chỉ sửa luật: bot thích nghi trong trận bằng trạng thái/biến; huấn luyện tối ưu ngoài trận là tính năng Laboratory sau alpha.

Mỗi bot có **Behavior Card** do tác giả duyệt: mục tiêu, điều kiện tấn công, chiến thuật mất bộ phận, điểm yếu dự kiến. Đây là mô tả, không đầu vào để engine phán thắng. Debrief cho chủ bot thấy “nhận telegraph ở tick T; luật X chọn tiến; bị bắn ở T+N”; người xem chỉ thấy event chiến đấu công khai.

AI được khuyến khích đưa 2 phương án có tradeoff, xin mục tiêu người chơi rồi chạy thí nghiệm trong quota đã cho. Không tự biến một brainstorm thành 1.000 simulations hoặc ranked submission. Chính sách phân quyền ở 05.

## 6. Phạm vi theo bằng chứng

| Mốc sản phẩm | Bắt buộc | Chưa mở |
|---|---|---|
| Combat proof | 1 arena, 1v1, 6 archetype, 5 module chủ động, destruction, FSM, CLI, replay | Auth/monetization, nhiều map, multiplayer team |
| Vertical slice premium | Workshop, Brain Lab, Arena, debrief, art/audio nhất quán, local A/B, MCP local | Ranked public, arbitrary scripting, storefront |
| Closed ranked alpha | Account/OAuth, cloud drafts, jobs, series, rating, leaderboard, admin pause, 2 host MCP | Guild, trading, tournament lớn, MMO |
| Mở rộng được kiểm chứng | Seasonal catalogs, authored module SDK Laboratory, tourney, private skill templates | Player code thực thi trực tiếp trên server trusted |

Ranked là yêu cầu sản phẩm bắt buộc trước bàn giao alpha; thứ tự thực hiện gameplay trước không loại ranked khỏi phạm vi. Mobile alpha ưu tiên xem trận/debrief/bảng hạng và chỉnh tham số; editor hình học đầy đủ ở desktop/tablet, thông báo rõ trong UX.

## 7. Chất lượng cao cần kiểm chứng thế nào

| Thuộc tính | Gate cụ thể |
|---|---|
| Khác biệt hành vi | 3 cặp cùng Body nhưng Brain khác nhau tăng mean leg score (win 1 / draw 0.5 / loss 0) ≥0.15 trên 200 kịch bản holdout khác nhau mỗi cặp; paired bootstrap 95% có lower bound >0 theo 09, kèm trace giải thích được |
| Trận kể chuyện | ≥80% trong ít nhất 12 người thử nhận đúng windup, module mất và một bước ngoặt, không cần nhìn log |
| Người mới làm được | ≥8/10 người mới hoàn thành tạo/sửa/thử/đọc một khác biệt ≤15 phút, ghi cả trợ giúp đã dùng |
| Tinh chỉnh AAA | Bộ art/audio complete cho slice; không asset placeholder ở các flow công bố; animation không che collider/telegraph |
| Trơn tru | Frame budget, tải đầu, replay seek và accessibility đạt 09 trên thiết bị thật đã ghi cấu hình |
| Công bằng | Determinism, đổi bên, kết quả/rating idempotent và ownership tests đạt; không suy luận từ FPS |

Các ngưỡng là **gate lựa chọn ban đầu**, không số liệu đã đo. Nếu không đạt, sửa trải nghiệm hoặc luật trước mở rộng module/season. Với nghiên cứu nhỏ, báo số người và quan sát, không gán “ý nghĩa thống kê” cho 10 người.

## 8. Chỉ số và kinh tế

North star: **số người mỗi tuần tạo một cải tiến bot có bằng chứng và quay lại dùng bot đó**. Đo sự kiện `experiment_completed`, `version_created`, `ranked_series_completed`, `return_session`; không lấy tổng simulations làm thước đo vì spam và botting làm sai.

Theo dõi funnel tạo bot → validation → experiment → revision → ranked → return; thời gian đến trận đầu, tỷ lệ replay được dùng để tạo experiment, archetype diversity, wait time, chi phí CPU cho người hoạt động. Retention D1/D7/D30 là mục tiêu khảo sát, chưa đặt benchmark tăng trưởng không có baseline. Phân biệt vòng lặp AI tự chạy với hành động người thực.

Không bán power, module, ngân sách CPU ranked hay sensor tốt hơn. Sau chứng minh retention mới thử cosmetics, workspace tiện ích và hosted experiment credits có giới hạn; CLI local cho phép thử miễn phí, quota cloud không được thay đổi tài nguyên bot trong trận. Season mới mở catalog đồng thời cho mọi người.

## 9. Những điều có thể thay đổi

Tên thế giới, tỷ lệ module, giá trị damage và art lighting có thể điều chỉnh qua thử nghiệm. Bốn yêu cầu gốc, authority server, privacy Brain, replay verification, bất biến versioning và explicit ranked intent là hợp đồng sản phẩm. Roadmap mở rộng phải giải thích nó cải thiện trí tuệ/chiến thuật/khả năng đọc trận ra sao.
