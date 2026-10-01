# 02 — Gameplay, cơ thể và chiến đấu

**Nguồn luật v2 duy nhất.** Bộ số `alpha-0` dưới đây là cấu hình prototype cần đo; thay đổi số phải phát hành ruleset mới. Đây là quyết định thiết kế, chưa là cân bằng đã chứng minh. ABI Brain ở [03](03_BOT_BRAIN.md), ranked ở [07](07_RANKED_LIVEOPS.md).

## 1. Hệ chiến đấu được chọn

1v1 autonomous combat góc nhìn top-down, cơ thể modular phá hủy được. Chiều sâu đến từ **không gian × nhịp vũ khí × tài nguyên × hành vi thích nghi**. Bỏ RPS tam giác và damage tự động khi chạm; tiếp xúc đẩy/chặn thân, vũ khí tạo hit theo action. Khiên có góc che, vũ khí có windup/recovery, đạn có thời gian bay, module bị phá làm mất khả năng.

Không có crit ngẫu nhiên, accuracy roll, sát thương mua thêm, bắt buộc trộn loại hoặc thưởng diversity tự động. Chuyên môn hóa là hợp lệ nếu có đối sách. Seed dùng chọn layout thử nghiệm/khởi tạo; arena ranked đầu tiên không có hazard random. Cơ thể và Brain phải cùng đóng góp vào thắng, không dùng AI judge.

## 2. Cơ thể và ngân sách

- Lưới vuông **12×12 ô**, một ô = 1 world unit; chỉ ô nguyên 0..11.
- Core là module **2×2**, đúng một; mọi module khác 1×1, tối đa **24 module kể cả Core**, tối đa **100 build points**. Không cần dùng hết budget.
- Ô không chồng nhau; toàn bộ occupied cells liên thông qua cạnh. Core footprint phải nằm trong grid. Đồ trang trí không chiếm ô, không tạo collider.
- Các module có `id` ASCII ổn định, `catalogId`, `cell{x,y}`, `orientation` 0/1/2/3 quay từng 90°. Core không xoay footprint; module footprint ở alpha đều vuông.
- Bot được xoay cả thân trong arena; local +X là trước, +Y là trái. Tâm thân cố định là tâm Core để phá module không làm tọa độ nhảy. World +X phải, +Y lên; renderer tự chuyển trục.
- Collider chính xác là hợp các ô đang nối Core; dùng convex polygon mỗi ô, không arbitrary user mesh. Có thể có lỗ và nhánh, không có bộ phận treo. Module active không được bắn xuyên ô của chính mình.
- Locked bounding radius từ tâm Core tới mọi collider vertex ≤**6500 milli-unit**, để mọi spawn preset và heading hợp lệ đều cách tường ≥1 world unit. Giới hạn này áp dụng cùng lưới 12×12, tối đa 24 modules và 100 points; editor báo radius khi đặt Core lệch. Không dịch spawn bí mật theo hình bot để cứu layout không hợp lệ.
- Module không nối Core sau destruction trở thành `detached` và ngừng hoạt động ngay; debris chỉ cosmetic. Không repair, nối lại, tách có chủ ý hoặc spawn drone ở alpha.

Validation ranked cần ≥2 thruster, ≥1 vũ khí gây damage; không đòi phải lao tới dummy nếu bot phòng thủ/bắn xa vẫn hợp lệ. Cấm stationary exploit bằng luật sân và objective, không phán “chủ động” mơ hồ.

**Grid ABI:** `cell{x,y}` là ô có góc dưới-trái `(x,y)` trong hệ grid +X trước,+Y trái; ô chiếm `[x,x+1]×[y,y+1]`. Core anchor là góc dưới-trái của footprint2×2, chiếm `(x,y),(x+1,y),(x,y+1),(x+1,y+1)`; tâm Core tại `(x+1,y+1)`. Tâm module 1×1 tại `(x+0.5,y+0.5)`; local milli-position của tâm là `(1000x+500-coreCenterX,1000y+500-coreCenterY)`, với coreCenter đã nhân1000. Bounds/collider vertices dùng corner integers×1000 trừ Core center. `orientation0=+X,1=+Y,2=−X,3=−Y`, tăng ngược chiều kim đồng hồ, angle=orientation×1024. Transform local→world dùng heading của bot vàLUT04; canonical geometry ordinal sort anchor `(y,x,catalogId,orientation)`. Grid anchor không là world origin, Core center mới là pose origin.

## 3. Catalog `alpha-0`

HP là số nguyên; mass dùng để suy ra khả năng cơ động lúc khóa gói. Point cost khác mass. Số sau dấu “/” trong vũ khí là thời gian **windup / active / recovery** theo sim tick.

| ID | Cost | Mass | HP | Nhiệm vụ |
|---|---:|---:|---:|---|
| `core` | 20 | 12 | 800 | Nguồn energy, mục tiêu kết liễu, footprint 2×2 |
| `thruster` | 6 | 3 | 180 | Lực tiến, strafe và xoay theo vị trí |
| `armor` | 4 | 4 | 300 | Chặn đường đạn và bảo vệ module phía sau |
| `blade` | 14 | 5 | 220 | Sweep cận chiến, damage 90, reach 1.5, 18/6/30 |
| `lance` | 18 | 6 | 200 | Đâm đường thẳng, damage 140, reach 3, 30/1/59 |
| `burst` | 16 | 5 | 180 | 3 viên ×32 damage, range 12, speed 18/s, 18/9/45 |
| `shield` | 12 | 4 | 260 | Cung che 90°, resource exchange, không damage |
| `breaker` | 12 | 4 | 180 | Đạn damage 60 + heat 180, range 6, speed 14/s, 24/1/65 |
| `capacitor` | 8 | 2 | 160 | +250 capacity energy, không tăng regen |
| `radiator` | 6 | 2 | 160 | +1 heat dissipation/tick khi còn nối Core |

Giới hạn catalog: ≤3 module weapon tổng (`blade/lance/burst/breaker`), ≤1 shield, ≤2 capacitor, ≤2 radiator, ≤6 thruster. Đây là trần độ phức tạp alpha; Laboratory có catalog riêng, không bỏ trần ranked bằng skin.

| Weapon | Energy khi bắt đầu | Heat khi bắt đầu | Hình học active |
|---|---:|---:|---|
| Blade | 140 | 180 | Sector 90° phía trước module, radius 1.5 |
| Lance | 220 | 280 | Capsule rộng 0.4 từ mặt module, dài 3 |
| Burst | 180 | 220 | Spawn viên tại active offsets 0, 4, 8 ticks |
| Breaker | 160 | 140 | Một projectile radius 0.1; không xuyên thân |

Blade và lance mỗi lần activation chỉ hit **một module đối thủ**, chọn time-of-impact sớm nhất, hòa theo khoảng cách từ muzzle rồi cell world được quy về hệ arena chuẩn; cùng giá trị còn lại dùng stable entity key. Không hit lặp mỗi active tick; sổ `attackInstanceId` nhớ mục tiêu. Projectile hit module đầu tiên dọc đường bay, biến mất; không đâm xuyên hoặc friendly damage ở alpha. Armor làm damage kinetic (`blade/lance/burst`) nhận vào **chính armor** còn700/1000; breaker là1000. Core/module khác1000. Không “armor aura” bảo vệ module không bị che.

Muzzle nằm trên mặt ô theo orientation + aim offset; quay vũ khí tối đa ±256 angle units (±22.5°). Blade/lance không có turret tự do: aim offset0, quay thân để chọn hướng. Burst/breaker dùng offset trong giới hạn. Self occlusion chặn projectile tại ô thân đầu tiên trừ ô firing module; viên bị hấp thụ không gây friendly damage, energy vẫn mất. UI cảnh báo đường bắn bị che.

## 4. Tài nguyên và state machine vũ khí

Core: energy capacity 1000, bắt đầu đầy; regen **2/sim tick** (120/giây). Heat0..1000, bắt đầu0; base cooling **1/tick** (60/giây) cộng radiator. Tại phase đầu tick: regen/cooling trước đọc Brain; clamp theo capacity hiện tại. Mất capacitor làm capacity giảm và clamp energy; mất radiator chỉ ảnh hưởng cooling tick sau.

Energy và heat tạo hai quyết định khác nhau: capacitor kéo dài burst trước khi cạn năng lượng; radiator tăng thời gian duy trì hỏa lực trước khi quá nhiệt. Nếu kích hoạt ngay sau mỗi chu kỳ, Blade có chu kỳ 0.9 giây, tiêu thụ trung bình 155.6 energy/giây và sinh 200 heat/giây; Burst có chu kỳ 1.2 giây, tương ứng 150 và 183.3. Core hồi 120 energy/giây nhưng chỉ tản 60 heat/giây; một radiator nâng tản nhiệt lên 120/giây. Đây là phép tính từ thông số đề xuất, chưa phải kết quả cân bằng đã chơi thử. T13 phải đo lựa chọn capacitor/radiator và đối chứng bỏ từng tài nguyên để xác nhận cả hai tạo chiều sâu hữu ích.

`idle → windup → active → recovery → idle`. Lệnh activate chỉ được nhận khi idle, module hoạt động, energy đủ và không overheated. Chi phí energy và heat trả ngay khi nhận; không refund khi mất module hoặc bị trượt. Mỗi phase đếm ticks từ0; phase dàiN được xử lý đúngN tick. Tick nhận activate là windup offset0; windup kết thúc mới sang active ở tick kế tiếp. Lệnh giữ activate khi recovery không queue tự động; Brain phải ra intent ở tick được nhận.

Heat sau cộng ≥1000 đặt `overheated=true`; cấm bắt đầu weapon/boost/shield, tắt shield ngay. Weapon đã windup được tiếp tục nếu module chưa phá (ngăn hủy đòn mơ hồ). Trạng thái hết khi heat≤600 ở phase đầu tick. Không slow tốc độ cơ bản vì heat: vừa cấm weapon vừa làm mất chuyển động khiến snowball quá mạnh. Visual vẫn cho thấy rủi ro.

Shield có toggle on/off (không attack phase), bật trả energy 40/heat 20, upkeep **1 energy/tick**, duy trì đến tắt, mất module, overheat hoặc thiếu upkeep. Có reset lock **30 tick sau tắt**. Shield center là tâm Core, radius bằng bounding radius lúc khóa gói +0.25, cung hướng orientation của shield theo thân ±512 angle units. Chỉ bảo vệ incoming từ ngoài cung đánh vào module bên trong; không chặn kẻ đã nằm trong radius, không chặn ring.

Với mọi incoming packets tick này nằm trong shield: tổng raw damage `R`; muốn chặn `B=floor(R×700/1000)`, thực chặn `min(B,2×energyAvailable)`, energy trả `ceil(blocked/2)`. Phân phối blocked theo trọng số raw damage bằng largest remainder, tie stable packet key. Nhờ xử theo batch, không weapon nào lấy lợi thế do iteration order. Shield không chặn heat trực tiếp: heat 180 của breaker nhân `unblockedRaw/rawRaw`, floor. Armor reduction áp **sau shield**; damage cuối floor, có thể0. Actual HP lost clamp vào HP đầu phase để không farm overkill.

## 5. Chuyển động

Mô hình kinematic có lực/thời gian tăng tốc, không physics engine float. Brain chọn thrust vector local `(forward,strafe)` mỗi trục −1000..1000, clamp độ dài bằng integer norm, `turn` −1000..1000; động lượng được tích phân qua sim ticks. Alpha **không boost**; action boost là reserved extension, validator từ chối.

Với locked mass `M`, thruster alive `N`, `N0` lúc khóa:

```text
drive = min(1000, floor(8 × N × 1000 / M))
vMax = floor(6000 × drive / 1000)             # milli-unit / giây
accel = floor(12000 × drive / 1000)          # milli-unit / giây²
```

M giữ nguyên trong trận: không tăng tốc nhờ bỏ giáp. Thruster loss có thể giảm drive, không buộc tier load bất ngờ. Vị trí thruster tạo torque: `lever_i=min(4000,isqrt(dx²+dy²))` theo milli-unit cách Core; `T=sum(1000+lever_i)` cho alive, `T0` lúc khóa; `wMax=floor(1024×min(1000,floor(T×1000/T0))/1000)` angle units/s. `T0=0` thì0. Thruster orientation tại alpha cosmetic, propulsion omnidirectional; không hứa mất “chân trái” tự làm lệch nếu không có force model. Vị trí xa lõi tạo dự phòng xoay nhưng dễ bị phá nhánh.

Giảm tốc khi không thrust: kéo từng component vận tốc về0 tối đa `6000/60` milli-unit/tick; khi thrust, approach desired velocity bằng accel/60, giữ remainder để không drift truncation. Angular velocity approach target theo acceleration2048 units/s², damping2048/s². Không teleport/đổi hướng tức thì. Khả năng mới có hiệu lực tick sau destruction.

**Control ABI cụ thể:** clamp input mỗi trục−1000..1000; `L=isqrt(f²+s²)`, nếuL>1000 thì mỗi trục `trunc(component×1000/L)`; nếu cả0 dùng damping trên. Desired local velocity `(trunc(vMax×f/1000),trunc(vMax×s/1000))`; rotate bằngLUT heading rồi clamp integer length≤vMax. VớiΔ=desiredWorld−currentWorld, step budget từ `accel/60` có integer remainder; nếu|Δ|≤step dùng desired, ngược lại `current += trunc(Δ×step/isqrt(Δ²))` mỗi trục. Desired angular velocity=`trunc(wMax×turn/1000)`; approach bằng angular acceleration2048/60, không xem `turn` là target heading. Sensor bearing phải qua controller/skill hoặc clamp proportional như fixture, không API tự face target. Khi vMax giảm, current velocity vẫn decelerate qua bước gia tốc/damping, không tức clamp vận tốc cũ; maximum command cap là vMax, quán tính có thể còn vượt ngắn hạn.

Remainders tách acceleration scalar và position per-axis: mỗi tick cộng rate integer vào accumulator, quotient chia60 trunc về0, giữ residualsigned <60; acceleration budget nonnegative, position/heading có signed residual. Khi approach đã đạt desired thì reset acceleration residual0 để không tích “lực miễn phí” trong idle; khi đổi dấu target heading velocity, giữ integration remainder vật lý. Normalize Δ vớiisqrt floor có thể làm rounding norm cao hơnstep; clamp resulting delta length≤step bằng cùng integer normalization trước apply. State/remainder checkpoint rõ, không floatingdeltaTime.

Body collision: swept convex cells, tối đa4 solver iterations/tick, sort contact theo time-of-impact và geometric key; inelastic normal response, giữ tangential velocity, không damage do contact. Solver phải đối xứng hai bên, correction chia theo locked mass; remainder về bot theo geometric world key (không actor A ưu tiên). Nếu overlap chưa giải hết, giữ last nonoverlap pose và ghi diagnostic; không thêm bước solver tùy máy. CCD cho đạn và lance cần thiết để không xuyên ô. Chi tiết solver được chốt bằng fixtures T04 trước thêm art; không dùng Pixi collision hoặc deltaTime browser.

## 6. Arena, objective và kết quả

Sân **40×28 unit**, tâm(0,0), tường collider. Spawn Core tại(−12,0)/(12,0), hướng vào nhau; bot footprint phải có khoảng cách tường≥1 lúc spawn. Ranked arena open, không chướng ngại; map mới thêm sau gate chiến thuật. Camera cho toàn sân, không thay hitbox theo zoom.

### Seed → trạng thái khởi tạo có ý nghĩa

Tọa độ trên là **preset trung tâm**, không phải mọi seed cùng snapshot. Catalog `open-alpha-init-v1` có 1.225 presets, là tích Cartesian của `yLeft,yRight ∈ {−3000,−2000,−1000,0,1000,2000,3000}` và `jitterLeft,jitterRight ∈ {−128,−64,0,64,128}` angle units. Tọa độ X cố định: left = −12000, right = 12000 milliunits. Heading cơ sở hướng tới Core đối phương qua integer atan/LUT ở tài liệu 04, rồi cộng jitter tương ứng. Presets được sắp lexicographic theo `(yLeft,yRight,jitterLeft,jitterRight)`; `scenarioId=firstUint32LE(SHA256(seedBytes || "open-alpha-init-v1")) mod1225`. Seed là unsigned 128-bit, serialize thành 16 bytes little-endian; server dùng cryptographic randomness để chọn seed ranked. Modulo bias ≤1/2³² cho mỗi preset được chấp nhận: mỗi series thử cả hai slot và người chơi không chọn seed.

Manifest ghi rõ `scenarioId`, `presetValues` và `arenaInitDigest`; worker kiểm tra derivation. Leg 0: A nhận left-slot pose, B nhận right-slot pose. Leg 1 **đổi hai bot vào hai slot poses đã khóa**: A nhận chính right-slot pose (gồm yRight/headingRight/jitterRight), B nhận left-slot pose. Reset resources/VM; không xoay thêm arena hoặc phản chiếu local Body/Brain. Jitter/offset thuộc slot, không đi theo actor: mỗi bot thử cả hai điều kiện xuất phát, và hai legs có thể cho kết quả khác nhau. Phép xoay toàn bộ thế giới 180° chỉ dùng làm metamorphic test riêng. Trong trận không có random hazards, crit hoặc noise; seed chỉ thay khoảng cách và heading khởi tạo. Radius 6500 bảo đảm khoảng cách spawn tới tường trên cả 1.225 presets. Thí nghiệm có thể chọn preset ID qua suite được duyệt; API không nhận tọa độ hoặc physics tùy ý.

Regression 100 seeds/cặp phải ánh xạ tới **100 scenario IDs khác nhau**; holdout 200 seeds/cặp phải tới **200 scenario IDs khác nhau**. Nhiều seed cùng preset không tăng sample size. Suite builder chọn hai tập IDs không giao nhau cho tuning/holdout trước khi chạy, tìm seed cho mỗi ID và lưu signed/versioned `seedSetDigest`; report công bố manifest sau khi đo. Baseline/candidate được ghép cặp trên cùng preset, opponent và version bindings, chạy cả hai slot assignments. Đơn vị thống kê là scenario ID, không phải từng leg. Do chỉ có 1.225 presets, kết luận chỉ nói về robustness trong phân bố arena-init này. CLI/fuzz có thể thêm kịch bản hợp lệ để kiểm tra numeric boundaries, nhưng không trộn chúng vào balance sample đã đăng ký.

Trận tối đa **90s =5400 ticks**. Vùng control circle radius 3 ở tâm hoạt động từ tick 600 (10s). Mỗi tick chỉ **một** Core nằm trong circle được +1 controlTick; hai hoặc không có Core thì không ai được điểm. Tâm Core xác định chiếm vùng, không cả silhouette. Đây là tài nguyên positional để bot phòng thủ vẫn có mục tiêu chiến lược và kiter phải trả giá.

Ring báo trước tại tick 3480 (58s), bắt đầu thu tick 3600(60s): bán kính25 xuống6 tuyến tính đến tick 5400; từ tick 3600 radius `25000 - floor(19000×(tick-3600)/1800)`. Ngoài nếu khoảng cách Core² >radius². Ring gây **50/1000 maxCoreHP mỗi giây**, tích remainder `maxCoreHP×50 / (1000×60)` mỗi tick ngoài; vào trong reset remainder0. Damage chỉ Core, bypass armor/shield, không tính damage_dealt. Không có thời gian grace phụ sau báo trước; giảm dần radius là tín hiệu tránh. Core không được heal nên không thể farm điểm.

Thứ tự kết thúc: áp toàn bộ damage tick → (1) cả Core 0: draw/coreDouble; một Core 0: đối phương thắng/core; (2) Brain vượt gas 10 decision liên tiếp: đối phương thắng/brainBudget, cả hai draw; (3) đến5400 ticks: timeout score. Không xử thua chỉ vì mất thruster hoặc weapon: turret/chiếm vùng/survival vẫn có giá trị đến cuối.

```text
D = floor(actualEnemyHPDamage × 1000 / enemyInitialTotalHP), clamp 0..1000
C = floor(controlTicks × 1000 / 4800), clamp 0..1000
H = floor(coreHP × 1000 / initialCoreHP)
score = 5 × C + 3 × D + 2 × H                # 0..10000
```

Damage do module bị detached **không** cộng damage score; chỉ HP damage địch thực nhận, không healing/overkill/ring/self occlusion. Timeout chênh≤**100/10000** là hòa, tránh một frame tranh vùng quyết định toàn series. Destroy Core luôn ưu tiên hơn score. Thời gian, ring, control và timeout đều là event engine, UI không tự quyết.

## 7. Tick và công bằng

Sim **60 Hz**; Brain chạy ticks0,6,12… (**10 Hz**) bằng cùng snapshot đầu tick. Intent giữ giữa decision ticks; activate chỉ là edge event của decision tick, không tự spam mỗi sim tick. Shield toggle áp đúng edge, thrust/turn giữ.

Tick index xử lý `0..5399`; `elapsedTicks=tick+1` sau commit. Control tích ở ticks600..5399 đúng4800 opportunities; hard timeout khi elapsedTicks=5400 (sau tick 5399). Ring formula dùng tick index khi phase bắt đầu; frame terminal ghi elapsedTicks5400 và radius endpoint6000 cho hiển thị, không xử thêm tick 5400 gây một control/damage tick thừa. Initial frame tickBoundary0 là trạng thái trước tick 0; pose boundaryN là trạng thái sau tickN−1. Checkpoint/seek theo boundaryN, combat event theo xử lý tick index.

1. Regen/cooling, expire effects, cập nhật resource flags.
2. Build observations từ world đầu tick; Brain decision khi đến lịch.
3. Thu tất cả intents; validate; resolve energy allocation per bot theo priority do Brain công bố, tie geometry ordinal chuẩn hóa của03. Không apply A trước rồi B quan sát hậu quả.
4. Advance movement, body CCD, fixed collision solver.
5. Advance weapon phases; spawn/sweep projectiles và melee; collect hit packets từ module đang alive đầu phase. Nếu bị phá cùng tick vẫn được hit đã thu.
6. Shield batch → armor → HP damage đồng thời; total HP damage clamp từng defender, attribution largest remainder nếu nhiều attacker.
7. Destroy all HP≤0, connectivity prune; cập nhật capability tick sau; aggregate heat/timer violations.
8. Objective, ring damage và kết quả. Ring Core kill tick này đồng thời cho cả hai.
9. Emit ordered combat events, pose frame, private decision trace và hash checkpoint.

Result không phụ thuộc actorId, tên module hay thứ tự JSON modules. Stable entity key để tie là gameplay ordinal từ canonical sort `(cell.y,cell.x,catalogId,orientation)`; moduleId chỉ để tham chiếu, không advantage. Sau canonicalization Brain remap references sang ordinal. Thay tên module không đổi gameplay result. Pure whole-world rotation180° và đổi nhãn slot phải cho outcome tương ứng; fixture hòa hình học phải dùng xử lý symmetric, không “A wins tie”.

## 8. Sáu archetype reference

| Archetype | Silhouette / module | Trí tuệ đặc trưng | Đối sách cần tồn tại |
|---|---|---|---|
| **Mantis** | Hai cánh hẹp, blade+thruster | Nhử windup, orbit rồi punish | Burst tạo vùng nguy hiểm, xoay giữ mặt |
| **Bastion** | Khiên rộng, shield+lance | Giữ trung tâm, chọn nhịp block | Breaker làm quá nhiệt, flank ngoài cung |
| **Kestrel** | Mũi tên lệch, burst | Đo khoảng cách, dẫn đạn, đổi lane | Ép objective, áp sát lúc recovery |
| **Ram** | Mũi dài, lance, armor trước | Commit có điều kiện, chặn lối lui | Sidestep windup rồi trả đòn |
| **Wisp** | Thân nhỏ lệch, breaker | Quấy tài nguyên, dự đoán shield toggle | Không shield khi bị bait, burst range |
| **Chimera** | Nhiều nhánh, blade+burst | Chuyển mode khi mất weapon/mobility | Phá nhánh và ép mode yếu |

Đây là template, không class khóa người chơi. Chassis hẹp, crab, ring, fan, wedge, asymmetric được làm cùng catalog. Mỗi archetype phải có package hợp lệ, Behavior Card, 2 biến thể Brain và 3 seeds replay fixture, đủ dữ liệu để thử counterplay. Không tuyên bố tỉ lệ thắng trước đo.

## 9. Cân bằng bằng thí nghiệm

Với 6 archetype có 15 cặp đối đầu: 15 ×100 seeds ×2 slot assignments = **3.000 trận**, cộng 6 mirror matchups ×100 ×2 =1.200 trận. Chạy regression set và holdout riêng; các seeds ranked không là training holdout công khai trước trận. Report win/draw, first-hit time, duration p10/p50/p90, control share, energy waste, overheating, module loss và death cause. CI nhanh dùng10 seeds; full balance là artifact release.

Gate ban đầu: p50 duration 35–70 giây; draw ≤15%; không một template thắng >65% toàn matrix; mỗi archetype có ít nhất một favorable và một unfavorable matchup. Ba cặp Brain cùng body phải tăng mean leg score (win 1/draw 0.5/loss 0) ≥0.15 trên ít nhất 200 holdout scenarios khác nhau/cặp, với paired-bootstrap 95% lower bound >0 theo tài liệu 09. Đây là điều kiện cần; adversarial bot contest và người chơi thật ở 09 tiếp tục kiểm tra exploit/counterplay. Wilson win-rate intervals chỉ mô tả, không tạo pass rule thay thế.

Tune theo thứ tự: telegraph/uptime → resource pressure → ranges/movement → HP/damage → objective. Không sửa đồng thời mọi trục rồi không biết nguyên nhân. Ablation: Brain default vs adaptive; objective on/off; radiator on/off; cùng mass khác vị trí; cosmetics high/off phải same result. Nếu fun gate fail, dừng hosted expansion và sửa combat trước.
