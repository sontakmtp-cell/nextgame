# PROMPT Chiến — Đặc tả Art Direction và UX

> Bản giao việc cho UI, technical art và frontend. Hướng được chọn: **Gốm Sống / Cốt Graphite** — những Synth chiến đấu lắp ghép bằng giáp gốm, khung hợp kim tối và dấu nhận diện tiết chế.
>
> Đây là đặc tả thiết kế. Chưa có app, asset render hay prototype trong phạm vi công việc này. Các chỉ tiêu bên dưới là mục tiêu nghiệm thu, không phải kết quả QA.

| Thuộc tính | Giá trị |
|---|---|
| Sản phẩm | PROMPT Chiến — web game 2D, người và AI cùng thiết kế Synth tự chiến đấu |
| Tagline | **Build intelligence. Prove it in battle.** |
| Phiên bản tài liệu | v2 |
| Trải nghiệm | Workshop, Brain Lab, Arena/Replay, Ranked và Leaderboard |
| Renderer | React cho UI; PixiJS cho sân 2D; engine mô phỏng tất định là tiến trình độc lập |
| Trạng thái preview | Chưa dựng HTML, chưa render asset, chưa chụp ảnh |

## 1. Phạm vi và nguồn sự thật

Tài liệu này quy định ngôn ngữ hình ảnh, bố cục, trạng thái tương tác, asset pipeline và cách trình bày dữ liệu. Nó không đặt luật chiến đấu, chỉ số module, thuật toán xếp hạng hay định dạng Brain mới. Những dữ liệu đó phải được đọc từ hợp đồng dùng chung:

- Luật, module và telegraph: [02_GAMEPLAY.md](./02_GAMEPLAY.md).
- Brain và nhịp quyết định: [03_BOT_BRAIN.md](./03_BOT_BRAIN.md).
- Biên engine, sự kiện và renderer: [04_ARCHITECTURE.md](./04_ARCHITECTURE.md).
- Công cụ AI/MCP và quyền của người dùng: [05_MCP_PLATFORM.md](./05_MCP_PLATFORM.md).
- Ranked, mùa giải và dữ liệu công khai: [07_RANKED_LIVEOPS.md](./07_RANKED_LIVEOPS.md).
- Tiêu chuẩn chất lượng, bảo mật và dữ liệu: [09_QUALITY_SECURITY.md](./09_QUALITY_SECURITY.md).

Baseline v2 đã chốt: Synth ghép module trên lưới vuông 12 × 12; Core có footprint 2 × 2; tối đa 24 module tính cả Core; các module gồm Core, Thruster, Armor, Blade, Lance, Burst, Shield, Breaker, Capacitor và Radiator; năng lượng và nhiệt là tài nguyên hiển thị; mô phỏng chạy 60 Hz và Brain quyết định 10 Hz. Số liệu gameplay chi tiết chỉ lấy từ 02_GAMEPLAY. Bộ hiển thị dùng footprint canonical do schema trả về, không tự suy ra collider từ hình vẽ.

Sáu tài liệu gốc trong thư mục dự án mô tả hệ tam giác Búa–Kéo–Bao, lưới tam giác và hướng Dark Cyber cũ. Chúng được lưu ở [archive/v1](../archive/v1/). Định hướng v2 về module vuông và sinh thể cơ khí thay thế phần hình ảnh v1; không trộn biểu tượng tam giác/RPS cũ vào asset v2.

## 2. Tầm nhìn hình ảnh

PROMPT Chiến là xưởng thiết kế và đấu trường quan sát. Người chơi tạo ra một Synth có cấu trúc riêng, phối hợp với AI để kiểm tra giả thuyết, sau đó xem thiết kế ấy tự bộc lộ ưu và nhược điểm trong trận đấu. Không khí cần gợi ba điều cùng lúc: đồ vật có thể chế tác, cơ thể có thể bị tổn thương và dữ liệu trận có thể đọc được.

**Tính cách thương hiệu:** chiến thuật, chế tác, tự chủ, điềm tĩnh dưới áp lực.  
**Ba từ khóa:** cơ khí sống · kỷ luật · sáng tạo.  
**Câu định vị hình ảnh:** *Một trí tuệ chiến thuật có cơ thể, ghép từ giáp gốm và cốt hợp kim, do người chơi cùng AI thiết kế.*

### Ba hướng hình ảnh đã cân nhắc

| Hướng | Ngôn ngữ hình ảnh | Ưu điểm | Đánh đổi |
|---|---|---|---|
| **Gốm Sống / Cốt Graphite** — được chọn | Tấm giáp gốm ngà, khung hợp kim than chì, đường ghép và chi tiết cơ khí nhỏ; ánh sáng màu chỉ đánh dấu đội và trạng thái quan trọng | Silhouette module rõ ở kích thước nhỏ; hợp với Synth cơ khí; giữ vẻ cao cấp khi HUD nhiều; chi phí hình ảnh dễ khống chế | Cần thiết kế silhouette và vật liệu kỹ; nếu lạm dụng mảng vuông sẽ trông như xe tăng hoặc dashboard công nghiệp |
| **Hồ Quang Kỷ Luật** | Sân tối, lưới kỹ thuật, ánh sáng cyan/coral và viền phát quang, telemetry chiếm vai trò lớn | Tạo nhịp giải đấu mạnh; trạng thái nguy hiểm nổi bật; tạo bản sắc công nghệ | Glow và lưới dễ lấn át Synth, giảm đọc hiểu màu/độ tương phản và tăng chi phí render |
| **Bàn Thử Tác Chiến** | Workspace sáng như bàn thiết kế; nền giấy ấm, ghi chú blueprint, canvas Arena trung tính | Dễ tiếp cận với người mới; đưa việc lắp Synth và giải thích của AI lên trước | Arena có thể thiếu cảm giác căng thẳng; cần chuyển cảnh rõ giữa xưởng và chiến trường |

**Quyết định:** dùng Gốm Sống / Cốt Graphite làm ngôn ngữ chính. Dùng sự sáng rõ và ghi chú của Bàn Thử Tác Chiến trong Workshop/Brain Lab; chỉ dùng các điểm sáng kỷ luật của Hồ Quang trong combat, objective, vòng bo và trạng thái nhiệt. Không dùng neon làm viền liên tục.

### Tiêu chí nhận diện

- Synth là cụm module có cấu trúc, không phải sprite nguyên khối có hoạ tiết trang trí.
- Thân có khối lượng qua giáp chồng lớp, gân chịu lực, mối nối và chuyển động nhỏ; không làm mờ footprint thật bằng biến dạng.
- Mỗi bot tạo silhouette khác nhau bằng topology lắp ghép, không dựa vào skin để giả vờ khác gameplay.
- Dấu đội, loại module, Core, năng lượng và nhiệt dùng các kênh hình ảnh riêng; màu không phải kênh duy nhất.
- VFX làm rõ sự kiện; không phủ kín hình dạng hay che mất điểm gãy, muzzle hoặc telegraph.

## 3. Synth và hệ thống hình học

### Cấu trúc hiển thị

1. **Sân lắp ráp** hiển thị đúng lưới vuông 12 × 12 theo geometry contract.
2. **Module** là thực thể có ID, catalogId, cell và orientation lấy từ gói bot. Mỗi module có mặt giáp, khung tối, khe nối và glyph loại.
3. **Core** dùng footprint 2 × 2 và một dấu tâm dễ nhận ra. Bộ đếm module lấy trực tiếp từ validation report; không tự đếm cell để tính ngân sách.
4. **Silhouette toàn Synth** hình thành từ hợp các mảng giáp của module đang nối. Mỗi mảng asset riêng là khối convex; khoảng âm giữa các cụm được giữ để đọc được cánh, càng, đuôi, khe và mặt trước.
5. **Vỏ mỹ thuật** là lớp vẽ thuần tuý. Hình này không tạo hitbox, không đổi vị trí, tốc độ, sát thương, nhiệt hay kết quả trận.

Hệ tọa độ local lấy từ 02_GAMEPLAY: local +X là trước, +Y là trái; world +Y hướng lên. Renderer nhận body pose, module pose và hướng aim từ snapshot authoritative thay vì đoán từ hình. Màu vỏ, vết xước và decal là cosmetic; module ID và state gameplay mới quyết định dữ liệu hiển thị.

### Ngữ pháp tạo silhouette

Hỗ trợ nhiều cấu trúc bằng cách cho phép phối module tự do trong luật hình học. Các mẫu sau giúp AI và người chơi hiểu topology, không phải lớp nhân vật bắt buộc:

- **Mũi giáo:** trục trước rõ, thân thuôn về phía sau.
- **Càng kép:** hai nhánh trước tách ra, khoảng giữa mở.
- **Vành đai:** khối quanh Core, tạo vùng rỗng hoặc hành lang trong.
- **Khiên lệch:** mặt phòng thủ rộng, một cánh phụ kéo dài.
- **Chữ thập cơ động:** các cụm tỏa quanh tâm, khối lượng cân ở nhiều phía.
- **Móc bất đối xứng:** một nhánh công dài và một cụm đối trọng ngắn.
- **Vỏ compact:** footprint thấp và kín, nhiều lớp bảo vệ quanh tâm.
- **Sinh thể đa nhánh:** topology dạng nhánh với các đầu phụ dễ mất trong trận.

Ở thumbnail 64 × 64 px, đường viền ngoài và khoảng âm chính phải phân biệt được. Hình nền không được làm nổi giả một cánh không tồn tại trong layout. Thư viện mẫu v2 dùng Mantis, Bastion, Kestrel, Ram, Wisp và Chimera theo 02_GAMEPLAY; thẻ mẫu ghi silhouette, module budget, Behavior Card và revision lấy từ dữ liệu thật.

### Glyph module

Vật liệu vỏ và màu đội giữ nhất quán; loại module được mã hoá bằng glyph khắc trên tấm trung tâm, notch ở mép và tên văn bản. Glyph chỉ tạo bản sắc hình ảnh, không gợi thêm hiệu ứng gameplay:

| Module | Glyph/chi tiết hình ảnh | Cách đọc ở 24–32 px |
|---|---|---|
| Core | Tâm tròn đồng tâm trong footprint 2 × 2; viền kim loại vàng nhạt | Tâm Synth |
| Thruster | Cặp khe thoát khí ở mặt sau, không có lửa thường trực | Hai khe song song |
| Armor | Hai lớp plate chồng và chốt cạnh | Hai mép lớp |
| Blade | Đường chém chéo và mép vát đơn | Vệt xiên |
| Lance | Một trục nhọn hướng ra ngoài | Mũi dài |
| Burst | Ba dấu tia ngắn tách rời | Ba nhánh |
| Shield | Khiên lõm hoặc hai lớp cung ôm vào trong | Hai lớp che |
| Breaker | Đường nứt chia đôi khối đặc | Mảng tách đôi |
| Capacitor | Ba vạch tích điện trong một buồng kín | Vạch tích lũy |
| Radiator | Ba cánh tản nhiệt song song | Cụm lá |

Glyph có bản đặc, bản nét và nhãn cho trợ năng. Ở kích thước quá nhỏ, ẩn chi tiết nội bộ và giữ notch/glyph lớn; không thu nhỏ chữ tới mức không đọc được.

### Trạng thái thân Synth

| Trạng thái từ engine | Phản hồi hình ảnh |
|---|---|
| Đang ổn định | Tư thế cân, rung vi mô rất nhẹ, ánh sáng Core đều |
| Năng lượng giảm | Thước năng lượng đổi mức theo quy tắc màu; nhãn số vẫn hiển thị |
| Nhiệt tăng | Vệt màu hổ phách/đỏ cam khu trú ở cụm liên quan, kèm biểu tượng nhiệt và con số; không đổi màu toàn thân |
| Module hư hại | Đường rạn nhỏ trên đúng module; viền/glyph vẫn đọc được |
| Module bị phá | Chớp gốm trắng ngắn; mảnh cosmetic rời khỏi sân rồi tự tắt; module đã chết biến khỏi trạng thái engine ngay |
| Cụm không còn nối | Mảng giáp xám, đường đứt tại nối; cụm đứng tại vị trí sự kiện rồi mờ đi nếu engine loại nó |
| Vũ khí lên nòng | Telegraph hình học rõ ở đúng sector/capsule/đường đạn, theo weapon phase public của engine |
| Core nguy cấp | Vòng tâm đổi nhịp chậm, số liệu đọc được; không dùng strobe nhanh |
| Core bị phá hoặc trận kết thúc | Synth dừng, dấu sự kiện hiện rõ, kết quả xuất hiện trên HUD; hiệu ứng không che màn hình |

Chuyển động cosmetic không dùng spring/history drift. Vị trí và góc chỉ được lấy từ pose snapshots và nội suy giữa hai tick authoritative liền kề. Khi seek, presentation được tái dựng từ public pose chunks và event list; không giữ trạng thái VFX phụ thuộc thứ tự frame.

## 4. Bảng màu

Sân dùng dark graphite để đặt tương phản cho giáp gốm sáng. Màu đội là điểm nhấn trên viền/glyph, không phủ cả khối. Hai đội vẫn phân biệt được bằng hình, pattern và nhãn khi chuyển sang thang xám.

| Token | HEX | Dùng cho |
|---|---|---|
| Void | **#090D11** | Nền trang và vùng ngoài sân |
| Arena | **#0E141A** | Mặt sân 2D |
| Surface 1 | **#141C24** | Panel chính |
| Surface 2 | **#1B2630** | Panel nổi, menu, drawer |
| Surface 3 | **#25323D** | Hover/selected container |
| Line | **#8193A0** | Khung, divider và ranh giới UI có ý nghĩa |
| Line quiet | **#293640** | Lưới sân, seam, divider phụ |
| Text primary | **#F4F1E8** | Nội dung chính |
| Text secondary | **#B9C2C9** | Hướng dẫn và nội dung phụ |
| Text muted | **#94A1AB** | Timestamp, chú thích, metadata |
| Ceramic | **#D9D4C8** | Tấm giáp chuẩn |
| Ceramic lit | **#F1EADC** | Viền sáng cục bộ hoặc trạng thái được chọn |
| Alloy | **#39434C** | Xương chịu lực, khớp và mảng lõm |
| Team A | **#F27B59** | Viền, stripe và badge Đội A |
| Team B | **#65C8D4** | Viền, stripe và badge Đội B |
| Core | **#F1C86B** | Tâm/Core và điểm chú ý chính |
| Primary action | **#E8C56C** | CTA chính; chữ trên nút dùng Void |
| Success | **#55C58A** | Hợp lệ, đã lưu, thắng |
| Warning/heat | **#F0B85B** | Cảnh báo, nhiệt tăng, sắp hết thời gian |
| Danger | **#EC6A68** | Lỗi, nguy cơ phá huỷ, bị hạ |
| Info | **#7EBBE8** | Trạng thái thông tin và trợ giúp |

**Tách đội và loại:** Đội A/B là sắc đội; module dùng glyph, notch và nhãn, không cấp thêm một màu loại. Đội A có badge tròn một notch và stripe liền; Đội B có badge lục giác hai notch và stripe chia đoạn. Đường viền đội mảnh kèm badge phải đủ để định danh mà không tô cả thân. Leg 1/Leg 2 đổi vị trí sân theo quy tắc counterbalanced slot assignment nhưng ID và dấu đội không đổi.

**Quy tắc tương phản:** văn bản thường hướng tới WCAG 2.2 AA, tối thiểu 4.5:1; văn bản lớn và ranh giới/biểu tượng có ý nghĩa tối thiểu 3:1. QA đã spot-check một số token trên Surface 3 và yêu cầu cập nhật Line/Text muted; các giá trị trên đã được tăng. Cần đo lại và kiểm toàn bộ cặp màu trên render thật trước nghiệm thu. Không dùng riêng đỏ/xanh để phân biệt thắng thua hoặc đội.

## 5. Typography, lưới và thành phần

### Font

- **UI và nội dung:** Inter, có Noto Sans làm fallback glyph tiếng Việt; tự host WOFF2 đã kiểm tra license và đủ dấu.
- **Brain, seed, hash và số liệu kỹ thuật:** IBM Plex Mono hoặc Noto Sans Mono; fallback monospace của hệ thống. Nhãn có dấu tiếng Việt vẫn dùng fallback có đủ glyph.
- Không dùng font display condensed cho nội dung tiếng Việt dài. Tên Synth có thể dùng weight 650–700 nhưng giữ đủ dấu.
- Preload một weight regular và một weight semibold; font phụ tải khi cần để giữ budget app shell.

### Thang chữ

| Vai trò | Kích thước/line-height | Weight |
|---|---|---|
| Page title | 30/38 px | 700 |
| Section title | 22/30 px | 650 |
| Panel title | 18/26 px | 600 |
| Body | 15/24 px | 400 |
| Label | 13/18 px | 550 |
| Caption | 12/16 px | 450 |
| Data/Brain | 13/20 px | 450, monospace |

Không thu nhỏ body xuống dưới 14 px trên màn hình hẹp. Số quan trọng trong Arena dùng tabular numbers để thanh tài nguyên không giật vị trí.

### Grid, shape và controls

- Spacing theo bội số 4 px; khoảng thường dùng là 4, 8, 12, 16, 24, 32, 48 px.
- Panel radius 10 px; card nổi 14 px; nút/field 8 px. Không dùng một kiểu bo cho mọi lớp.
- Viền UI 1 px; focus ring 2 px màu Core hoặc Info, có khoảng thở 2 px.
- Button cao tối thiểu 40 px desktop và 44 px trên touch. Nút icon có accessible name và tooltip.
- Input luôn có label nhìn thấy được; lỗi nằm ngay cạnh trường và không chỉ đổi viền đỏ.
- Tooltip giải nghĩa ký hiệu không thể hiện trong glyph; không dùng tooltip làm nơi duy nhất đặt hướng dẫn.
- Shadow phẳng, nhẹ. Tránh glow liên tục, blur nền nặng và gradient nhiều lớp làm giảm tương phản.

## 6. Điều hướng và responsive

### Khung điều hướng chung

Header có logo PROMPT Chiến, trạng thái tài khoản, mùa/ruleset khi có liên quan, trạng thái kết nối và menu hồ sơ. Điều hướng chính gồm **Workshop**, **Brain Lab**, **Arena**, **Ranked**, **Leaderboard** và **My Synths**. Trang hiện hành có nền nổi và nhãn chữ; không chỉ đổi màu icon.

Desktop có sidebar cố định 224 px. Tên trang và action chính luôn thấy được mà không cuộn. Workspace giới hạn độ rộng theo công việc, còn Arena có thể tận dụng toàn khung.

### Breakpoint và cách xếp

| Khung | Hành vi |
|---|---|
| ≥ 1440 px | Sidebar 224 px; Workshop có module palette 224 px, canvas co giãn, inspector 300 px; AI collaborator là dock mở/thu độc lập |
| 1024–1439 px | Sidebar thu về 72 px; canvas chiếm ưu tiên; inspector mở bằng panel 280 px hoặc drawer |
| 768–1023 px | Điều hướng thành rail trên; palette/inspector đổi qua tab; canvas giữ toàn chiều rộng vùng làm việc |
| ≤ 767 px | Thanh điều hướng gọn; ưu tiên xem trận, debrief, leaderboard và chỉnh tham số Brain; AI chat mở bằng drawer |
| ≤ 479 px | Chỉ giữ trạng thái, tên Synth và action cần thiết; telemetry phụ chuyển vào tab; không cắt tên hoặc số liệu |

Geometry editor đầy đủ dành cho desktop/tablet. Trên điện thoại, người chơi xem trận/replay, xem diff, chỉnh tham số Brain được phép và quản lý phiên bản; khi cần lắp lại hình, UI giải thích và mở lựa chọn tiếp tục trên tablet/desktop. Không hiển thị editor hình học nhỏ tới mức không thể thao tác. Touch target tối thiểu 44 × 44 px; controls không nằm sát vùng gesture hệ điều hành.

### Sơ đồ khung Workshop desktop

    ┌──────────────────────────────────────────────────────────────────────┐
    │ PROMPT Chiến / Workshop                     Mùa · Đồng bộ · Hồ sơ   │
    ├────────────┬────────────────┬────────────────────────┬───────────────┤
    │ Điều hướng │ Palette module │ Canvas 12 × 12         │ Inspector     │
    │            │                │                        │ Core/module   │
    │ Workshop   │ Thruster       │   layout đang dựng    │ năng lượng    │
    │ Brain Lab  │ Armor          │   ghost placement     │ nhiệt/cảnh báo│
    │ Arena      │ Blade          │   lưới + khoảng âm    │               │
    │ Ranked     │ Lance          │                        │ AI đề xuất    │
    │ Leaderboard│ Burst/Shield…  │                        │               │
    ├────────────┴───────────────┴────────────────────────┴───────────────┤
    │ Synth v07 · module n/24 · Hoàn tác · Lưu · Validate · Experiment   │
    └──────────────────────────────────────────────────────────────────────┘

### Sơ đồ Arena mobile

    ┌──────────────────────────┐
    │ Arena · Đã tính · 00:42  │
    ├──────────────────────────┤
    │ Đội A      Đội B         │
    │ Năng lượng / nhiệt       │
    │                          │
    │        SÂN 2D            │
    │     objective            │
    │    bot A    bot B        │
    │                          │
    ├──────────────────────────┤
    │ Sự kiện | Chỉ số | Brain │
    ├──────────────────────────┤
    │ Play/Pause   X1    Seek  │
    └──────────────────────────┘

## 7. Workshop — người chơi và AI đồng thiết kế

Workshop là nơi chính để người chơi nghĩ hình, dựng module, trao đổi với AI và đánh giá phương án. Giao diện phải cho thấy trạng thái Synth lẫn thay đổi của AI trên cùng màn hình.

### Canvas và lắp ghép

- Canvas chính là lưới chuẩn 12 × 12, nền tối phẳng, grid vừa đủ để căn module.
- Pan, zoom, fit-to-frame và reset camera có nút riêng. Zoom không đổi cỡ controls.
- Ghost placement cho biết trước vùng chiếm, điểm nối, ngoài grid và xung đột validation trước khi thả.
- Kéo module bằng chuột/bút/touch trên desktop/tablet; bàn phím hỗ trợ chọn ô, di chuyển, xoay theo orientation schema, duplicate và remove.
- Khi chọn module, viền sáng quanh đúng module; identity đội và glyph vẫn hiện; inspector chỉ hiển thị dữ liệu do package và gameplay trả về.
- Hiển thị Core footprint 2 × 2, bộ đếm module n/24 và cảnh báo budget. Không suy từ số cell trên canvas.
- Toggle grid, contour, anchor, kết nối và energy/heat overlay. Overlay mặc định tắt nếu che mất silhouette.
- Undo/Redo, autosave, version label, trạng thái draft/validated/submitted; thao tác xoá cụm có Undo rõ ràng.

### AI collaborator

Alpha **không bắt buộc chatbot/LLM tự host trong web**. AI chat diễn ra ở MCP host của người chơi; dock web là panel brief/diff/experiment/review đồng bộ từ Application và mở link/context có quyền. Text input mục tiêu có thể lưu Behavior Card hoặc copy/attach sang host bằng action rõ; không ngầm gọi API model hay giữ API key. Nếu sau alpha thêm chatbot first-party, cần ADR về provider/budget/privacy/scope, không suy từ mock sidebar rằng service đó đã có.

AI hiện trong sidebar desktop hoặc drawer mobile. Luồng co-create:

1. Người chơi nhập mục tiêu bằng lời, có thể thêm ràng buộc về silhouette, budget, threat model hoặc hành vi Brain.
2. AI trả một **brief diễn giải**: điều đã hiểu, phần còn giả định, hypothesis và metric dự định xem.
3. AI đưa tối đa ba phương án topology/chiến thuật với silhouette, budget và trade-off ngắn.
4. Người chơi chọn; AI tạo **diff có thể duyệt** gồm module thêm/bớt/di chuyển, Brain state/rule đổi, lý do và validation liên quan.
5. Người chơi chấp nhận từng phần, hoàn tác, sửa tay, hỏi giải thích hoặc chạy experiment paired trên cùng seed set/binding.
6. Kết quả luôn gắn đúng revision/hash, baseline, candidate, số lần chạy và bất định. Sửa bot làm kết quả cũ hiện rõ là stale.

AI không thay đổi draft đang có mà không tạo revision/diff; không tự biến brainstorm thành batch lớn; không tự gửi Ranked. Ranked submit là action chủ động của người chơi qua human intent đã xác thực, không được suy ra từ OAuth scope, tool annotation hoặc confirmation text do AI viết.

Chọn module chỉ là trạng thái local của editor. Không gửi selection hay nội dung riêng sang AI host cho đến khi người chơi bấm action gửi/đính kèm. Tool workflow từ MCP và Web gọi cùng Application Service/ACL/quota theo 05_MCP_PLATFORM. Nếu MCP host chỉ trả text, đưa link mở đúng Synth/revision; nếu host không hỗ trợ Apps, Web Lab vẫn đầy đủ.

### Validation và AI lỗi

- Bot mới có các action rõ: mô tả ý tưởng cho AI, bắt đầu từ mẫu, hoặc lắp tay.
- Validation đặt marker tại module/cell, kèm tên quy tắc, cách sửa và nút focus vị trí.
- Nếu simulation chưa hoàn tất, hiện queued/running/completed/failed theo trạng thái thật; progress chỉ dùng dữ liệu backend. Có nút huỷ khi API cho phép.
- Timeout/lỗi hạ tầng ghi là job failed/retryable; không gán kết quả thua cho Synth.
- Nếu AI không hiểu yêu cầu, giữ nguyên draft và hiện phần chưa thực hiện hoặc câu hỏi cụ thể.

## 8. Brain Lab — kiểm soát hành vi

Brain Lab giúp người mới nhìn thấy quyết định của Synth, đồng thời giữ khả năng chỉnh sửa chính xác theo Brain ABI.

### Bố cục

- **Rail trái:** danh sách state/skill, search, reachable/unreachable từ validator.
- **Canvas giữa:** flow graph; state là card, transition là đường có nhãn điều kiện. Vị trí node chỉ đổi cách nhìn, không đổi priority/semantics.
- **Inspector phải:** điều kiện và intent thành form/cây logic; sensor, variable, mode và đơn vị lấy từ 03_BOT_BRAIN.
- **Tab Source:** JSON chuẩn để xem/chỉnh trực tiếp. Chuyển graph/source phải giữ semantics; parse error ở editor và có thể quay lại revision trước.
- **Trace strip:** khi mở sandbox/replay của chính chủ bot, hiện snapshot sensor được phép, state, rule đầu tiên khớp, intent, gas/fault và event liên quan.

Brain ra quyết định 10 Hz trong engine 60 Hz. UI đặt marker tại tick quyết định, còn chuyển động giữa marker là kết quả engine. Official public replay không chứa Brain state/intent đối thủ; chỉ owner hoặc collaborator được cấp quyền mới xem private trace của bot họ có quyền.

### Cách diễn giải Brain

- Rule hiển thị theo thứ tự thực, có số thứ tự cố định.
- Điều kiện phức tạp thu gọn/mở rộng được, kèm tên kỹ thuật và giải thích ngắn.
- Màu state chỉ trang trí: tên, trạng thái chọn và transition phải có chữ/đường.
- Cảnh báo unreachable, dead rule hoặc lỗi gas lấy từ validator/trace. UI không tự sửa Brain mà không có diff.
- Action “Hỏi AI về trace này” gửi đúng replay/snapshot được phép; không gửi Brain đối thủ, exact enemy energy/heat hoặc private checkpoint.

## 9. Arena, replay và debrief

Arena dùng chung viewer cho sandbox, experiment, official result, replay và MCP App. HUD thuộc DOM/React để có thể đọc bằng screen reader; sân, module và VFX được vẽ bởi PixiJS. Mode luôn rõ: **Practice**, **Experiment**, **Official — trận đã tính**, hay **Replay**.

Alpha official được server tính xong rồi phát lại. Không gọi playback là live. Practice có thể tiến hành trên máy/worker, nhưng kết quả mang nhãn local/unofficial cho đến khi server xác nhận.

### Stage và HUD

- Sân chiếm 60–70% diện tích desktop; bối cảnh graphite phẳng, grid lớn thưa và vạch giới hạn.
- Không có parallax hoặc texture nền chuyển động. Tâm sân/objective dùng dấu hình học đơn giản, nhãn hiện khi cần.
- Hai Synth có tên, badge Đội A/B, pattern viền và Core. Màu và vị trí không phải cách duy nhất đoán đội.
- HUD hiển thị status match, energy và heat bằng thanh có nhãn cùng giá trị. Luật/đơn vị lấy từ 02_GAMEPLAY.
- Chủ bot thấy exact private resource/Brain trace trong quyền của mình. Đối thủ/khán giả chỉ thấy public state: vị trí, module, telegraph, overheated/public event; không hiện exact enemy energy/heat hay Brain.
- Tab phụ: **Sự kiện**, **Chỉ số**, **Brain trace**. Event public có icon, module, thời điểm và link seek; Brain trace chỉ hiện khi ACL cho phép.
- Timeline có marker theo public event: weapon phase/telegraph, hit, module broken, Core, objective, ring warning và terminal result.
- Play/Pause, step, tốc độ playback, seek, fit, mute và quality chỉ đổi cách xem/seek dữ liệu đã có; không điều khiển bot hay đổi outcome.

### Telegraph vũ khí

Người xem phải đọc được đòn sắp đến trước khi nó active. Telegraph lấy hướng, muzzle, sector/capsule hoặc projectile lane từ public weapon phase của engine; hiệu ứng tô hình học mảnh, không che mục tiêu. Thời gian hiển thị không được ngắn hơn **300 ms**; Blade ở baseline hiện tại dùng windup **18 sim ticks** tại 60 Hz theo [02_GAMEPLAY.md](./02_GAMEPLAY.md). Renderer không tự kéo ngắn windup, không dự báo intent trước khi engine công bố phase và không dùng frame-based slow motion để bù readability. Khi giảm/tắt VFX, telegraph vector/shape và nhãn vẫn còn.

### Debrief

Sau replay, trang debrief tóm tắt kết quả do server xác nhận, ba sự kiện lớn có tick link, tài nguyên đã dùng, module mất, objective/ring và Brain trace riêng. Mỗi nhận định AI gắn event/tick và được gọi là diễn giải. Nút **Tạo experiment từ bước ngoặt này** tạo candidate draft; nó không tự submit Ranked.

## 10. Ranked và Leaderboard

### Ranked BO2 đổi slot

Một series gồm đúng hai leg, cùng package/seed/binding; không đổi bot, không carry state giữa hai leg. Lượt thứ hai đổi participants vào hai slot poses cố định của preset, gồm y/heading/jitter từng slot. Không quay arena thêm 180° và không phản chiếu local body/Brain. UI dùng cách gán slot và rating của [07_RANKED_LIVEOPS.md](./07_RANKED_LIVEOPS.md).

- **Trước queue:** hiện Synth/revision, Behavior Card, validation binding, mùa và điều khoản dữ liệu công khai/riêng tư. Xác nhận khóa đúng snapshot.
- **Consent:** submit chỉ sau explicit human intent đã xác thực. AI/MCP có thể chuẩn bị review, nhưng không tự phê duyệt hoặc dùng tool để vào queue.
- **Đang chờ:** trạng thái queued, thời gian chờ do server trả, nút cancel khi chưa matched, thông tin entry đã khóa. Không dựng đối thủ giả để lấp chờ.
- **Đã matched/running:** timeline hai leg có nhãn **Leg 1/2** và **Leg 2/2**; chip chỉ ra đổi slot xuất phát. Hai badge Đội A/B giữ nguyên danh tính khi vị trí đổi.
- **Đang settling:** chưa công bố rating delta như kết quả cuối; hiện “đang xác minh”.
- **Kết quả:** W/D/L mỗi leg, tổng series, rating delta do backend trả, replay từng leg và action fork thành revision riêng để phân tích.
- **Mất kết nối:** khôi phục state từ API/cursor; client không đoán queue, kết quả hoặc rating.
- Sau matched, user không có nút rút làm mất series; chỉ hiển thị trạng thái operator void/infra failure nếu backend trả.

HUD ở Leg 1 đặt Đội A trái, Đội B phải. Leg 2 chuyển vị trí vật lý theo slot assignment nhưng nhãn A/B, số liệu, màu, lịch sử và thứ tự kết quả không nhập nhằng. Không lật silhouette của từng bot; hướng local +X và glyph vũ khí giữ nguyên.

### Leaderboard

- Header có mùa/bracket đang xem, snapshot ID, thời điểm tạo và trạng thái bảng cập nhật.
- Bảng gồm thứ hạng, creator display name, Synth đang tham gia, rating, series played, W/D/L, last active và provisional badge theo dữ liệu public của 07.
- Một hàng mỗi creator; đổi tên hoặc cosmetic Synth không tạo slot mới.
- Có tìm kiếm và bộ lọc được server hỗ trợ. Sort hiển thị nhãn; pagination giữ cùng snapshot.
- Hàng của người đăng nhập được highlight bằng nền và chữ “Bạn”, vẫn đọc được placement khi tắt màu.
- Mobile đổi hàng thành card với thứ tự placement → creator → Synth → record → rating.
- Public profile chỉ mở public Body/presentation/results. Không leak private Brain, experiment note, trace hay exact resource snapshot của đối thủ.

## 11. Trạng thái tương tác, loading và error

| Tình huống | Phản hồi |
|---|---|
| Đang tải app | Skeleton đúng kích thước panel; không nhảy bố cục; nhãn cho biết phần nào đang chờ |
| Không có Synth | Mời tạo từ prompt, chọn mẫu hoặc dựng tay |
| AI đang xây | Hiện hypothesis/job state và phần diff đã có; draft trước vẫn dùng được |
| AI lỗi/không hiểu | Giữ nguyên draft; nêu phần chưa làm hoặc câu hỏi cần giải quyết |
| Đang validate | Khoá action trùng lặp; progress chỉ dùng số backend trả |
| Validation fail | Tóm tắt lỗi/cảnh báo, field pointer, vị trí module và cách sửa; focus đúng vị trí |
| Experiment chạy | Hiện job ID, suite, seeds/holdout mode, revisions, trạng thái, quota/cost nếu contract có; cho cancel nếu được |
| Experiment lỗi hạ tầng | Retryable, giữ cùng snapshot/hash khi retry; không biến infra failure thành bot loss |
| Kết quả stale | Gắn nhãn cũ; nút mở revision đã chạy hoặc chạy lại revision hiện hành |
| Đang queue | Trạng thái thật từ server, cancel trước matched, đã khóa revision nào |
| Đã matched/settling | Không giả khả năng cancel; hiển thị status và tiến độ chỉ khi có |
| Mất mạng | Banner không che canvas; draft lưu local có timestamp; retry có backoff, không nhân đôi submit |
| Job đang chờ | Có thể đóng panel/mở lại từ danh sách; mất MCP stream không đồng nghĩa mất job |
| Cursor/receipt hết hạn | Nêu recovery: refresh list hoặc lấy receipt qua resource có quyền |
| Không hỗ trợ MCP App | Trả structured report và link Web Lab/replay đúng resource; không làm mất chat context |
| Không có kết quả tìm kiếm | Giữ bộ lọc, giải thích không có kết quả, action xoá lọc |
| Modal xác nhận | Nêu tác động cụ thể, focus trap, Escape chỉ đóng khi an toàn |

Thông báo thành công không tự biến mất trước khi đọc được; lỗi quan trọng không chỉ là toast. Xoá/sửa có Undo hoặc restore nếu contract cho phép. Toast có nút truy cập trực tiếp tới kết quả job khi phù hợp.

## 12. Motion, telegraph, VFX và âm thanh

### Motion

- Chuyển động UI: nhanh 120–160 ms, chuẩn 200–240 ms, chuyển trang 320–420 ms; ease-out mặc định.
- Không có idle animation nháy liên tục. Pulse dành cho cảnh báo và không quá 2 nhịp/giây.
- Reduced motion bỏ camera shake, zoom punch, pulse và trail; giữ marker tĩnh, con số, telegraph và timeline event.
- **Không dùng frame-based slow motion** để làm đòn dễ nhìn hơn. Một animation 300 ms chỉ đọc weapon phase đã xảy ra; nó không thay đổi thời gian mô phỏng.
- Không dùng spring, smoothing nhiều tick hoặc lịch sử frame để dựng body pose. Nội suy chỉ giữa hai pose snapshots kề nhau; không phản hồi ngược vào engine.

### VFX và replay seek

VFX director nhận public event, public pose chunks, match tick và thứ tự event ổn định trong projection. Mỗi effect là hàm xác định theo dữ liệu đó: cùng replay và tick cho cùng frame. Không dùng Math.random, browser time hoặc persistent particle state theo thứ tự frame.

- Telegraph đọc đúng event/phase công khai, có outline/sector/capsule/đường đạn mảnh và hướng rõ; không render intent kín chưa phát ra.
- Telegraph gameplay hiển thị tối thiểu 300 ms. Blade ở cấu hình hiện tại có windup 18 tick ở 60 Hz; timing chính thức lấy từ 02_GAMEPLAY. Cues vẫn hiểu được khi VFX thấp/tắt.
- Hit: flash gốm ngắn và vệt theo pháp tuyến/snapshot; không dùng màn hình trắng lớn.
- Destruction: vài mảnh ceramic cosmetic trong tối đa 400 ms; debris không còn collision hay ảnh hưởng.
- Core: vòng đồng tâm và số liệu; không strobe nhanh.
- Objective/ring: outline và nhãn từ trạng thái authoritative; renderer không tự tính vùng kiểm soát/bán kính.
- Kết thúc series: dừng phát đúng tick result; không slow-mo, không kéo dài hoạt ảnh để làm thay event timestamp.

Khi seek hoặc đổi hướng playback, renderer xoá/rebuild presentation từ public chunks/events quanh tick mục tiêu. Không phát lại private checkpoint cho public viewer. Trajectory VFX không suy từ Brain địch; chỉ owner được cấp quyền xem trace riêng của họ. Điều này giữ privacy và đảm bảo seek bất kỳ thứ tự nào cho cùng trạng thái.

### Âm thanh

| Tín hiệu | Bản sắc âm / nhịp | Điều kiện |
|---|---|---|
| Blade windup/active | Servo nâng ngắn → swoosh hẹp → snap gốm khi trúng | Hụt thiếu layer impact,không giả hit |
| Lance | Charge trầm tăng → click sắc lúc phóng → crack nếu trúng | Charge kết thúc tại phase thật |
| Burst |3pulses kim loại khô theo offsets0/4/8 | Không phát3voices chỉ từrequestactivate nếu bị phátrướcactive |
| Breaker | Pulse điện trầm+hiss ngắn,heatcue từpublicstatus | Không tiết lộ exactenemyheat bằng pitch |
| Shield | Hum nhẹ khi bật,impact bịlọc khi block | Off/overheat có âm khác,caption tương ứng |
| Module/Core break | Crack module nhỏ; Core 1motif kết thúc rõ | Duck ambient,không tăngvolume theo sốparticles |

Audio runtime quản lý≤16 voices,mỗiweapon≤2concurrent,global impact throttle không được bỏ visualevent. Asset authoring normalizepeak≤−3dBFS trướcmix,masterlimiter tránh clipping; không đồng nhất loudness với cảm giác mạnh. Playbackseek dừng mọi transient,không phátlại âm trướcseek; resume chỉ âm event mới đúngtime. x2/x4 tắt transientdày,giữtelegraphcaption. Volume vàsensorypreset lưu userpreferences,không tronggameplayhash.

- **UI:** click cơ khí mềm, xác nhận, cảnh báo validation và submit có âm khác nhau.
- **Arena:** hum nền thấp tùy chọn, telegraph, contact, module break, objective/ring và match end.
- Mọi tín hiệu âm quan trọng có marker, nhãn hoặc event caption tương ứng; không dùng âm thanh làm điều kiện hiểu trận.
- Mute và volume riêng cho UI/Arena; không autoplay trước gesture. Ưu tiên ít layer, không lặp warning dày.
- Âm vị trí hoá stereo theo public event location; giữ cùng quy tắc panning trái/phải khi hai bot đổi slot giữa legs.
- Tôn trọng reduced sensory settings và mute hệ thống; không bắt buộc rung/haptic.

## 13. Accessibility và inclusive design

- Mục tiêu WCAG 2.2 AA cho màu chữ, focus, form, điều hướng và thao tác.
- Mọi chức năng canvas có representation ngoài canvas: bảng module, trạng thái Synth, objective và danh sách event/timeline cho screen reader.
- Keyboard-only: tab order theo bố cục; canvas nhận focus; phím mũi tên chọn ô/module; Enter chọn/đặt; Escape đóng panel; có help overlay cho shortcuts; không cướp phím khi đang nhập text.
- Focus ring luôn thấy trên panel và canvas. Modal quản lý focus; khi đóng trả focus tới đúng control mở nó.
- Đội A/B có badge/pattern khác nhau và nhãn chữ. Module có glyph và tên; màu chỉ bổ trợ.
- Text zoom 200% và reflow xuống 320 CSS px không làm mất action quan trọng.
- Touch controls tối thiểu 44 × 44 px. Drag có phương án chọn rồi bấm hướng/đặt; điện thoại có mobile summary flow thay vì geometry editor quá chật.
- Có tuỳ chọn giảm chuyển động, tắt âm, giảm VFX và tăng tương phản.
- Mỗi event có text summary hoặc caption; không truyền state chỉ bằng chuyển động.
- Exact energy/heat và Brain trace của đối thủ không xuất hiện trong accessible tree khi replay public; privacy rules không được bỏ qua để tiện đọc màn hình.

## 14. Asset pipeline và hiệu suất

### Asset registry

    assets/
      modules/{catalogId}/plate.svg
      modules/{catalogId}/glyph.svg
      materials/ceramic/
      materials/alloy/
      teams/a/
      teams/b/
      arena/
      vfx/{publicEventKind}/
      audio/ui/
      audio/arena/
      manifest.json

Tên asset key khớp module catalogId/eventId, không dịch; display label được dịch riêng. Mỗi module có source vector, glyph, normal/damaged/disabled/selected state và team applique độc lập. Hệ tọa độ/anchor lấy từ contract; Core có viewBox theo footprint 2 × 2. Skin, wear và palette chỉ đổi presentation hash.

### Quy trình

1. **Contract:** lấy catalogId, footprint, cell/orientation, public event ID và phase từ 02/04.
2. **Blockout:** lắp silhouette bằng hình phẳng không texture; xem ở 64 × 64, grayscale, hai đội cạnh nhau và VFX off.
3. **Material pass:** thêm seam, fastener, gân, wear decal; không sửa footprint/collider.
4. **Export:** SVG là nguồn gốc; nếu Pixi cần texture atlas thì export 1x/2x từ manifest, giữ anchor/trim và stable key.
5. **VFX/audio:** asset map vào event registry, có fallback tĩnh nếu tải lỗi.
6. **Review:** rà contrast, non-color cues, size, screenreader text, performance, privacy và material guide.
7. **Version:** thay cosmetic không đổi gameplay hash; engine package hash chỉ lấy dữ liệu authoritative.

### Runtime performance

- React quản lý form/HUD state; không setState mỗi render frame. PixiJS ticker chỉ vẽ scene graph.
- Dùng atlas, reuse texture, DPR cap2 và atlas tối đa 2048 × 2048 theo kiến trúc 04.
- Target app shell ≤400 KiB gzip; tổng asset slice tải ban đầu ≤8 MiB gồm font; asset không cần cho màn đầu lazy-load.
- Desktop viewer target p95 ≤16.7 ms và p99 ≤33.3 ms trong replay stress 2 phút. Mobile low-tier target p95 ≤33.3 ms.
- Renderer memory drift target ≤10 MiB sau 10 replay liên tiếp. Warm seek p95 ≤150 ms; cached manifest seek p95 ≤500 ms.
- Nếu frame time vượt mục tiêu, hạ theo thứ tự trail → particle phụ → microdetail → cosmetic animation. Giữ HUD, silhouette, glyph, telegraph, objective, ring, hit và result.
- Low tier giữ layout tĩnh, trạng thái module và cues chiến đấu. Không thay simulation tick theo FPS; tab hidden/pause viewer không đổi ranked result.

## 15. Renderer và ranh giới engine

**Đề xuất triển khai:** React + Vite cho UI, PixiJS 8/WebGL2 cho sân, đúng stack đã chọn trong 04_ARCHITECTURE. Engine TypeScript tất định chạy riêng trong Web Worker/server process; React/Pixi không import logic nội bộ engine.

    Người chơi / MCP
        │  draft · validate · experiment · view replay
        ▼
    Application/API ──► deterministic engine
                           │ authoritative state + public/private event projections
                           ▼
                    read-only presentation adapter
                     ├── PixiJS: body, arena, telegraph, VFX
                     └── React: HUD, timeline, forms, accessible summaries

Không có mũi tên từ PixiJS/VFX về engine. Input người dùng chỉ sửa draft hoặc điều khiển viewer (play/seek/zoom); official Ranked dùng package đã xác nhận. Presentation đọc public replay pose chunks khi xem public; không nhận private checkpoint. Owner-only Brain trace đi qua quyền riêng và không chung event stream công khai.

## 16. Chỉ tiêu measurable cho chất lượng cao cấp

“AAA” ở đây là tiêu chuẩn craft cần nhắm tới, không phải tuyên bố về ngân sách hay chất lượng đã đạt. Các gate v2 được chọn trong [01_PRODUCT.md](./01_PRODUCT.md) và [09_QUALITY_SECURITY.md](./09_QUALITY_SECURITY.md); mục tiêu cụ thể:

| Hạng mục | Mục tiêu nghiệm thu | Bằng chứng cần thu |
|---|---|---|
| Đọc trận | Ít nhất 80% trong tối thiểu 12 người thử nhận đúng đội, telegraph, module bị phá và bước ngoặt, không xem log | Video scenario normal/low VFX; ghi từng câu trả lời, kinh nghiệm và thiết bị |
| Tạo/sửa/thử/debrief | Ít nhất 8/10 người mới hoàn thành trong ≤15 phút | Usability session có assistance và nơi cần trợ giúp; không thay bằng checklist tự chấm |
| Silhouette | Người xem phân biệt các silhouette ở 64 × 64 px, kể cả grayscale | Blind read task dùng đủ mẫu archetype và cặp có topology gần nhau |
| Telegraph | Đòn đọc được khi VFX off và không có slow motion; thời lượng theo phase engine, Blade tối thiểu 300 ms | Replay fixture và kiểm tra chính xác tick/time của public phase |
| Ranked BO2 | Người chơi đọc đúng leg hiện tại, slot assignment, W/D/L và bot đã khóa | Task test trước trận, giữa hai leg, sau kết quả |
| Responsive | 1440×900, 1024×768, 768×1024, 390×844 và 320 CSS px không mất CTA/dữ liệu critical | Screenshot/browser walkthrough + keyboard/touch review |
| Performance | Desktop p95≤16.7ms, p99≤33.3ms trong2 phút; mobile low p95≤33.3ms | Performance capture trên thiết bị/browser đã ghi cấu hình |
| Replay seek | 100 random seeks cho frame parity; warm p95≤150 ms, cached p95≤500 ms | Public replay fixture, actual browser timing, không mock seek |
| Accessibility | WCAG2.2 AA target; keyboard/screen reader; text 200%; no color-only meaning | Automated scan + manual keyboard/AT/grayscale/color deficiency review |
| Art completeness | Flow được công bố không còn placeholder; animation không che collider/telegraph | Asset manifest, screenshots normal/low VFX, QA độc lập |
| Privacy | Public viewer không tiết lộ Brain, exact enemy energy/heat hoặc private checkpoints | Projection allowlist review, canary test và permission evidence của 09 |
| Determinism | Art on/off, seek order, reduced quality không đổi sim result/hash | Same manifest/seed, result comparison và event sequence |

Các con số trên là target của tài liệu nguồn; chưa có test runner, app, thiết bị baseline hay người thử trong phiên này. Không đánh dấu đạt khi chỉ có code hoặc ảnh mock.

## 17. Bàn giao và phần chưa có bằng chứng

### Bàn giao cho UI/Art Agent

- Dùng token, typography, spacing, button/input/card/modal/toast/focus ở mục 4–5.
- Workshop desktop/tablet có canvas/palette/inspector/AI panel; phone dùng summary/parameter edit và thông báo giới hạn geometry editor.
- Brain Lab giữ đúng semantics/source map, tick trace và quyền privacy.
- Arena/replay dùng chung renderer; telegraph đọc được không cần VFX; seek tái dựng public events.
- BO2 đổi participants vào hai preset slot poses, không rotate arena bổ sung; không phản chiếu local bot, không đổi Synth giữa legs.
- Module art có đủ catalog glyph; vỏ không sửa collider; team id giữ ổn định khi đổi bên.
- Error/loading/empty/stale/offline/AI failure/queue/settling states có recovery path.
- Reduced motion, mute, keyboard, screenreader summary và grayscale được thiết kế cùng bản thường.

### Chưa có bằng chứng

- Chưa dựng app/prototype HTML, chưa tạo hình bằng image generator, chưa render asset hoặc chụp screenshot.
- QA đã spot-check hai token trên Surface 3 và yêu cầu tăng Line/Text muted; palette được cập nhật trong bản này. Chưa có full contrast audit trên mọi cặp trạng thái hoặc render thật; cũng chưa kiểm tra font subset tiếng Việt hay browser/device matrix.
- Chưa có usability, performance, motion sensitivity, screenreader, grayscale hoặc deterministic replay test.
- Chưa chạy external visual-design search trong phiên này; tool tìm kiếm không có và các endpoint tìm kiếm/trang tham khảo trả HTTP 403. Không có nguồn ngoài đã kiểm chứng trong quyết định hình ảnh.
- Các tên field/event cụ thể phải theo hợp đồng 02/03/04. Không hardcode giả định riêng cho renderer.

## 18. Nguyên tắc không đổi khi implementation

1. Người và AI cùng thiết kế Synth; người duyệt diff và quyết định Ranked submit.
2. Hình dáng và Brain có thể sáng tạo; server vẫn validate theo cùng luật.
3. Arena giải thích trận thay vì phô hiệu ứng.
4. Team, module và nguy cơ luôn có dấu hiệu ngoài màu sắc.
5. Engine là nguồn sự thật; mỹ thuật không điều khiển physics hoặc kết quả.
6. Telegraph theo weapon phase thật, tối thiểu 300 ms; không dùng slow motion theo frame để sửa luật.
7. VFX public có thể dựng lại khi seek từ public events; private trace giữ ACL.
8. Viewer và MCP App dùng chung renderer, không lộ private engine checkpoint.
9. Mỗi phiên bản asset/renderer có thể thay đổi mà không đổi package gameplay.
