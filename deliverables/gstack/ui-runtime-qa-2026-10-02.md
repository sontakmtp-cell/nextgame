# UI Runtime QA — PROMPT Chiến (G2 local vertical slice)

**Report ID:** ui-runtime-qa-2026-10-02
**Author:** gstack-qa-lead (QA & Release)
**Date:** 2026-10-02
**Scope:** Runtime render, responsive layout, contrast, keyboard/focus, UI states and grayscale for the four G2 screens (Workshop, Brain Lab, Arena/replay, My Synths).
**Source modified:** **No.** Only `deliverables/gstack/**` and `.local/gstack/**` were written. App source, dist and docs untouched.
**Purpose:** Produce real, measured runtime evidence for the UI gates that the official report (`deliverables/implementation/G2_REPORT.md`) lists as UNRUN — beginner usability, readability and full contrast audit — and quantify the user's "xấu và rối" (ugly/cluttered) complaint.

---

## 1. Executive summary

- The app **boots and renders cleanly** in headless Chromium at all five spec breakpoints. **0 page errors, 0 console errors** across every run. The Arena worker simulation ran and the PixiJS/WebGL arena rendered (software SwiftShader).
- **No horizontal overflow** at any of the five viewports, including 320 CSS px. **No clipped/truncated text** detected. **No CTA is lost** at 320px — `Lưu revision`, `Kiểm tra bot`, `Thử trận` are all present and inside the first viewport at every breakpoint.
- **Text contrast passes WCAG 2.2 AA everywhere.** Measured live ratios for body/secondary/muted/eyebrow/label text range **5.81:1 – 17.26:1** (min required 4.5:1). The gold CTA is 11.73:1; the focus ring is 12.27:1.
- The spec's self-admitted "re-measure Line / Text-muted" concern is **resolved for text**: `Text muted #94A1AB` now measures 6.51–7.38:1 and `Line #8193A0` 5.42–6.14:1 — both pass. **However `Line quiet #293640` still fails** as a meaningful boundary: **1.39:1 on Surface 1** and **1.50:1 on Arena** (needs ≥3:1). It is used for panel borders, `hr`, table dividers and the 12×12 grid cell lines.
- The Arena stage is **below the spec §9 target** at the primary desktop breakpoint: **36.7%** of the 1440×900 viewport (824×577 px) vs the required **60–70%**. It swings to **84.8%** at 1024×768 because the layout collapses to one column.
- **Grayscale:** teams are **not distinguishable by luminance** (Team A vs Team B = **1.37:1** measured on the real grayscale render, < 3:1). They remain identifiable only via the **non-colour cues** the renderer draws (● circle badge + solid stripe for A; ⬡ hexagon badge + dashed stripe for B) plus the DOM labels `● Đội A` / `⬡ Đội B`. So "no colour-only meaning" holds, but the grayscale-luminance gate is weak.
- **Keyboard/focus is sound:** `:focus-visible` ring is `solid 2px #F1C86B` offset 3px (spec-compliant); tab order is logical; the module grid uses a correct roving-tabindex pattern and **Arrow keys move focus** (verified 7,5 → 7,6).
- All four UI states reachable were captured: **loading**, **error banner**, **stale-replay notice**, **empty My Synths**.
- The core "cluttered" drivers are **content density and vertical length**, not overlap: Workshop is **1.7×** viewport tall at 1440×900 and **3.2×** at 1024×768; Brain Lab is **3.8×** viewport tall at 390px. Raw JSON textareas are the primary beginner-facing friction.

**Health score: 74 / 100** (no blocking/critical defects; 1 medium-high contrast gap, several medium layout/typography issues, and the human usability/readability gates remain UNRUN).

---

## 2. How it was run (commands + exit codes)

Environment: Windows 10, Node **v24.19.0** (Codex runtime node), Playwright **1.62.1**, Chromium **151.0.7922.34** (headless, WebGL via ANGLE/SwiftShader software rasteriser). The **prebuilt production bundle** `apps/web/dist/` (built 2026-10-02 19:39, after the last source edit 19:22) was served unchanged via Vite preview.

| # | Command (from repo root `D:/AI/nextgame`) | Purpose | Exit |
|---|---|---|---|
| 1 | `node apps/web/node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5188 --strictPort` (cwd `apps/web`) | serve prebuilt `dist` | 0 |
| 2 | `node .local/gstack/probe.mjs` | confirm Chromium + WebGL + boot | 0 |
| 3 | `node .local/gstack/capture.mjs` | 20 viewport screenshots + 4 state screenshots + layout/contrast/focus/grid/grayscale pass (23 s) | 0 |
| 4 | `node .local/gstack/measure2.mjs` | refined CTA/scroll-top, focus ring, zoom, arena-host rects, grayscale canvas capture (13 s) | 0 |
| 5 | `node .local/gstack/analyze.mjs` | PNG pixel analysis of grayscale vs colour canvas | 0 |
| 6 | `node .local/gstack/supp.mjs` | grid-cell size, computed font metrics, overlap check | 0 |
| 7 | `node .local/gstack/contrast.mjs` | live computed-style contrast audit | 0 |

Raw machine-readable output: `deliverables/gstack/.capture/{capture,measure2,supp,contrast-live,grayscale-analysis}.json`.
Helper scripts live in `.local/gstack/` (not project source). **No application source was edited.**

---

## 3. Viewport matrix

Full-page screenshots at the five spec §6/§16 breakpoints. `H-overflow` = `documentElement.scrollWidth > innerWidth`.

| Screen | 1440×900 | 1024×768 | 768×1024 | 390×844 | 320×844 |
|---|---|---|---|---|---|
| Workshop | `workshop-1440x900.png` | `workshop-1024x768.png` | `workshop-768x1024.png` | `workshop-390x844.png` | `workshop-320x844.png` |
| Brain Lab | `brain-lab-1440x900.png` | `brain-lab-1024x768.png` | `brain-lab-768x1024.png` | `brain-lab-390x844.png` | `brain-lab-320x844.png` |
| Arena / replay | `arena-1440x900.png` | `arena-1024x768.png` | `arena-768x1024.png` | `arena-390x844.png` | `arena-320x844.png` |
| My Synths | `my-synths-1440x900.png` | `my-synths-1024x768.png` | `my-synths-768x1024.png` | `my-synths-390x844.png` | `my-synths-320x844.png` |
| H-overflow | none | none | none | none | none |

Document height (vertical length) and viewport:

| Screen | 1440×900 | 1024×768 | 768×1024 | 390×844 | 320×844 |
|---|---|---|---|---|---|
| Workshop doc height | 1555 (1.7×) | 2485 (3.2×) | 2553 (2.5×) | 1768 (2.1×) | 1896 (2.2×) |
| Brain Lab doc height | 1547 (1.7×) | 2411 (3.1×) | 2479 (2.4×) | 3217 (3.8×) | 3343 (4.0×) |
| Arena doc height | 1788 (2.0×) | 2922 (3.8×) | 2811 (2.7×) | 2777 (3.3×) | 2873 (3.4×) |
| My Synths doc height | 964 (1.1×) | 1146 (1.5×) | 1214 (1.2×) | 1328 (1.6×) | 1462 (1.7×) |

Extra shots: `fold-workshop-1440x900.png`, `fold-workshop-390x844.png` (above-the-fold), `state-loading-1440x900.png`, `state-error-banner-1440x900.png`, `state-stale-replay-1440x900.png`, `arena-grayscale-lowvfx-1440x900.png`, `zoom200-320x844.png`, `arena-canvas-color-1440.png`, `arena-canvas-grayscale-1440.png`.

### Arena stage area (spec §9: 60–70% of desktop area)

| Viewport | `.arena-host` | % of viewport | % of workspace (excl. 224px sidebar) |
|---|---|---|---|
| 1440×900 | 824 × 577 | **36.7%** | 43.4% |
| 1024×768 | 976 × 683 | **84.8%** | 84.8% |
| 768×1024 | 720 × 504 | 46.1% | 46.1% |
| 390×844 | 358 × 251 | 27.3% | 27.3% |
| 320×844 | 288 × 202 | 21.5% | 21.5% |

### CTAs at every breakpoint (present + inside first viewport)

| Viewport | Lưu revision | Kiểm tra bot | Thử trận |
|---|---|---|---|
| 1440×900 | ✔ (116×44, top 170) | ✔ (118×44, top 170) | ✔ (90×44, top 170) |
| 1024×768 | ✔ (top 249) | ✔ (top 249) | ✔ (top 249) |
| 768×1024 | ✔ (top 348) | ✔ (top 348) | ✔ (top 348) |
| 390×844 | ✔ (114×44, top 290) | ✔ (top 290) | ✔ (top 290) |
| 320×844 | ✔ (91×44, top 327) | ✔ (91×44, top 327) | ✔ (91×44, top 327) |

---

## 4. Contrast audit (WCAG 2.2 AA)

### 4a. Measured on the real render (computed styles, live DOM)

Background resolved by walking ancestors (page background = `#090d11`).

| Element | Foreground | Background | Size/weight | Ratio | AA (4.5:1) |
|---|---|---|---|---|---|
| View title `.topbar h1` | `#f4f1e8` | `#090d11` | 30px/700 | **17.26** | PASS |
| Eyebrow `.topbar .eyebrow` | `#b9c2c9` | `#090d11` | 11px/600 | **10.79** | PASS |
| Status strip | `#b9c2c9` | `#090d11` | 13px/400 | **10.79** | PASS |
| Subtle/secondary `.subtle` | `#b9c2c9` | `#090d11` | 13px/400 | **10.79** | PASS |
| Panel title `.panel h2` | `#f4f1e8` | `#141c24` | 22px/700 | **15.22** | PASS |
| Panel eyebrow | `#b9c2c9` | `#141c24` | 11px/600 | **9.52** | PASS |
| `dl dt` / module small | `#b9c2c9` | `#141c24` | 12–13px | **9.52** | PASS |
| Budget label | `#b9c2c9` | `#141c24` | 10px/400 | **9.52** | PASS |
| Axis tiny label `.axis` | `#94a1ab` | `#0e141a` | **9px**/400 | **7.01** | PASS |
| Footer | `#94a1ab` | `#090d11` | 11px/400 | **7.38** | PASS |
| Brand caption | `#b9c2c9` | `#0e141a` | 12px/400 | **10.25** | PASS |
| Nav number | `#94a1ab` | `#1b2630` | 12px/400 | **5.81** | PASS (lowest) |
| Primary CTA | `#090d11` | `#e8c56c` | 15px/600 | **11.73** | PASS |
| Secondary button | `#f4f1e8` | `#1b2630` | 15px/400 | **13.61** | PASS |

### 4b. Spec §4 token pairs (computed)

| Pair | Ratio | Required | Verdict |
|---|---|---|---|
| Text primary on Void / Surface 1 | 17.26 / 15.22 | 4.5 | PASS |
| Text secondary on Surface 1 / Surface 2 | 9.52 / 8.51 | 4.5 | PASS |
| Text muted on Void / Surface 1 / Arena | 7.38 / 6.51 / 7.01 | 4.5 | PASS |
| Line `#8193A0` on Surface 1 / Void | 5.42 / 6.14 | 3.0 | PASS |
| **Line quiet `#293640` on Surface 1** | **1.39** | 3.0 | **FAIL** |
| **Line quiet `#293640` on Arena** | **1.50** | 3.0 | **FAIL** |
| Gold text on Void / Void on Gold button | 11.73 / 11.73 | 4.5 | PASS |
| Core `#F1C86B` on Void (focus ring) | 12.27 | 3.0 | PASS |
| Team A / Team B on Void | 7.20 / 9.99 | 4.5 | PASS |
| Success / Danger on Void | 9.04 / 6.34 | 3 / 4.5 | PASS |
| **Team A vs Team B luminance (grayscale)** | **1.39–1.41** | 3.0 | **FAIL** |

**Headline:** every **text** token passes AA; the only failures are **non-text "quiet" boundaries (1.39–1.50:1)** and **grayscale team luminance (≈1.4:1)**.

---

## 5. Keyboard & focus

| Check | Result |
|---|---|
| `:focus-visible` ring on buttons | `solid 2px rgb(241,200,107)` = `#F1C86B`, offset `3px` — matches spec §5 (2px Core ring, breathing space). **PASS** |
| `:focus-visible` ring on `.module-choice` | same ring, `focusVisible: true`. **PASS** |
| Tab order (12 stops) | skip link → brand → Workshop → Brain Lab → Arena → My Synths → synth name → Lưu revision → Kiểm tra bot → Thử trận → module palette (Lõi, Động cơ, Giáp…). Logical, no lost/trapped focus observed. **PASS** |
| Module grid operability | Roving tabindex (single tab stop). `ArrowUp` moved focus `7,5` → `7,6`; Arrow handler present for all four arrows. **PASS** |
| Skip link | `Đến vùng làm việc` present as first focusable, fixed off-screen until focused. **PASS** |
| Escape to body during tabbing | Not observed within tested sequence. **PASS (limited)** |
| ARIA semantics (source + DOM) | `role="status"` on status strip, `role="alert"` on error, `aria-pressed` on toggles, `aria-current="page"` on nav, canvas `role="img"` + `aria-label`. **PASS** |

---

## 6. UI states captured

| State | Reachable? | Evidence |
|---|---|---|
| Loading ("Mở xưởng trí tuệ / Đang mở Workshop…") | ✔ (worker asset delayed) | `state-loading-1440x900.png` |
| Error banner (`DUPLICATE_KEY /schemaVersion` + byte pointer) | ✔ (invalid import) | `state-error-banner-1440x900.png` |
| Stale replay ("Replay thuộc bản trước; draft hiện tại đã đổi.") | ✔ (edit after replay) | `state-stale-replay-1440x900.png` |
| Empty My Synths ("Chưa có bản lưu. Bấm Lưu revision.") | ✔ (fresh IndexedDB) | `my-synths-1440x900.png` |
| Pending JSON notice ("JSON đang gõ chưa áp dụng…") | ✔ | `state-error-banner-1440x900.png` |

Note: full-page screenshots render `position:sticky`/`fixed` chrome (sidebar, skip link) at the capture scroll offset — this is a screenshot artifact, **not** a layout defect; the above-the-fold shots (`fold-*.png`) show the real first paint.

---

## 7. Grayscale & team distinction

- Grayscale is implemented as a CSS filter on the arena host: `getComputedStyle('.arena-host').filter === "grayscale(1)"` (renderer `packages/renderer/src/index.ts` L28). Confirmed on the live DOM.
- Both bots render in grayscale (non-background pixel share: **8.88%** gray vs **9.83%** colour — not blank).
- **Measured luminance of the two team accent regions in the grayscale render: A = 94.5/255, B = 133.9/255 → ratio 1.37:1** (theory from token table 1.41:1). **Below 3:1** → teams are **not** separable by brightness alone.
- Non-colour cues are present in the renderer: Team A = circle badge + solid stripe; Team B = hexagon badge + dashed stripe (L41–50). DOM labels carry the same cue: `● Đội A · Mantis` / `⬡ Đội B · Đối thủ`.
- **Verdict:** "no colour-only meaning" is satisfied via shape + pattern + label, but the grayscale **luminance** separation is weak. Recommend increasing badge/stripe size or adding a luminance-offsetting outline if grayscale readability is a hard gate.
- Artifacts: `arena-grayscale-lowvfx-1440x900.png`, `arena-canvas-grayscale-1440.png`, `arena-canvas-color-1440.png`, `grayscale-analysis.json`.

---

## 8. Defects

Severity: **Critical** (blocks use) / **High** (major UX or AA failure on core content) / **Medium** (clear quality gap) / **Low** (polish).

| ID | Sev | Area | Finding | Evidence |
|---|---|---|---|---|
| D1 | **High** | Contrast | `Line quiet #293640` fails non-text 3:1 as a **meaningful boundary**: 1.39:1 on Surface 1 (panel borders, `hr`, `th/td` dividers) and 1.50:1 on Arena (12×12 grid cell lines, `.cell-grid button` borders). | §4b; `workshop-1440x900.png`, `arena-1440x900.png` |
| D2 | **Medium** | Layout | Arena stage is **36.7%** of the 1440×900 viewport (824×577) vs the spec §9 **60–70%** target. The 224px sidebar + 300px telemetry column squeeze the stage; it swings to 84.8% at 1024×768 where the layout collapses. | §3 arena table; `arena-1440x900.png`, `arena-1024x768.png` |
| D3 | **Medium** | Layout | Extreme vertical length / density. Workshop doc height 1555px at 1440×900 (1.7×) and 2485px at 1024×768 (3.2×); Brain Lab 3217px at 390 (3.8×). `Experiment` and `footer` are below the fold on every breakpoint. This is the main "rối" (cluttered) driver. | §3 doc-height table |
| D4 | **Medium** | Typography | Sub-12px text tokens: `.axis` **9px**, budget label **10px**, eyebrow **11px** — below the spec §5 caption floor of 12px. Readable (ratios 7.0–10.8:1) but fragile at zoom/small screens. | `supp.json` fonts |
| D5 | **Medium** | Grayscale | Team A/B luminance ratio ≈1.4:1 in grayscale (<3:1). Mitigated by shape/label cues. | §7 |
| D6 | **Low** | Touch | Module grid cell = **43.2×43.2px** at 1440/1024 and 41.2px at 768, below the spec §6 44×44px touch target (`.cell-grid button{min-height:0}`). | `supp.json` cells |
| D7 | **Low** | Layout | At 320px the nav item **"My Synths" wraps to two lines**, and the top eyebrow / `Local / unofficial` badge wrap. Cosmetic only; no overflow. | `workshop-320x844.png` |
| D8 | **Low** | Layout | At 1024px the 180px palette column wraps module meta ("20 điểm · 12 mass" → 2 lines), increasing palette height. | `workshop-1024x768.png` |
| D9 | **Low** | UX/onboarding | Raw JSON textareas (Rule JSON, whole-bot JSON) dominate Brain Lab/Workshop and are the most beginner-hostile surface; no guided/visual rule builder. Relevant to the UNRUN beginner-usability gate. | `brain-lab-1440x900.png` |
| D10 | **Low** | Readability | In the arena the bots render very small relative to the stage (module sprites ≈ 41px at 1440; the field is mostly empty). Contributes to the "sparse/unclear" feel and to telegraph/silhouette readability risk. | `arena-1440x900.png` |

No **Critical** defects. No overflow, no clipping, no overlap (overlap scan of main blocks returned `[]`), no lost CTAs, no console/page errors.

---

## 9. UNRUN / limitations (honest scope)

- **Human usability** (spec §16: ≥8/10 newcomers complete the create→edit→test→debrief loop in ≤15 min) — **UNRUN**. No participants. This report provides runtime/visual inputs only.
- **Readability/counterplay** (≥12 humans, ≥80% correct team/telegraph/module-loss/turning-point) — **UNRUN**.
- **Independent art QA** — **UNRUN** (this is a QA/measurement pass, not an art review).
- **Real devices / browsers** — **UNRUN**: no Android/iOS hardware, no Safari, no Firefox, no integrated-GPU host. Only headless Chromium 151 on a desktop GPU-less software rasteriser (ANGLE/SwiftShader). Visual/perf fidelity on real GPUs is not asserted.
- **Screen reader** — **UNRUN**: ARIA roles/labels were inspected in DOM, but no NVDA/VoiceOver/JAWS session.
- **200% text resize** — **PARTIAL**: at 320px with `html{font-size:200%}` there was **no horizontal overflow** (`zoom200-320x844.png`); however the stylesheet uses `px` units so root-font scaling under-tests real browser text zoom. WCAG 1.4.10 reflow at 320px **passes** (no horizontal scroll).
- **Colour-deficiency simulation** — **UNRUN**: only grayscale was exercised; no protanopia/deuteranopia simulation.
- **WebGL context loss / reduced motion / audio / seek parity** — not re-run here; covered by the official `scripts/g2-qa.mjs` (18 checks, PASS) and **not** contradicted by this pass. I did confirm the arena renders under software WebGL with 0 errors.
- **Screenshot caveat** — full-page PNGs place `sticky`/`fixed` chrome at the scroll offset; treat `fold-*.png` as the true first paint.
- This pass used the **prebuilt `dist`**, not a fresh build; `dist` (19:39) post-dates the last source edit (19:22), so it reflects current source.

---

## 10. Action items (prioritised)

1. **D1 (High):** Raise `--quiet` used for *meaningful* boundaries (panel border, table dividers, grid cell lines) to ≥3:1 against `#141C24`/`#0E141A`, or move those borders to `--line #8193A0`. Keep `--quiet` only for truly decorative seams.
2. **D2 (Medium):** Re-balance the desktop arena at ≥1300px so the stage reaches 60–70% (e.g. narrower telemetry column, collapsible debrief drawer, or move telemetry below the stage at 1440).
3. **D3 (Medium):** Reduce vertical density — collapse `Experiment` into a tab/drawer, move `footer`/UI-audio into a settings menu, and make long panels scroll-contained.
4. **D4 (Medium):** Lift `.axis` to ≥12px and the budget label to ≥12px; keep eyebrow at 11px only if it is non-essential.
5. **D5 (Medium):** Enlarge/outline team badges and stripes so grayscale luminance separation reaches ≥3:1.
6. **D6 (Low):** Ensure grid cells meet 44×44 on touch-capable tablet widths (or explicitly gate geometry editing to pointer devices).
7. **D9 (Low):** Add a guided rule builder for the common fields; keep raw JSON as an advanced path. Directly targets the UNRUN beginner-usability gate.
8. Run the **human usability / readability / independent-art / real-device** gates per `deliverables/implementation/G2_PLAYTEST.md` before any acceptance claim.

---

### Artifact index
- Screenshots: `deliverables/gstack/shots/` (31 PNGs).
- Raw measurements: `deliverables/gstack/.capture/{capture,measure2,supp,contrast-live,grayscale-analysis}.json`.
- Repro scripts: `.local/gstack/{probe,capture,measure2,analyze,supp,contrast}.mjs`.
