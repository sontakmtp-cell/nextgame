# 07 — Đấu hạng, bảng xếp hạng và vòng đời mùa giải

Ranked+leaderboard là thành phần bắt buộc của closed alpha, không là backlog tùy chọn. Combat source ở [02](02_GAMEPLAY.md), consent/tool ở [05](05_MCP_PLATFORM.md), data/finalizer ở [04](04_ARCHITECTURE.md).

## 1. Đơn vị thi đấu

Một **series** gồm hai leg cùng package, seed, engine/ruleset/catalog/arena binding. Leg0 A nhận left-slot pose/B nhận right-slot pose. Leg1 A nhận right-slot pose/B nhận left-slot pose đã khóa trong cùng preset, gồm y/heading/jitter của từng slot; không rotate arena bổ sung và không phản chiếu local body/Brain. “Mirrored” là tên UX của **counterbalanced slot assignment** này, không đảo chirality của bot. Không đổi bot giữa legs, không carry biến/resources, không gọi AI trong trận.

Thực thi slot assignment theo02, không whole-world rotation vì rotation toàn trận trên sân đối xứng sẽ chỉ tạo trận tương đương. Seed chọn init preset theo 02; server lưu scenarioId, presetValues, arenaInitDigest và slot assignment, rồi kiểm tra derivation. Body của mỗi participant giữ nguyên geometry local; relative orientation đến đối thủ từ pose slot mới. Pure rotation invariance vẫn có metamorphic test riêng.

Official seed do server mint và giữ kín trước matched; ghi vào manifest khi kết quả được phát, seed không chọn bởi MCP/user. Hai leg independent từ trạng thái ban đầu. Không thêm random tiebreak leg thứ ba. Leg win=1,draw=0.5,loss=0; series score `S=(s0+s1)/2`. UI công bố W/D/L từng leg, tổng, kết quả series và rating delta; không giấu draw. Một thắng+một thua =series draw. Chính sách score/version có digest riêng.

Dùng **một active ranked lineage/user/season**; người chơi vẫn có nhiều bot lab. Rating theo user theo season/bracket, đổi package không reset MMR. Package mới chỉ vào entry mới sau series cũ settle/cancel before matched. Alpha có một bracket catalog/budget chung, không “paying bracket”.

## 2. Admission và queue

Điều kiện: authenticated account không banned, owner package, validation passed đúng tuple digests của mùa đang mở, package/cost/Brain hợp lệ, web intent đúng và unused, quota entry chưa vượt. Body public, Brain private, người chơi biết phần nào bị chia sẻ trước approve. Intent được consumption atomic cùng unique entry và idempotency receipt; OAuth scope không thay nó.

Queue entry là snapshot bất biến, tồn tại tối đa24h nên **không cần cả hai người online**. Không tự tạo các defense matches không được yêu cầu ở alpha. Một submit cho phép đúng một series; muốn tiếp tục chủ động submit lại. Không auto-submit phiên bản mới của AI. Maximum20 series/day/user và5 submissions/hour; không charge lab execution credit cho official legs. Quota theo subject, web/MCP chung, account/IP controls chống spam nhưng NAT không tự ban cả nhóm.

State `queued → matched → running → settling → settled`; trước matched có `cancelled/expired`; sau matched chỉ operator void do infra/fairness, user không hủy để tránh loss. Các state công khai của submission có cùng nghĩa dù frontend mất kết nối. In-flight series không đổi policy khi season đóng admission.

Matchmaker dùng row locks, unique participant active constraints, không tự ghép user với mình. Loại previous opponent cùng package pair trong30 phút nếu còn candidate khác; tối đa3 series cùng user pair/day, chống win trade. Entry chờ lâu nhất là ưu tiên, trong pool chọn rating gap nhỏ nhất rồi queuedAt,server random keyed tie có audit; chưa đọc Brain để “ghép fair”. Package counter matchup không là selection criterion.

Rating window ±100 ban đầu; mỗi30s +50 đến±400 tại180s. Quá180s UI giải thích low pool, tiếp tục chờ/cancel hoặc practice; không NPC tính rating, không fabricate live opponent, không tự mở gap vô hạn. Một entry≤24h có thể match khi người khác tới sau. Nếu pool nhỏ, wait time cao là vấn đề acquisition/format, không benchmark worker. Theo dõi unique active subjects và coverage/timezone để quyết định async ladder khác sau alpha.

## 3. Rating baseline dễ kiểm chứng

Alpha dùng **Elo có giai đoạn provisional**, chọn vì dễ hiểu và ledger audit; Glicko2/TrueSkill là ADR sau khi cần uncertainty/inactivity, không để Agent tự chọn thuật toán.

```text
initial rating =1000; provisional nếu completedSeries<10
K_pair =40 nếu ít nhất một bên provisional, ngược lại20
E_A =1 / (1 + 10^((R_B-R_A)/400))
deltaA =roundHalfAwayFromZero(K_pair × (S_A-E_A))
deltaB =-deltaA
newA =oldA+deltaA; newB=oldB+deltaB
```

Application rating có thể dùng float64, version/runtime pin và store E/delta ledger; không thuộc deterministic combat hash. `roundHalfAwayFromZero` explicit, không JS `Math.round` negative asymmetry. Không clamp rating về0 vì phá zero-sum; UI rank tiers có minimum display Bronze, MMR signed int. K_pair giống nhau để provisional không tạo rating mass. Race series của cùng user bị unique active gate nên settle tuần tự; sorted row locks chống deadlock. Delta chỉ apply sau cả hai legs verified. Infra failed, cancelled, expired hoặc void chưa settle: delta0.

Fixture mandatory: bằng1000 A thắng cả2→+20 nếu provisional,+10 nếu không; một thắng/ một hòa→+10/+5; split win→0. Rating expected với unequal MMR, ±round ties, retry/fencing và season closure phải có golden ledger. UI badge không ảnh hưởng matchmaking: Bronze<1100,Silver1100..1299,Gold1300..1499,Platinum1500..1699,Master≥1700; đây threshold alpha cần hiệu chỉnh distribution, không nghĩa Master đạt chuẩn esports.

## 4. Leaderboard

Leaderboard season/bracket gồm rank, creator display name, active bot name/silhouette, rating, series played,W/D/L, last active và provisional badge. Public không email/token/private Brain/experiment notes. Một creator một hàng; cosmetic tên bot đổi không tạo slot mới.

Eligibility displayed ranked:≥10 completed series và≥1 series trong7 ngày; người chưa đạt ở tab provisional, không biến mất khỏi profile. Sort `rating DESC, seriesWins DESC, lastCompletedAt DESC, userId ASC`; equal rating cùng thể hiện rating nhưng ordinal rank khác theo tie policy công khai. Snapshot mỗi60s, `snapshotId/generatedAt/policyDigest`, pagination snapshot signed ở05. Read replica/cache không update rating authority; profile hiển thị ledger mới nhất và trạng thái “bảng cập nhật…” nếu snapshot chưa tới.

Season kết thúc lưu immutable leaderboard snapshot+policy+ledger refs; winner chỉ chốt sau dispute window72h và review abuse. Hồ sơ bot hiển thị record từng package, nhưng rating thuộc creator. Không suy từ winrate nhỏ rằng bot mạnh hơn top ladder.

## 5. Mùa, cập nhật luật và mở rộng

Alpha season28 ngày là cadence thử, không hứa marketing lịch vĩnh viễn. Mỗi season pin ruleset/catalog/engine+rating+queue policy. Balance update chỉ áp mùa mới; exploit khẩn cấp: pause admission, quarantine affected packages, công bố correction version và affected series policy, không sửa replay cũ. Với security fix không đổi semantics có engineDigest mới, vẫn reverify compatibility/validation; don't bypass digest because patch nhỏ.

Khi đổi mùa: stop admission trước closing time, finish matched series trong drain window15 phút; quá đó infra-void chưa rated và công bố reason. Archive old rules/artifacts để playback/verify. Tạo season mới rating reset1000 trong alpha; non-alpha soft-reset formula cần ADR trước áp. Mỗi package muốn tham gia phải revalidate binding mới, owner approve entry mới. Module release dùng Laboratory 1–2 tuần thử nghiệm mục tiêu, thời gian thật phụ thuộc gate chứ không lịch cứng.

Chỉ unlock cosmetics, achievement, profile collection qua progression. Toàn catalog ranked và Brain gas/sensors bình đẳng. New mechanics phải cho mọi người cùng ngày và suite/docs/tools discovery cập nhật đồng bộ. User skill library không bị reset khi season đổi; migration chỉ explicit với diff.

## 6. Abuse, integrity và khiếu nại

Trust worker artifact qua signature/digest/provenance, không client score. Rate-limit account creation và simulations, anti-collusion bằng repeat pair pattern, unusual one-sided module/idle behavior, account risk; tín hiệu chỉ tạo review, không tự reverse MMR theo một heuristic. Multi-account không giải được bằng fingerprint tuyệt đối; publish policy và appeal, thu tối thiểu dữ liệu cần thiết.

Dispute submit seriesId+reason trong72h, có receipt. Operator verify exact archived inputs bằng private access audited. Nếu chưa settle: void an toàn. Nếu đã settle: **không trừ lại delta riêng lẻ** khi đã có series sau vì Elo phụ thuộc trạng thái trước; rebuild season ledger từ event checkpoint với invalid series excluded theo thứ tự settle, tạo correction version và diff public, freeze leaderboard trong recompute. DB unique correction run id, operator review, backup+rollback snapshot. Giữ original ledger/replay, không overwrite bằng kết quả mới.

Storage dùng `ledger_runs/run_id`, unique `(run_id,series_id,user_id)` và active run pointer04. Mỗi series settle có monotonic `settle_sequence`; correction **pause admission và settlement**, drain/quarantine tất cả in-flight, lấy watermark. Recompute mọi completed series đến watermark trong candidate run, giữ invalid series excluded record, kiểm totals/ordering; activate ratings+leaderboard snapshot+run pointer trong một transaction dưới season lock. Không resume trước activation. Pending series sau đó settle trên run mới; retry cùng run không duplicate, audit giữ cả before/after. Rollback pointer trước reopen, sau reopen cần catchup/rebuild chứ không quay snapshot cũ làm mất series mới.

Game pause switches riêng: ranked admission, experiments, mechanic catalog, API writes; read replay/profile vẫn dùng được khi incident. Admin endpoints RBAC+MFA/audit, không MCP admin tool. Mỗi action reason và affected IDs; vụ việc chứa private Brain không public source để “chứng minh”.

## 7. Gate alpha

Hai concurrent calls chỉ tạo một entry; stale package/human intent reject; không match same owner; hai legs transform đúng; destroy simultaneous/draw/timer scoring đúng02; worker retry không tạo third leg; rating apply once và zero-sum; leaderboard pagination consistent; withdrawal/season close races; corrupt/missing artifact không settle. Chạy load pool 20+ subjects để đo waits và throughput riêng, chạy low pool để UX không dối. Ranked release blocked nếu bất kỳ authority/privacy/finalization gate fail, dù gameplay đẹp.
