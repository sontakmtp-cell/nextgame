# Product review — Autoplan PROMPT Chiến / Nextgame

Người nhận: Gu, team gstack-nextgame. Phạm vi: tái thiết kế và kế hoạch thực hiện; không triển khai game. Ngày rà soát: 2026-10-01.

## 1. Kết luận để Gu tổng hợp

Chốt lại sản phẩm quanh lời hứa: **người chơi nghĩ ra một chiến thuật, cùng AI biến nó thành bot, nhìn bot thực hiện chiến thuật đó, hiểu nguyên nhân thất bại và sửa đúng một điều**. Cái cần chứng minh là quyền tác giả chiến thuật và khả năng học từ trận đấu. Một trò tự đánh đẹp nhưng người chơi không hiểu bot đang làm gì sẽ hụt lời hứa này.

Đồng ý baseline Gu: sinh vật mech modular 2D trên lưới vuông; lõi riêng; vũ khí chủ động; năng lượng và nhiệt; arena có tranh chấp trung tâm; sim TypeScript số nguyên 60 Hz và Brain typed DSL 10 Hz; web React/PixiJS; Node modular backend, PostgreSQL, object storage và worker riêng; ranked hai lượt đảo bên với cùng seed/package, cập nhật rating một lần theo series. Đây là **quyết định thiết kế mới**, chưa phải hệ thống được xây hoặc đo.

Ba điều chỉnh cần đưa vào bản cuối:

1. Vertical slice chỉ cần **Blade + Burst + Shield**, một Dash dùng cơ động và một arena. Lance/Breaker vẫn thuộc catalog đích, nhưng triển khai sau khi ba module đầu tạo được lựa chọn chiến thuật và phản công dễ đọc. Đây là sắp thứ tự việc làm, không bỏ quyền sáng tạo.
2. Brain 10 Hz yêu cầu đòn có telegraph đủ để bot phản ứng. Khởi điểm thử nghiệm: các đòn cần né/phản công có cửa sổ báo ít nhất 250 ms. Motor/aim và trạng thái đòn được sim cập nhật 60 Hz; không chạy toàn bộ combat ở 10 Hz. Nếu playtest thấy bot phản ứng chậm, đo rồi tăng nhịp Brain hoặc bổ sung primitive phản ứng có semantics công khai; không cho từng bot tự chọn tick rate.
3. Năng lượng và nhiệt phải tạo hai bài toán khác nhau: năng lượng quyết định **có đủ khả năng dùng đòn hay không**, nhiệt quyết định **dùng dồn liên tiếp có an toàn hay không**. Nếu hai thanh chỉ cùng cản một nút, bỏ một tầng khỏi slice trước khi đẻ thêm UI. Không cộng cả hai thành hình phạt ngầm khiến bot chết mà không hiểu.

Ranked và leaderboard thuộc MVP phát hành theo yêu cầu người dùng. Chúng đứng sau fun gate và integrity gate trong thứ tự xây dựng; không được hoãn vô thời hạn dưới tên "sẽ làm sau".

## 2. Nguồn đã đọc và giới hạn bằng chứng

Đã đọc toàn bộ sáu file, không chỉ mục lục:

| Nguồn | Dung lượng đọc | Điều dùng trong review |
|---|---:|---|
| `BRAIN.md` | 91 dòng | FSM first-match, snapshot chung, ngân sách bước, giới hạn sensor/action, phân biệt job failed với bot thua |
| `PLAN.md` | 220 dòng | Ranh giới core/application/adapters, vòng lặp MCP, version/hash, mốc và các claim hosted/production |
| `can_bang.md` | 787 dòng | Ma trận RPS, cooldown, tải Motor, bonus đa dạng, timeout score và bộ test matchup |
| `gameplay.md` | 566 dòng | Vòng nghĩ–luyện–chiến–mổ xẻ, hình dạng có ý nghĩa, tổn thương thay hành vi, five archetypes |
| `ky_thuat_my_thuat.md` | 664 dòng | Event → VFX, interpolation, visual identity, performance budget, chất lượng thấp, contradiction nền trắng/Dark Cyber |
| `spec_demo.md` | 1.434 dòng | Phạm vi, whitelist bot, replay/determinism, MCP before/after match, mục 37 sáu lời hứa gameplay |

Đã đọc đầy đủ role `gstack-product-reviewer.md` và `codex-runtime.md` trong package `c1/software-workshop`. Skill onboarding cloud cũng đã đọc theo chỉ dẫn môi trường; tác vụ chỉ viết tài liệu, không có manifest/app/service để install hoặc start. Không lưu script setup giả.

Repository được cấp chỉ có sáu tài liệu gốc. Không có mã, schema thật, bot mẫu, báo cáo M1–M4, kết quả benchmark, replay hoặc tài khoản để kiểm tra. Các câu "production đã nghiệm thu", "14/14", "18/18", "100 seed", "thắng 80%" là **claim được tài liệu kể lại**, không phải bằng chứng mà review này xác minh. Không suy ra VPS cũ còn vận hành hoặc code cũ có thể tái sử dụng.

Các sai khác thực sự thấy ngay trong văn bản:

- Cooldown được hiệu chỉnh lên 18 tick trong BRAIN/PLAN/can_bang nhưng bảng gameplay còn 6 tick và technical art còn mô tả cooldown 6.
- `can_bang` đầu file chuyển impact sang vận tốc riêng từng bên, mục 3.3 vẫn giải thích impact đối xứng; spec còn cảnh báo như chưa sửa.
- Luật thực thi mất hết combat/motor 10 giây khác các đoạn cảnh báo "dưới 5 combat sẽ bị xử thua".
- Technical art giữ nhiều quy tắc trên nền trắng rồi thêm Dark Cyber ở cuối; màu, contrast và vệt cần được kiểm tra lại trên nền đích.
- Các bảng về Core có dòng Búa bị Kéo khắc trái với vòng RPS chính; đây là ví dụ lỗi trong giải thích, không có code để kết luận bug runtime.
- `HP × damage = hằng số` không chứng minh hệ thống cân bằng: targeting, cooldown, cấu trúc, số bộ phận và điều kiện thắng đều ảnh hưởng kết quả.
- Cùng ngân sách không bảo đảm không tồn tại bot áp đảo. Cần đo exploit/dominant strategy, không dùng lời hứa "không có bot mạnh nhất" như định lý.

Những bất định còn lại: nhu cầu người chơi thật, thiết bị đích, hạ tầng thật, ngân sách mỹ thuật/âm thanh, khả năng kết nối MCP của host được chọn, chi phí runner, mức thông tin được công khai, và độ vui của active combat. Các đề xuất dưới đây là quyết định để thử nghiệm, không thay cho số đo.

## 3. Office Hours — sáu câu hỏi buộc làm rõ sản phẩm

Chế độ Startup: kiểm tra tiền đề trước khi mở rộng nền tảng.

| Câu hỏi | Phán đoán từ nguồn | Quyết định / hành động |
|---|---|---|
| Demand reality: ai đang cần? | Chưa có interview/cohort. Có giả thuyết: người thích robot đấu, autobattler và lập trình bằng AI | Nhắm trước người thích thử chiến thuật bằng ChatGPT/Claude, có thể ngồi desktop xem và chỉnh bot; không tuyên bố đã có demand |
| Status quo: họ làm gì hôm nay? | Có thể chơi autobattler, Robocode/Screeps, tự viết mô phỏng hoặc chỉ xem video robot; chưa quan sát | Thử xem họ có sẵn sàng dùng MCP để chuyển từ ý tưởng sang đấu thật, thay vì chỉ thích video |
| Desperate specificity: ba người thật? | Không có tên hoặc hành vi đủ bằng chứng | Mời 6–8 tester qua kênh chủ dự án có, ghi hành vi; review không tự liên hệ bên ngoài |
| Narrowest wedge: nhỏ nhất mà có giá trị? | Một bot, một lần chỉnh có tác động đọc được, một trận ranked công bằng | Một arena, một vòng AI → tập → phân tích → thay đổi → đấu; không social/economy/platform trước |
| Observation: đã thấy họ làm gì? | Tài liệu ghi nhiều gate kỹ thuật, thiếu dữ liệu người dùng làm việc không được trợ giúp | Test nhiệm vụ, không khảo sát "có thích không": tạo bot, xem một lần thua, sửa, thử lại |
| Future-fit: mở rộng tới đâu? | Có đường tiến hóa bot, meta và công cụ thiết kế | Wedge sáng tạo chiến thuật → ranked mùa → giải đấu/laboratory mechanics; chỉ mở sau tín hiệu hành vi |

**Vấn đề chí mạng:** chứng minh deterministic hoặc MCP hoạt động vẫn chưa chứng minh người chơi muốn cải tiến bot lần hai. **Bước tiếp theo:** vertical slice có trace chiến thuật và buổi chơi không hướng dẫn từng click. Độ tin cậy về nhu cầu hiện tại: thấp; độ tin cậy về thứ tự thử nghiệm: cao.

## 4. Autoplan, giai đoạn 1 — CEO Review

### Scope mode: SELECTIVE EXPANSION

Không có dữ liệu tăng trưởng, tài nguyên team hoặc phản hồi thị trường để nói sản phẩm đang thắng. Chọn mode này theo nhiệm vụ người dùng: giữ lõi người+AI, tự đấu và ranked, mở rộng đúng combat/khả năng lập trình, đồng thời bỏ những tầng chưa phục vụ lõi. Không dùng EXPANSION để suy diễn traction; không chọn REDUCTION vì rule đó cấm review feature mới mà người dùng đã yêu cầu.

### Thách thức tiền đề

| Tiền đề cũ / mới | Vì sao có thể sai | Cách giải quyết |
|---|---|---|
| Hình học tiếp xúc RPS tự sinh trận đấu thú vị | Tiếp xúc kéo dài tạo cọ xát, lợi thế loại cứng có thể át timing/Brain | Active windup → active → recovery, primitive aim và defensive windows; chạy A/B với slice đơn giản |
| Trộn ba loại bắt buộc giúp sáng tạo | Cộng hưởng trở thành checklist tối ưu, người chơi cùng một đáp án | Bỏ tax độc canh và RPS hard-counter; ngân sách/công suất/vị trí/exposure tạo tradeoff thực |
| Thêm code tùy ý là tự do tối đa | Hạ tầng không an toàn, nondeterminism, simulation farm và ranked bất công | Typed DSL có bộ nhớ, FSM, toán, queries spatial bounded, target ID, utility score, cooldown/energy/heat; mechanics catalog có version |
| Thêm năm vũ khí cùng lúc sẽ phong phú | Chưa biết một loại chém có đọc được hay phản công được không | Slice ba module; đưa hai module còn lại vào giai đoạn sau fun gate |
| Đồ họa AAA đồng nghĩa nhiều glow/hạt | Lấp telegraph/hitbox, giật máy, không ai hiểu | Ưu tiên animation có chủ đích, âm thanh, silhouette, camera, feedback; đo clip trên thiết bị đích |
| MCP sẽ làm việc đầu tiên dễ hơn | OAuth/host/schema có thể ngốn hết thời gian trước first fight | Web starter cho first success; MCP native flow là bắt buộc ở MVP release, host UI là nâng cấp |
| Cùng seed + đảo bên là đủ công bằng | Có thể còn ưu tiên ID, event order, sensor asymmetry hoặc crash lặp | Metamorphic tests và side-swap suites; series rating exactly-once; infrastructure failure không xử thua |

### Phiên bản 10 sao

Người chơi mô tả "một con nhện giả lùi, giữ khiên tới khi đối thủ hụt đòn rồi đánh chân". AI dựng một bot có silhouette riêng và giải thích tradeoff. Trận có chuẩn bị, né, hụt đòn, cửa phản công và bước ngoặt khi một module hỏng. Sau trận người chơi bấm vào đúng thời điểm bot quyết định lùi, nhìn sensor/rule/action, yêu cầu sửa một điều, so hai phiên bản trên cùng bộ đối thủ. Đấu ranked cho họ biết ý tưởng có hoạt động ngoài sân tập không. Họ muốn khoe cả bot lẫn một đoạn quyết định hay.

Khoảng cách hiện tại: toàn bộ mới có mô tả, thiếu prototype active combat, code runner mới, cảm giác âm thanh/chuyển động, ranked/leaderboard contract và người chơi thật. Không có đường rút gọn bỏ fun gate.

### Phạm vi và ưu tiên

- **Giữ:** người+AI qua MCP, tự chiến đấu 2D, authoritative sim, version/package hash, replay, bot có cấu trúc bị hỏng, budget công bằng, ranked và leaderboard.
- **Thêm đúng mục tiêu:** active combat, objective trung tâm, energy/heat có semantics, trace Brain, comparison cùng seed/opponents, rõ ràng trạng thái không an toàn/không đủ lực.
- **Cắt khỏi MVP:** guild, marketplace, nền kinh tế, bán stat, skin ảnh hưởng collider, PvE campaign, nhiều map, nhiều chế độ ranked, tournament phức tạp, host-specific viewer độc lập, LLM trong trận, microservice theo tên tính năng, arbitrary JS ranked.
- **Ưu tiên:** P0 tính đúng và giải thích được → combat xem được và phản công được → một lần sửa có giá trị → MCP end-to-end → ranked/leaderboard → mở catalog.

### Kill / pivot criteria

Đây là ngưỡng quyết định nội bộ cho prototype, không phải số thị trường đã đo:

1. Sau tối đa ba vòng tuning slice, phần lớn tester vẫn không chỉ ra được một nguyên nhân thua và một sửa đổi có căn cứ: dừng mở platform, pivot vào readability/trace.
2. Một archetype baseline áp đảo tất cả matchup sau side-swap, kể cả đối thủ được thiết kế để khai thác recovery: dừng thêm module, xử lý dominant strategy.
3. Chi phí chạy thử vượt quota có thể cung cấp công bằng ở ngân sách hạ tầng thật: giảm giới hạn sim/query, scheduling hoặc thời lượng trước khi tăng quy mô; không thu tiền mua sức mạnh.
4. MCP host mục tiêu không hoàn thành được vòng tạo→sửa→thử với auth thật: chưa mở lời hứa "AI thiết kế được"; giữ slice cho thử nghiệm và sửa adapter/auth.
5. Sau ba vòng cải tiến onboarding, không có ít nhất một nửa cohort prototype tự nguyện sửa và thử lại: xem lại core motivation. Cohort nhỏ chỉ cho tín hiệu, không chứng minh retention thị trường.

## 5. Gameplay được chọn và các đánh đổi

### Combat có nhịp, có quyết định, có cơ hội trả lời

Chọn hình thể mech có module nhìn được và các đòn **windup → active → recovery**. Vị trí gắn, góc bắn, reach, tốc độ xoay, đường tiếp cận và trạng thái module ảnh hưởng tác dụng thật. Không để cả thân gây damage vô hạn chỉ vì hai bot đang chạm nhau.

| Cấu phần | Hành vi và tradeoff cần thấy |
|---|---|
| Blade | Cung quét rộng, dễ trúng mục tiêu cơ động gần; phải tiến vào vùng nguy hiểm và để lộ recovery |
| Burst projectile | Ép đường tiếp cận, bắn theo hướng/target cho phép; projectile có tốc độ hữu hạn và vật cản module, tốn năng lượng/nhiệt, không auto-hit |
| Shield | Bảo vệ một sector, không bất tử; bật khiên làm hao năng lượng và giới hạn tấn công đồng thời theo luật catalog, dùng sai hướng vẫn hở |
| Dash | Đổi vị trí ngắn có thời gian chuẩn bị/cooldown; không vô địch tự động, không teleports qua module, dùng sớm để tiếp cận mất phương án né |
| Lance, giai đoạn mở catalog | Reach và đâm theo trục tạo lối chơi spacing; whiff recovery rõ và yếu khi bị vòng sườn |
| Breaker, giai đoạn mở catalog | Đòn nặng để phá thế shield/zone; chậm, telegraph lớn, bị né/phản công; không hard counter không thể chơi lại |

Thông số Gu (lưới vuông, lõi 2×2 riêng, trần 24 module gồm lõi, budget 100) là baseline của schema mới. Giá, HP, mass, energy, heat và reach cần nằm trong catalog/ruleset máy đọc được; không chép một bảng số chưa đo vào nhiều tài liệu rồi gọi đó là balance. Đếm module và ngân sách là hai ràng buộc khác nhau: core 2×2 vẫn đếm một module theo schema, không bốn ô; validation phải báo cả hai thang giới hạn.

**Sáng tạo không đồng nghĩa tùy ý sửa luật ranked.** Người chơi được sáng tạo cấu trúc, tổ hợp module, target selection, điều kiện né/phản công, đánh lạc hướng, ghi nhớ, chính sách dự phòng khi mất module. Sensor và actions không được đóng thành vài nút "rush/flank/flee". Skill template là điểm xuất phát có thể mở và chỉnh logic, không phải lựa chọn nguyên khối duy nhất. Mechanics mới chạy laboratory có manifest/cost/sensors/actions, review server và version trước khi vào một pool ranked. Phân biệt rõ "tôi lập trình một chiến thuật mới" với "tôi tự thêm quy tắc gây damage mới".

### Objective và kết thúc trận

Tranh chấp trung tâm cho người chơi một lý do tiến vào vùng nguy hiểm; sudden-death ring sau mốc Gu đã chọn chống trận kéo dài. Trước max duration, phá lõi vẫn là kết thúc trực tiếp. Timeout cần quy tắc công khai: ưu tiên điểm kiểm soát hợp lệ; bằng điểm so tỷ lệ HP core; bằng nữa hòa. Không nhồi lại công thức bốn trọng số cũ vào objective mới vì người xem không đoán được ai đang dẫn.

Phải định nghĩa **contested**, core vào vùng, một bên vắng mặt, cả hai chết cùng tick và sát thương môi trường. Đề xuất chỉ bot có core hoạt động mới giữ điểm; hai core trong vùng thì dừng tích lũy, không lấy tổng diện tích thân. Điểm là mục tiêu thứ hai có chủ đích, không một cộng thêm vô hình. UI phải hiển thị ai giữ vùng và trạng thái hòa; Brain nhận sensor objective/ring. Kiting, phục kích và turret đứng yên có thể hợp lệ nếu đáp ứng objective; không giữ sandbox ép mọi bot phải đâm dummy. Safety validation kiểm tra có thể chạy/không treo; behavioral warning và đánh giá chiến thuật là dữ liệu riêng.

Tradeoff: objective làm game dễ đọc và chống stall, nhưng có nguy cơ turret camping và giảm thuần robot deathmatch. Kiểm tra bằng cặp ranged turret/shield holder/diver: nếu camp trung tâm là đáp án duy nhất, chỉnh cover-free line of fire, contest geometry, energy và pressure của đòn; không vá bằng cấm một trường phái.

### Ranked và leaderboard

Một pool ruleset/season, một active package mỗi người; vẫn giữ nhiều draft. Một series hai leg đảo bên cùng seed và packages. Mỗi leg thắng/hòa/thua; tổng kết series thắng nếu một bên có nhiều leg thắng hơn, còn lại hòa. Không cập nhật rating sau từng leg. Retry hạ tầng dùng cùng identity/seed, không reroll để tìm kết quả đẹp.

Rating theo người/entry season; version bot mới không reset rating hay tạo account mới. Leaderboard hiển thị rating, số series, uncertainty/provisional, bot active và ruleset/season. Danh sách phải có pagination và chỉ cập nhật từ kết quả đã finalized. Không cộng điểm chỉ vì chạy nhiều simulation.

MVP low population nên có matchmaking server với package đã khóa; người khác không phải online cùng phút. Trận có nhãn "trận đã tính" khi phát replay. Chọn đối thủ gần rating với phạm vi nới dần, chặn tự đấu và limit lặp cặp; baseline/NPC dùng practice và không có điểm ranked. Đừng đặt người dùng vào FIFO vô hạn trong demo ít người. Chính sách đối thủ vắng mặt cần được Gu/Eng khóa trước auth/platform.

Hai leg tăng chi phí và thời gian xem. Hiển thị tổng series ngay, cho chọn xem từng leg hoặc highlights; không bắt ngồi xem đủ hai lượt để vào trận tiếp theo. Chống farming cần chống reroll pairing và điều tiết tần suất per account; determinism không giải quyết Sybil/collusion. Đưa vào alpha abuse review, không dùng nó làm lý do trì hoãn prototype.

## 6. Autoplan, giai đoạn 2 — Design Review

Điểm bên dưới đánh giá **độ đầy đủ của tài liệu hiện có** trên thang 0–10 của role. Không đánh giá UI đã render, không khẳng định keyboard/mobile/contrast đã pass. Baseline mới là đề xuất cải thiện, chưa được chấm thay cho sản phẩm chạy thật.

| Chiều | Điểm | Bằng chứng / thiếu gì | Điều cần để đạt 10 |
|---|---:|---|---|
| First impression | 5 | Một câu tự đấu rõ, nhưng nhiều ngôn ngữ cyber/hình học và tuyên bố thắng bằng meta | Hero clip 10 giây + một câu "Tạo bot cùng AI, để nó tự đấu, sửa sau replay"; tester hiểu mà không có người giải thích |
| Onboarding | 4 | Có vòng MCP dài, chưa có first success/tài khoản/host recovery đồng nhất | Starter trước OAuth MCP, first battle nhanh, sau đó một sửa chiến thuật; host thật hoàn thành từ docs |
| Information architecture | 5 | Editor/inspector/viewer rõ, có 6 doc lặp/mâu thuẫn | Bốn khu Xưởng–Sân tập–Đấu hạng–Replay, một primary action mỗi bước; nguồn schema/rules duy nhất |
| Interaction design | 4 | JSON import/export và seek có mô tả, chưa có active aim/module command/error flows | Prototype cả happy path, selection, drag/undo, conflict, invalid module và touch constraints; hành động bot rõ trong trận |
| Visual hierarchy | 5 | Core/HUD/team encoding có ý, Dark Cyber chưa reconcile nền trắng | Telegraph và core ưu tiên; UI chiến đấu tối thiểu; phân tích bật theo nhu cầu; đọc được ở chất lượng thấp |
| Feedback & response | 5 | Jobs queued/running/completed/failed đã có | Progress có trạng thái/job ID/estimated wait đáng tin; errors có cách sửa; damage/overheat/whiff đồng bộ âm hình |
| Consistency | 3 | Versioning tốt trên giấy nhưng balance/visual/runtime mô tả mâu thuẫn | Catalog/rules chung cho web/MCP/CLI; same terms, same parser, same errors; regression fixtures |
| Accessibility | 2 | Pattern/huy hiệu và LOD có; thiếu keyboard, focus, reduced motion/audio/canvas alternative | Keyboard editor/viewer, focus recovery, contrast đo trên nền đích, reduced motion, mute, event table tiếp cận được, hit flash có trần |
| Error prevention & recovery | 4 | Revision/hash/idempotency có; chưa có UX merge/conflict và auth/job recovery | Không ghi đè draft; show diff/resolve; reconnect lấy đúng job/match; undo và validation sửa theo path |
| Delight | 5 | Câu chuyện tổn thương/tách mảnh có ý tưởng | Một cú whiff→punish và một adaptation thấy được; animation/âm thanh nhất quán; tester muốn khoe clip/bot |

Maturity của tài liệu: Developing. Điểm mạnh: câu chuyện bot và replay. Điểm yếu: accessibility và tính nhất quán. Điểm này không nói thiết kế đồ họa đẹp hay xấu vì chưa có ảnh/video mới để xem.

**Top 3 theo ưu tiên CEO:**

1. First success và loop sửa một lần: starter → đánh tập → replay có nguyên nhân → sửa → so. Mục tiêu chuyển Onboarding 4 lên ít nhất 7 qua test nhiệm vụ.
2. Readability active combat và Brain trace: telegraph/whiff/recovery, energy/heat cue, module mất và đổi hành vi. Mục tiêu đưa Feedback và Delight lên 7 qua clip/playtest, không tự tăng điểm trên giấy.
3. Accessibility và recovery thành acceptance criteria ngay: keyboard, reduced motion, text event alternative, reconnect/conflict. Vì Accessibility <3, **đưa thành P0 theo Autoplan**. Không xây đủ UI rồi mới kiểm tra.

### Luồng cụ thể và quality bar cảm giác AAA

- **Xưởng:** silhouette lớn, panel module theo tác dụng, budget/mass/resource capacity dễ hiểu; nút chính "Thử bot". User thấy patch AI đề xuất và diff; bot draft không tự nhảy vào ranked.
- **Sân tập:** chọn archetype + một bài kiểm tra; có kết quả đơn giản, replay và compare. Đừng trả 30 số KPI để AI lặp vô hạn mà người chơi không hiểu.
- **Đấu hạng:** trước submit thấy package/version đã khóa, pool, tình trạng provisional; kết quả series rõ, một link xem replay mỗi leg.
- **Replay:** chế độ Xem và Phân tích. Xem tập trung combat; Phân tích có rule matched, sensor snapshot, target/action và lý do fallback. "Vì sao bot làm thế" dựa trace engine; AI được diễn giải, không bịa ý đồ.
- **Mobile:** MVP ưu tiên xem/inspect/replay và duyệt thay đổi; editor đầy đủ tập trung desktop. Không hứa parity code editor trên điện thoại khi chưa test; layout 360 px vẫn đọc được kết quả/nút chính.

"Cảm giác AAA" là mục tiêu chất lượng: anticipation, impact, recovery; audio có lớp và khoảng im; camera không che telegraph; vật liệu/silhouette thống nhất; UI gọn, animation chỉnh có chủ đích. Không phải tuyên bố đạt độ sản xuất AAA. Chọn một hướng hình ảnh sinh vật mech công nghệ sống: thân rắn có khớp, module nhận diện được, nét hữu cơ là secondary motion; tránh lò xo làm toàn bot lệch khỏi hitbox.

Mỗi cú trúng/hụt cần âm và hình khác nhau. Effects đọc event một chiều; giảm motion không thay luật. Seek replay phải dựng lại cosmetic từ event/time hoặc warm-up hữu hạn, không từ lịch sử playback không ổn định. Phân biệt sim hash bắt buộc và visual fidelity có thể khác theo LOD; không hứa mọi pixel y hệt ở mọi GPU/bậc chất lượng.

## 7. Autoplan, giai đoạn 3 — Eng Review

Đây là review kiến trúc **được đề xuất**, không code review hay chứng nhận an toàn.

| Khu vực | Lock | Risk | Action |
|---|---|---|---|
| Architecture | Engine không mạng/DB/UI; Application chung cho Web/MCP; catalog/contracts versioned | Chọn stack từ docs cũ hoặc tách microservice trước đo; Brain quá đóng | TS modular monorepo, integer sim, process workers tách CPU; typed DSL có query bounded; expose module API thay internal imports |
| Data flow | Draft revision → compile/validate → immutable package hash → queued series → workers → replay/result → rating | Submit revision sai; chỉ lưu hash không đủ reconstruct; upload replay thành công nhưng DB thất bại | Validation key chứa package/engine/rules/Brain version; immutable artifacts; idempotency và optimistic concurrency; state machine job/series/outbox |
| Edge cases | Hai bots sense cùng snapshot, damage simultaneous; infrastructure failed khác bot violation | Missing target, destroyed module, last motor, zero-energy, overheat, double KO, leg2 fail, lease expiry | Quy tắc fallback có trace; cùng failure taxonomy trong MCP/CLI/web; finalize rating chỉ khi đủ hai leg terminal hợp lệ |
| Critical tests | Determinism/side-swap/metamorphic và replay integrity có mục tiêu rõ | Không có code/test; 100 seed không bao quát query/collision/order/exploit | Property tests bounds/overflow, conservation/resource/cooldown, penetration/order; end-to-end immutable submit/two-leg/rating exactly-once |
| Performance | Sim 60 Hz, Brain 10 Hz, viewer display-rate nội suy; workers không block API | Projectile/query counts và flex geometry mở rộng không giới hạn; TS integer overflow; LOD che telegraph | Limit module/projectile/query/ops/memory/ticks trong ruleset; fixed-point intermediate safe bounds; benchmark p95/p99, queue, replay size và frame time trên device đích |

### Trace luồng dữ liệu cần khóa

`Human intent → AI MCP patch → draft revision → schema/catalog/geometry/Brain compile → package + validation report → practice job → trace/replay → revised package → ranked entry → two-leg series → immutable verified results → rating transaction → leaderboard snapshot`.

Trong official series, chỉ package, seed, engine, ruleset và Brain VM đã khóa ảnh hưởng trận. Không WebSocket/MCP action có quyền điều khiển, không prompt được feed vào combat. Package phải chứa hoặc tham chiếu đến artifact bất biến đủ khôi phục, không chỉ tên bot.

Replay lưu state/event cần viewer và checkpoints; trace Brain đầy đủ thuộc practice/owner analysis, tránh phát raw code/rule graph cho đối thủ nếu không có policy công khai. Public telemetry có thể là normalized intent/target/action, không suy ra engine đọc Brain đối thủ. Signature/hash chứng minh nội dung/authority, không tự chứng minh engine không thiên vị.

### Các P0 cần ưu tiên hơn feature

| Priority | Rủi ro | Điều kiện đóng |
|---|---|---|
| P0 | Nondeterminism, overflow, xử lý A trước B, projectile tunnel | Golden fixtures + repeat/side-swap/property tests, bounds documented; cùng packages+seed+versions cho cùng sim hash |
| P0 | Untrusted Brain/query không có resource cap thực | Parser/compiler/VM bounded, no I/O/clock/LLM, costed query, violations deterministic; job kill/retry không ghi bot loss |
| P0 | Version sai/cập nhật rating lặp hoặc series thiếu leg | Submit validation hash đúng; two-leg immutable; transaction unique series rating; worker lease/retry fixtures |
| P0 | Người chơi không đọc telegraph hoặc không thể dùng flow bằng keyboard | Design checklist có prototype và test thực; không claim pass trước chạy |
| P1 | Job/auth/conflict recovery thiếu, DX 🔴 | Structured errors, polling/reconnect, idempotency, draft diff; tested owner scope |
| P1 | Fun gate không có evidence | Cặp archetypes, clip, nhiệm vụ tester và baseline report; không xây scaling thay thế |
| P1 | Leaderboard không tách practice/provisional/pool | Queries chỉ finalized series đúng ruleset; UI state rõ và pagination |
| P2 | Catalog mới chưa có test chuẩn | Laboratory manifest + fixture/test matrix + reviewed activation theo version/season |

Baseline stack đủ thực dụng để làm thử; chưa có số đo chứng minh Node/TS đáp ứng tải hay 60 Hz. 60 Hz là nhịp mô phỏng game, không bắt server ngủ 16,7 ms khi chạy job offline. Worker có thể chạy nhanh nhất có thể trong budget rồi lưu replay. Nếu benchmark thất bại, tối ưu data layout/broadphase/query trước đổi ngôn ngữ toàn bộ; Rust/WASM là phương án sau số đo, không dependencies MVP bắt buộc.

## 8. Autoplan, giai đoạn 4 — DX Review

Mode **EXPANSION** cho bot SDK/catalog/DSL mới và MCP workflow mới, theo selective expansion CEO. Bảy chiều: getting started, API, errors, docs, tooling, migration, community đều cần phục vụ một vòng tạo–thử–sửa thực.

| Persona | Pain point chính | Mức | Fix gắn với CEO/Design/Eng |
|---|---|---|---|
| New developer / người dùng AI đầu tiên | Dài từ auth tới bot hợp lệ, AI dễ đoán tên action | 🔴 | Quickstart bot nhỏ hợp lệ, get_rules có capability manifest + examples đúng version, offline CLI và starter web; time to first success đo thật |
| Regular developer / người tinh chỉnh | Không biết rule nào sai, target/module nào khiến hành vi không chạy | 🔴 | Trace first-match/utility/query/fallback; validation path + codes + suggested fix; compare same opponents/seeds |
| Power developer | FSM/template thành preset cứng, thiếu toán/vector/query/memory | 🔴 | Typed values/spatial operators/query bounded, module handles/actions discoverable, memory và skill composition; escape hatch ở DSL có semantics và budget |
| Contributor | Sửa schema/render/combat dễ phá nhau | 🟡 | Contracts/core/application/adapters/render ownership rõ; golden fixtures; dev combat/fx lab; migration guides |

Các 🔴 nâng lên P1 trong plan hợp nhất theo role; P0 Eng vẫn đứng trên.

### Bảy chiều DX theo từng persona

Đánh giá dưới dựa tài liệu và proposal; tất cả kiểm tra trải nghiệm runtime vẫn chưa chạy.

| Chiều | Người mới | Người dùng thường xuyên | Power developer | Contributor | Hành động chung |
|---|---|---|---|---|---|
| Getting started | Thiếu bot mẫu hiện hữu trong checkout | Chưa có one-command repeatable loop | Thiếu batch practice tái lập | Không có manifest/toolchain | Quickstart và examples executable; CLI fixture chạy offline |
| API design | Khó biết action hợp lệ | Mỗi mặt web/MCP/CLI có thể lệch | Sensors cũ quá hẹp, cần query/memory | Dễ xuyên internal imports | Capability manifest/typed contracts, bounded query; enforcement module boundary |
| Error messages | Không biết sửa invalid bot ở đâu | Không biết rule/resource nào từ chối | Budget/query violation thiếu cost trace | Khó phân biệt bug platform với lỗi bot | Codes/path/tick/module và trace; failure taxonomy nhất quán |
| Documentation | Sáu doc dài trước first success | Luật cũ mâu thuẫn cooldown/impact | Thiếu recipes cho tactics phức tạp | Không rõ nguồn thật khi sửa | Một quickstart, generated reference, versioned design decisions và recipes |
| Tooling | Cần starter và web first practice | Cần compare/version diff | Cần batch seeds/opponents và query inspection | Cần combat/fx lab và fixtures | Shared CLI/application workflow, diagnostics và reproducible benchmark artifacts |
| Migration | Có thể bị bot invalid sau update | Không biết version cũ còn ranked được không | API mới phá behavior/memory semantics | Thay schema có thể phá replay cũ | Pool/version compatibility và draft migration; never mutate locked packages |
| Community | Chưa có nguồn recipes/support xác minh | Cần chia sẻ cách sửa bot | Cần đóng góp catalog có luật review | Cần contribution guide và ownership | Starter recipes/replay examples thật trước community portal; laboratory contribution checklist |

### Benchmark tham chiếu

Chưa chạy hay nghiên cứu benchmark current release của các công cụ dưới đây; đây là **đối chiếu khái niệm**, không số đo tốc độ/UX hoặc claim cạnh tranh đã xác minh.

| Chiều | Nextgame hiện tại | Robocode | Screeps | Yêu cầu mới |
|---|---|---|---|---|
| First success | Chỉ docs, chưa đo | Mẫu bot và trận là mô hình tham chiếu | Thế giới/scripting có onboarding riêng | Người mới chạy được first practice trong một phiên; nội bộ nhắm dưới 15 phút cho quickstart desktop |
| Error recovery | Có limits/hash trên giấy, thiếu runner mới | Cần học từ trace/debug loop bot | Cần học từ feedback code/state | Error structured theo schema path/tick/module, không chỉ "invalid bot" |
| Docs-first | Sáu docs lặp, thiếu file examples được dẫn | API và robot model là hướng tham khảo | API/world model là hướng tham khảo | Một guide + reference sinh từ contracts/catalog + examples executable |
| API surface | First-match JSON v1 quá hẹp cho active combat | Bot action API là góc tham khảo | Script/world API là góc tham khảo | Ít MCP workflow tools, bot DSL expressiveness cao có budget; không tăng tool cho mỗi module |

### Top 5 DX actions

1. **Capability manifest có máy đọc:** enums/schema/module actions/sensors/query limits/units, ví dụ nhỏ đúng ruleset; AI không đoán API. Docs và CLI sinh/check bằng cùng contracts.
2. **Một replay trace giải thích quyết định:** show world observation mà bot được phép biết, rule/skill đã chọn, target, command và resource rejection; dùng practice owner trace làm tập debug.
3. **Một workflow nhất quán:** web/MCP/CLI gọi cùng validate/compile/sim, cùng failure codes; jobs có retry-after/cursor/status, idempotency và revision conflicts.
4. **Conformance pack cho SDK và catalog:** minimal bots cho rush/kite/counter/zone/control/recovery-on-damage; mỗi bot có purpose và expected invariants. Không viết test chỉ mirror implementation.
5. **Migration theo pool:** declare API/schema/rules/catalog versions; old package vẫn replay được; version bot mới không đổi ranked silently; migration tạo draft, không sửa artifact đã khóa.

## 9. Kế hoạch hợp nhất và 6 nguyên tắc Autoplan

Không tạo bốn danh sách giao việc độc lập lặp cùng một rủi ro. Plan dưới đã hợp nhất CEO→Design→Eng→DX; P0 Eng và Accessibility<3 được nâng lên trước feature, DX 🔴 vào P1.

| Rank | Priority / nguồn | Action cụ thể | Nguyên tắc áp dụng | Gate / artifact |
|---:|---|---|---|---|
| 1 | P0 Eng + DX | Contracts catalog/units/version, Brain semantics/budget/query, package/validation key và safety boundaries | Explicit over clever; completeness | Spec máy đọc + examples + fixtures dùng chung, ownership rõ |
| 2 | P0 Eng | Headless engine slice, deterministic damage/physics/resource, swap/order/overflow/crash behavior | Pragmatic; action | Tests đã chạy và golden sim hashes; không dùng claim cũ |
| 3 | P0 Design + CEO | Viewer active telegraph/impact/recovery, keyboard/reduced motion, trace/phân tích | Boil lakes; completeness | Prototype ba module/arena; checklist thực, clip có evidence |
| 4 | P0 Eng + P1 CEO | Khóa immutable series hai leg, retry/fail states và atomic rating trước ranked; thực hiện persistence khi đến pha MVP | Explicit; pragmatic | Failure/retry/idempotency/integrity gate; không block slice offline bằng platform |
| 5 | P1 CEO + DX | Người chơi tạo bot và sửa một chiến thuật qua AI+MCP+practice; structured errors/conflicts | Bias toward action; DRY | Host thật + user task evidence; first success và iteration log |
| 6 | P1 CEO + Design | Ranked/leaderboard alpha, provisional/pool/empty queue và abuse controls | Completeness; boil lakes | End-to-end nhiều người/entries, leaderboard chỉ official finalized |
| 7 | P1 Product + art | Tuning archetype/metagame, audio/camera/material polish và performance on target devices | Action; pragmatic | Balance/playtest report và p95/frame traces |
| 8 | P2 Future fit | Mở Lance/Breaker, skill recipes rồi laboratory mechanics theo manifest review | Boil lakes; DRY | Catalog conformance + versioned activation; không đổi luật giữa season |

Áp dụng riêng từng nguyên tắc:

1. **Choose completeness:** MVP release phải có cả MCP, practice→replay→sửa, ranked+leaderboard, auth/job recovery, accessibility và integrity. Không gọi slice đơn lẻ là sản phẩm hoàn chỉnh.
2. **Boil lakes:** đào sâu một arena, một pool, ba module trong slice; giữ đường mở catalog. Không giải guild/economy/mobile parity cùng lúc.
3. **Pragmatic:** baseline TS/Pixi/PG/worker, DSL và module manifest rõ; headless benchmark trước server scale. Không áp kiến trúc triển khai cũ khi chưa có code.
4. **DRY:** errors/contracts/rules/catalog dùng chung cho web/MCP/CLI; bốn review hợp nhất actions; một viewer và một sự thật thắng-thua.
5. **Explicit over clever:** ghi rõ target invalid, resource rejection, contested, simultaneous KO, VM violation, infrastructure failure và retry/series transaction. Không AI judge hoặc hard-counter ngầm.
6. **Bias toward action:** dùng prototype và nhiệm vụ cụ thể để thay tranh luận abstract; ba vòng tuning có pivot criteria; mọi test cần artifact và kết quả thực.

Xung đột được giải theo role: hành động hơn phân tích kéo dài; đầy đủ hơn hoàn hảo; thực dụng hơn elegant. Tuy nhiên action không cho phép bỏ P0 integrity hoặc tự khai có bằng chứng chưa đo.

## 10. MVP → dài hạn và gói việc giao Agent

Các pha dùng gate đầu ra, không ước lượng lịch khi chưa có team/toolchain thật.

| Pha | Phạm vi | Gate đề xuất, chưa chạy |
|---|---|---|
| P0 — khóa design/contract | Một combat ruleset, module budget, DSL/query API, outcome/control, ranked series, UX states | Không có luật trọng yếu viết hai cách; examples hợp lệ; role ownership và fixture definitions |
| P1 — playable slice | Engine + viewer + editor tối thiểu + 3 module + dash + một arena + owner trace | Đòn có phản công; 3 archetypes tạo matchup khác; cùng body khác Brain thể hiện hành vi khác; mất module thay chiến thuật; determinism/safety pass |
| P2 — AI iteration + fun gate | MCP auth/tools/jobs, practice compare, first-run UX; cohort mục tiêu 8 tester | Ít nhất 5/8 hoàn thành first practice trong 15 phút không hướng dẫn từng click; ít nhất 6/8 chỉ đúng nguyên nhân một kết quả từ replay; ít nhất 4/8 tự nguyện sửa và thử lại. Đây là ngưỡng discovery nội bộ, không thống kê thị trường |
| P3 — MVP ranked alpha | Persistence, two-leg match, rating/leaderboard, quotas, failure handling, accessibility/performance | E2E hai client/entries qua MCP và web; mọi series rating exactly-once; retries không đổi bot/seed; provisional và pool đúng; backup restore và worker recover có evidence |
| P4 — polish và catalog | Lance/Breaker, recipes/utility behaviors, audio/VFX/camera pass | Combat clarity và resource tradeoff không giảm; bounded queries/runner benchmark đạt trên target đích; balance report đủ matchup |
| Dài hạn | Season, tournaments, share clips, laboratory mechanics, community recipes; nhiều arena chỉ nếu chiến thuật cần | Mỗi feature có nhu cầu/usage signal, catalog conformance và season/version compatibility; không hứa marketplace/economy trước tín hiệu |

Fun gate không ép win rate 50% ở mọi cặp. Cần thấy ít nhất một counter có nguyên nhân đọc được, recovery có thể punish, same-body different-brain tạo khác biệt, một bot bị thương có phương án dự phòng. Đo side-swapped matchup matrix nhiều seed và nhiều hình thể; vài bot reference không chứng minh toàn bộ meta cân bằng. Ngưỡng domination/exploit được balance owner đăng ký trước batch để tránh đổi gate sau khi xem kết quả.

### Work packages để Gu dispatch

Các package dưới là kế hoạch giao việc, chưa phải agent đã thực hiện hoặc kết quả QA.

| Package / chủ trì | Phạm vi sở hữu tương lai | Phụ thuộc | Acceptance cụ thể |
|---|---|---|---|
| Combat & economy designer | rules/catalog/outcome và fixtures design | P0 premise | Three-module slice; energy/heat distinct; contested/ring/KO đầy đủ; counterplay và archetype matrix |
| Engine / deterministic runtime | packages/core, VM interpreter và headless tools | Contract đã khóa | 60 Hz sim / 10 Hz Brain semantics; integer bounds, ordering, isolation/cost budget; reproducible hashes |
| Bot SDK & MCP builder | DSL docs/examples, MCP adapter và auth tests | Contracts + Application surface | Agent dùng capability manifest không đoán; two-host end-to-end thực; jobs/errors/idempotency scopes; không live control |
| Backend / ranking owner | app/jobs/series/rating/storage, workers adapter | Immutable artifact + engine | Transaction rating exactly-once; two-leg retry/fail/recover; owners/scope; leaderboard pagination/provisional/pool |
| UI / interaction designer | web shell/editor/replay analysis | Contracts + design flows | Task từ first success đến one-change comparison; keyboard/focus/conflict/reconnect; mobile viewing verified |
| Technical artist / audio owner | renderer/event VFX, combat lab, audio/camera | Engine events + combat timing | Telegraph không bị che, low-tier clarity, seek reconstruction, reduced motion/mute; sim kết quả không đổi |
| QA / balance / playtest owner | Test matrix, fixture capture, report | Từng package có executable | Critical-path/failure/integrity tests thực, device perf thực, tester observation; phân biệt unrun/failed/pass |

Gu giữ cross-member dispatch và ownership file; product reviewer chỉ đề xuất, không tự tạo team. Cho từng Agent exact files và contracts version; tránh giao hai người cùng schema hoặc rating transaction. Review code sau mỗi gate với artifact immutable, không dựa vào đoạn báo cáo thành công trong PLAN cũ.

## 11. Các bất định cần giải trong thực thi

| Bất định | Giả định để tiếp tục ngay | Cách đóng / quyết định nếu sai |
|---|---|---|
| Brain 10 Hz có đủ cảm giác counterplay? | Telegraph ≥250 ms cho đòn cần phản ứng; actuation 60 Hz | Measure trace/dodge/whiff trong slice; tăng Brain đồng loạt hoặc thêm reaction primitive công khai |
| Energy + heat có thành hai luật thừa? | Energy giới hạn burst tức thời, heat giới hạn sustained pressure | Test cùng archetype hai configuration; giữ nếu tạo tradeoff riêng dễ giải thích, nếu không đơn giản hóa |
| Trung tâm làm turret camp áp đảo? | Objective contested và ranged có recovery/resource weakness | Turret/holder/diver matchup, gameplay observation; chỉnh combat/resource/objective trước thêm map |
| DSL có đáp ứng "lập trình bot linh hoạt"? | Có toán/vector/memory/FSM/skills/query bounded, người dùng chỉnh được template | Thực hiện 6 tactics không dựng preset mới; nếu không, mở operators/data access theo contract, không arbitrary network JS |
| Ranked ít người có đối thủ đủ? | Asynchronous package matchmaking với user entries đã khóa | Dry-run population và lặp cặp; UX waiting chính xác; NPC chỉ practice |
| AI có thật sự giúp? | Hai host MCP mục tiêu xác thực và đọc schema được | Native end-to-end testing; SDK/transport/auth dựa chuẩn actual host, không mô phỏng bằng tool giả |
| Art có đủ chất lượng và nhẹ? | Desktop web đầu tiên, mobile xem/replay; PixiJS có LOD nhưng cues thiết yếu luôn giữ | Device target chọn trước, measure frame time + grayscale/readability/reduced motion; không suy fps từ 120 polygon |
| Privacy của bot/trace? | Draft và code riêng; public appearance/results/replay, normalized intent; owner raw trace | Khóa policy trước API/public ranked; usage review; permission tests |

Không có câu hỏi phê duyệt mới trong review này: người dùng đã trao toàn quyền tái thiết kế. Những khoảng trống có thể đo được được giao thành spike/gate có default rõ. Những thông tin vận hành như host/thiết bị/budget thật cần ghi trong backlog xác minh, không dùng làm cớ dừng tài liệu.
