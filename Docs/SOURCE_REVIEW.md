# Đọc toàn bộ nguồn và chuyển đổi v1 → v2

Người điều phối và các chuyên gia sản phẩm/mỹ thuật/MCP đã đọc toàn bộ sáu file tại checkout gốc. Các bản gốc giữ nguyên byte ở [archive](../archive/v1/README.md), có [manifest](../archive/v1/source-manifest.json). Không có mã nguồn, schema, examples, CI hay báo cáo release được viện dẫn trong checkout; không truy cập production để xác minh chúng.

## Những gì giữ, đổi và lý do

| Nguồn | Phần đã đọc | Giữ | Tái thiết kế / đích |
|---|---|---|---|
| `spec_demo.md`1434lines |41 mục:vision→geometry/brain→replay→MCP→milestones/security | Co-create,authority,fixed tick,versioned package,CLI,replay,host fallback | Demo triangle→premium product01; combat02; schemas03; arch04; ranked07 mandatory |
| `gameplay.md`566lines | Hành trình,ngân sách,Motor,body destruction,Brain,vòng4mùa,archetypes | Player architect,learning from loss,lineage,body influences behavior | Self-contact RPS→active attacks; objective+energy/heat; new silhouettes06 |
| `can_bang.md`787lines | Damage/RPS/LUT/cooldown/diversity/load/anti-stall/19tests | Integer semantics,ablation,side swap,counterplay diagnostics | Bỏ HP×damage equality/RPS diversity tax; matrix+bounds/holdout/gates02/09 |
| `BRAIN.md`91lines | FSM grammar,sensors,intents,gas,faults,validation | Snapshot two bots,atomic writes,state trace,budget,isolation | Expand modules/resources/skills/intelligence03; dummy-contact validation bỏ |
| `ky_thuat_my_thuat.md`664lines | Contracts,VFX/interpolation/softform/team encodings/heatmap/ring/detach/budgets/dark update | Presentation one-way,readability,seek/VFX seed,LOD,FX gallery,noncolor channels | Pixi/material art06; collider clarity; DOM accessibility; actual frame measurement |
| `PLAN.md`220lines | Architecture/web/MCP/auth/hosting/milestones+production addenda | Modular core,shared service,CAS,idempotency,version/replay | Single target stack04; new dependency plan08; remove inherited completion claims |

## Mâu thuẫn và claim không đưa sang v2

1. `gameplay` summary ghi defender cooldown6,`BRAIN/PLAN/can_bang` cập nhật18;`can_bang` body còn ví dụ relative impact symmetric dù header chuyển own velocity. Bộ v2 bỏ hệ damage contact và đặt timing/source duy nhất02.
2. Art v1 chủ yếu ngân sách nền trắng rồi thêm Dark Cyber; wobble/spring history có thể gây visual seek drift/collider mismatch.06 định nghĩa vật liệu/chuyển động/seek theo playback time và readability budget thống nhất.
3. `PLAN` có Cloudflare/D1/DO rồi VPS Node/SQLite,Vercel proxy; auth demo invite/password rồi Google open signup; đều không có implementation trong repo này.04 chọn một target+provider spike,migration từ production cũ là task riêng nếu sau này có dữ liệu/code thật.
4. Claims14/14,18/18,80%win,production auth và hosted MCP Apps thiếu reports/code tương ứng. V2 không coi là completed capability. Tất cả implementation gates unrun.
5. Brainv1 cấm mọi attack action,JSON chỉ move/turn; user muốn cơ chế sáng tạo lâu dài.03 chọn active module ABI+skills+versioned registry,tách user tactic tự do khỏi trusted mechanic plugin.
6. Spec demo trì hoãn leaderboard/rating; user mới yêu cầu bắt buộc.07/T12/T14 đưa ranked+leaderboard vào alpha exit criteria.
7. File gốc có nhiều absolute Windows links và relative link ngoài checkout. Archive giữ để provenance; active documents dùng relative links hợp lệ. Không tạo code/reports v1 giả để làm link historical pass.
8. Hứa “mọi người full re-sim” mâu thuẫn mục tiêu Brain private nếu public package chứa source.04/05 giải thích public playback/integrity vs operator exact verify rõ.

## Navigation tương thích

Root `spec_demo.md`→01+04;`gameplay.md`→02;`can_bang.md`→02+09;`BRAIN.md`→03;`ky_thuat_my_thuat.md`→06;`PLAN.md`→08. Chúng chỉ là bảng chỉ đường, không duplicate luật. Agent triển khai v2 phải đọc README, không dùngarchive làm acceptance.

## Phạm vi kết quả

Tái cấu trúc tài liệu và thiết kế, không implement game,deploy,commit/push hay sửa production. Chuyên gia MCP đã research publisher npm declarations+checksums; nguồn protocol từ pinned skill khi website403. Chuyên gia design không có screenshot/render task này. Những giới hạn đó được báo trong synthesis; không thể dùng review tài liệu như chứng minh game vui/an toàn/AAA đã đạt.
