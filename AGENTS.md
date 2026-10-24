# AGENTS.md

Mandala is a local-first goal chart (Mandala method): one goal in the center, eight pillars around it, eight actions per pillar. No accounts. Data stays in `localStorage`. The outside calls are optional. A person who turns AI on and connects their own provider (OpenRouter, Gemini, Claude or OpenAI) can have Bindu send its prompt there from the browser (`provider.ts`); nothing is sent without that consent, and Bindu as a whole can be turned off. A person who turns on sync keeps the same charts on each of their devices: charts are sealed on the device with a key only those devices hold, and the server (`/api/sync`, Turso) keeps a copy it cannot read (`docs/device-sync.md`). A published share is the one thing the server can read, and only the plan.

**Before touching any UI, read [DESIGN.md](./DESIGN.md).** It is the source of truth for tokens, components, and copy. A new or restyled component also follows **Making a component** there: name the object it is in this app, give it one job, try several versions in the place it will sit, and let arrivals land while departures ease out.

## Stack

- SvelteKit 2 + **Svelte 5 runes only** (`$state`, `$derived`, `$effect`, `$props`, snippets, `{@attach}`). No stores from `svelte/store`, no `export let`, no `on:click`.
- TypeScript strict. Package manager and runner: **bun**.
- Styling: tokens, base reset, and pillar utilities live in `src/app.css` (OKLCH custom properties, no component `<style>` blocks). Chart print lives in `src/print.css`, imported from `app.css`. Tailwind v4 utilities everywhere else, preflight off. A raw `<button>` or text field keeps the browser border and gray face unless it is a primitive or sets `border-0` and an explicit background (`DESIGN.md` → Native chrome). Primitives in `src/lib/components/ui/` use `tv` + `cn` and are previewed at `/dev/ui`. Feature screens use those primitives plus layout utilities. They don't restyle a primitive's color, radius, or type.
- Fonts: `@fontsource-variable/source-sans-3` for text and controls, and its serif sibling `@fontsource-variable/source-serif-4` for titles through `--serif` (`font-serif`). Faces are declared in `src/app.css` and preloaded in `src/routes/+layout.svelte`. Do not add another family (no Fraunces, Bricolage Grotesque, or Epilogue).
- PWA: `src/service-worker.ts` + `static/manifest.webmanifest`. Deployed on Vercel.

## Commands

```sh
bun install
bun run dev          # vite dev server
bun run check        # svelte-kit sync + svelte-check (must be 0 errors, 0 warnings)
bun run test         # vitest
bun run build
bun run gen:icons    # regenerate app icons, favicon.svg, logo.svg from src/lib/chart/ring.ts
```

## Map

```
src/
  app.css                     tokens, base reset, pillar utilities; imports print.css; dark block duplicated twice
  print.css                   chart print (@page, forced paper colors, cell type)
  routes/+layout.svelte       fonts, app.css, theme-color metas, favicon
  routes/+page.svelte         mounts ChartApp
  lib/chart/
    model.ts                  chart data model, HUES, block/cell indexing, action ids (pure, tested)
    id.ts                     prefixed, sortable ids (TypeID): chart_, action_, tool_, share_
    fixtures.ts               for tests: `A.a0_0`, an id that names its cell, and `slotted` to give a chart those ids
    chart.svelte.ts           ChartStore singleton `chart`: state, persistence, theme, view mode
    ring.ts                   ring geometry (PILLAR_ANGLES, pillarArc, arcPath) + OKLCH→sRGB + BRAND colors
    library.ts                multiple saved charts
    presets/                  starter charts
    draft.ts                  prompts for a chat app, and reading the pasted reply
    provider.ts               the same prompts sent to the person's own AI provider from the browser, and OpenRouter's sign-in; the key stays on the device
    start.ts                  writing a chart from the center: where it resumes, the next block, what a preset lends (pure, tested)
    helper.ts                 Bindu's rules: picks, insights, progress (pure, tested)
    helper.svelte.ts          Bindu's store `helper`: the page in view, picks, the write round trip, an agent's offer
    webmcp.ts                 tools an agent in the browser can call through WebMCP: read, propose to Bindu, tick (pure, tested)
    ingest.ts                 time measured on a page by a browser extension, posted to the open tab and logged once by id (pure, tested)
    morph.ts                  view transitions for view, theme and accent changes
    theme.ts                  theme and accent: read, save, paint (attribute and browser bar), shared by the store and the error page
    versions.ts               earlier versions of a chart kept in IndexedDB when sync replaces or outvotes it (rules pure, tested)
    contract.ts               where each saved field may travel (shared, yours, device), and every browser storage key
    sync/                     device sync and shares (docs/device-sync.md)
      key.ts                  the sync key, the room and seal derived from it, sealing a chart on the device (tested)
      plan.ts                 per chart: take, send, or merge against what was last agreed on; deleted for good wins (pure, tested)
      sync.ts                 one chart merged field by field: this device's edits on top of the server's copy (pure, tested)
      remote.ts               the sync API from the browser, and opening what it returns
      device.svelte.ts        DeviceSync: when a round runs, one tab at a time, the status the dialog shows
      publish.ts              published shares
    tools.ts                  shelves: video ids, rotation, opened, known (pure, tested)
    calendar.ts               a month of days and what was finished on each, across every chart (pure, tested)
    board.ts                  the board's lists: lanes, order, moves, what Today deals first (pure, tested)
    timer.ts                  time on an action: the running timer, sessions, minutes per pillar (pure, tested)
    chime.ts                  the sound at the end of a block, readied by a tap
    demos.ts                  the situations /dev/demo opens (pure, tested)
    export-image.ts           poster export (canvas)
  lib/components/
    ChartApp.svelte           page shell: topbar, hero, results, layout modes, dock, toast
    MandalaGrid.svelte        the 9×9 grid
    BlockSheet.svelte         a pillar's block in words, opened from the chart on a phone
    SidePanel.svelte          editor for the selected block
    ProgressRing.svelte       8-segment progress ring (spatial angles)
    BrandMark.svelte          logo mark, same geometry as the ring
    Helper*.svelte            Bindu: launcher, panel, and one component per page
    CenterOut.svelte          a chart written from the center out: goal, pillars, then each block of actions
    WeeklyReflection, WeekStrip, MiniChart, CalendarView
    BoardView.svelte          the board: Open, To do, Doing, Done; drag, keyboard carry, card sheet
    Shelf, ShelfSheet, ToolFace the material behind a pillar, and how a link lands on it
    ToolRow.svelte            one link on a shelf and its menu: know, comes round, move, remove (shelf and all shelves)
    Shelves.svelte            every pillar's shelf at once: each row's menu, and Select links to move or remove several
    TimerSlip, TimerRing, LogTimeDialog  time on an action: the slip on the dock, its ring, time logged afterwards
    SyncDialog.svelte         turning sync on, joining from a QR code, a link or a saved key, turning it off here
    QrCode.svelte             a QR code drawn in tokens, dark on light in both themes
    VersionsDialog.svelte     earlier versions of each chart, and going back to one
    ChartSwitcher, PresetPicker, MethodGuide, Icon
    MenuTitle                 a page title that opens a menu: fits two lines, chevron always in view
    ui/                       Tailwind primitives (Button, Menu, Dialog, Dock, Pages, …). Catalog: /dev/ui
  routes/api/sync             the sealed rows device sync reads and writes (lib/server/sync.ts)
  routes/dev/demo             one-click situations for trying every interaction
scripts/generate-pwa-icons.ts rasterizes PNG icons, writes SVG favicon/logo
```

## Domain rules

- 9 blocks × 9 cells. Block 4 / cell 4 is the goal. Pillar `k` (0–7) is row-major around the center: TL, T, TR, L, R, BL, B, BR. Convert with the helpers in `model.ts`; don't re-derive indices inline.
- Pillar `k` owns hue `HUES[k]`. Anything that shows a pillar uses that hue, and nothing else does.
- Anything arranged in a circle (ring, mark, icon) places pillar `k` at `PILLAR_ANGLES[k]`, so it matches the grid spatially.
- All state goes through `chart` (`chart.svelte.ts`). Components call its methods (`chart.setText`, `chart.select`, `chart.say(message)` for toasts); they don't write to `localStorage` themselves. The store never writes over another tab: it merges what storage holds first (`reconcile` in `library.ts`) and follows `storage` events.
- A link is a tool on a pillar's shelf (`data.tools.p{k}`), never an action. Actions hand tools out; `tools.ts` decides which one today.
- A board card is an action. Its list lives on its meta (`lane`, `rank`, `done`); move it with `chart.moveCard`, and let `board.ts` decide order. A routine never goes to Done.
- Saved things have ids from `id.ts`: `chart_`, `action_`, `tool_`, `share_`, then a sortable UUIDv7. A new kind of saved thing gets its own prefix there. `meta`, day logs, and tools point at an action by its id (`ActionId`), never by its cell; `a{k}_{j}` is only a place on the grid. Convert with `idAt`, `slotOf`, `keyOf`, and `idOfKey` in `model.ts`. A cleared line gets a new id (`setByKey`), and a copy gets new ids for all (`withNewIds`). Tests name actions with `A.a0_0` from `fixtures.ts`.
- Saved data has a place in the sync contract (`contract.ts`, `docs/sync.md`). A new field on a saved type fails `bun run check` until it is placed, and a new `localStorage` key fails `contract.test.ts` until `BROWSER_KEYS` lists it. Decide where it goes, and whether it is `plan` or `history`, in the same change. History is never `shared`: another person gets the plan, not your days. `forSharing` and `withoutHistory` read the contract, so they follow it.
- Saved charts carry a `version` (`CHART_VERSION` in `model.ts`), stamped by `parseChart`, which every chart passes through on load, import, share, and sync. There are no users yet, so there is no upgrade or legacy code: change the shape of saved data freely, and don't add a fallback for an old shape. Write upgrades in `parseChart` once people have data to keep.
- Done is one record across Today, the board, the editor, and the calendar: the action's `done`/`doneAt` and the day's tick are written together. Finish or reopen with `chart.finish` / `chart.reopen` (or `chart.moveCard`), never by writing one of them alone. Ask `finishedOn` in `board.ts` whether something was finished on a day.
- Time is logged per day as sessions (`days[date].sessions`, each pointing at an action by id), never as a tick. One timer runs at a time (`data.timer`), as a start time, not a count.

## Conventions

- Reuse `src/lib/components/ui/` (`Button`, `IconButton`, `SegmentedControl`, `Menu`, `Dialog`, `Dock`, `Toast`, `Notice`, `Eyebrow`). Layout that has no primitive goes on the feature component as utilities. Don't add a global class for a one-off.
- Only standard HTML elements and components that exist in this repo. No animation libraries. Icons come from `Icon.svelte`; add a path there if one is missing.
- Colors only through tokens. New token = add a light value and a dark value in **both** dark blocks.
- New animations use `motion-safe:` so reduced motion skips them.
- Icon-only buttons need `aria-label`. Toggles use `aria-pressed`, tabs `aria-selected`, menus `aria-expanded`.
- Copy: sentence case, short, warm, no emoji, toasts in past tense ("Copied as text").
- Nothing on the device guesses meaning from English words. People write charts in any language, so a check that reads words (a regex over English phrases, an `[a-z]` normalizer, whitespace as the only word break) goes to a model through a prompt instead. Normalize with `\p{L}\p{N}`, and break text with `Intl.Segmenter`.
- Don't edit generated files (`static/icon-*.png`, `static/apple-touch-icon.png`, `src/lib/assets/favicon.svg`, `src/lib/assets/logo.svg`). Change `scripts/generate-pwa-icons.ts` or `ring.ts` and run `bun run gen:icons`.
- Comments only for constraints the code can't show: a why, a browser or platform quirk, where a magic number comes from. No comment that restates the code, names the element, or repeats the commit message. When in doubt, leave it out.

## Done means

1. `bun run check` passes with 0 errors and 0 warnings.
2. `bun run test` passes (add tests beside `model.ts` / `library.ts` / `draft.ts` when you change them).
3. UI changes are looked at, not assumed: light and dark theme, desktop (split mode) and a ≤900px mobile width, keyboard focus visible. Use the browser tools to screenshot if you have them. A new interaction gets a card on `/dev/demo`.
4. The change passes the checklist in `.cursor/skills/mandala-ui-review/SKILL.md`.

## Git

- Name a branch for the work: `<type>/<short-topic>`, lowercase, words joined by hyphens. Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`. For example `fix/ux-review-keyboard-editor`, `feat/weekly-reflection`.
- A session that starts on a generated branch (`claude/<word>-<word>-<id>`) renames it with `git branch -m <new-name>` before the first push. This is standing permission. Never push a randomly named branch.
- Everything asked for in one session goes on that session's branch, docs and AGENTS.md included. Don't split it onto a second branch.
- No pull request unless asked.
- A PR description says what changed for the person using the app, and why. It never lists a change the diff does not contain.

## Skills in this repo

- `.cursor/skills/mandala-component/` — building or changing UI within the design system.
- `.cursor/skills/mandala-ui-review/` — reviewing UI/UX, researching patterns on Mobbin, visual verification.
- `.cursor/skills/mandala-delight/` — making a flat screen tactile, and a finished state a moment: metaphor first, several tries before keeping one, motion that lands on the way in and eases on the way out.
- `.cursor/skills/mandala-method/` — filling, reviewing, and tightening a chart (goal, pillars, actions).
