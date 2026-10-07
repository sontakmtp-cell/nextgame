# Kế hoạch chuyển PROMPT Chiến sang giao diện 3D

## 1. Mục tiêu và phạm vi đã chốt

**Workshop, Arena và My Synths chuyển sang 3D, ưu tiên sát ảnh concept trên PC. Toàn bộ Brain Lab giữ giao diện 2D pixel art.**

Luật chiến đấu tiếp tục chạy trên mặt phẳng như hiện tại. Việc nâng cấp thay cách dựng robot, sân, ánh sáng, camera và giao diện; giữ nguyên Brain, chuyển động, va chạm, kết quả trận và các bản Synth đã lưu.

Nguồn áp dụng:

- [Tài liệu kỹ thuật](D:/AI/nextgame/Docs): luật, dữ liệu, ranh giới giữa các phần mềm và tiêu chuẩn kiểm tra.
- [Ảnh concept](D:/AI/nextgame/assets/concepts): bố cục và phong cách của ba màn chuyển sang 3D.
- [Báo cáo G2](D:/AI/nextgame/deliverables/implementation/G2_REPORT.md): chức năng đã triển khai và các tiêu chí còn thiếu bằng chứng.

**Hiện trạng cần giữ trong kế hoạch:**

- Dự án đã có React, Workshop, Brain Lab, lưu phiên bản trên máy, thí nghiệm A/B và Arena dùng Pixi 2D.
- G2 là bản local/unofficial; còn thiếu nghiệm thu về người dùng, thiết bị và mỹ thuật.
- Mười GLB mới tổng cộng **312,29 MiB**. Mỗi model có **500.000 tam giác**, ba texture 2048×2048, một mesh và chưa có animation.
- Tài nguyên Arena gồm 60 ảnh cắt sẵn; chưa có model sân 3D.
- Checkout có nhiều thay đổi chưa commit. Agent phải làm trên trạng thái hiện tại, bảo toàn công việc có sẵn.

Không mở rộng đợt này sang backend, đăng nhập, MCP, ranked, cân bằng gameplay hoặc bổ sung cơ chế Lance/Breaker. Có thể chuẩn bị hình ảnh cho đủ mười module; danh sách được phép lắp vẫn lấy từ catalog hiện hành.

## 2. Thiết kế và kiến trúc cần thực hiện

### Công nghệ và ranh giới dữ liệu

Giữ React/Vite hiện tại; thêm Three.js và React Three Fiber để dựng cảnh 3D. Fiber 9 phù hợp với React 19 theo [tài liệu chính thức](https://r3f.docs.pmnd.rs/getting-started/installation).

Bộ phiên bản đã đối chiếu để dùng cho đợt triển khai:

| Thành phần | Phiên bản |
|---|---:|
| `three` | `0.186.1` |
| `@react-three/fiber` | `9.8.1` |
| `@react-three/drei` | `10.7.9` |
| `@types/three` | `0.186.0` |
| `@gltf-transform/cli` | `4.5.1` |
| `meshoptimizer` | `1.3.0` |

Pin phiên bản chính xác và cập nhật lockfile. Giữ Node, pnpm, React và TypeScript hiện có. Không thêm bộ mô phỏng vật lý 3D.

Tạo package **`@prompt-chien/renderer3d`** riêng:

- Nhận dữ liệu hiển thị và phát callback khi người chơi chọn module/ô lắp.
- Không nhập engine, Brain VM, worker hoặc dữ liệu riêng của đối thủ.
- Không sửa trực tiếp bot, tính sát thương hay quyết định kết quả.
- Giữ package Pixi hiện có để đối chiếu và quay lại chế độ 2D.

Luồng dữ liệu:

```text
Workshop: Body hiện tại → cảnh robot 3D
          thao tác chọn/lắp → bộ sửa bot hiện có → kiểm tra bằng worker

Arena:    PublicFrame → cảnh đấu 3D
          trace và tài nguyên riêng → bảng giao diện web riêng

My Synths: phiên bản đã lưu → cảnh xem trước và ảnh thumbnail
```

Tách audio và `eventLocation` hiện có thành phần dùng chung, giữ các export cũ tương thích. Không để việc bật âm thanh trong màn 3D kéo cả Pixi vào cùng gói tải.

### Các giao diện kỹ thuật cần chốt trước khi chia việc

| Giao diện | Trách nhiệm |
|---|---|
| `SceneViewport` | Sở hữu canvas, chất lượng, camera, loading và xử lý lỗi đồ họa |
| `SynthVisual` | Ghép model theo module; nhận footprint, hướng, trạng thái và dấu đội |
| `SynthPreview` | Xem Body trong Workshop/My Synths; chỉ nhận phần Body cần hiển thị |
| `ArenaScene` | Nhận public frames, vị trí phát lại và tùy chọn hình ảnh |
| `PresentationManifest` | Ánh xạ catalog ID sang model, thumbnail, mức chi tiết và thông tin chuẩn hóa |
| `WorkshopScene` | Trả callback chọn module/ô; phần ứng dụng thực hiện thao tác sửa bot |

Manifest cần chứa đường dẫn asset, hash nguồn/đầu ra, số tam giác, mức chi tiết, hướng/pivot chuẩn hóa và thông tin nguồn tài nguyên. Nó không trở thành nguồn luật gameplay.

Giữ nguyên `BotDefinition`, `PublicFrame`, định dạng replay, giao thức worker và IndexedDB. Thông tin camera, chất lượng và thumbnail nằm trong dữ liệu trình bày riêng.

### Quy ước hình học

- Một ô lắp tương ứng một đơn vị hiển thị.
- Trong cảnh 3D: X là trước, Y là chiều cao, −Z tương ứng phía trái của bot.
- Tâm robot bám tâm Core như engine hiện tại; không lấy tâm bao của model làm tâm gameplay.
- Hướng module giữ bốn góc hiện có. Heading của replay chuyển sang góc quanh trục Y.
- Core có footprint 2×2; module khác lấy footprint từ catalog.
- Chuẩn hóa model bằng scale đồng đều để giữ tỷ lệ; kiểm tra riêng hướng mặt trước và điểm đặt đáy.
- Chọn module bằng vùng chọn đơn giản bám footprint, tránh dò từng tam giác của model.
- Chiều cao, giật vũ khí và mảnh vỡ chỉ là hình ảnh.

### Thiết kế từng màn

| Màn | Thiết kế đích và chức năng bắt buộc |
|---|---|
| **Workshop** | Robot trên bàn lắp sáng, nhìn chéo từ trên xuống; thư viện module và inspector bên phải; tên/ghi chú phía trên; ngân sách, lắp, thử trận và lưu phía dưới. Có module xem trước màu xanh ngọc, ô lắp rõ, chọn/di chuyển/xoay/xóa, undo/redo và thao tác bàn phím. |
| **Arena** | Sân 3D nhìn từ trên xuống, hai robot và dấu đội rõ; bảng sự kiện/trace bên phải; điều khiển phát lại phía dưới. Giữ phát/dừng, tua, bước tick, tốc độ, audio và tạo giả thuyết từ sự kiện. |
| **My Synths** | Danh sách bên trái, robot xem trước ở giữa, lịch sử phiên bản bên phải. Chọn phiên bản để xem trước; chỉ thay bản đang sửa khi thực hiện hành động mở/khôi phục. Giữ bảo vệ bản chưa lưu. |
| **Brain Lab** | Giữ toàn bộ 2D pixel art: đồ thị, dây nối, thư viện node và bảng sửa luật. Không thêm canvas 3D hay thay thứ tự/ý nghĩa thực thi luật. |

Dùng concept để khớp bố cục, vật liệu gốm, khung graphite, ánh sáng ấm và điểm nhấn xanh ngọc. Dựng cảnh thật; ảnh concept chỉ làm tài liệu đối chiếu.

Tách theme theo màn để CSS mới không làm mất pixel art của Brain Lab. Các màn 3D dùng Inter/IBM Plex Mono tự host sẵn; chữ và nút tiếp tục dùng giao diện web để dễ đọc và thao tác.

Camera:

- Workshop/My Synths: góc chéo cố định khi mở; chuột trái chọn, chuột phải xoay, cuộn để zoom, có nút đặt lại góc.
- Arena: góc mặc định bao quát sân; cho zoom và đổi góc trong giới hạn, không tự rung/đổi góc lúc nghiệm thu.
- Khi đang nhập liệu, kéo timeline hoặc mở hộp thoại, khóa thao tác camera tương ứng.
- Mặc định dùng camera trực giao để giảm méo hình và giữ khả năng đọc ô lắp.

**Thiết bị:** từ 1024 px có trình lắp đầy đủ; 768–1023 px dùng panel thu gọn; dưới 768 px là bản tóm tắt, xem trước và chỉnh tham số. Điện thoại không bắt buộc lắp hình học trực tiếp.

## 3. Các ticket giao agent

Thực hiện theo thứ tự dưới đây. Mỗi ticket có một owner; agent chỉ sửa phạm vi được giao. Nếu chia nhiều agent sau này, thống nhất giao diện trước và giao một người tích hợp các file chung.

### U3D-00 — Khóa nền và đặc tả chuyển đổi

**Owner:** Agent tích hợp/kiến trúc.

**Công việc:**

- Ghi nhận trạng thái checkout, dữ liệu mẫu, hash và kết quả kiểm tra nền.
- Chụp giao diện hiện tại, đặc biệt Brain Lab để làm mốc chống thay đổi ngoài ý muốn.
- Viết kế hoạch triển khai vào `D:\AI\nextgame\Docs\UI3D_IMPLEMENTATION.md`.
- Bổ sung quyết định kiến trúc mới, làm rõ việc thay lựa chọn Pixi cho lớp trình bày.
- Chốt các giao diện tại mục 2 và cập nhật quy tắc import cho package mới.
- Thiết lập lựa chọn trình bày `2d/3d`; mặc định 2D trong thời gian phát triển.

**Đầu ra nghiệm thu:** bản đặc tả, danh sách file được sở hữu, báo cáo nền và cách chọn hai chế độ. Không coi các gate G2 cũ là đã đạt.

### U3D-01 — Chuẩn hóa và tối ưu tài nguyên

**Owner:** Agent technical art.  
**Phụ thuộc:** U3D-00.  
**Phạm vi:** tài nguyên sinh mới và công cụ xử lý asset.

**Công việc:**

1. Giữ nguyên toàn bộ GLB/PNG nguồn.
2. Tạo script kiểm kê có thể chạy lại: kích thước, số tam giác, texture, hướng, pivot và hash.
3. Làm bộ thử Core, Armor, Thruster và Blade trước; sau đó áp dụng cho cả mười module.
4. Chuẩn hóa hướng lắp, tỷ lệ, đáy model và điểm neo.
5. Giảm hình học, giữ đường viền/vật liệu; nếu giảm tự động làm méo hình thì sửa model và bake chi tiết từ nguồn.
6. Nén hình học bằng Meshopt, texture bằng KTX2; đóng gói decoder cùng ứng dụng. Three.js hỗ trợ cấu hình các loader này qua [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html).
7. Kiểm tra công cụ KTX2: hiện chưa tìm thấy `toktx` trong PATH; chuẩn bị toolchain riêng cho dự án và ghi phiên bản/cách cài.
8. Xuất thumbnail module cùng ánh sáng và góc nhìn.

Ngân sách đầu ra:

| Mức | Tam giác/module tối đa | Texture tối đa | Dung lượng/model mục tiêu |
|---|---:|---:|---:|
| High — PC | 30.000 | 2048² | 3 MiB |
| Medium | 8.000 | 1024² | 0,75 MiB |
| Low | 2.000 | 512² | 0,25 MiB |

Đây là ngưỡng phải kiểm chứng. Nếu model không giữ được chất lượng dưới ngưỡng, ticket cần sửa tài nguyên; không tải thẳng bản 500.000 tam giác để hoàn tất.

**Đầu ra nghiệm thu:** model ba mức, manifest, script tái tạo, bảng số đo và ảnh đối chiếu từng module với nguồn.

### U3D-02 — Renderer và cảnh mẫu hoàn chỉnh

**Owner:** Agent 3D renderer.  
**Phụ thuộc:** U3D-01.

**Công việc:**

- Dựng các thành phần renderer đã chốt.
- Ghép robot từ Body thật; hỗ trợ đủ bốn hướng và cấu trúc bất đối xứng.
- Dựng bàn xưởng/sân bằng hình học đơn giản, chi tiết mép gốm, khung tối và đèn cam.
- Dùng ảnh floor phù hợp làm vật liệu mặt sàn; loại vùng đệm trong suốt và sửa đường ghép khi cần.
- Dựng thành sân/đạo cụ có chiều cao; ảnh cắt 2D dùng làm chi tiết bề mặt hoặc hiệu ứng phù hợp.
- Objective và vòng bo vẽ theo dữ liệu thật; không lấy vòng tròn có sẵn trong ảnh làm dấu gameplay.
- Làm cache model/texture dùng chung; không tạo một canvas cho mỗi thẻ.
- Cảnh tĩnh chỉ vẽ lại khi thay đổi; không chạy cập nhật React toàn ứng dụng mỗi khung hình.

**Đầu ra nghiệm thu:** cảnh Workshop mẫu với robot thật, ảnh High/Medium/Low, kiểm tra camera và vùng chọn. Phải đạt chất lượng cơ sở trước khi nhân rộng sang các màn.

### U3D-03 — Workshop và giao diện chung

**Owner:** Agent frontend tích hợp.  
**Phụ thuộc:** U3D-02.  
**Phạm vi:** App, theme chung, màn Workshop và kết nối trạng thái.

**Công việc:**

- Tách phần điều phối dữ liệu khỏi giao diện để các màn dùng cùng một bản bot.
- Áp dụng bố cục Workshop theo concept.
- Nối thao tác 3D vào các hàm sửa module, validation, undo/redo và lưu hiện có.
- Hover hiện ô/module xem trước; thao tác lắp chỉ thay bot sau hành động xác nhận.
- Báo lỗi overlap, ngoài lưới, vượt ngân sách hoặc mất kết nối theo validation hiện có.
- Giữ đường thao tác bàn phím và chế độ xem lưới chuẩn dễ truy cập.
- Đưa import/export, chọn mẫu, A/B và tùy chọn phụ vào drawer; vẫn giữ toàn bộ chức năng.
- Bảo toàn bot đang sửa, buffer JSON và lịch sử undo khi đổi màn.

**Đầu ra nghiệm thu:** tạo/sửa/kiểm tra/lưu/thử trận được bằng robot 3D, không mất chức năng cũ.

### U3D-04 — Arena và replay 3D

**Owner:** Agent Arena/replay presentation.  
**Phụ thuộc:** U3D-02 và giao diện ứng dụng từ U3D-03.

**Công việc:**

- Dựng hai robot theo public frames; dùng trạng thái HP, phase, aim, projectile, shield, ring và objective đã có.
- Nội suy vị trí/góc giữa hai frame; trạng thái sống/phá/tách chuyển đúng tick.
- Telegraph luôn hiện khi tắt VFX; lấy thời gian từ phase của engine.
- VFX và mảnh vỡ tái dựng từ tick/sự kiện, không phụ thuộc thứ tự tua.
- GLB chưa có bộ phận chuyển động riêng: đợt này dùng chuyển động toàn module và hiệu ứng; không giả định có nòng, rotor hoặc xương animation.
- Tách trace/tài nguyên riêng của A khỏi renderer; không thêm dữ liệu riêng của B.
- Mất context đồ họa: dừng, giữ tick, tải lại tài nguyên và phục hồi.
- Nếu 3D không mở được: vẫn xem được kết quả/timeline/trace, có lựa chọn chuyển 2D.

**Đầu ra nghiệm thu:** replay 3D đầy đủ, tua chính xác, âm thanh không phát lại sai và kết quả giống bản 2D.

### U3D-05 — My Synths và thumbnail

**Owner:** Agent thư viện Synth.  
**Phụ thuộc:** U3D-03.

**Công việc:**

- Làm danh sách, cảnh xem trước và lịch sử như concept.
- Render thumbnail bằng một hàng đợi; cache theo nội dung Body và phiên bản asset.
- Chọn bản lưu để xem không thay bot đang sửa.
- Giữ thao tác mở, khôi phục vào draft và lưu revision mới.
- Giữ kiểm tra xung đột giữa hai tab và cảnh báo bản chưa lưu.
- Không thay cấu trúc database hiện tại; cache thumbnail có thể xóa/tạo lại.

**Đầu ra nghiệm thu:** xem đúng từng phiên bản, khôi phục đúng nội dung, không ghi đè lịch sử.

### U3D-06 — Bảo toàn Brain Lab pixel art

**Owner:** Agent frontend.  
**Phụ thuộc:** U3D-03.

**Công việc:**

- Tách CSS pixel art khỏi theme 3D.
- Giữ đồ thị, dây nối, pan/zoom, thư viện node, thứ tự luật và bảng sửa hiện tại.
- Kiểm tra chuyển Workshop → Brain Lab → Arena → Brain Lab với buffer chưa áp dụng.
- Chỉ sửa vấn đề do đợt tái cấu trúc gây ra; không thiết kế lại Brain Lab theo concept 3D.

**Đầu ra nghiệm thu:** ảnh so sánh với nền U3D-00 và toàn bộ thao tác Brain cũ hoạt động.

### U3D-07 — QA, tối ưu và bàn giao

**Owner:** Agent QA/tích hợp.  
**Phụ thuộc:** tất cả ticket trên.

**Công việc:**

- Mở rộng kiểm tra browser và profile hiện có cho renderer mới; giữ kết quả 2D để so sánh.
- Kiểm tra tài nguyên tải thật, bộ nhớ, cleanup và các lỗi mạng/đồ họa.
- Chụp ba màn 3D cạnh concept; Brain Lab cạnh ảnh nền pixel art.
- Sửa lỗi, chạy lại kiểm tra liên quan và cập nhật tài liệu hiện hành.
- Chỉ chuyển mặc định sang 3D khi các tiêu chí bắt buộc đạt; giữ chế độ 2D để phục hồi.

**Đầu ra nghiệm thu:** báo cáo cuối, lệnh/exit thực, ảnh/video, số đo, danh sách lỗi và các kiểm tra chưa chạy.

## 4. Kiểm thử và điều kiện nghiệm thu

### Dữ liệu và chức năng

- Cùng bot, seed và đối thủ phải giữ simulation hash, replay hash, kết quả và thứ tự sự kiện giữa 2D/3D.
- Lắp và chọn đúng ô ở cả bốn hướng; kiểm tra Core 2×2, bot lệch/bất đối xứng và đủ 24 module.
- Kiểm tra lỗi ngoài lưới, overlap, budget, mất kết nối và Core.
- Save/reload, import/export, undo/redo, khôi phục lịch sử và xung đột hai tab hoạt động.
- Brain Lab giữ buffer chưa áp dụng và đúng thứ tự luật.
- A/B giữ baseline, candidate, seeds và hai spawn slots như hiện tại.
- Một vòng hoàn chỉnh: sửa Body → sửa Brain → kiểm tra → A/B → replay → tạo giả thuyết → lưu revision mới.

### Hình ảnh và replay

- Chụp Workshop, Arena và My Synths ở 1600×1100 và 1920×1080; kiểm tra responsive ở 1024, 768, 390 và 320 px.
- So sánh năm điểm: bố cục, silhouette robot, vật liệu gốm/kim loại, ánh sáng và phân cấp thông tin.
- Kiểm tra model ghép không xuyên nhau rõ rệt, không mất khoảng trống đặc trưng và không bị crop.
- Kiểm tra tua ngẫu nhiên 100 lần: cùng tick, camera và tùy chọn phải tái dựng cùng trạng thái hình ảnh.
- Kiểm tra windup, shield, mất module, detached, ring và kết thúc trận.
- Low, grayscale, reduced motion và VFX off vẫn đọc được đội, Core và telegraph.
- Không nghiệm thu bằng DOM assertions đơn thuần; phải xem ảnh/video render thật.

### Hiệu năng và khả năng phục hồi

Giữ các mục tiêu đang có trong Docs:

| Hạng mục | Điều kiện |
|---|---|
| Shell ứng dụng | ≤400 KiB gzip; mã 3D tải riêng |
| Asset tải đầu | ≤8 MiB gồm font; High tải bổ sung sau |
| Desktop | p95 ≤16,7 ms; p99 ≤33,3 ms trong stress 120 giây |
| Mobile Low | p95 ≤33,3 ms trên thiết bị thật |
| Warm seek | p95 ≤150 ms |
| Cached seek | p95 ≤500 ms |
| Bộ nhớ | Drift ≤10 MiB sau 10 vòng; ghi rõ loại bộ nhớ đo được |

PC mặc định **High**, nhưng mở nhanh bằng bộ Medium rồi nâng model/texture theo cảnh cần dùng. Nghiệm thu chất lượng PC bằng ảnh sau khi High tải xong. Không tải sẵn cả mười bộ High ở lần mở đầu.

Đo stress tối đa 48 module hai bot, cùng fixture projectile/event hiện có; phân biệt fixture render với trận gameplay hợp lệ. Chạy Chrome/Edge trên PC hiện tại, ghi rõ GPU, DPR, độ phân giải và chất lượng. Integrated GPU kiểm Medium; Android thật kiểm Low.

Kiểm tra thêm model thiếu, texture thiếu, mạng chậm, context loss, đổi màn liên tục và tab ẩn. Sau mỗi lần đổi màn phải dọn listener và tài nguyên đúng quyền sở hữu cache.

Nếu chưa có thiết bị/người thử, ghi **chưa chạy**. Các gate người dùng, readability và mỹ thuật độc lập trong Docs vẫn giữ nguyên; đợt 3D không tự đóng các thiếu sót G1/G2.

## 5. Quy tắc giao việc và tài liệu bàn giao

Agent thực hiện trên checkout hiện tại, không reset/clean, không xóa asset nguồn và không ghi đè dữ liệu local. Mỗi ticket báo rõ file sửa, chức năng thay đổi và bằng chứng kiểm tra.

Bổ sung script `test:ui3d`, `profile:ui3d`, `budget:ui3d`; chạy cùng `build`, `check`, `test:unit`, boundary checks và replay checks hiện có. Kiểm tra ngân sách mới phải tính model, texture, decoder và các lần tải High; script budget G2 hiện tại chưa bao phủ chúng.

Bằng chứng đặt riêng tại:

`D:\AI\nextgame\deliverables\implementation\UI3D\<revision>\`

Cập nhật tài liệu sản phẩm/kiến trúc/mỹ thuật/kế hoạch/QA để thống nhất cách gọi **“mô phỏng 2D, hiển thị 3D; Brain Lab pixel art”**. Giữ báo cáo G2 cũ làm lịch sử, tạo báo cáo UI3D mới.

**Prompt giao agent dùng chung:**

> Thực hiện ticket U3D-XX theo UI3D_IMPLEMENTATION.md. Đọc Docs và kiểm tra checkout trước khi sửa. Chỉ sửa phạm vi ticket; bảo toàn thay đổi của người khác. Giữ engine, Brain, catalog, replay, worker và dữ liệu IndexedDB tương thích. Ba màn Workshop/Arena/My Synths dùng 3D; toàn bộ Brain Lab giữ 2D pixel art. Không dùng GLB nguồn nặng làm asset chạy thật. Bàn giao code, tài nguyên tái tạo được, ảnh render, lệnh kiểm tra và số đo thực. Khi có tiêu chí chưa đạt, ghi rõ ticket chưa hoàn tất. Không tự commit, push hoặc deploy.

**Hoàn tất đợt chuyển đổi khi:** ba màn 3D đạt chất lượng hình ảnh đã chốt, Brain Lab giữ nguyên pixel art, vòng sử dụng cũ chạy đầy đủ, dữ liệu/kết quả không đổi và mọi tiêu chí bắt buộc có bằng chứng.
