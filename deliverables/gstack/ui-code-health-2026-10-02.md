# UI Code-Health Review — PROMPT Chiến (G2 vertical slice)

- **Date:** 2026-10-02
- **Scope:** `apps/web` (React+Vite UI), `packages/renderer`, `scripts/boundaries.mjs`, Docs/04 §3 + Docs/06 §4–5/§17 + Docs/08 T07
- **Type:** Read-only structural review. **No application source was modified.**
- **Reviewer:** gstack-investigator
- **Question answered:** *why* the UI is hard to work with and feels cluttered — structurally, not just visually.

---

## TL;DR

The UI is not "a component tree with some ugly styling". It is **one 99-line / ~29 KB component that inlines ~20 logical components, 38 `useState` hooks, 10 refs, 9 effects and 54 inline handlers**, styled by **one 8-line / 12.7 KB minified CSS file with 217 rules, zero `@layer`, and 19 hex literals that duplicate tokens that already exist**. The **design system the architecture docs and the boundary lint both assume (`packages/design-system`) does not exist** — `scripts/boundaries.mjs:3` whitelists it for `web`, `Docs/04_ARCHITECTURE.md:63,70` lists it, and `Docs/08_IMPLEMENTATION.md:95` assigns it to T07, yet `packages/` contains only `brain, content, contracts, engine, renderer, replay`.

The result: every concern (state, layout, copy, tokens, a11y) lives in the same two files, so **there is no seam to change one thing without touching everything**. That is the structural root cause of "xấu và rối". Visual polish is downstream of this — you cannot make the UI consistent while the token set, the component vocabulary and the localization strings are all implicit and duplicated.

Quantified snapshot:

| File | Lines | Bytes | Rules/hooks | Notes |
|---|---:|---:|---|---|
| `apps/web/src/App.tsx` | 99 | 28,727 | 38 `useState`, 10 `useRef`, 9 `useEffect`, 0 `useMemo` | max line **1,142 chars**; ~20 components inlined |
| `apps/web/src/Arena.tsx` | 57 | 11,785 | 13 `useState`, 9 `useRef`, 4 `useEffect` | max line 605 chars; ~8 components inlined |
| `apps/web/src/style.css` | **8** | 12,702 | 217 rule blocks, 0 `@layer`, 5 `@media` | 35 hex literals, 19 duplicate tokens, 9 token-less |
| `packages/design-system` | — | — | — | **does not exist** (declared in 3 places) |

---

## Severity table

| # | Finding | Severity | Evidence | Blast radius |
|---|---|---|---|---|
| F1 | `App.tsx` is a single-component monolith: ~20 logical components, 38 hooks, 54 inline handlers in one function | **P0** | `App.tsx:11`–`App.tsx:97` | every UI change |
| F2 | Design system declared in boundaries + 2 docs but **not implemented**; no component library, no token module, no i18n owner | **P0** | `boundaries.mjs:3`; `Docs/04:63,70`; `Docs/08:95`; `ls packages/` | every screen, forever |
| F3 | CSS is an 8-line minified monolith: 217 rules, no `@layer`, 19 token-duplicating hexes, 9 token-less hexes; 11 tokens exist vs **21 documented** | **P1** | `style.css:1`–`style.css:8`; `Docs/06:123`–`145` | visual consistency |
| F4 | State sprawl: 38 `useState` + 10 refs + no reducer; `dirty`/`pending` are hand-derived; 3 sources of truth for bot text (`bot`, `importText`, `ruleText`) | **P1** | `App.tsx:12`–`23`, `:52` | correctness + re-render cost |
| F5 | `JSON.stringify` used as the equality / dirty / stale-check primitive (key-order sensitive, O(bot) per render) | **P1** | `App.tsx:39,41,52`; `model.ts:20-21`; `renderer/index.ts:27` | correctness |
| F6 | Zero component tests, no jsdom/testing-library, no storybook, no eslint/prettier → App.tsx is 100% untested and unguarded | **P1** | `tests/workshop.test.ts`; `package.json`; no config files found | every change |
| F7 | Global panels render on every view: the A/B Experiment panel + footer sit outside the `view===` conditionals → DOM order ≠ visual intent, added clutter on Arena/Synths | **P2** | `App.tsx:91`–`93` | layout + a11y |
| F8 | Presentation leaks gameplay constants + duplicated Vietnamese copy with no localization owner | **P2** | `renderer/index.ts:4,39,49`; `Arena.tsx:47`; `App.tsx:8`; `Arena.tsx:6` | drift vs engine |
| F9 | Magic numbers + comma-operator density: 11× literal `12`, 9× `1000`, grid math inlined in JSX; `view` is a `useState` string, not a route | **P2** | `App.tsx:60,75,76`; `App.tsx:12` | maintainability |

No P0 *runtime* bug was found; these are structural P0s. Positive notes: **no `dangerouslySetInnerHTML` / `innerHTML` / `eval`** anywhere in `apps/web/src` or `packages/renderer/src`; `tsconfig.base.json` has `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` on; no hard boundary-lint violation (see F8 for the soft leak).

---

## Per-finding detail

### F1 — `App.tsx` is a single-component monolith (P0)

**Evidence.** `App.tsx` is 99 lines / 28,727 chars. The component body spans `App.tsx:11`–`:97`. The render return is `App.tsx:66`–`:96`. Measured density:

| Line | Chars | What it is |
|---:|---:|---|
| 67 | 633 | Navigation + brand + nav-foot |
| 69 | 800 | SynthHeader (name + 3 actions) |
| 73 | 535 | ModulePalette |
| 74–76 | 545 / 446 / 406 | BlueprintGrid + 144-cell loop + ModuleLayer |
| 77 | 706 | BuildControls + DesktopHelp + MobileNote |
| 78 | 319 | ModuleList (`<details>` fallback) |
| 80 | 685 | BuildInspector diagnostics + budget + meter + `dl` |
| 81 | 976 | BuildInspector selected-module editor |
| 84 | **1,132** | ImportPanel |
| 85 | **1,142** | Brain Lab state/rule rail |
| 86 | 850 | RuleEditor |
| 87 | 932 | RuleEditor controls |
| 88 | 609 | BehaviorCard |
| 89 | 773 | Arena view |
| 90 | 1,121 | My Synths |
| 91 | 1,090 | ExperimentPanel |
| 92 | 777 | Comparison table |

Counts: **38 `useState` declarations** (`App.tsx:12`–`22`, `:18`, `:22`), **10 `useRef`** (`:23`), **9 `useEffect`** (`:20,21,46,47,49,50,51,53,54`), **0 `useMemo`**, **54 inline handlers** (36 `onClick`, 16 `onChange`), **82 `className=`**, **18 `json()` calls** + 1 `JSON.stringify`, 1 inline `style={{}}` object.

**Logical components that should exist but are inlined (~20):** `AppShell`, `Navigation`, `TopBar`, `SynthHeader`, `StatusStrip`, `ErrorBanner`, `PendingNotice`, `WorkshopView`, `ModulePalette`, `BlueprintGrid`, `CellGrid`, `ModuleLayer`, `BuildControls`, `ModuleList`, `BuildInspector`, `BuildDiagnostics`, `ImportPanel`, `BrainLabView`, `StateRail`, `RuleEditor`, `BehaviorCard`, `ArenaView`, `ArenaEmpty`, `MySynthsView`, `DraftRow`, `Lineage`, `ExperimentPanel`, `ComparisonTable`, `Footer`.

**Root cause.** T07 (`Docs/08:95`) was scoped as one deliverable ("module grid editor … Brain editor … Behavior Card … paired A/B … debrief") and implemented as one component. There was never a decomposition step, and no lint/format guardrail (F6) to discourage the comma-operator style. The docs specify *screens and states* but never a *component contract*, so nothing forced the split.

**Impact.** Every change — a button label, a spacing tweak, a new field — is edited inside a 1,100-char line that also owns the worker message loop, undo/redo, dirty tracking and persistence. Reviewers cannot see a diff; the file is the #1 merge-conflict surface; new contributors must hold the entire app in working memory. This is the direct mechanism behind "rối".

**Fix.** Extract presentational components bottom-up with props (Phase 1 below), then move state into hooks (Phase 2). See "Proposed decomposition".

---

### F2 — The design system is declared but does not exist (P0)

**Evidence.**
- `scripts/boundaries.mjs:3` — `allowed = { …, 'design-system': [], web: ['contracts','renderer','design-system'], … }`. The lint explicitly permits `web → design-system`, and reserves an (empty-import) `design-system` package.
- `Docs/04_ARCHITECTURE.md:63` — tree entry `design-system/  DOM components/tokens/localization`.
- `Docs/04_ARCHITECTURE.md:70` — `web→renderer/design-system/contracts`.
- `Docs/08_IMPLEMENTATION.md:95` — T07 **Paths:** `apps/web, design-system DOM components`.
- `Docs/06_ART_UX.md:513` — handoff: "Dùng token, typography, spacing, button/input/card/modal/toast/focus ở mục 4–5"; §4 defines a 21-token palette.
- `ls packages/` → `brain content contracts engine renderer replay`. **No `design-system`.**

**Root cause.** The package was specified in three documents but never created; the Frontend Agent absorbed its responsibilities into `App.tsx` + `style.css`. The boundary lint does not *require* the package to exist (it only checks that imports are allowed), so the gap was never caught.

**Impact.** This is the single highest-leverage finding. Because there is no token module, no primitive set and no localization module:
- tokens drift into raw hexes (F3),
- copy is duplicated across files (F8),
- every button/panel is re-styled ad hoc, so the UI cannot look consistent,
- the documented "token / typography / spacing / button / input / card / modal / toast / focus" contract has no owner and no home.

**Fix.** Create `packages/design-system` (Phase 3): `tokens.css` with all 21 doc tokens, a small primitive set, and `i18n/vi.ts`. Wire it via `pnpm-workspace.yaml` and the existing boundary rule (already whitelisted). This is exactly what the architecture already expects — no new decision required, only executing the one on file.

---

### F3 — CSS is an 8-line minified monolith with token drift (P1)

**Evidence.** `style.css` is **12,702 bytes on 8 physical lines**, **217 rule blocks**, **0 `@layer`**, **5 `@media`** breakpoints (1600/1300/1050/767/reduced-motion), 1 `@import`. `:root` (`style.css:1`) declares **11 tokens**:
`--void, --arena, --surface, --raised, --line, --quiet, --muted, --gold, --danger, --a, --b`.

`Docs/06_ART_UX.md:123`–`145` defines **21 tokens**. Missing from `:root` (and their raw hexes appear in the file instead):

| Doc token | HEX | Present in `:root`? | Raw hex in CSS |
|---|---|---|---|
| Surface 3 | `#25323D` | ✗ | `#25323d` ×2 (`style.css:5,9`) |
| Text primary | `#F4F1E8` | ✗ | `#f4f1e8` ×4 (`:4,54,58`) |
| Text muted | `#94A1AB` | ✗ | `#94a1ab` ×3 (`:42,76,141`) |
| Ceramic lit | `#F1EADC` | ✗ | — (in renderer as `0xf1eadc`) |
| Alloy | `#39434C` | ✗ | `#39434c` ×1 (`:99`) |
| Core | `#F1C86B` | ✗ | `#f1c86b` ×1 (`:11`) |
| Success | `#55C58A` | ✗ | `#55c58a` ×1 (`:45`) |
| Warning/heat | `#F0B85B` | ✗ | — |
| Info | `#7EBBE8` | ✗ | — |
| Ceramic | `#D9D4C8` | ✗ | — |

Token-duplication (hardcoded value that already has a token): **19 occurrences across 11 distinct hexes** — e.g. `#b9c2c9` ×5 (= `--muted`), `#090d11` ×2 (= `--void`), `#0e141a` ×2 (= `--arena`), `#1b2630` ×2 (= `--raised`), `#293640` ×2 (= `--quiet`). Plus **9 token-less hexes** including one-off tints `#e8c56c22` ×2 (a hardcoded alpha of `--gold`) and `#f1d58e`, `#536571`.

**Root cause.** No `@layer` ordering and no token discipline → authors hardcode the nearest colour; with no design-system owner (F2) nothing reconciles the hex against the doc. The file was then minified onto 8 lines, so drift is invisible in review.

**Impact.** Global restyles are impossible without regex surgery; `--muted` and the raw `#b9c2c9` are two sources of truth; changing a token silently fails to update the 19 hardcoded sites. This is a direct cause of "xấu" — inconsistent surfaces/contrast because the palette is only half-applied.

**Fix.** (Phase 0, additive) create `styles/tokens.css` with all 21 doc tokens and import it; (Phase 4) split into `@layer reset, tokens, base, layout, components, utilities;`, replace all 28 non-token hexes with `var(--…)`, and delete the duplicated literals. Keep each rule's declaration block intact when splitting.

---

### F4 — State-management sprawl, no reducer (P1)

**Evidence.** 38 `useState` + 10 `useRef` in `App.tsx:12`–`23`. State groups, currently flat and mutually coupled:

| Group | Hooks | Lines |
|---|---|---|
| view / bot / templates / catalog / cards | 5 | `:12` |
| history (past/future/selected/cell/palette) | 5 | `:13` |
| diagnostic / validation / busy / status | 4 | `:14` |
| replay / comparison / opponent / count / baseline | 5 | `:15` |
| draftId / revision / drafts / history / stored / saving | 6 | `:16` |
| hypothesis / weakness / parentHash | 3 | `:17` |
| uiSound / uiVolume (+ ref) | 3 | `:18` |
| importText / importDirty / staged / showImport / stateIndex / ruleIndex / ruleText / ruleDirty | 8 | `:22` |
| refs (worker, seq, active, applyId, applyBase, current, loaded, rootCell) | 8 | `:23` |

Derived flags are hand-computed: `dirty` and `pending` at `App.tsx:52`. Three separate representations of the same bot text coexist: the applied `bot`, `importText`, and `ruleText`, kept in sync by effects at `App.tsx:47` and `:50` guarded by `importDirty`/`ruleDirty`.

**Root cause.** Incremental feature addition on a single component — each feature added its own `useState` pair, and cross-cutting concerns (dirty/pending, worker job lifecycle) were expressed as ad-hoc derived booleans instead of a state machine.

**Impact.** (a) Inconsistency risk is real: `importText`/`ruleText` can diverge from `bot` and the code defends this with `applyBase.current`/`applyId.current` string comparisons (`App.tsx:39,41`) — a race the type system does not catch. (b) The worker job lifecycle is spread over `busy`, `active.current`, `applyId.current`, `applyBase.current`, `seq.current` — a classic 5-variable protocol that should be one reducer. (c) No `useMemo` at all, so every one of the ~30+ state changes re-runs all derivations including the deep `JSON.stringify` in `dirty`.

**Fix.** (Phase 2) Introduce `useReducer` (`sessionReducer`) holding `{bot, past, future, baseline, draft:{id,revision,stored}, editors:{importText,importDirty,staged,ruleText,ruleDirty}, job:{busy,id,applyId,applyBase}}` and a `useWorker` hook owning the message protocol. Replace the string-compare race guard with a monotonically increasing `jobId` + structural revision counter.

---

### F5 — `JSON.stringify` as the equality / dirty / stale primitive (P1)

**Evidence.**
- `App.tsx:52` — `dirty = !!bot && (json({bot,hypothesis,weakness,parentHash}) !== stored || …)` runs **on every render**, deep-serializing the entire bot (body + brain + all rules) with 2-space indentation (`json` = `JSON.stringify(value,null,2)`, `App.tsx:9`).
- `App.tsx:39` — `applyBase.current !== json(current.current)` (stale-draft guard).
- `App.tsx:41` — `active.current.text === json(current.current)` (job-ownership check), mixed into an `||`/`&&` chain.
- `model.ts:20`–`21` — `diffSummary` stringifies every module twice plus the whole brain.
- `renderer/index.ts:27` — `JSON.stringify(options) === JSON.stringify(this.options)` on every `render()` call (i.e. every animation frame at 60 Hz during playback).

**Root cause.** No structural-equality utility and no immutable-version counter; stringify is the path of least resistance, and TS `strict` does not flag it.

**Impact.**
1. **Correctness:** `JSON.stringify` is **key-order sensitive**. `dirty`, the stale-draft guard and job-ownership all compare strings; any code path that rebuilds an object with a different key order (`{...bot, name}` vs a decoded JSON, `structuredClone` round-trips, future persistence normalization) yields a false "dirty"/"stale"/"job mismatch" with no type error. `App.tsx:39` can wrongly discard a valid validation result.
2. **Performance:** a full pretty-printed stringify of the bot per render, and per animation frame in the renderer. For a 24-module body with multiple brain states/rules this is KB-scale allocation + GC churn on the main thread during exactly the interaction the user is judging. The renderer's version also defeats its own early-out intent: it allocates two strings per frame to decide whether to skip drawing.

**Fix.** (Phase 2/3) Add a `structuralEqual`/`revision` counter in the session reducer; make `dirty` depend on a `rev` integer, not a serialization. In the renderer, compare the 4 option fields directly (`o.quality===this.options.quality && …`) — no allocation. In `diffSummary`, compare field-by-field.

---

### F6 — Untestable and unguarded (P1)

**Evidence.**
- `tests/workshop.test.ts` is the only "workshop" test and it imports **only** `packages/content`, `apps/web/src/model.ts` (pure functions) and `renderer.eventLocation`. **Zero React components are rendered anywhere in `tests/`.**
- No `jsdom`, no `@testing-library/*`, no `happy-dom` in `package.json` or `apps/web/package.json`; `vitest.config.ts` includes only `tests/**/*.test.ts` with no DOM environment.
- No `.storybook/`, no storybook dependency.
- **No eslint and no prettier** anywhere (no config files, no deps) — so `react-hooks/exhaustive-deps`, `jsx-a11y` and any style rule are absent. The comma-operator density and the stale-closure risk in `createWorker` (`App.tsx:28`–`46`, mounted once with `[]` deps but closing over first-render `loadDraft`) are exactly what those rules would flag.
- `main.tsx` renders `<App/>` with no error boundary and no `StrictMode`.

**Root cause.** Tests were written per *package* (engine/brain/replay/contracts have real suites) but the `apps/web` UI was never given a test harness; the docs' acceptance for T07 relies on "Playwright + usability sessions" (`Docs/08:96`), so unit/component coverage was never added.

**Impact.** Blast radius of any change = the whole app. There is no way to verify a `BlueprintGrid` edit, a dirty-state regression or a rule-editor change without manually driving the full worker + IndexedDB + WebGL stack. Refactoring (F1) is therefore high-risk *precisely because* there is no safety net — the two findings compound.

**Fix.** (Phase 0, before any refactor) add `eslint` + `eslint-plugin-react-hooks` + `jsx-a11y`, `prettier`, `jsdom` + `@testing-library/react` + `@testing-library/user-event`; add a smoke test that renders `<App/>` with the worker mocked and asserts the nav + Workshop panels mount. Then every extraction in Phase 1 ships with a characterization test.

---

### F7 — Global panels render on every view (P2)

**Evidence.** `App.tsx:89`–`90` are gated by `view==='Arena'` / `view==='My Synths'`, but the Experiment panel (`App.tsx:91`–`92`) and the footer (`App.tsx:93`) are **outside** every `view===` conditional, at the same level inside `<main>`. The `{diagnostic&&…}` banner (`:71`) and `{pending&&…}` notice (`:72`) are likewise global.

**Root cause.** The A/B experiment was implemented as an always-visible bottom section rather than a Workshop/Brain-Lab-scoped panel; the view model (`view` string) has no notion of which panels belong to which screen.

**Impact.** On the Arena screen the user sees the replay, then an A/B experiment editor and a comparison table below it — irrelevant to watching a match and a source of perceived clutter. It also breaks the intended heading order (an `h2` experiment section follows Arena content) and adds DOM weight to every view. `Docs/06 §6` describes per-screen layouts; a global experiment block contradicts that.

**Fix.** (Phase 1) Move `ExperimentPanel` + `ComparisonTable` into `features/experiment/` and render them only in `Workshop` and `Brain Lab` (the views where a candidate can be edited), or gate on `view`. Move the footer outside `<main>` into the app shell.

---

### F8 — Presentation leaks gameplay constants and duplicates copy (P2)

**Evidence.**
- `packages/renderer/src/index.ts:4` — `const color={A:…,B:…}, unit=25;` (world scale hardcoded in presentation).
- `renderer/index.ts:39` — damaged-core threshold `m.hp < (core ? 400 : 100)`; `renderer/index.ts:49` — core HP bar divides by `800`. Two different core-HP constants in the same file, neither sourced from contracts.
- `Arena.tsx:47` — energy meter `max={1000 + capacitors*250}`; heat meter `max="1000"` (`:47`). Gameplay units hardcoded in the React HUD.
- Duplicated, un-owned Vietnamese copy: `App.tsx:8` `labels` (8 module names) and `Arena.tsx:6` `captions` (16 event kinds); plus inline strings throughout both files. `Docs/04:63` assigns `localization` to the missing `design-system` package (F2), so there is no owner.

**Root cause.** No design-system/i18n module (F2) and no contract-provided presentation constants; the renderer/HUD author inlined the numbers and words that were at hand. Note `Docs/06 §17` explicitly warns "Không hardcode giả định riêng cho renderer" and "rules/units lấy từ 02_GAMEPLAY".

**Impact.** If the engine changes core HP, energy cap or grid scale, the presentation silently desyncs (the 400-vs-800 split is already an internal inconsistency). Copy cannot be changed once for all screens. **Boundary lint:** this is *not* a violation of `boundaries.mjs` — `renderer` imports only `contracts`/`replay` and `web` imports only allowed packages — it is a **soft boundary leak** (magic gameplay values crossing the presentation contract).

**Fix.** (Phase 3/4) Source scale/HP/energy caps from `@prompt-chien/contracts` (or a presentation constants module derived from them); move all copy into `design-system/src/i18n/vi.ts` keyed by module `catalogId` / event `kind`.

---

### F9 — Magic numbers, comma-operator density, no routing (P2)

**Evidence.**
- 11× literal `12` and 9× `1000` in `App.tsx`; grid math inlined in JSX: `x=i%12`, `y=11-Math.floor(i/12)` (`App.tsx:75`), and the module-layer style computes `m.cell.x/12*100` etc. inline (`App.tsx:76`). `144` cells, `size` `2` for core, `orientation*90`, `/1000`, `*unit=25` all appear as bare numbers.
- Comma-operator declarations: `const [a,setA]=useState(…), [b,setB]=…` throughout `App.tsx:12`–`18`, `:22`; `const worker=useRef(…),seq=useRef(0),…` (`:23`).
- `view` is `useState('Workshop')` (`App.tsx:12`), not a route: no URL, no back/forward, no deep link; `Docs/04:49` says "React shell + **routes**". `lazy(()=>import('./Arena.js'))` (`:7`) is the only code split.

**Root cause.** Minification-style authoring with no formatter to normalise it (F6) and no constants module (F2/F8).

**Impact.** Reviewing a one-line diff is impractical; the 12×12 assumption is duplicated in the grid loop, the cell-hit-test (`:59,60`), the module layer (`:76`) and `moveCell` clamps (`:61`); a change to grid size requires finding all 11 sites. No routing blocks shareable/refreshable screen URLs.

**Fix.** (Phase 0/4) Run Prettier to expand to one declaration per line and one JSX element per line (mechanical, reviewable). Extract `GRID = 12`, `CELLS = GRID*GRID`, `CORE_SIZE = 2`, `UNIT_SCALE = 1000` into a shared constants module. (Phase 5) Adopt a tiny router (or `view` derived from `location.hash`) so screens are addressable.

---

## Proposed component / file decomposition

Target tree (the design-system package is the one already declared in the boundary lint):

```text
packages/design-system/            # NEW — F2
  package.json
  src/
    index.ts
    tokens.css                     # all 21 Doc/06 tokens, in @layer tokens
    i18n/vi.ts                     # module labels + event captions + UI copy
    primitives/
      Button.tsx  Panel.tsx  Field.tsx  Notice.tsx
      ErrorBanner.tsx  StatusStrip.tsx  Meter.tsx
      Tabs.tsx  Toolbar.tsx  Badge.tsx

apps/web/src/
  main.tsx                         # + ErrorBoundary, StrictMode
  styles/
    index.css                      # @layer reset, tokens, base, layout, components, utilities
    tokens.css  layout.css  components.css  responsive.css
  app/
    App.tsx                        # shell only: routing + providers  (target <80 lines)
    AppShell.tsx  Navigation.tsx  TopBar.tsx  Footer.tsx
  state/
    useBotSession.ts               # reducer + history + revision counter (replaces ~24 hooks)
    sessionReducer.ts
    useWorker.ts                   # worker lifecycle + request/response protocol
    useUiSound.ts
  features/
    workshop/
      WorkshopView.tsx
      ModulePalette.tsx
      BlueprintGrid.tsx
      CellGrid.tsx
      ModuleLayer.tsx
      BuildControls.tsx
      ModuleList.tsx               # the <details> fallback
      BuildInspector.tsx
      BuildDiagnostics.tsx
      ImportPanel.tsx
    brain/
      BrainLabView.tsx  StateRail.tsx  RuleEditor.tsx  BehaviorCard.tsx
    arena/
      ArenaView.tsx  ArenaEmpty.tsx  ReplayNotice.tsx  Arena.tsx  Telemetry.tsx
    synths/
      MySynthsView.tsx  DraftRow.tsx  Lineage.tsx
    experiment/
      ExperimentPanel.tsx  ComparisonTable.tsx
  lib/
    json.ts                        # structuralEqual / diff, replaces stringify-as-equality
    constants.ts                   # GRID, CORE_SIZE, UNIT_SCALE
```

Indicative target sizes (from the measured line-density map): `App.tsx` → shell only (<80 lines); each feature view 60–140 lines; primitives 15–40 lines each; `style.css` → 5–6 layered files of 40–120 lines.

---

## Phased refactor plan (keeps the app working)

Each phase is independently shippable and verified by `pnpm check` (`tsc -b` + `node scripts/boundaries.mjs`) plus the growing test suite.

**Phase 0 — Guardrails (no behaviour change, do first).**
1. Add Prettier + config; run it once over `apps/web/src` (mechanical diff — do not hand-edit logic).
2. Add ESLint with `react-hooks`, `jsx-a11y`, and a `no-sequences` rule; fix or suppress findings explicitly.
3. Add `jsdom` + `@testing-library/react`; add a smoke test that renders `<App/>` with the worker and IndexedDB mocked.
4. Add `styles/tokens.css` with the 10 missing Doc/06 tokens (additive; existing hexes still work) and import it.

**Phase 1 — Extract presentational components (no state moves).**
Extract, one PR each, props-only: `StatusStrip`, `ErrorBanner`, `PendingNotice`, `Footer`, `Navigation`, `TopBar`, `SynthHeader`, `ModulePalette`, `BuildDiagnostics`, `ComparisonTable`, `ModuleList`. `App.tsx` stays the orchestrator. Add a render test per component. Move `ExperimentPanel` behind a `view` gate (F7) and the footer out of `<main>`.

**Phase 2 — State into hooks/reducer.**
Introduce `sessionReducer` + `useBotSession` (replacing ~24 `useState`), `useWorker` (owning `busy/active/applyId/applyBase/seq`), and `useUiSound`. Replace the `JSON.stringify` dirty/stale checks with a `rev` counter and `structuralEqual` (F5). Target `App.tsx` < 80 lines.

**Phase 3 — Create `packages/design-system`.**
Add the package (already whitelisted in `boundaries.mjs:3`), move tokens + primitives + `i18n/vi.ts` there, refactor `web` to import from it. Removes the duplicated label/caption maps (F8).

**Phase 4 — CSS architecture.**
Split `style.css` into `@layer reset, tokens, base, layout, components, utilities`; replace the 28 non-token hexes with `var(--…)`; move the inline `module-layer` layout (`App.tsx:76`) to CSS custom properties set per module (`--x/--y/--w/--h/--rot`). Convert renderer/HUD gameplay constants to contract-sourced values (F8).

**Phase 5 — Routing + accessibility pass.**
Make `view` addressable (route/hash) (F9); run an automated a11y scan (axe) + keyboard/heading-order review; verify the module `<details>` fallback and focus management.

**Definition of done:** `App.tsx` ≤ ~80 lines and contains no `useState` for bot/editor state; no raw hex outside `tokens.css`; no `JSON.stringify` equality checks; `design-system` package exists and is imported by `web`; component tests cover each feature view; `pnpm check` green.

---

## Appendix — measurement commands used

```text
awk 'END{print NR}' apps/web/src/App.tsx            # 98/99 lines
python: len(re.findall(r'useState', app))           # 38 declarations
python: count r'#[0-9a-fA-F]{3,8}' in style.css     # 35 literals / 20 distinct
python: split style.css on '}'                       # 217 rule blocks
grep design-system  Docs/ scripts/                   # 3 declarations, 0 implementations
find packages/ -maxdepth 1 -type d                   # no design-system
```
