# Báo cáo QA — thiết kế Nextgame v2

**Ngày:** 01/10/2026  
**Chế độ:** QA-only, đọc tài liệu và chạy kiểm tra tĩnh có thể lặp lại; không sửa tài liệu nguồn hay mã game.  
**Phạm vi:** [README](../../../README.md), [01–09 index](../../../README.md), [ADR](../../../docs/v2/DECISIONS.md), [source review](../../../docs/v2/SOURCE_REVIEW.md), [fixture](../../../docs/v2/examples/mantis.bot.json), [raw product](product.md), [raw design](design.md), [raw MCP](mcp.md), [raw security](security.md), và [bản tổng hợp Workshop](../redesign-nextgame-2026-10-01.md).

## Kết quả

Không còn lỗi tài liệu mức P0/P1/P2 trong snapshot cuối. Các lỗi hợp đồng và lỗi biên tập đã đóng ở mức tài liệu, rồi được kiểm tra lại tĩnh; chúng chưa được xác minh bằng engine hoặc ứng dụng chạy thật.

**QA health score: N/A.** Workspace chỉ chứa thiết kế; không có ứng dụng để chạy kiểm tra gameplay, UI, browser hay host. Không có rubric defensible cho điểm 0–100 từ các kiểm tra tài liệu này.

**Quyết định:** Go để bắt đầu T01 theo kế hoạch; No-Go để gọi game hoặc Ranked sẵn sàng phát hành, đúng với [gate 09](../../../docs/v2/09_QUALITY_SECURITY.md#8-release-và-rollback).

## Kiểm tra đã chạy

- Markdown: kiểm tra code fence cân bằng trên 25 tài liệu đang hoạt động; 133 đường dẫn cục bộ tới file đều tồn tại, và 23 fragment trong báo cáo này khớp heading đích. Sáu bản nguồn v1 nguyên byte được loại khỏi link-target scan vì [README archive](../../../docs/archive/v1/README.md) ghi rõ các link lịch sử ngoài checkout có thể không tồn tại.
- Fixture: parser JSON từ chối duplicate keys; kiểm tra cấu trúc cho thấy 8 module, 11 occupied cells, 72/100 build points, Core 2×2, không overlap/out-of-bounds, mọi cell liên thông tới Core, maximum vertex radius 2.23607 world units (2,236.07 milliunits), và state/module references có đích. Đây chỉ là kiểm tra cấu trúc fixture, không phải JSON Schema, compiler, Brain hay combat validation.
- Archive: 6 file v1 khớp byte count và SHA-256 trong manifest.
- Số học đặc tả: 1.225 spawn presets; ticks 0–5.399 là 5.400 ticks; control ticks 600–5.399 là 4.800 cơ hội; Blade windup 18 ticks = 300 ms; score tối đa 10.000. Capacity math ở 09 khớp 12/21 worker slots và lower bounds 35/70 giây cho một host 4 vCPU.
- Nhiệt/năng lượng: các chu kỳ Blade 54 ticks và Burst 72 ticks cho đúng các tốc độ ghi ở [02 §4](../../../docs/v2/02_GAMEPLAY.md#4-tài-nguyên-và-state-machine-vũ-khí): Blade 155,6 energy/s và 200 heat/s; Burst 150 energy/s và 183,3 heat/s. Core hồi 120 energy/s, tản 60 heat/s; một radiator nâng tản lên 120 heat/s. Đây là phép tính từ cấu hình, không phải kết quả mô phỏng hay cân bằng.
- Palette: Line `#8193A0` tối thiểu 4,13:1 và Text muted `#94A1AB` tối thiểu 4,96:1 trên năm nền tối trong [06 §4](../../../docs/v2/06_ART_UX.md#4-bảng-màu). Đây là phép tính token, không phải audit màu trên render.

## Findings đã đóng ở mức tài liệu

| ID / mức | Kiểm tra lại trong snapshot cuối |
|---|---|
| QA-TIME / P1 | Blade dùng 18/6/30 ticks; 18-tick windup đạt 300 ms ở 60 Hz. [02](../../../docs/v2/02_GAMEPLAY.md#3-catalog-alpha-0) và [06 §9](../../../docs/v2/06_ART_UX.md#9-arena-replay-và-debrief) đồng bộ. |
| QA-ORDER / P1 | Arbitration của Brain và gameplay tie dùng geometry ordinal chuẩn hóa, không dùng moduleId làm ưu tiên. [02](../../../docs/v2/02_GAMEPLAY.md#7-tick-và-công-bằng), [03](../../../docs/v2/03_BOT_BRAIN.md#7-intent-arbitration). |
| QA-GRID / P1 | Grid anchor/Core center, cell extents, orientation CCW và local-to-world mapping được nêu rõ ở [02 §2](../../../docs/v2/02_GAMEPLAY.md#2-cơ-thể-và-ngân-sách) và [§5](../../../docs/v2/02_GAMEPLAY.md#5-chuyển-động). |
| QA-SEEDS / P1 | Seed ánh xạ tới 1.225 preset đã định nghĩa; tuning/holdout yêu cầu scenario ID riêng và manifest lưu giá trị preset. [02 §6](../../../docs/v2/02_GAMEPLAY.md#6-arena-objective-và-kết-quả), [09 §3](../../../docs/v2/09_QUALITY_SECURITY.md#3-game-feel-và-intelligence-gate). |
| QA-AIM / P1 | Burst/Breaker clamp aim offset ±256; Blade/Lance từ chối giá trị khác 0. [03 §7](../../../docs/v2/03_BOT_BRAIN.md#7-intent-arbitration). |
| QA-BO2 / P1 | Leg 2 đổi người chơi giữa hai pose slot cố định, giữ y/heading/jitter theo slot; không áp thêm phép quay thế giới hoặc phản chiếu body. 180° chỉ là metamorphic fixture. [02](../../../docs/v2/02_GAMEPLAY.md#6-arena-objective-và-kết-quả), [07](../../../docs/v2/07_RANKED_LIVEOPS.md#1-đơn-vị-thi-đấu), [09 Q04](../../../docs/v2/09_QUALITY_SECURITY.md#2-test-matrix-bắt-buộc). |
| QA-BO2-RAW / P1 | Raw design report ghi rõ đề xuất quay 180° ở pass trước đã bị thay bằng final fixed-slot mapping, nên không còn mâu thuẫn với nguồn v2. [Raw design](design.md). |
| QA-CAPACITY / P1 | 09 tách normal/stress pools, 12/21 slots và lower bounds của host đơn; không gắn SLO 15 giây cho một host. [09 §4](../../../docs/v2/09_QUALITY_SECURITY.md#4-performance-targets-và-phương-pháp). |
| QA-METRIC / P2 | 01/02/09 dùng cùng pass rule: paired mean leg score ≥0,15 trên 200 holdout scenarios mỗi cặp, bootstrap 95% lower bound >0; Wilson chỉ mô tả. [01](../../../docs/v2/01_PRODUCT.md#7-chất-lượng-cao-cần-kiểm-chứng-thế-nào), [02](../../../docs/v2/02_GAMEPLAY.md#9-cân-bằng-bằng-thí-nghiệm), [09](../../../docs/v2/09_QUALITY_SECURITY.md#3-game-feel-và-intelligence-gate). |
| QA-CONTRAST / P2 | Hai token được tăng; phép tính năm nền đạt contrast target cho các cặp đã kiểm tra. Chưa phải full accessibility audit. [06 §4](../../../docs/v2/06_ART_UX.md#4-bảng-màu). |
| QA-FIXTURE / P2 | Mantis JSON được gắn nhãn fixture parser/canonicalization, không phải bot combat-ready hay counterplay evidence. [03](../../../docs/v2/03_BOT_BRAIN.md#3-botdefinition-logic). |
| QA-COPY / P2 | Khoảng trắng và diễn đạt seed/BO2 được sửa trong 02 §6/§9 và DECISIONS §D08; raw design cũng ghi rõ rotation proposal là superseded. Final pass không còn lỗi copy ghi nhận trước đó. [02](../../../docs/v2/02_GAMEPLAY.md#6-arena-objective-và-kết-quả), [DECISIONS](../../../docs/v2/DECISIONS.md#làm-rõ-d08-sau-qa), [raw design](design.md). |

## Chưa chạy và giới hạn

Không có game code, runtime validator, engine, web app hay service. Build, unit/property, simulation, Brain execution, replay/browser, screenshot/render, usability, accessibility trên thiết bị, performance/load, MCP hosts/OAuth, security attack, backup/restore và release gates đều **unrun**. Không có kết luận game vui, counterplay tốt, Ranked công bằng trong runtime, hoặc mức AAA đạt được.

T04 vẫn phải chốt fixture/ADR cho các trường hợp solver hình học chưa đủ định nghĩa trước khi áp damage; T05/T13 phải đo energy/heat, radiator/capacitor, counterplay và các balance gates. Giá trị nhiệt vừa cập nhật là candidate design, chưa có kết quả gameplay. Các acceptance và owner nằm trong [08](../../../docs/v2/08_IMPLEMENTATION.md) và [09](../../../docs/v2/09_QUALITY_SECURITY.md).

## Hành động ưu tiên

1. **T01 → T14:** triển khai đúng DAG; ghi PASS/FAIL/SKIPPED/UNRUN riêng cho từng gate. Không đổi No-Go phát hành cho đến khi các gate runtime bắt buộc đạt trên revision cụ thể.
