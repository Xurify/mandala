# Plan: Tailwind v4 + composable UI primitives

Status: **phase 1–2 started.** Tailwind v4 is installed beside the global CSS (preflight off). Primitives live in `src/lib/components/ui/` and are catalogued at `/dev/ui`. Feature screens still use the global classes until phase 3.

## Goal

Replace the 2,846-line global `src/app.css` with:

1. **Tokens stay CSS variables** (the source of truth, unchanged values), exposed to Tailwind through `@theme`.
2. **Composable Svelte primitives** in `src/lib/components/ui/` that own their styling with Tailwind utilities. They replace the global component classes (`.btn`, `.seg`, `.menu-*`, `.method-dialog`, etc.). Feature components compose primitives and never restyle them.
3. **Feature layout** (hero, grid, panel) written in utilities inside each component.

The visual output must not change. This is a refactor, not a redesign.

## Current state (measured)

| Area | `app.css` lines | Used by |
| --- | --- | --- |
| Tokens + base | 1–191 | everything |
| Buttons (`btn*`, `icon-btn`, `seg`) | 192–343 | ChartApp, DraftDialog, PresetPicker, MethodGuide, SidePanel |
| Page / topbar / search | 344–512 | ChartApp |
| Hero / ring / stats | 513–700 | ChartApp, ProgressRing |
| Menus | 701–851 | ChartApp (12 items), ChartSwitcher (6) |
| Results / notice / dock / toast | 852–1004 | ChartApp |
| Layout modes | 1005–1141 | ChartApp |
| Chart grid | 1142–1320 | MandalaGrid |
| Editor panel | 1321–1954 | SidePanel, InkPad |
| Dialogs | 1955–2426 | MethodGuide, PresetPicker, DraftDialog |
| Utilities | 2427–2486 | mixed |
| Responsive / motion / print | 2487–2846 | everything |

Duplication to remove: open/close + backdrop-click logic is repeated in 3 dialogs; menu open/close/escape/outside-click is repeated in `ChartApp` and `ChartSwitcher`. `ChartApp.svelte` is 721 lines and mostly markup.

## Primitives (`src/lib/components/ui/`)

Each is small, typed with `$props()`, forwards `...rest` to the root element, and takes `children` as a snippet. Variants use `tv()` from `tailwind-variants`. Extra `class` values go through `cn()` in `src/lib/components/ui/cn.ts`, which calls `twMerge` from `tailwind-merge`, so a layout override replaces the matching utility instead of fighting it.

| Primitive | API sketch | Replaces |
| --- | --- | --- |
| `Button` | `variant: 'primary' \| 'soft' \| 'ghost'`, `size: 'md' \| 'sm'`, `icon?: IconName`, `href?` (renders `<a>`) | `.btn*` |
| `IconButton` | `icon`, `label` (required, becomes `aria-label`), `size?` | `.icon-btn` |
| `SegmentedControl` | `options: {value,label,icon?}[]`, `bind:value`, `size?` | `.seg`, `.seg-sm` |
| `Menu` / `MenuItem` / `MenuDivider` | `Menu` owns open state, escape, outside click, and focus return; `MenuItem` has `icon`, `badge?`, `tone?: 'danger'` | `.menu-*`, logic in ChartApp + ChartSwitcher |
| `Dialog` | `bind:open`, `title`, `size: 'sm' \| 'md'`, snippets `children` + `footer` | `.method-dialog`, `.dialog-foot`, and the 3 copies of the open/close logic |
| `Dock` / `DockTab` | tablist semantics built in, `bind:value` | `.dock*` |
| `Toast` | reads `chart` message; placed inside `Dock` wrapper | `.toast` |
| `Notice` | `action?` snippet | `.notice` |
| `Eyebrow` | `pip?: number \| 'goal'` | `.eyebrow`, `.tag-pip` |
| `Card` | surface + `shadow-sm` + radius | repeated card styles |

`BrandMark`, `ProgressRing`, and `Icon` move into `ui/` unchanged.

Rule after migration: **feature components may only put layout utilities (flex, grid, gap, padding, width) on primitives, never color, radius, or typography.** That rule goes into AGENTS.md and the `mandala-component` skill.

## Tailwind setup

- `bun add -d tailwindcss @tailwindcss/vite`; add the plugin in `vite.config.ts` before `sveltekit()`.
- `src/app.css` becomes: `@import 'tailwindcss';` + token blocks (unchanged) + `@theme inline { --color-bg: var(--bg); --color-ink: var(--ink); … --font-serif: var(--serif); --ease-ui: var(--ease); --shadow-sm: …; --radius-pill: 999px; }` + `@custom-variant dark` keyed on `[data-theme='dark']` and the system fallback.
- Pillar hue: keep `--h` inline; utilities like `bg-[oklch(var(--p-l)_var(--p-c)_var(--h))]` get long, so define `@utility pillar-cell`, `pillar-action`, `pillar-dot`, `pillar-stroke` once.
- Container queries (`@container`, `cqi` sizing on the grid) are built into v4: use `@container` + `@md:` variants.
- Reduced motion: `motion-safe:` on every transition and animation, which replaces the manual list at the bottom of `app.css`.
- Coarse pointer: `@custom-variant coarse (@media (pointer: coarse))`.
- Print: keep a small plain `@media print` block in `app.css`; utilities are awkward for print.

## Phases

Each phase ends with `bun run check`, `bun run test`, and screenshot comparison (light and dark, 1280 split mode and 390 mobile) against the baseline from phase 0.

0. **Baseline.** Screenshot every state: view, edit, and split modes; each dialog; both menus; the toast; the notice; the search results; in both themes and at both widths. Save them to `docs/plans/baseline/` (not committed or gitignored).
1. **Install.** Add Tailwind alongside the existing CSS with the `@theme` mapping. Nothing should visibly change. Commit.
2. **Primitives.** Build `ui/` primitives with utilities. `/dev/ui` shows every variant in both themes. The route stays; delete `src/routes/dev/ui` yourself if you don't want the catalog.
3. **Swap by surface**, deleting the matching `app.css` section each time:
   1. Dialogs (MethodGuide, PresetPicker, DraftDialog)
   2. Menus (ChartApp, ChartSwitcher)
   3. Buttons, segmented controls, dock, toast, notice
   4. Hero and topbar: split `ChartApp` into `Topbar.svelte` and `Hero.svelte`
   5. SidePanel and InkPad
   6. MandalaGrid (last, because it has the most `cqi` sizing and hover logic)
4. **Cleanup.** `app.css` should shrink to about 250 lines (tokens, `@theme`, pillar utilities, base, print). Update DESIGN.md (component section → primitive table), AGENTS.md (styling rules), and the `mandala-component` skill.

## Risks

- **Dark block duplication:** the custom variant must match both the `data-theme` attribute and the system fallback. Test with the theme set to System and the OS set to dark.
- **Specificity drift:** while old CSS and utilities coexist, global selectors like `.topbar .menu-dropdown` can beat utilities. Delete each section in the same commit as its swap.
- **Svelte class merging:** `cn()` (`tailwind-merge`) resolves conflicting utilities. Feature code still shouldn't restyle color, radius, or type on a primitive.
- **Visual regressions in `cqi` text sizing** on the grid. Compare the grid pixel-for-pixel before deleting its CSS.

## Decisions

1. `tailwind-merge` is in, via `cn()`.
2. `tailwind-variants` (`tv`) is in. Not `cva`.
3. `/dev/ui` stays in the repo. Remove the route folder by hand if the catalog gets in the way.
