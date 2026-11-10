# MVGreen – Navrhni si zahradu

Memory file for this repo, written so a new session doesn't have to
re-derive context (and re-burn tokens) that already exists here. The
container resets between sessions — **anything not committed to this repo
is lost**. Keep this file updated as things change; it's cheaper than
rediscovering them.

## What this is

A WordPress plugin (`Piel89/mvgreen-navrh-zahrady`) that lets a homeowner
upload a photo of their garden, mark what should stay fixed vs. what can
change, describe/pick a style, and get an AI-generated redesign of the
photo (via OpenAI image edits) plus a plant list, care plan and price.

It's a side project of the owner's actual business, MVGreen
(www.mvgreen.cz) — a lawn/green-maintenance company. **The owner is not a
developer and not a gardener/plant expert** (knows lawns, not beds/plants).
He reports bugs by describing what he saw while clicking through the live
site, usually in Czech, sometimes with screenshots. Expect imprecise
phrasing — read the intent, not the literal grammar — and reply to him in
Czech.

## Repo layout

```
mvgreen-navrh-zahrady/              ← git root (no further nesting beyond this)
├── version.json                    ← single source of truth for the plugin version (see Release process)
├── TODO.md                         ← owner's "maybe later" ideas — NOT to be implemented without explicit request
├── docs/                           ← handover docs, NOT shipped in the plugin ZIP
│   ├── README.md                   ← short post-handover changelog (older, mostly superseded by git log)
│   └── MVGreen_predani_projektu_23-10-2026.pdf  ← original handover doc (decisions, known issues)
└── mvgreen-navrh-zahrady/          ← the actual plugin (this is what WordPress loads)
    ├── mvgreen-navrh-zahrady.php   ← main plugin file: Version docblock + MVGREEN_VERSION constant, enqueues, AJAX/REST endpoints
    ├── github-updater.php          ← checks GitHub releases for updates (this is how the live site gets new versions)
    ├── payments.php, plan.php, poptavka.php, web.php  ← other plugin PHP (payments, the lawn-care plan tool, demand/poptávka form, mvgreen.cz site helpers)
    └── assets/
        ├── app.js                  ← the wizard/designer UI — by far the biggest file, 300k+. Steps 0–8, mask painting UI glue, concept picker, AI call orchestration.
        ├── app.css                 ← matching styles
        ├── garden-brief.js         ← buildInstructions(): builds the actual text prompt sent to the AI
        ├── ai-safety.js            ← pixel-level enforcement: finish() validates/crops what the AI returned against the locked mask (see below)
        ├── mg-paint-mask.js        ← step 4's brush tool: paint "Zůstane/Odstranit" over an auto-segmented (SLIC) photo
        ├── mg-area-types.js        ← step 5's grid-brush tool: classify the editable area into grass/path/wall/bed/mulch/paving/hedge
        ├── mg-slic.js + mg-segment-worker.js  ← SLIC superpixel segmentation used by mg-paint-mask.js
        ├── garden-plan.js          ← builds the plant list / staged plan / care plan content shown after generation
        ├── garden-care.js          ← care-calendar content
        ├── catalog-805.js          ← plant catalog data
        └── web.js / web.css        ← unrelated: helpers for the main mvgreen.cz marketing site, not the designer wizard
```

## The wizard (app.js), step numbers

`wizardStep` 0–8, driven by `showWizardStep(n)`:

- 0 — welcome/landing
- 1 — style choice
- 2 — (variant/reference picks)
- 3 — photo upload
- 4 — **Označení plochy** — mark what stays ("Zůstane") vs. what can
  change, via `mg-paint-mask.js`. Auto-opens the paint dialog every time
  this step is entered (see `openMaskConfirmation(editExisting)` — pass
  `true`, which preloads the customer's existing `paintCategory`, whenever
  a mask already exists; passing `false` forces a fresh
  auto-segmentation guess and silently discards prior marks — this was a
  real bug, fixed in 0.6.223, don't reintroduce it).
- 5 — **Co kam patří** — classify the editable area (grass/path/wall/bed/
  mulch/paving/hedge) via `mg-area-types.js`. NOT auto-opened; shows a
  status + "Určit, co kam patří" / "Upravit určení" (`editExisting=true`,
  preserves prior marks) / implicit "start over" via the main button once
  already determined.
- 6 — generation step / review before sending
- 7 — **3 concepts picker** (only on the `!hasAreaTypes` path — i.e. when
  the customer didn't use step 5's area-type tool): shows 3 cheap AI
  generations side by side, customer picks one, then a final high-quality
  generation runs on the chosen one. See `conceptVariants` below.
- 8 — done / finish

## Key concepts in the AI pipeline

**`ai-safety.js` `finish(photo, editMask, aiImage, box, bufferMask)`** —
the actual enforcement layer. Compares the AI's output pixel-by-pixel
against the original photo, outside the confirmed editable mask:
- Pixels strictly outside the mask+buffer must barely change (`drift`
  check, `MAX_DRIFT=22`).
- A thin "ring" around the mask boundary (`bufferMask`) is allowed more
  drift (occlusion by a plant/bush growing into it is realistic) BUT only
  within a dilated "growth reach" mask — i.e. only where the AI actually
  drew real new growth just inside the editable mask that plausibly
  reaches that ring pixel. Ring pixels not reachable by real growth get
  full strict treatment.
- `ringOverrun` (`RING_MAX_CHANGED_SHARE=0.5`): if more than half the ring
  pixels changed a lot, the whole generation is rejected — this is what
  catches wholesale redraw/erasure of a locked object (a fence, a tank
  lid) rather than legitimate partial occlusion by a plant.
- Returns `{ ok, drift, emptyInside, ringOverrun, canvas, raw }`.

**`garden-brief.js` `buildInstructions()`** — the prompt text. Encodes, in
Czech, the rules the owner has dictated over many sessions:
- Whole-photo context: look at locked elements (house, fence, paving) and
  match new elements' material/color/style to them.
- Plants near a locked backdrop keep full natural height/width and may
  grow INTO the occlusion ring to realistically cover part of a locked
  element — never artificially shrunk/pushed back or cut off in a straight
  line, unless nothing locked is behind them at all.
- The occlusion ring is for a SMALL LOCAL part of any locked element
  (house, fence, wall, gazebo, composter, tree, tank lid, anything) —
  never the whole element or most of it; that's erasure, not occlusion,
  and stays forbidden inside the ring too.
- The customer's own written/checked wishes always outrank any generic
  style default.

**`app.js` `conceptVariants`** (was `conceptStyles` before 0.6.220 — a
fixed moderní/rustikální/naturalistický triple that ignored the
customer's own chosen style; reversed per owner's explicit instruction) —
3 *composition-emphasis* variants ("Vyvážená varianta" / "Bohatší
výsadba" / "Otevřenější varianta") layered on top of the customer's own
style/notes, not 3 unrelated styles. Each non-empty variant's extra text
ends with an explicit "only applies where the customer didn't already say
something else" guard, so it can never outrank what the customer
actually wrote (0.6.222 fix).

## Release process (follow exactly, every code change)

1. Bump the version in lockstep, in all three places:
   - `mvgreen-navrh-zahrady/mvgreen-navrh-zahrady.php`: the `Version:`
     docblock line AND the `MVGREEN_VERSION` constant.
   - `version.json` (repo root).
2. Lint: `php -l` on any touched `.php` file; `node --check` on any
   touched `.js` file.
3. `git add` the **specific files only** (never `-A`/`.`).
4. `git commit` with a message explaining the *why*, ending with:
   ```
   Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
   Claude-Session: <this session's URL — check the current system reminder for the exact value, it changes per session>
   ```
5. `git push origin main`.
6. Confirm the GitHub Actions build picked up the exact commit SHA:
   `gh run list --repo Piel89/mvgreen-navrh-zahrady --workflow=build-plugin.yml --branch=main --limit=5 --json databaseId,status,conclusion,headSha,event`,
   then poll `gh run view <id> --json status,conclusion` until
   `status:"completed"`.
7. Confirm the release exists:
   `gh api repos/Piel89/mvgreen-navrh-zahrady/releases/tags/vX.Y.Z`.

**Never skip steps 6–7** — a push that fails to build silently leaves the
live site on the old version with no error visible here.

## Live site

- Site: `mvgreen.cz`, wizard embedded at `https://mvgreen.cz/navrhni-si-zahradu/`.
- Updates ship via `github-updater.php`, which polls GitHub releases —
  so step 7 above (confirming the release exists) is what actually makes
  an update available in wp-admin.
- **Updating the live plugin is classified as a "Production Deploy" and
  blocked by the Claude Code auto-mode permission classifier** — clicking
  "spustit automatickou aktualizaci" in wp-admin cannot be done from here.
  Ask the owner to click it himself (he responds quickly over chat during
  live testing sessions).
- The "Vytvořit testovací AI návrh (levný test)" button (`#mg-ai-test`,
  admin-only, gated by `window.MVGreenAI.enabled`) runs the exact same
  `runAiGeneration()` path a real customer gets, but at OpenAI's cheapest
  image quality — good for testing logic/positions/text, not final visual
  quality. Real customer runs cost real money; say so before triggering
  one, and prefer this cheap path for testing when possible.

### Browser-automation gotchas (Claude in Chrome) found while live-testing

- Clicking `#mg-ai-test` triggers a native `confirm()` dialog that
  **freezes the Chrome extension's CDP connection** (clicks/screenshots
  start timing out). Workaround: `javascript_tool` ->
  `window.confirm = () => true;` then
  `document.getElementById('mg-ai-test').click();` — bypasses the native
  dialog entirely.
- `confirmedEditMask` (step 4's result) is an **in-memory `<canvas>`, not
  persisted to localStorage** — a full page navigation/reload loses it,
  even though other form state survives. If you navigate away mid-test
  (e.g. to wp-admin to check/trigger an update) you'll need to repaint
  the mask from scratch afterward.

## AI architekt v2 (rebuild in progress, started 2026-11-08)

The owner rejected the 8-step wizard ("looks cheap") and approved a new design (claude.ai
artifact "MVGreen AI architekt – návrh": 5-step mobile wizard, painted planting plan, 11-page
A4 PDF). It is being built **next to** the old designer, not replacing it:

- `architekt.php` – shortcode `[mvgreen_ai_architekt pred="URL" po="URL"]` for a hidden,
  password-protected test page. Photos come from the WP media library – the repo is **public**,
  never commit customer photos.
- `assets/v2/plan-render.js` – `MVGreenPlan.renderSheet(project)` draws the painted plan from a
  project in **metres** (areas, beds with `back` edges + `blocked` spots, paths with stones,
  walls, structures, fences, existing plants, labels). Plants are auto-placed by `spon`, so
  legend/budget counts always match the drawing – never hand-count.
- `assets/v2/architekt.js` – the 5-step wizard (photo+mask → place/orientation/house/fence → mode
  AI vs. customer sketch, style, wishes → summary → result + 11-page PDF). Global for plan render is
  `MVGreenPlanV2` (not `MVGreenPlan` – collides with garden-plan.js). Test hook:
  `window.MVGreenArchitektTest` (state, build(ctx), pickPlants) – used by node tests.
- `assets/v2/plants-catalog.js` – **generated, never edit by hand.** ~1200 plants (perennials,
  grasses, ferns, bulbs, shrubs, hedges, conifers, trees, fruit trees, climbers), built by
  `node scripts/build-plants.js` from the pipe tables in `data/rostliny/*.txt` (format + codes in
  `data/rostliny/README.md`). Owner 2026-11-10: "nemůžeme to dělat z 33… aspoň 1000". Replaced
  `plants-curated.js` (its 162 species are the files trvalky/kere/travy/jehlicnany.txt). Bloom is
  `null` for non-flowering/evergreen plants and the catalog's bloom wins over AI facts in the PDF.
  Flags: thorny, evergreen, toxic, acid, spreads, wet. `pickPlants` only auto-picks roles
  back/mid/front and skips acid + spreads always, thorny + toxic with kids/dog. Weak spot: dry
  shade has few tall plants.
- Plant photos: `node scripts/plant-photos.js` pre-picks one Wikimedia Commons file per plant
  (scored: whole plant/flower, cultivar match; bark/fruit/insects/drawings rejected) into
  `data/plant-photos.json` (`status` auto/ok/rejected/missing; rejected files remembered). The
  catalog carries only `photoFile`; `mvgreen_plant_photo` downloads exactly that file to uploads
  (GDPR – customer browser never hits Wikimedia), falls back to search. Commons titles can be
  wrong (a "Taxus" file showed a pine), so the owner reviews photos in a claude.ai artifact
  "Kontrola fotek rostlin" (db collection `verdicts/<plant key>` = {s:'ok'|'bad'}); read it with
  ArtifactData, set those statuses in plant-photos.json, rerun plant-photos.js + build-plants.js.
  Review data: `node scripts/photo-review-data.js <dir>` (thumbnails stay out of the public repo).
- `assets/v2/mark.js` (`MVGreenMarkV2`, 0.6.238) – step-1 marking WITHOUT the brush (owner picked
  options 3 + 8 of 10: finger too thick at fence edges, fullscreen toolbars covered the photo).
  Server `mvgreen_ai_detect_v2` (gpt-4.1 vision, ~1 Kč) returns objects {kind, name, suggestion,
  polygon 0–1000}; client snaps polygons to SLIC segments (majority vote, smaller objects win),
  adds sky from `seg.skyIds`. Tap = cycle Zůstane → Pryč → Navrhnout znovu; tap on unassigned =
  grow a similar-colour region; long-press = split that part off. Clean fullscreen: only ×,
  Hotovo, undo, list button; they hide while touching; pinch zoom. Output = same contract as
  `confirmPaintMask` + `state` (reopen without a new AI call) + keep/removeNames (removeNames go
  into the prompt). "Doladit štětcem" opens the old brush with the same category array.
  Also exports `stats/grow/polygon` (region growing + outline ≤16 points) used by sketch.js.
- `assets/v2/sketch.js` – tool „Ťuknout do plochy“ (option 10, default tool): tap → outline found
  from segments inside the editable area → menu next to the finger (dlažba/záhon/kačírek/trávník,
  větší/menší plocha) → stored as a normal area item.
- `assets/v2/sketch.js` – customer sketch by TAPPING (owner rejected finger-drawing as imprecise):
  wall/path = points, steps = two edges (width), areas = corners, tree/shrub = tap; optional note
  per element. Sent to gpt-image as a 2nd `image[]` (`guide`, same letterbox as the photo) plus a
  text description; the prompt says the sketch is APPROXIMATE and AI must make the whole coherent.
- Server: `mvgreen_ai_plan_v2` (gpt-4.1 → plan in metres from photographer's view, y = depth),
  `mvgreen_plant_photo` (Wikimedia CC0/BY/BY-SA, cached in uploads/mvgreen-plants, misses only 6 h).
- Page 8 work estimate is computed from project areas (workPlan() in architekt-pdf.js) – owner:
  a fixed "2–3 víkendy" was unrealistic.
- Launch gate: old designer stays until 5 v2 designs in a row pass without error. Status
  2026-11-08: 4 full tests, none clean yet; test 4 (sketch) was the first close match. Owner will
  evaluate the tapping sketch himself next and was not yet convinced.
- Admin daily AI test limit option `mvgreen_ai_daily_limit` was raised to 5 (owner approved).

Known data gap: `catalog-805.js` (old designer only) has no bloom months and no prices. The v2
catalog has bloom months but still no prices – PDF prices come from AI facts.

## Conventions

- All commit messages and user-facing strings in this codebase are
  Czech; keep new ones Czech too.
- Code style in `app.js`/`garden-brief.js`/`ai-safety.js` is dense,
  semicolon-joined, minimal whitespace — matches existing style rather
  than reformatting.
- Inline comments in the JS frequently cite the owner's own words in
  quotes with a date, explaining *why* a rule exists — keep doing this
  for non-obvious fixes; it's what lets a future session understand
  intent without the owner re-explaining.
- `TODO.md` is parked ideas only — things explicitly NOT to build until
  asked. Don't implement from it unprompted.
