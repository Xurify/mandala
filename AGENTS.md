# AGENTS.md

Mandala is a local-first goal chart (Mandala method): one goal in the center, eight pillars around it, eight actions per pillar. No accounts, no backend. Data stays in `localStorage`.

**Before touching any UI, read [DESIGN.md](./DESIGN.md).** It is the source of truth for tokens, components, and copy.

## Stack

- SvelteKit 2 + **Svelte 5 runes only** (`$state`, `$derived`, `$effect`, `$props`, snippets, `{@attach}`). No stores from `svelte/store`, no `export let`, no `on:click`.
- TypeScript strict. Package manager and runner: **bun**.
- Styling: tokens, base reset, and pillar utilities live in `src/app.css` (OKLCH custom properties, no component `<style>` blocks). Chart print lives in `src/print.css`, imported from `app.css`. Tailwind v4 utilities everywhere else, preflight off. Primitives in `src/lib/components/ui/` use `tv` + `cn` and are previewed at `/dev/ui`. Feature screens use those primitives plus layout utilities. They don't restyle a primitive's color, radius, or type.
- Fonts: `@fontsource-variable/source-sans-3` only, imported in `src/routes/+layout.svelte`. Do not add Fraunces, Bricolage Grotesque, or Epilogue.
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
    model.ts                  chart data model, HUES, block/cell indexing (pure, tested)
    chart.svelte.ts           ChartStore singleton `chart`: state, persistence, theme, view mode
    ring.ts                   ring geometry (PILLAR_ANGLES, pillarArc, arcPath) + OKLCH→sRGB + BRAND colors
    library.ts                multiple saved charts
    presets/                  starter charts
    draft.ts                  "get a prompt" / paste-back flow
    export-image.ts           poster export (canvas)
  lib/components/
    ChartApp.svelte           page shell: topbar, hero, results, layout modes, dock, toast
    MandalaGrid.svelte        the 9×9 grid
    SidePanel.svelte          editor for the selected block
    ProgressRing.svelte       8-segment progress ring (spatial angles)
    BrandMark.svelte          logo mark, same geometry as the ring
    ChartSwitcher, PresetPicker, DraftDialog, MethodGuide, Icon
    ui/                       Tailwind primitives (Button, Menu, Dialog, Dock, …). Catalog: /dev/ui
scripts/generate-pwa-icons.ts rasterizes PNG icons, writes SVG favicon/logo
```

## Domain rules

- 9 blocks × 9 cells. Block 4 / cell 4 is the goal. Pillar `k` (0–7) is row-major around the center: TL, T, TR, L, R, BL, B, BR. Convert with the helpers in `model.ts`; don't re-derive indices inline.
- Pillar `k` owns hue `HUES[k]`. Anything that shows a pillar uses that hue, and nothing else does.
- Anything arranged in a circle (ring, mark, icon) places pillar `k` at `PILLAR_ANGLES[k]`, so it matches the grid spatially.
- All state goes through `chart` (`chart.svelte.ts`). Components call its methods (`chart.setText`, `chart.select`, `chart.say(message)` for toasts); they don't write to `localStorage` themselves.

## Conventions

- Reuse `src/lib/components/ui/` (`Button`, `IconButton`, `SegmentedControl`, `Menu`, `Dialog`, `Dock`, `Toast`, `Notice`, `Eyebrow`). Layout that has no primitive goes on the feature component as utilities. Don't add a global class for a one-off.
- Only standard HTML elements and components that exist in this repo. No animation libraries. Icons come from `Icon.svelte`; add a path there if one is missing.
- Colors only through tokens. New token = add a light value and a dark value in **both** dark blocks.
- New animations use `motion-safe:` so reduced motion skips them.
- Icon-only buttons need `aria-label`. Toggles use `aria-pressed`, tabs `aria-selected`, menus `aria-expanded`.
- Copy: sentence case, short, warm, no emoji, toasts in past tense ("Copied as text").
- Don't edit generated files (`static/icon-*.png`, `static/apple-touch-icon.png`, `src/lib/assets/favicon.svg`, `src/lib/assets/logo.svg`). Change `scripts/generate-pwa-icons.ts` or `ring.ts` and run `bun run gen:icons`.
- Comments only for constraints the code can't show.

## Done means

1. `bun run check` passes with 0 errors and 0 warnings.
2. `bun run test` passes (add tests beside `model.ts` / `library.ts` / `draft.ts` when you change them).
3. UI changes are looked at, not assumed: light and dark theme, desktop (split mode) and a ≤900px mobile width, keyboard focus visible. Use the browser tools to screenshot if you have them.
4. The change passes the checklist in `.cursor/skills/mandala-ui-review/SKILL.md`.

## Skills in this repo

- `.cursor/skills/mandala-component/` — building or changing UI within the design system.
- `.cursor/skills/mandala-ui-review/` — reviewing UI/UX, researching patterns on Mobbin, visual verification.
- `.cursor/skills/mandala-method/` — filling, reviewing, and tightening a chart (goal, pillars, actions).
