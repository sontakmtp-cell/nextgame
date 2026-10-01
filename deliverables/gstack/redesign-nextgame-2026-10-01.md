# Software Workshop Expert Teams — Nextgame v2

**Ngày:** 01/10/2026. **Phạm vi:** đọc toàn bộ tài liệu, tái thiết kế và lập kế hoạch triển khai; không xây game hoặc deploy. Gu điều phối trong task `/root`.

PROMPT Chiến được thiết kế lại thành nền tảng xây trí tuệ có cơ thể: bot modular, chiến đấu chủ động, Brain typed DSL, thí nghiệm có đối chứng và đấu hạng. Bốn yêu cầu cốt lõi của người dùng được giữ. Hướng mỹ thuật được chọn là Gốm Sống / Cốt Graphite. Bộ tài liệu là baseline để triển khai và đo chất lượng; chưa chứng minh game đạt cảm giác AAA.

Sáu tài liệu gốc được lưu nguyên byte và đối chiếu SHA-256 với original HEAD. Các tuyên bố production hoặc nghiệm thu v1 thiếu code/report trong checkout được ghi là chưa xác minh, không chuyển thành trạng thái completed v2.

## Decision card

| Phạm vi | Kết luận |
|---|---|
| Bắt đầu triển khai | **Go cho T01**, rồi T02–T03 để khóa contracts |
| Công bố game/ranked sẵn sàng | **No-Go:** chưa có implementation hoặc runtime evidence |
| Review tài liệu | Năm chuyên gia hoàn tất artifact; các findings được nêu đã đóng ở mức tài liệu |
| Security | Không có verified vulnerability; 3 delta corrections đã đóng ở mức thiết kế |
| Bước tiếp theo | Foundation/Contract Agents, sau đó Brain/Simulation theo DAG của 08 |

Không trung bình hóa điểm design để bỏ qua một gate chưa đạt. Quyết định phát hành sau này cần engineer chịu trách nhiệm review exact revision và bằng chứng thực thi.

## Team thực sự tham gia

Team task-local `gstack-nextgame`; host trả các canonical task names dưới đây. Cột cấu hình là model/effort truyền qua native dispatch theo skill policy. Host không cung cấp attestation riêng về model runtime.

| Chuyên gia / native task | Cấu hình dispatch | Kết luận và artifact |
|---|---|---|
| Product Reviewer `/root/gstack_product_reviewer` | gpt-6.1-sol / high | Autoplan CEO → Design → Eng → DX, đủ sáu nguyên tắc; ưu tiên slice, trace, readability và accessibility. [Raw](raw/product.md) |
| Designer `/root/gstack_designer` | gpt-6-luna / max | Ba hướng visual; chọn ceramic/graphite, đặc tả UX/art/audio và handoff. Preview/render chưa chạy. [Raw](raw/design.md) |
| MCP Builder `/root/mcp_builder` | gpt-6.1-sol / high | 16 tools, scopes, concurrency, quotas, human intent, privacy và SDK/App compatibility. [Raw](raw/mcp.md) |
| Security Officer `/root/gstack_security_officer` | gpt-6.1-sol / high | STRIDE, OWASP 2021 và 14-phase review theo phạm vi tài liệu; threats là lý thuyết, corrections được đóng ở mức design. [Raw](raw/security.md) |
| QA Lead `/root/gstack_qa_lead` | gpt-6-luna / max | Rà số liệu, timing, geometry/control ABI, sampling, ranked mapping, palette, links và fixture. [Raw](raw/qa.md) |

Mỗi chuyên gia có file ownership riêng và chỉ báo Gu. Không tạo thêm team/peers, không giả làm worker. Các ticket T01–T16 là kế hoạch tương lai, không phải công việc các chuyên gia đã triển khai.

## Quyết định hợp nhất

- Giữ learning loop, immutable packages, body destruction, deterministic engine và shared Application. Bổ sung active weapons, memory/skills và paired experiments.
- Slice đầu dùng Blade/Burst/Shield; Lance/Breaker hoàn thiện trước ranked alpha. Dash/boost chưa được chọn cho alpha để giảm complexity; validator reject action chưa hỗ trợ.
- Sim 60 Hz, Brain 10 Hz; windup slice tối thiểu 300 ms. Typed DSL trước arbitrary player code; mechanics mới qua reviewed registry và Laboratory SDK.
- Chọn center-control/damage/Core timeout score công khai của 02 thay đề xuất lexicographic trong raw product. Camping/counterplay phải qua ablation và playtest.
- Brain private; public replay dùng pose chunks và signed integrity. Exact re-sim cần đủ private inputs được cấp quyền, hoặc internal verifier có audit.
- Ranked hai leg cùng seed/package: đổi participants vào hai preset slot poses đã khóa, không mirror local Body hoặc rotate arena thêm. Pure whole-world rotation 180° chỉ là metamorphic test, không leg mapping.
- Elo dùng cùng K cho cặp, zero-sum và cập nhật một lần sau đủ hai leg. Queue snapshot tồn tại 24 giờ, không cần cả hai người online; NPC chỉ practice.
- Node/TypeScript modular backend, PostgreSQL, object storage, isolated workers; React/PixiJS cho web. Same-origin auth và MCP OAuth, SDK2 backend tách khỏi App bridge có peer SDK1.

## Findings và corrections

| ID / mức | Vấn đề | Nguồn sửa / trạng thái |
|---|---|---|
| QA-TIME / P1 | Blade 200 ms không phù hợp mục tiêu phản ứng Brain 10 Hz | 02 đổi sang 18/6/30 ticks; 300 ms windup |
| QA-ORDER / P1 | Arbitration theo moduleId mâu thuẫn geometry ordinal | 02/03 dùng canonical ordinal và rename invariance |
| QA-GRID / P1 | Anchor, orientation và control mapping chưa đủ chặt | 02 định nghĩa cell/Core transform, desired velocity, angular throttle và remainder |
| QA-SEEDS / P1 | Nhiều seed có thể tạo cùng trận, làm sai uncertainty | 02 định nghĩa 1.225 presets; distinct scenario IDs và disjoint holdout |
| QA-AIM / P1 | Expression có thể yêu cầu aim vượt giới hạn | 03 clamp Burst/Breaker ±256; Blade/Lance nonzero bị reject |
| QA-BO2 / P1 | Whole-world half-turn tạo hai trận tương đương trong sân đối xứng | 02/07 dùng fixed-slot participant assignment; 04/06/08/ADR đồng bộ |
| QA-CAPACITY / P1 | Target latency không khớp một worker host | 09 tách single-host bound, normal pool và stress pool assumptions |
| QA-METRIC / P2 | Win rate/Wilson và paired-score có hai pass rules | 01/02/09 thống nhất mean leg score, 200 scenarios/cặp và paired bootstrap |
| QA-CONTRAST / P2 | Hai token chưa đạt contrast trên Surface 3 | Designer tăng Line/Text muted; computed spot-check đạt ngưỡng |
| QA-FIXTURE / P2 | Bot mẫu chưa là counterplay exemplar | 03 gắn nhãn parser/canonical fixture; reference brains thuộc T05/T13 |
| QA-RESOURCE / thiết kế | Heat dễ trùng giới hạn energy nếu tản nhiệt quá nhanh | 02 tách cooling 60/giây khỏi energy regen 120/giây và tăng attack heat; T13 vẫn phải đo ablation |
| QA-COPY / P2 | Seed sampling/D08 khó đọc; raw design giữ BO2 proposal cũ | 02/ADR biên tập rõ số liệu; raw design ghi mapping cuối và proposal đã thay thế |
| SEC-COMPILER / assurance | Final IR cap không đủ ngăn expansion DoS | 03 thêm bounds trước allocation và compiler work/deadline |
| SEC-ORIGIN / assurance | Digest không chứng minh artifact được tin cậy | 04 thêm signed release, trusted keys và OS isolation |
| FD-01 / P1 | Một review có thể mint nhiều approval handles | 04/05 unique intent/review, CAS approve/revoke/consume; 09 negative tests |
| FD-02 / P1 | Ledger rebuild thiếu version và cutover an toàn | 04/07 có ledger runs, pause/drain, watermark, atomic switch; 09 gates |
| FD-03 / P2 | Public “checkpoint” có thể bị hiểu là full private state | 04/05 phân biệt public pose chunks và private checkpoints |
| SOURCE / tài liệu | Cooldown, impact, hosting/auth và completion claims v1 mâu thuẫn | Archive + source review + một nguồn authoritative mỗi domain |

Đây là defects/assurance obligations của thiết kế, không verified security exploits. Raw artifacts giữ lịch sử các pass; latest closure ghi kết luận cuối. Runtime controls vẫn phải được chứng minh khi code tồn tại.

## Bộ bàn giao

- [Mục lục chính](../../README.md): 9 tài liệu domain, [ADR](../../docs/v2/DECISIONS.md) và [source review](../../docs/v2/SOURCE_REVIEW.md).
- [Kế hoạch Agent](../../docs/v2/08_IMPLEMENTATION.md): 16 tickets, dependencies, owned paths, output, acceptance, gates và prompt nhận việc.
- [Bot fixture](../../docs/v2/examples/mantis.bot.json): mẫu đủ trường để triển khai parser/schema; không là bot đã playtest.
- [Archive v1](../../docs/archive/v1/README.md): sáu bản gốc và manifest SHA-256. Các file root cũ là navigation stubs.

## Validation và giới hạn bằng chứng

Đã kiểm tra archive bytes với original HEAD và manifest: cả sáu khớp. Bot JSON parse được; 8 modules, 11 cells, 72/100 points, Core 2×2, không overlap, liên thông và refs state/module đúng. Đây là structural checks, không schema/compiler/engine runtime validation.

Computed palette spot-check: Line `#8193A0` có minimum 4.13:1 và Text muted `#94A1AB` có minimum 4.96:1 trên năm backgrounds được khai báo. Các cặp đó đạt ngưỡng 3:1 và 4.5:1; chưa là full rendered accessibility audit.

MCP specialist đọc npm metadata và published tarball declarations, giữ SHA-512 verification. Website official spec/GitHub trả 403 nên protocol semantics dùng pinned skill references có provenance. Designer không có research web thành công hoặc preview/render. Không có code nên build, gameplay, browser, host OAuth, performance, restore và security attack gates đều **unrun**. Không gán QA/security score cho một sản phẩm chưa chạy.

QA closure không còn finding tài liệu P0/P1/P2 mở trong phạm vi đã rà. Kiểm tra 25 Markdown files đang hoạt động: 133 local links có đích tồn tại, gồm 23 heading-fragment links khớp headings đích; code fences cân bằng. `git diff --check` đạt. Sáu file archive không bị sửa khi tái cấu trúc.

Các giả thuyết còn mở có gate/owner: game fun, vai trò energy/heat, camping, DSL expressivity, TS throughput, art budget, host compatibility và low-pool demand. Review tài liệu chỉ cho phép bắt đầu T01, chưa cho phép gọi sản phẩm sẵn sàng phát hành.

## Hành động tiếp theo

1. **P0 — Foundation/Contract:** T01 → T02 → T03, khóa schemas, budgets và hash trước engine integration.
2. **P0 — Simulation/Art:** T04 → T06 và T08, chứng minh counterplay, determinism và readability trong slice.
3. **P1 — Platform/Competitive/QA:** T09 → T14 theo gates. MCP/ranked bắt buộc alpha; Apps T15 và Laboratory T16 sau đó.

Không commit, push, deploy hoặc publish trong task tài liệu này. Estimate thời gian trong 08 là planning assumption; hiệu chỉnh bằng prototype/asset measurements.
