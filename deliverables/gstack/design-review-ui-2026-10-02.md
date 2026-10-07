# Design Review — PROMPT Chiến UI (G2 local vertical slice)

| | |
|---|---|
| **Reviewer role** | Independent design consultant (not the implementing artist) |
| **Date** | 2026-10-02 |
| **Scope** | G2 web UI: `apps/web/src/App.tsx`, `Arena.tsx`, `style.css`, `packages/renderer/src/index.ts`, `apps/web/public/assets/*` |
| **Judged against** | `Docs/06_ART_UX.md` v2 (authoritative art/UX spec) |
| **User complaint under test** | *"Giao diện game xấu và rối quá"* — the game UI is ugly and cluttered/messy |
| **Method** | Source + asset inspection; token-by-token diff vs §4/§5/§6; renderer geometry math at arena scale; severity classification. No live browser session (out of scope) — findings are from static evidence and reproducible geometry. |
| **Gap this fills** | G2_REPORT §5 lists *independent art QA* = UNRUN, *beginner usability* = UNRUN, *readability/counterplay* = UNRUN. This is a first independent art/UX pass. |

---

## 0. Verdict

**Partly true — but not for the reason most people assume.**

- **"Rối" (cluttered/messy): YES, confirmed.** The clutter is structural, not cosmetic. There is no single primary action per screen; the `LOCAL EXPERIMENT` panel renders on *every* view and competes with the page's real task; and a single flat `.notice` style makes warnings, info, diffs and stale-data states all shout at the same volume. The Workshop screen alone presents ~11 buttons + 8 palette choices + 144 interactive cells + 4 headings of near-equal weight.
- **"Xấu" (ugly): YES in the arena, NO in the shell.** The dark palette is on-spec and genuinely tasteful; the typography is close to spec. The *ugly* is concentrated in combat: **every module uses the identical ceramic plate**, so at arena scale a Synth is a cluster of identical light-grey squares with no silhouette identity — which is the single highest-impact visual defect. The "Gốm Sống / Cốt Graphite" material language the spec sells is essentially invisible in the UI and collapses at 25px in the arena.
- The shell reads as a **generic dark dashboard with one gold accent**, not as *"một trí tuệ chiến thuật có cơ thể"*. The brand language (§2) does not survive to the screen.

Severity legend: **P0** = blocks the core experience / causes the complaint · **P1** = clear, visible deviation from spec · **P2** = meaningful quality gap · **P3** = polish.

---

## 1. What's actually good (fair assessment)

This is not a bad slice — the engineering and the *system intent* are better than the pixels.

1. **Palette base is exactly on-spec.** `:root` Void `#090D11`, Arena `#0E141A`, Surface 1 `#141C24`, Surface 2 `#1B2630`, Line `#8193A0`, Line quiet `#293640`, Team A `#F27B59`, Team B `#65C8D4` all match §4 verbatim. Team colors are the correct hues.
2. **Genuine design-token attempt.** A real `:root` custom-property layer exists; `.panel`, `.eyebrow`, `.notice` are consistently reused across screens. This is a system, not ad-hoc styling.
3. **Above-average accessibility scaffolding for a vertical slice.** Skip link (`.skip`), `role="status"` on the status strip, `role="alert"` on errors, `aria-pressed` on every toggle, `aria-current="page"` on nav, real `<meter>` elements, keyboard grid navigation (←↑↓→ / Enter) and Ctrl+Z / Ctrl+Shift+Z undo, focus-visible ring globally defined. Spec §13 is *attempted*, not ignored.
4. **Renderer determinism is correct.** No `Math.random`; interpolation only between two adjacent authoritative frames; seek rebuilds presentation from public chunks; VFX are deterministic functions of public events (§12 satisfied). This is the hard part and it's done.
5. **Privacy split is correct.** Renderer receives public frames only; owner trace/resource stays in the DOM layer (App/Arena). Matches §9/§15.
6. **Reduced-motion and grayscale are wired** in both CSS (`@media(prefers-reduced-motion:reduce)`) and the renderer (`options.reducedMotion`, `options.grayscale`), and team shape *does* differ in grayscale (long line vs. two dashes). §16's grayscale requirement is at least attempted.
7. **Empty / error / stale states exist with recovery paths**: worker-crash retry, job cancel, apply/discard JSON, stale-replay banner, "Chưa có bản lưu" empty state.
8. **Mobile correctly suppresses the geometry editor** (§6) and shows an explanatory `.mobile-note`.

---

## 2. P0 — root causes of the complaint

### P0-1 · Arena silhouette failure: all 10 modules are the *identical* ceramic plate
**Problem.** Every module SVG shares byte-for-byte the same plate: same alloy frame, same `#D9D4C8` body, same `#F1EADC` highlight, same `#B1AC9F` shadow, same seam lines, same four corner bolts. Only the central glyph `<g>` differs. In the arena each module is drawn as a 1-cell sprite at `unit = 25` logical px, so a 128px plate scales to 25px and the glyph's `stroke-width="6"` becomes **≈1.2px — effectively invisible**. Every Synth is therefore a lattice of identical light-grey squares. There is no union-of-armor silhouette, no negative space, no topology read.

This directly violates:
- §3 "Silhouette toàn Synth hình thành từ hợp các mảng giáp… khoảng âm giữa các cụm được giữ".
- §3 "Ở thumbnail 64 × 64 px, đường viền ngoài và khoảng âm chính phải phân biệt được".
- §16 Art completeness + Silhouette gate ("phân biệt silhouette ở 64×64 px, kể cả grayscale").
- §14.2 Blockout step ("xem ở 64 × 64, grayscale, hai đội cạnh nhau và VFX off") — not evidenced.

**Evidence.**
- `apps/web/public/assets/core.svg`, `thruster.svg`, `armor.svg`, `blade.svg`, `burst.svg`, `shield.svg`, `radiator.svg`, `capacitor.svg`, `lance.svg`, `breaker.svg` — identical `M7 17L17 7h94l10 10v94l-10 10H17L7 111z` plate; only the trailing `<g fill="none" stroke="#39434c" stroke-width="6">` glyph differs.
- `packages/renderer/src/index.ts:4` — `const color={A:0xf27b59,B:0x65c8d4},unit=25;`
- `packages/renderer/src/index.ts:36-38` — `sprite.width=sprite.height=size*unit` (25px per 1-cell module).
- `apps/web/public/assets/modules.svg` — the atlas repeats the same 10 identical plates in a 5×2 grid.

**Fix (art direction).** Give each module a *distinct outline profile*, not just a center glyph, so the union of plates reads as a body:
- **Armor** — thick double plate with a stepped edge notch.
- **Blade** — angled blade protruding past the cell edge (asymmetric outline).
- **Lance** — pointed nose breaking the square.
- **Thruster** — rear vent slots that notch the trailing edge.
- **Radiator** — three fins protruding on one face.
- **Shield** — concave arc face.
- **Capacitor** — recessed chamber (inset outline).
- **Core** — keep 2×2 concentric rings + pale-gold rim (§3 table).
Add a **notch profile** to the silhouette (per §3 "notch ở mép") so shape is readable even in pure black. Re-run the §14.2 blockout at 64×64 grayscale, two teams, VFX off, before any further art pass. Also raise the arena `unit` (or add a per-bot bounding-scale) so a module renders ≥32px on a 1440 screen.

---

### P0-2 · Clutter: no primary action; the experiment panel renders on every view
**Problem.** The `LOCAL EXPERIMENT` panel is a direct child of `<main>` and sits **outside all `view===…` conditionals**, so it appears under Workshop, Brain Lab, Arena *and* My Synths. On the default Workshop screen this yields four headings of near-equal visual weight and multiple gold `.primary` buttons, so the eye has no anchor.

Counted on the default Workshop screen (bot loaded):
- 4 nav buttons · 3 header actions (`Lưu revision`, **`Kiểm tra bot`**, `Thử trận`) · 8 palette module choices · 144 grid cells · 3 grid controls (`Hoàn tác`, `Làm lại`, `Đặt…`) · 1 `<details>` module list · 2 inspector buttons + 1 template select · 2 experiment buttons (**`Chạy A/B`**) · footer sound controls ≈ **11 buttons + 8 palette + 144 cells**, with **≥2 `.primary`** competing.
- Competing headings: topbar `h1` "Workshop" (30px) → `.synth-name` input (32px/700) → `h2` "Lắp cơ thể" (22px) → `h2` "Đổi một điều. Đo một khác biệt." (22px).

**Evidence.**
- `apps/web/src/App.tsx:91-92` — `<section className="experiment panel">…` is unconditional.
- `apps/web/src/App.tsx:69` — `Kiểm tra bot` is `.primary`; `App.tsx:91` — `Chạy A/B` is `.primary`; also `App.tsx:84` and `App.tsx:89`.
- `apps/web/src/style.css` — `.synth-name{font-size:32px;font-weight:700}` vs `h1{font-size:30px}`.
- Spec §6 "Tên trang và action chính luôn thấy được"; §7 Workshop diagram shows the primary flow (body → validate → experiment) as one bottom action bar, not a free-floating panel.

**Fix.**
1. Make the experiment panel **contextual**: render only on `Workshop`/`Brain Lab`, and default it **collapsed** (`<details>` or a right-dock tab) — the user opens it when they want to measure.
2. Enforce **exactly one `.primary` per view**: Workshop → `Kiểm tra bot`; Arena → `Thử trận`. Demote `Chạy A/B`, `Kiểm tra và áp dụng JSON` and `Thử trận đầu tiên` to secondary.
3. Fix the title hierarchy: `.synth-name` → 30px/650 so the page title keeps rank; move the "01/02/03" eyebrow numbering to a single step indicator so it reads as one flow.

---

### P0-3 · All notices share one visual weight — nothing signals severity
**Problem.** A single `.notice` style (gold left border on Surface 2) is reused for at least five semantically different states: a real geometry risk (Burst occlusion), a process state (JSON unapplied), a data-integrity state (stale replay), an informational diff, and a WebGL-context message. Because everything looks equally important, the user learns to ignore all of them — which is exactly the "rối" feeling. §4 defines Success/Warning/Danger/Info tokens and §11 requires distinct state treatments; none are used.

**Evidence.**
- `apps/web/src/style.css` — `.notice{padding:12px 16px;border-left:3px solid var(--gold);background:#1b2630;color:#f4f1e8;font-size:13px;…}`
- Usages: `App.tsx:72` (JSON pending), `App.tsx:80` (Burst occlusion — a real warning), `App.tsx:84` (template diff — info), `App.tsx:89` (stale replay — integrity), `Arena.tsx:35` (WebGL context).
- Spec §4 token table: Success `#55C58A`, Warning/heat `#F0B85B`, Danger `#EC6A68`, Info `#7EBBE8`.

**Fix.** Split `.notice` into variants and use them:
```
.notice--warning { border-left-color: var(--warning); }  /* #F0B85B — occlusion, heat */
.notice--info    { border-left-color: var(--info); }     /* #7EBBE8 — diffs, hints */
.notice--success { border-left-color: var(--success); }  /* #55C58A — saved/valid */
.notice--danger  { border-left-color: var(--danger); }   /* #EC6A68 — stale/invalid */
```
Add a leading icon (shape, not color-only, per §13). Keep gold `.notice` only for the true process state.

---

## 3. P1 — clear spec deviations

### P1-1 · Token system incomplete; ~10 hardcoded hex values; `--muted` is mislabeled
**Problem.** `:root` defines only a partial palette and, worse, `--muted` is set to `#B9C2C9`, which is the spec's **Text secondary**, not Text muted. The true Text muted `#94A1AB` is then hardcoded in three places. Eight spec tokens (Surface 3, Ceramic, Ceramic lit, Alloy, Core, Success, Warning, Info) have no variable at all and reappear as raw hex; one off-palette color (`#536571`) is invented for the grid border.

**Evidence (spec §4 → implementation).**

| Spec token | Spec HEX | In CSS? | Where used instead |
|---|---|---|---|
| Void | `#090D11` | ✅ `--void` | — |
| Arena | `#0E141A` | ✅ `--arena` | — |
| Surface 1 | `#141C24` | ✅ `--surface` | — |
| Surface 2 | `#1B2630` | ✅ `--raised` | also hardcoded in `.notice` |
| Surface 3 | `#25323D` | ❌ | hardcoded `#25323d` (hover ×2, aria-pressed ×1) |
| Line | `#8193A0` | ✅ `--line` | — |
| Line quiet | `#293640` | ✅ `--quiet` | — |
| Text primary | `#F4F1E8` | ❌ | hardcoded ×4 (button, notice, error code, `:root`) |
| Text secondary | `#B9C2C9` | ⚠️ mislabeled `--muted` | plus hardcoded in `.eyebrow`, `.subtle`, `.local-badge` |
| Text muted | `#94A1AB` | ❌ | hardcoded in `.nav-number`, `.axis`, `footer` |
| Ceramic | `#D9D4C8` | ❌ | only inside SVGs |
| Ceramic lit | `#F1EADC` | ❌ | only inside SVGs / renderer `0xf1eadc` |
| Alloy | `#39434C` | ❌ | `.experiment` border-top, renderer `0x39434c` |
| Team A / B | `#F27B59` / `#65C8D4` | ✅ `--a` / `--b` | — |
| Core | `#F1C86B` | ❌ | `:focus-visible{outline:2px solid #f1c86b}` |
| Primary action | `#E8C56C` | ✅ `--gold` | also hardcoded `#e8c56c22` |
| Success | `#55C58A` | ❌ | `.dot{background:#55c58a}` |
| Warning/heat | `#F0B85B` | ❌ | **unused anywhere** |
| Danger | `#EC6A68` | ✅ `--danger` | — |
| Info | `#7EBBE8` | ❌ | **unused anywhere** |

Extra off-palette value: `.cell-grid{border:1px solid #536571}` — a color in neither the spec palette nor any token.

**Fix.** Define the full set (`--surface-3`, `--text-1/2/3`, `--ceramic`, `--ceramic-lit`, `--alloy`, `--core`, `--success`, `--warning`, `--info`), rename `--muted` → `--text-2` and add `--text-3:#94A1AB`, replace every raw hex, and delete `#536571` in favor of `--line`. This is a ~20-line change with outsized consistency payoff.

---

### P1-2 · Typography floor violated: pervasive 9–11px labels; mono data 12px not 13px
**Problem.** The spec's floor is Caption 12/16, Label 13/18, Data 13/20 mono, and §5 explicitly says *"Không thu nhỏ body xuống dưới 14 px trên màn hình hẹp."* The implementation ships many 9–11px labels — and the `.eyebrow` label (the main section identifier on every panel) is 11px, dropping to **9px** on mobile.

**Evidence.**
- `.eyebrow{font-size:11px;…}` — used on every panel/section.
- `.axis{font-size:9px}` · `.budget>span{font-size:10px}` · `.nav-foot{font-size:11px}` · `footer{font-size:11px}` · `.telemetry pre{font-size:11px}`.
- Mobile: `.topbar .eyebrow{font-size:9px}` · `.arena-top .mono{font-size:10px}`.
- `.mono,code{font-size:12px}` — spec Data = 13px.
- `h3{font-size:16px}` — spec Panel title = 18px.

**Fix.** `.eyebrow` → 12px (keep letter-spacing); `.axis` → 12px; delete the 9/10px mobile overrides; `.mono` → 13px; `h3` → 18px. Nothing here needs layout rework — it is a pure token correction.

---

### P1-3 · Telegraph too faint; destruction has no ceramic-shard VFX; damage read is a subtle tint
**Problem.** The telegraph is the single cue the game lives or dies on (§9/§12/§16: "Đòn đọc được khi VFX off"). Implemented as a 2px arc at radius `1.5*unit` (blade) and a 1.5–2px line at `alpha:.65` (burst) — at screen scale that is ~1.5–2px of thin stroke, which does not read as a sector/cone. Destruction draws the *same* expanding-ring primitive as a hit, differing only by color — there is no ceramic-shard moment (§12 "Destruction: vài mảnh ceramic cosmetic trong tối đa 400 ms"). Damage is signalled by `tint 0xb7a896` (a slightly warm off-white) plus a 1.5px crack — nearly invisible at 25px.

**Evidence.**
- `packages/renderer/src/index.ts:65-70` — `telegraph()`: blade `arc(x,y,1.5*unit,heading−π/4,heading+π/4)` width 2; burst `lineTo(x+cos*300,…)` width `active?2:1.5` alpha `.65`.
- `packages/renderer/src/index.ts:54-61` — hit/blocked/destroyed all render `this.fx.circle(pt.x,pt.y,4+age*.8).stroke(...)`; only the color differs.
- `packages/renderer/src/index.ts:39,44` — `sprite.tint=damaged?0xb7a896:0xffffff`; crack `stroke({color:0x39434c,width:1.5})`.

**Fix.** (a) Telegraph: draw a **filled sector** at low alpha plus a ≥3px outline, and keep it when VFX is off (already kept — good); assert ≥300ms visibility against the engine phase. (b) Destruction: a short ceramic-white flash + 3–5 deterministic shards computed from the public event (no persistent particle state — keep §12 determinism), lifetime ≤400ms. (c) Damage: a visible seam (2px dark seam + cracked border) rather than a tint.

---

### P1-4 · Arena team/state legibility: 2px dots, ~10px stripes; energy/heat only in the sidebar
**Problem.** In-canvas team identity is a **2px dot** per module plus a ~10px stripe — unreadable at scale, and the two teams are otherwise identical light squares. Core HP is a 46×4px bar. Meanwhile §9 requires the arena HUD to show **energy and heat as labelled bars with values**, but those meters live only in the `.telemetry` sidebar (`Arena.tsx:46-47`), so the viewer must look away from the fight.

**Evidence.**
- `packages/renderer/src/index.ts:41` — `circle(point.x,point.y,size===2?6:2)` (2px for normal modules).
- `packages/renderer/src/index.ts:42-43` — B: two 4px dashes; A: one 10px line.
- `packages/renderer/src/index.ts:49` — `rect(bot.x-23,bot.y+42,46,4)` HP bar.
- `apps/web/src/Arena.tsx:46-47` — `<div className="resource">…Energy…Heat…` inside `.telemetry`.
- Spec §4 "Đội A có badge tròn một notch… Đội B có badge lục giác hai notch"; §9 "HUD hiển thị status match, energy và heat bằng thanh có nhãn cùng giá trị".

**Fix.** Draw a **readable team badge** next to each bot (circle-1-notch for A / hexagon-2-notch for B, per §4) at ≥18px; promote energy+heat to DOM HUD bars above the canvas (screen-reader friendly, §9/§13); enlarge the core HP bar.

---

### P1-5 · Breakpoints don't match spec; the 72px middle tier is missing; no ≤479 rule
**Problem.** The implementation uses 1600 / 1300 / 1050 / 767. The spec defines ≥1440 / 1024–1439 / 768–1023 / ≤767 / ≤479, with a **72px collapsed sidebar** in the 1024–1439 band. That tier is not implemented (nav goes 224 → 180 at ≤1300, then to a top rail at ≤1050). The 1024–1050 window falls into the wrong bucket, and there is no `≤479` rule at all.

**Evidence.** `style.css` media queries: `@media(min-width:1600px)`, `@media(max-width:1300px)`, `@media(max-width:1050px)`, `@media(max-width:767px)`, `@media(prefers-reduced-motion:reduce)`. Spec §6 table.

**Fix.** Re-anchor to 1439 / 1023 / 767 / 479; add the 72px collapsed sidebar for 1024–1439; add a `≤479` rule (telemetry → tabs; keep status + Synth name + essential CTA).

---

## 4. P2 — meaningful quality gaps

- **P2-1 · Workshop columns narrower than spec.** `.workshop-grid{grid-template-columns:200px minmax(280px,1fr) 260px}` vs spec ≥1440 "palette 224 / canvas auto / inspector 300". The spec widths only apply at ≥1600. On a 1440 laptop the canvas is squeezed. Fix: `224px minmax(0,1fr) 300px` at ≥1440.
- **P2-2 · Heading hierarchy inverted.** `.synth-name` (32px/700) out-ranks the page `h1` (30px); `h3` is 16px vs Panel title 18px. Fix sizes as in P1-2 + demote `.synth-name`.
- **P2-3 · Shape/spacing drift.** No `border-radius:14px` anywhere (spec card tier unused); `:focus-visible{outline-offset:3px}` vs spec 2px; non-4px spacing values `14, 9, 7, 10, 36` (`button{padding:8px 14px}`, `input…{padding:9px 12px}`, `gap:10px`, `.brand-caption{margin:24px 0 36px}`). Fix: add the card tier, set offset 2px, snap spacing to the 4px scale.
- **P2-4 · Canvas affordances below spec (§7).** `.cell-grid` cells use `border:1px solid #293640` on `#0E141A` — the grid is nearly invisible ("grid vừa đủ để căn module" is not met). Missing: ghost placement preview, pan/zoom/fit-to-frame/reset camera buttons, and grid/contour/anchor/connection/energy-heat overlay toggles. Selection is only `filter:brightness(1.2)`. Fix: raise grid contrast to `--quiet` at ~2px or `--line` at 1px, add the control cluster, add a real selected ring.
- **P2-5 · State coverage gaps (§11).** No skeleton loader (loading is a plain `.loading` block), no toast component, no offline banner, and success is only status-strip text. Fix: add a sized skeleton for panels, a `.toast` with a "open result" action, and an offline banner that does not cover the canvas.
- **P2-6 · Warning/error rely on color + text only.** `.error{border:1px solid var(--danger)}` has no icon; warnings have no shape cue. §13 "không truyền state chỉ bằng màu". Fix: add per-severity glyphs.

---

## 5. P3 — polish

- **P3-1 · Font weights.** `fonts.css` ships Inter 400/600/700 + mono 400. Spec §5 wants 450/550/650 → those weights are synthesized. No `<link rel="preload">` for the two primary weights. Fix: add the missing weights or accept the spec's nearest and document it; preload regular + semibold.
- **P3-2 · Static document title.** `index.html` `<title>` is always "PROMPT Chiến — Workshop" regardless of view. Fix: set per-view title.
- **P3-3 · Brand language doesn't surface.** "Gốm Sống / Cốt Graphite" appears only in the `.axis` caption "CERAMIC SHELL / GRAPHITE CORE". The material story is otherwise absent from the chrome. Fix: carry the ceramic/alloy language into panel headers, the palette, and the arena HUD.
- **P3-4 · Duplicated literal.** `#F4F1E8` (Text primary) is hardcoded in `:root`, `button`, `.notice`, `.error code` instead of a token — covered by P1-1 but worth a one-line note.

---

## 6. Top 10 changes — highest visual impact per effort

| # | Change | Effort | Impact | Fixes |
|---|---|---|---|---|
| 1 | Split `.notice` into Warning/Info/Success/Danger variants with shape icons | XS | High | P0-3 |
| 2 | Make experiment panel contextual + collapsed; enforce one `.primary` per view | S | High | P0-2 |
| 3 | Redraw module plates with distinct silhouette profiles + edge notches; validate at 64×64 grayscale | L | Very high | P0-1 |
| 4 | Complete the token set; kill all hardcoded hex; rename `--muted`→`--text-2`, add `--text-3` | XS | High | P1-1 |
| 5 | Raise type floor: `.eyebrow` 11→12, `.axis` 9→12, mono 12→13, `h3` 16→18, delete 9/10px mobile | XS | High | P1-2, P2-2 |
| 6 | Thicken telegraph (filled sector + ≥3px outline); add deterministic destruction shards; visible damage seam | M | High | P1-3 |
| 7 | Arena HUD: per-bot team badge (notch shape) + energy/heat bars above the canvas | M | High | P1-4 |
| 8 | Fix heading hierarchy: `.synth-name` 32→30/650; single page title | XS | Medium | P0-2, P2-2 |
| 9 | Re-anchor breakpoints to 1439/1023/767/479; add 72px tier + ≤479 rule | M | Medium | P1-5 |
| 10 | Visible canvas grid + ghost placement + fit/zoom/reset + overlay toggles | M–L | Medium | P2-4 |

**Sequencing recommendation:** 1 → 4 → 5 → 2 → 8 (all tiny, immediate "less messy" relief), then 3 → 6 → 7 (the "no longer ugly" art work), then 9 → 10.

---

## 7. Answers to the brief's specific questions

- **Is the primary task obvious on Workshop?** No. Four headings of near-equal weight and ≥2 gold CTAs; the body-build flow is one of several equal-weight columns. → P0-2.
- **Does everything compete at the same visual weight?** Yes. → P0-2, P0-3.
- **Does the arena get 60–70% of desktop?** Roughly yes (~57% on a 1440 screen after nav + telemetry), but the always-on experiment panel below pushes the fight and dilutes focus. → P0-2.
- **Token adherence?** Partial. Base dark tokens exact; 8 spec tokens missing, 1 mislabeled, ~10 hardcoded hex, 1 off-palette color. → P1-1.
- **Typography adherence?** Close on the main scale, failing on the floor (9–11px labels, 12px mono, 16px panel title). → P1-2.
- **Spacing/shape?** Panel radius 10 ✅, button 8 ✅, min-height 44 ✅ (safe), but card-14 unused, focus offset 3 vs 2, several non-4px values. → P2-3.
- **Arena readability?** Fails. Identical plates, invisible glyphs, 2px team dots, faint telegraph, no shard VFX. → P0-1, P1-3, P1-4.
- **Art asset quality?** Ceramic-over-alloy reads correctly at 128px in isolation; it does not read at game scale, and team patterns are absent from the plates. → P0-1.
- **Empty/loading/error/stale & mobile?** Empty/error/stale present with recovery; loading lacks a skeleton; no toast/offline banner; mobile correctly hides the geometry editor. → P2-5, §1.8.
- **Brand vs. generic dashboard?** Reads generic; the material language barely surfaces. → P3-3.

---

*Prepared as an independent review. No application source files were modified. Findings are reproducible from the cited files/lines; the arena-scale arithmetic uses `unit=25` (`renderer/src/index.ts:4`) and the module sprite sizing at `:36-38`.*
