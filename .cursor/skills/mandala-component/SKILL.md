---
name: mandala-component
description: Builds or changes Svelte 5 UI in the Mandala app using its calm-editorial design system (paper/ink tokens, pill buttons, Source Sans 3, pillar hues). Use when adding a component, screen, dialog, menu item, button, or style; when editing app.css or any .svelte file under src/lib/components; or when the user asks for UI or UX work in this repo. Chart content and method copy follow mandala-method.
---

# Building Mandala UI

Read `DESIGN.md` first if it isn't already in context. This skill is the workflow; `DESIGN.md` holds the visual rules. Anything the screen says about how a chart works follows `.cursor/skills/mandala-method/SKILL.md`. Words on screen: goal, pillar, action.

Feature screens and `src/lib/components/ui/` both use Tailwind utilities (`tv` + `cn` on primitives). Preview primitives at `/dev/ui`. A feature component may pass layout classes to a primitive. It does not restyle that primitive's color, radius, or type.

## Workflow

```
- [ ] 1. Find the closest existing pattern
- [ ] 2. Decide the hierarchy (what is the one primary action?)
- [ ] 3. Build with a primitive, or utilities on the feature component
- [ ] 4. Add CSS only for tokens, a shared pillar utility, or chart print
- [ ] 5. Wire state through `chart`
- [ ] 6. Verify (check, both themes, mobile, keyboard)
```

**1. Find the closest pattern.** Search before writing. A dialog → `PresetPicker.svelte` (`Dialog` + `{#snippet footer()}`). A toggle → `SegmentedControl` like the theme row in `ChartApp.svelte`. An overflow action → `MenuItem` in the topbar menu. A header → `Eyebrow` + `font-serif` heading + muted line, like `SidePanel.svelte`. `font-serif` is the title role. `--serif` is the same Source Sans 3 as `--font`. Do not add a second typeface.

**2. Decide hierarchy.** List the actions. Exactly one gets `Button` `variant="primary"` (or none). Secondary → `soft`. Informational or escape → `ghost` or `IconButton`. Rarely used or destructive → the overflow menu, not a visible button.

**3. Build with primitives and utilities.** `Button`, `IconButton`, `SegmentedControl`, `Eyebrow`, `Menu`, `Dialog`, `Notice`, `Dock`, `chart.say()` for toasts. Icons via `<Icon name="…" size={16|18} />`; add missing paths to `Icon.svelte`. Grid cells keep the class names `cell`, `goal`, `pillar`, `action`, `block`, and `mandala` because `src/print.css` selects them.

Preflight is off. A raw `<button>` or text field without `border-0` and an explicit background shows the browser face. Two to four exclusive options are `SegmentedControl`, not a hand-rolled pill group. A text field copies the rename input in `ChartSwitcher.svelte`. See `DESIGN.md` → Native chrome.

**4. New CSS goes in `src/app.css` only for tokens or a shared `@utility`.** Chart print goes in `src/print.css` (imported from `app.css`). Never a component `<style>`. Only tokens, never raw colors. If you add a token: light value in `:root`, dark value in **both** dark blocks. Animate with `motion-safe:`.

**5. State.** Read and mutate through the `chart` singleton (`$lib/chart/chart.svelte.ts`). Derived UI state uses `$derived`, not `$effect`. Local UI state uses `$state` in the component.

**6. Verify.** Run `bun run check` (0 errors, 0 warnings). Then look at the result: light + dark, desktop split mode + ≤900px width, Tab through it. Finish with the checklist in `.cursor/skills/mandala-ui-review/SKILL.md`.

## What the screen is allowed to be

The grid is the map. Day-to-day work is a few actions pulled off it, not a second planner drawn in the chrome.

- Do not add a daily rewrite, a streak, a life-wheel of eight life areas, or a control that starts all 64. Erin’s ramp (five to eight actions the first week, then five to eight more) belongs in copy, not in a new mode, unless the user asks for that surface.
- Empty cells are gaps in the plan. An empty state offers the next step (write the goal, start from a preset). It does not scold.
- Placeholder and preset text has to pass the method tests: a cell can be ticked, and it is a behaviour the person controls. “Study 20 minutes” can be a sample. “Do better” cannot.
- One chart is one direction. Switcher and preset copy say that. They do not invite two aims into one center.
- Toasts stay one line, past tense, no exclamation: `chart.say('Copied as text')`.

## Svelte 5 rules for this repo

- Props: `let { value, onchange }: Props = $props();`. Callbacks are props (`onselect`), not dispatched events.
- Events: `onclick={…}`, never `on:click`.
- Reusable markup inside a file: `{#snippet name(args)}` + `{@render name(args)}`.
- DOM behavior: `{@attach fn}` over `use:`.
- No `svelte/store`, no `export let`, no `$:`.

## Pillar color

Anything representing pillar `k` sets `--h` inline and takes lightness/chroma from theme tokens, so the hue holds across themes (as `BrandMark.svelte` does):

```svelte
<path class="mark-arc" style:--h={HUES[k]} d={d} />
```

```css
.mark-arc { stroke: oklch(var(--ring-fill-l) 0.13 var(--h)); }
```

Pick the token pair by role: `--p-*` pillar cells, `--t-*` action cells, `--dot-*` small tinted fills, `--ring-*` strokes.

Circular layouts use `PILLAR_ANGLES`, `pillarArc`, `arcPath` from `$lib/chart/ring.ts`.

## Examples

**"Add a 'Duplicate chart' action."** Rare, non-destructive: a `MenuItem` in `ChartSwitcher`'s menu, not a new button in the hero. On success, `chart.say('Chart duplicated')`.

**"Add a confirm step before Clear."** `Dialog` with `title="Clear this chart?"`, one muted line, `{#snippet footer()}` with `Button variant="soft"` Cancel and `Button variant="primary"` "Clear chart". Danger color stays on the menu item that opened it, not on the button fill.

**"The stats need a label."** `Eyebrow` above, number in tabular-nums below. No box, no border.

**"Explain the method in the dialog."** Follow mandala-method. Goal, then eight pillars, then 64 actions. The chart is built once and reviewed. It is not redrawn every morning.
