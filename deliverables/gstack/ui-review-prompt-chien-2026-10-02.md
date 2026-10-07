# Đánh giá lại giao diện game — PROMPT Chiến (G2 local vertical slice)

| | |
|---|---|
| **Ngày** | 2026-10-02 |
| **Kịch bản** | Đánh giá thiết kế + sức khỏe mã UI + QA runtime (design review / UI rework assessment) |
| **Thành viên tham gia** | 🎨 Designer (đánh giá hình ảnh/UX độc lập) · 🔧 Investigator (kiến trúc & sức khỏe mã UI) · ✅ QA lead (render runtime + tương phản + responsive) |
| **Phạm vi** | `apps/web/src/{App.tsx,Arena.tsx,style.css}`, `packages/renderer/src/index.ts`, `apps/web/public/assets/*`, đối chiếu `Docs/06_ART_UX.md` v2 |
| **Câu hỏi của người dùng** | *"Giao diện game xấu và rối quá"* |
| **Nguồn tham chiếu** | `Docs/06_ART_UX.md` (chuẩn art/UX), `Docs/01_PRODUCT.md` (gate chất lượng), `deliverables/implementation/G2_REPORT.md` |
| **Khoảng trống được lấp** | G2_REPORT §5 ghi *independent art QA*, *beginner usability*, *readability* = **UNRUN**. Đây là lượt đánh giá độc lập đầu tiên cho phần UI. |
| **Thay đổi mã nguồn** | **Không.** Chỉ ghi vào `deliverables/gstack/**` và `.local/gstack/**`. |

---

## 📌 TL;DR

- **Nhận xét của bạn đúng một nửa, và đúng ở chỗ quan trọng nhất.** "Rối" (lộn xộn) = **ĐÚNG, và mang tính cấu trúc**. "Xấu" = **ĐÚNG ở đấu trường (arena), SAI ở phần vỏ** — bảng màu tối đúng spec và khá đẹp; cái xấu tập trung ở phần combat art.
- **Nguyên nhân gốc số 1 (hình ảnh):** cả **10 module dùng chung một tấm giáp giống hệt nhau**, chỉ khác glyph ở giữa. Ở tỉ lệ sân (`unit=25`) glyph chỉ còn ~1.2px → mỗi bot là một mảng ô vuông xám giống nhau, không có silhouette. Đây là lỗi hình ảnh nặng nhất và vi phạm gate silhouette 64×64 của spec §3/§16.
- **Nguyên nhân gốc số 1 (kết cấu):** toàn bộ UI nằm trong **một component 99 dòng / ~29 KB** (`App.tsx`) với **38 `useState`**, và **package `design-system` mà chính lint và tài liệu yêu cầu thì chưa hề tồn tại** → không có chỗ để token/component/copy sống chung, nên mọi thứ trôi dạt.
- **Bằng chứng runtime:** app render sạch ở cả 5 breakpoint (0 lỗi console), **mọi chữ đạt WCAG AA** (5.81–17.26:1) — nhưng **viền "quiet" `#293640` chỉ đạt 1.39:1** (cần 3:1), **sân chỉ chiếm 36.7%** viewport 1440 (spec cần 60–70%), và trang Workshop cao **1.7× viewport**.
- **Kết luận:** UI chưa sẵn sàng nghiệm thu (đúng như G2_REPORT nói), nhưng **đường sửa rõ ràng và phần lớn là việc nhỏ**. 5 thay đổi rẻ tiền nhất đã xóa phần lớn cảm giác "rối".

---

## 🎯 Thẻ kết luận

| Hạng mục | Nội dung |
|---|---|
| **Go / No-Go (nghiệm thu UI G2)** | 🟡 **Có điều kiện** — chưa thể gọi đạt: 3 gate người thật vẫn UNRUN + frame p95 desktop FAIL (16.8 ms > 16.7 ms) |
| **Go / No-Go (sửa lại UI)** | 🟢 **Go** — ưu tiên rõ, 5 việc đầu rất rẻ, không cần đổi luật/ABI/engine |
| **Phân bố mức độ** | 🔴 P0: **5** · 🟠 P1: **9** · 🟡 P2: **8** · 🟢 P3: **4** |
| **Điểm sức khỏe runtime (QA)** | **74 / 100** — không có lỗi Critical; 1 lỗi tương phản High, vài lỗi layout/typography Medium |
| **Đánh giá lại cảm nhận** | "Rối" = **xác nhận** (mật độ + không có hành động chính) · "Xấu" = **xác nhận ở arena**, không ở vỏ |
| **Điểm sáng cần giữ** | Determinism của renderer, tách privacy public/owner, nền tảng a11y (skip link, aria, bàn phím), bảng màu nền đúng spec |

---

## 1. Kết luận cốt lõi của từng thành viên

### 🎨 Designer — Đánh giá hình ảnh/UX độc lập
- **Phán quyết:** Đúng một nửa. "Rối" xác nhận và mang tính cấu trúc; "xấu" tập trung ở arena, không phải ở vỏ. Vỏ đọc như "dashboard tối chung chung với một điểm nhấn vàng" — ngôn ngữ "Gốm Sống / Cốt Graphite" gần như không tới được màn hình.
- **Ba P0:** (1) mọi module dùng chung một tấm giáp → mất silhouette; (2) không có hành động chính, panel `LOCAL EXPERIMENT` render ở **mọi view** (kể cả Arena) → ≥2 CTA vàng tranh nhau; (3) mọi thông báo dùng chung một style vàng → cảnh báo/diff/stale/tiến trình "hét" cùng âm lượng.
- **Điểm sáng:** nền bảng màu đúng spec, có lớp token thật, scaffolding a11y tốt, determinism và tách privacy đúng.

### 🔧 Investigator — Kiến trúc & sức khỏe mã UI
- **Phán quyết:** UI không phải "một cây component với vài style xấu" mà là **một monolith**. Mọi mối quan tâm (state, layout, copy, token, a11y) nằm trong cùng hai file → **không có đường may nào để sửa một thứ mà không đụng tất cả**.
- **Nguyên nhân gốc cao đòn nhất:** **`packages/design-system` được khai báo ở 3 nơi** (`boundaries.mjs:3`, `Docs/04:63,70`, `Docs/08:95`) **nhưng chưa được tạo** → không có module token, không có primitive, không có chủ sở hữu i18n.
- **Số liệu:** `App.tsx` 38 `useState`/10 ref/9 effect/**0 `useMemo`**; `style.css` 217 rule/0 `@layer`/**35 hex literal** (19 trùng token, 9 vô chủ); **0 test component**, **không eslint/prettier** → bán kính ảnh hưởng của mọi thay đổi = toàn app.
- **Cảnh báo kèm theo:** `JSON.stringify` được dùng làm phép so sánh dirty/stale/equality (nhạy cảm thứ tự key, cấp phát chuỗi mỗi render — và mỗi frame trong renderer).

### ✅ QA lead — Bằng chứng runtime
- **Cách chạy:** serve `apps/web/dist` bằng `vite preview` (127.0.0.1:5188), Chromium 151 headless (WebGL SwiftShader). 4 màn × 5 viewport + 4 state + grayscale; 6 script exit 0; **0 lỗi page/console**.
- **Tương phản:** **mọi chữ đạt AA** (5.81–17.26:1); lo ngại "Line/Text-muted" trong spec đã được giải quyết cho chữ. **Chỉ viền `Line quiet #293640` trượt** ở vai trò ranh giới có nghĩa (1.39:1 / 1.50:1, cần 3:1) — dùng cho viền panel, `hr`, divider bảng và lưới 12×12.
- **Layout:** **không tràn ngang, không cắt chữ, không mất CTA** ở cả 320px; nhưng sân chỉ **36.7%** viewport 1440 (spec 60–70%), trang Workshop cao **1.7×** (1440) và **3.2×** (1024) — đây là **nguyên nhân "rối" chính** (mật độ + độ dài dọc).
- **Bàn phím/a11y:** focus ring 2px `#F1C86B` đúng spec, tab order hợp lý, lưới module dùng roving-tabindex và mũi tên di chuyển focus — **PASS**.
- **Grayscale:** hai đội chỉ chênh **1.37:1** về độ sáng (dưới 3:1) — vẫn phân biệt được nhờ hình badge (● tròn / ⬡ lục giác) + pattern stripe + nhãn chữ, nhưng gate "grayscale" yếu.

---

## 2. Phát hiện tổng hợp (đã gộp trùng, sắp theo mức độ)

| # | Mức độ | Nhóm | Vị trí | Vấn đề | Đề xuất | Nguồn |
|---|---|---|---|---|---|---|
| 1 | 🔴 P0 | Art/Arena | `assets/*.svg`, `renderer/index.ts:4,36-38` | Cả 10 module dùng **cùng một tấm giáp**; ở `unit=25` glyph ~1.2px → bot là mảng ô xám giống nhau, mất silhouette | Vẽ lại **profile đường viền riêng** + notch mép cho từng module; kiểm ở **64×64 grayscale**; tăng `unit`/scale bot | Designer P0-1 · QA D10 |
| 2 | 🔴 P0 | Cấu trúc | `App.tsx:91-92` | Panel `LOCAL EXPERIMENT` render **ngoài mọi điều kiện `view===`** → hiện cả ở Arena/My Synths; nhiều CTA vàng tranh nhau | Chỉ render ở Workshop/Brain Lab + mặc định **thu gọn**; ép **đúng 1 `.primary`/view** | Designer P0-2 · Investigator F7 |
| 3 | 🔴 P0 | Kiến trúc | `App.tsx:11-97` | **Monolith**: ~20 component inline, 38 `useState`, 54 handler, dòng dài nhất 1,142 ký tự | Tách component bottom-up (Phase 1) → reducer/hook (Phase 2) | Investigator F1 |
| 4 | 🔴 P0 | Kiến trúc | `packages/` | **`design-system` chưa tồn tại** dù lint + 2 tài liệu yêu cầu → không có token/primitive/i18n owner | Tạo `packages/design-system` (đã được whitelist sẵn) | Investigator F2 |
| 5 | 🔴 P0 | UI/Trạng thái | `style.css` `.notice` | Mọi thông báo dùng **chung 1 style vàng** (cảnh báo thật, diff, stale, tiến trình) → người dùng học cách bỏ qua tất cả | Tách `.notice--warning/info/success/danger` + icon hình khối | Designer P0-3 |
| 6 | 🟠 P1 | Tương phản | `style.css` `--quiet` | `Line quiet #293640` làm **ranh giới có nghĩa** chỉ đạt **1.39:1** (cần 3:1): viền panel, `hr`, divider bảng, lưới 12×12 | Viền có nghĩa → `--line #8193A0`; giữ `--quiet` cho seam trang trí | QA D1 |
| 7 | 🟠 P1 | Token | `style.css:1` | `:root` có **11/21 token**; ~10 hex hardcode; `--muted` bị **gán sai** (= Text secondary, không phải Text muted) | Bổ sung đủ 21 token, đổi tên `--muted`→`--text-2`, thêm `--text-3`; xóa mọi hex thô | Designer P1-1 · Investigator F3 |
| 8 | 🟠 P1 | CSS | `style.css` | 8 dòng/217 rule/0 `@layer`; 19 hex trùng token, 9 hex vô chủ; 1 màu ngoài palette `#536571` | Tách theo `@layer reset,tokens,base,layout,components,utilities` | Investigator F3 |
| 9 | 🟠 P1 | Typography | `style.css` | Nhiều nhãn **9–11px** (`.axis` 9px, budget 10px, `.eyebrow` 11px); mono 12px, `h3` 16px — dưới sàn spec (12/13/18px) | Nâng sàn: eyebrow/axis ≥12px, mono 13px, `h3` 18px; bỏ override 9/10px mobile | Designer P1-2 · QA D4 |
| 10 | 🟠 P1 | Combat đọc hiểu | `renderer/index.ts:54-70` | Telegraph quá mảnh (arc 2px / line 1.5px); phá module vẽ **cùng vòng tròn như hit** (không có mảnh gốm); hư hại chỉ là tint mờ | Telegraph = **sector tô + outline ≥3px**; thêm mảnh gốm tất định ≤400ms; vết nứt rõ | Designer P1-3 |
| 11 | 🟠 P1 | State | `App.tsx:12-23,39,41,52` | 38 `useState` + 10 ref, không reducer; **3 nguồn sự thật** cho text bot; `JSON.stringify` làm dirty/stale (nhạy thứ tự key) | `useReducer` + `useWorker`; đếm `rev` thay vì so chuỗi | Investigator F4 · F5 |
| 12 | 🟠 P1 | Test/Guardrail | `package.json`, `tests/` | **0 test component**, không jsdom/testing-library, không eslint/prettier → refactor rủi ro cao vì không có lưới an toàn | Thêm eslint+jsx-a11y+prettier+jsdom, smoke test render `<App/>` **trước** khi tách | Investigator F6 |
| 13 | 🟠 P1 | Arena HUD | `renderer/index.ts:41-49`, `Arena.tsx:46-47` | Danh tính đội trong canvas chỉ là **dot 2px** + stripe ~10px; energy/heat **chỉ ở sidebar**, không ở HUD cạnh sân | Badge đội ≥18px (tròn/notch, lục giác/2-notch); đưa energy+heat lên DOM HUD trên sân | Designer P1-4 |
| 14 | 🟠 P1 | Responsive | `style.css` media queries | Breakpoint 1600/1300/1050/767 **không khớp** spec (1440/1024/768/479); thiếu tier sidebar 72px; **không có rule ≤479** | Neo lại 1439/1023/767/479; thêm tier 72px và rule ≤479 | Designer P1-5 |
| 15 | 🟡 P2 | Layout | `Arena.tsx`/CSS | Sân chỉ **36.7%** viewport 1440 (spec 60–70%); nhảy lên 84.8% ở 1024 do cột dọc | Cân lại cột telemetry (thu hẹp/thu gọn drawer) để sân đạt 60–70% | QA D2 |
| 16 | 🟡 P2 | Mật độ | toàn trang | Workshop cao **1.7×** (1440) / **3.2×** (1024); Brain Lab **3.8×** ở 390px; `Experiment`+`footer` luôn dưới fold | Thu gọn `Experiment` vào tab/drawer; đưa footer/âm UI vào settings; panel dài cho scroll nội bộ | QA D3 · Designer P0-2 |
| 17 | 🟡 P2 | Grayscale | renderer | Đội A vs B chỉ chênh **1.37:1** độ sáng (<3:1) — chỉ phân biệt nhờ hình/label | Phóng to/outline badge để đạt ≥3:1 luminance | QA D5 |
| 18 | 🟡 P2 | Ranh giới | `renderer/index.ts:39,49`; `Arena.tsx:47` | Presentation **hardcode hằng gameplay**: core HP `400` vs `800` (mâu thuẫn nội bộ), `unit=25`, cap energy | Lấy scale/HP/cap từ `@prompt-chien/contracts` | Investigator F8 |
| 19 | 🟡 P2 | Workshop UX | `style.css` `.cell-grid` | Lưới gần như vô hình (1px `#293640` trên `#0E141A`); thiếu ghost placement, pan/zoom/fit, toggle overlay | Tăng tương phản lưới; thêm cụm điều khiển camera + ghost + ring chọn thật | Designer P2-4 |
| 20 | 🟡 P2 | Trạng thái | `App.tsx` | Thiếu skeleton loading, toast, banner offline; thành công chỉ là text status-strip | Thêm skeleton, toast có nút "mở kết quả", banner offline không che canvas | Designer P2-5 |
| 21 | 🟡 P2 | Mã | `App.tsx:60,75,76` | 11× literal `12`, 9× `1000`, toán lưới inline trong JSX; `view` là `useState` chứ không phải route | Tách hằng số `GRID/CORE_SIZE/UNIT_SCALE`; thêm route/hash | Investigator F9 |
| 22 | 🟡 P2 | Touch | `.cell-grid button` | Ô lưới **43.2×43.2px** < 44×44 spec | Đảm bảo ≥44px ở width tablet-cảm ứng, hoặc gate editor theo pointer | QA D6 |
| 23 | 🟢 P3 | Typography | `fonts.css` | Inter chỉ có 400/600/700 (spec muốn 450/550/650 → được tổng hợp); thiếu preload | Bổ sung weight hoặc ghi nhận; preload regular+semibold | Designer P3-1 |
| 24 | 🟢 P3 | Thương hiệu | `index.html`, chrome | `<title>` tĩnh; ngôn ngữ "Gốm Sống / Cốt Graphite" chỉ xuất hiện ở caption `.axis` | Title theo view; đưa chất liệu ceramic/alloy vào panel/arena | Designer P3-2, P3-3 |
| 25 | 🟢 P3 | Onboarding | `App.tsx` Brain Lab | Textarea JSON thô chiếm ưu thế ở Brain Lab/Workshop — bề mặt thân thiện kém nhất với người mới | Thêm rule builder trực quan; giữ JSON làm đường nâng cao | QA D9 |
| 26 | 🟢 P3 | Mobile | CSS ≤320px | "My Synths" xuống 2 dòng, badge wrap ở 320px (chỉ mỹ quan) | Tinh chỉnh nhãn nav ở ≤479 | QA D7, D8 |

---

## 3. Lộ trình sửa (theo thứ tự đòn bẩy cao nhất / công sức)

### Giai đoạn A — "Bớt rối ngay" (đều là việc nhỏ, XS–S, giá trị lớn)
1. **Tách `.notice` theo mức độ** (Warning/Info/Success/Danger + icon) — sửa 1 chỗ, rõ toàn bộ thông báo.
2. **Hoàn tất bộ token**: đủ 21 token, đổi `--muted`→`--text-2`, thêm `--text-3`, xóa mọi hex thô (kể cả `#536571`).
3. **Nâng sàn typography**: `.eyebrow` 11→12, `.axis` 9→12, mono 12→13, `h3` 16→18; bỏ override 9/10px.
4. **Panel Experiment thành theo ngữ cảnh + thu gọn**, ép **1 `.primary`/view**; hạ `.synth-name` 32→30.
5. **Nâng viền `--quiet` có nghĩa** lên `--line` để đạt 3:1.

### Giai đoạn B — "Hết xấu" (phần art, M–L)
6. **Vẽ lại tấm giáp module theo profile silhouette riêng + notch**, kiểm 64×64 grayscale (2 đội, VFX off) — đòn bẩy hình ảnh lớn nhất.
7. **Telegraph rõ** (sector tô + outline ≥3px) + **mảnh gốm tất định** khi phá module + vết nứt hư hại.
8. **HUD arena**: badge đội ≥18px + thanh energy/heat trên sân; phóng to thanh HP core.

### Giai đoạn C — "Đúng chuẩn & bền vững" (M–L)
9. **Neo lại breakpoint** 1439/1023/767/479 + tier sidebar 72px + rule ≤479.
10. **Tạo `packages/design-system`** + tách CSS theo `@layer` + nguồn hằng số từ contracts.
11. **Guardrails trước khi refactor**: eslint + prettier + jsdom + smoke test, rồi tách `App.tsx` bottom-up.
12. **Lưới Workshop rõ** + ghost placement + camera fit/zoom/reset + overlay toggle.

---

## ✅ Danh sách hành động

| # | Hành động | Phụ trách | Mức ưu tiên | Kỳ vọng |
|---|---|---|---|---|
| 1 | Tách `.notice` theo mức độ + thêm icon hình khối | Frontend | **P0** | Ngay (XS) |
| 2 | Bổ sung đủ 21 token, xóa hex thô, sửa nhãn `--muted` | Frontend | **P0** | Ngay (XS) |
| 3 | Nâng sàn typography lên 12px + mono 13px + `h3` 18px | Frontend | **P0** | Ngay (XS) |
| 4 | Gate panel Experiment theo view + thu gọn; 1 `.primary`/view | Frontend | **P0** | Ngắn (S) |
| 5 | Đổi viền ranh giới có nghĩa sang `--line` (đạt 3:1) | Frontend | **P0** | Ngắn (XS) |
| 6 | Vẽ lại 10 tấm giáp theo silhouette riêng; kiểm 64×64 grayscale | Technical Art | **P0** | Trung (L) |
| 7 | Telegraph rõ + mảnh gốm khi phá module + vết nứt | Renderer | **P1** | Trung (M) |
| 8 | Badge đội + thanh energy/heat trên HUD arena | Renderer/Frontend | **P1** | Trung (M) |
| 9 | Thêm guardrails (eslint/prettier/jsdom + smoke test) **trước** refactor | Frontend | **P1** | Trung |
| 10 | Tạo `packages/design-system` + tách CSS theo `@layer` | Frontend | **P1** | Trung–Dài |
| 11 | Neo lại breakpoint 1439/1023/767/479 + tier 72px + rule ≤479 | Frontend | **P2** | Trung |
| 12 | Chạy gate người thật: usability 10 người, readability 12 người, art QA độc lập | QA/Product | **P1** | Trước khi nghiệm thu |

---

## ⚠️ Chưa hoàn thiện / giới hạn đã biết

- **Gate người thật vẫn UNRUN** (kế thừa từ `G2_REPORT.md`, nay xác nhận lại): beginner usability (≥8/10 trong ≤15 phút), readability/counterplay (≥12 người, ≥80% mỗi tác vụ), independent art QA. Báo cáo này **không thay thế** các gate đó.
- **Thiết bị/browser thật UNRUN**: chỉ chạy Chromium 151 headless với WebGL phần mềm (SwiftShader) — không có Android/iOS/Safari/Firefox, không có GPU rời, không đo fidelity hiệu năng thật.
- **Screen reader UNRUN**: đã kiểm ARIA trong DOM nhưng chưa chạy NVDA/VoiceOver/JAWS. Mô phỏng mù màu UNRUN (chỉ có grayscale).
- **Frame p95 desktop vẫn FAIL** (16.8 ms > 16.7 ms, kế thừa G2) — không bị bác bỏ bởi lượt này.
- **`dist` dùng để chụp** là bản build sẵn (19:39, sau lần sửa nguồn cuối 19:22) — phản ánh nguồn hiện tại, nhưng không phải build mới.
- **Ảnh full-page** đặt chrome `sticky/fixed` tại offset cuộn — là artifact chụp, không phải lỗi layout; dùng `fold-*.png` cho first-paint thật.
- **Đánh giá của Designer** dựa trên nguồn tĩnh + toán hình học (không tự mở browser) — các kết luận về arena được QA xác nhận độc lập (D10).

---

## 📚 Chỉ mục sản phẩm thành viên

| Thành viên | Sản phẩm | Đường dẫn |
|---|---|---|
| 🎨 gstack-designer | Đánh giá thiết kế độc lập (251 dòng) | `deliverables/gstack/design-review-ui-2026-10-02.md` |
| 🔧 gstack-investigator | Đánh giá sức khỏe mã UI (337 dòng) | `deliverables/gstack/ui-code-health-2026-10-02.md` |
| ✅ gstack-qa-lead | Báo cáo QA runtime (226 dòng) | `deliverables/gstack/ui-runtime-qa-2026-10-02.md` |
| ✅ gstack-qa-lead | 31 ảnh chụp runtime | `deliverables/gstack/shots/` |
| ✅ gstack-qa-lead | Số đo thô (JSON) | `deliverables/gstack/.capture/` |

**Ảnh chụp tiêu biểu:** `shots/fold-workshop-1440x900.png` (Workshop first-paint) · `shots/arena-1440x900.png` (sân + panel Experiment luôn hiện) · `shots/arena-canvas-grayscale-1440.png` (grayscale) · `shots/workshop-320x844.png` (mobile) · `shots/state-error-banner-1440x900.png` (trạng thái lỗi).

---

> Báo cáo này do nhóm AI Software Workshop (GStack) phối hợp tạo. Các quyết định kỹ thuật quan trọng cần được kỹ sư phụ trách rà soát lại. Không thay đổi mã nguồn ứng dụng trong lượt đánh giá này.
