# G2 local — Workshop, Brain Lab, Arena

G2 implements T07/T08 on top of the G1 engine. It is a local/unofficial vertical slice; acceptance still depends on human usability/readability, independent art review and the hardware/browser matrix. See `deliverables/implementation/G2_REPORT.md` for measured results. G1 numeric limitations D17/D18 remain.

## Start

Use Node **24.18.0** and pnpm **10.34.6**, as in G0/G1. From the repository root:

```powershell
npx --yes pnpm@10.34.6 install --frozen-lockfile
npx --yes pnpm@10.34.6 build
npx --yes pnpm@10.34.6 --filter @prompt-chien/web dev
```

Open `http://127.0.0.1:5173`. This local flow does not need API, Postgres, MinIO or an account. It uses the existing G1 Brain/compiler/engine in one browser worker. The G0 `pnpm dev` API/service workflow is still available separately.

## One complete loop

1. Start with Mantis, or select another template and review/apply its Body/Brain diff. Choose a module, select a grid cell, then place it. Arrow keys move the cursor; Enter selects; Ctrl+Z / Ctrl+Shift+Z undo/redo. Move a selected module through X/Y and rotate it. Smartphone geometry is explicitly a summary flow; use tablet/desktop to place modules.
2. Check the bot. Body errors and Brain/compiler errors show their original JSON pointer. The cost display is informative; shared validation is the authority. A straight Burst muzzle warning is a cardinal heuristic, not an exact aim/collision claim.
3. Save a local revision. IndexedDB stores immutable revision rows and a CAS head. A stale tab cannot overwrite a newer head; its draft remains in memory and can be saved as a new Synth. My Synths can restore an earlier definition and Behavior Card into a new revision. Save before closing; export JSON for a portable backup.
4. Lock the current baseline, then change one Brain parameter or rule. Full rule JSON supports condition, intent, variable writes and nextState. Whole-bot JSON also supports variables, skills, state names and source imports. Unapplied buffers survive tab navigation; actions explain why they wait for Apply/Discard.
5. Choose an opponent and **1, 3 or 10 scenarios**: respectively **4, 12 or 40 legs**. Baseline and candidate use identical tuning seeds, opponent and both locked spawn slot assignments. The report includes hashes, seeds, per-leg results and scenario averages. Confidence is null; it is not a holdout/balance claim. Cancel terminates the worker; infrastructure failure is retryable and is never a bot loss.
6. Replay the candidate snapshot. Play/pause, step, speed and seek change presentation only. Own A resources/trace are a separate local sidecar; renderer accepts only public frames. Only A trace is returned to the UI; B Brain/energy/heat are absent from the public projection. The source map links trace rules to original JSON pointers.
7. Use a debrief event to form a hypothesis, edit the draft and save a new revision. Replay from the previous definition is marked stale. Parent package hash from the replay records the hypothesis lineage.

## Art and audio

Original SVG ceramic plates, glyphs, arena and synthesized WAV motifs live in `assets/source`; reproducible exports/atlas and license/hash manifest live in `assets/generated`. `node scripts/g2-assets.mjs` regenerates and copies runtime assets. Atlas is 640×256. Inter and IBM Plex Mono WOFF2 files are self hosted under `apps/web/public/fonts`; manifests retain official source URLs, transformed file hashes and OFL licenses. Source fonts were converted with fontTools; fonts are already shipped and no font conversion dependency is needed to run/build.

PixiJS **8.22.0** is pinned. Main UI has no Brain/engine import; Arena loads lazily. Resolution is capped at 2, low tier at 1.5. High/medium/low cap cosmetic flashes at 64/24/8; complete public events, module state, telegraphs and HUD remain. VFX can be disabled; grayscale uses the same frames with team badges/patterns. Reduced motion suppresses trails/flashes. Quality, volume and visual preferences use localStorage only for presentation; drafts use IndexedDB. Audio starts after a gesture, uses at most 15 Arena voices plus one native UI voice, conservative master gain and compressor; pause/seek cancels transient voices and 2×/4× suppress dense audio. UI click/confirmation/error cues have independent mute/volume controls. No clock/audio changes simulation.

WebGL context loss pauses at the current tick; restore redraws that tick. Unsupported WebGL or asset failure gives an error plus the usable DOM result/timeline/trace, rather than a blank application. Resize redraws paused frames. Renderer is shared under `packages/renderer`, independently of app/domain code.

## Verification

```powershell
npx --yes pnpm@10.34.6 check
npx --yes pnpm@10.34.6 test:unit
node scripts/boundary-selfcheck.mjs
node scripts/g2-qa.mjs
node scripts/g2-profile.mjs
```

Browser scripts reuse Playwright from this Codex dependency runtime or a project-installed `playwright`; set `PLAYWRIGHT_MODULE` to its module directory on another machine. They launch installed Chrome by default; `G2_BROWSER=msedge` selects Edge. `g2-qa` boots/stops its own production preview on 5187, tests with an isolated browser context, and records screenshots/results in `.local/g2/qa`. `g2-profile` starts/stops its own fixture server on 5188, records **120 actual seconds**, tests 10 renderer rebuilds after CDP garbage collection and separately labels desktop mobile emulation. Its maximum-input synthetic stress is **render-only**, never authoritative gameplay. It does not validate real phone performance or GPU memory drift.

`node scripts/g2-evidence.mjs` checks captured command exits and QA/profile artifacts, hashes a sorted source inventory, and copies evidence to `deliverables/implementation/T07/<revision>` and `T08/<revision>`. It requires `.local/g2/final-commands`, final browser QA, profile and budget results. Reports/compiled outputs/local private archives are excluded from source identity. No Git commit, push, official signing or deployment is implied.

Human testing instructions and blank recording sheets are in `deliverables/implementation/G2_PLAYTEST.md`; do not replace participants with automation.
