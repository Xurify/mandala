---
name: mandala-component
description: Builds or changes Svelte 5 UI in the Mandala app using its calm-editorial design system (paper/ink tokens, pill buttons, Source Sans 3, pillar hues). Use when adding a component, screen, dialog, menu item, button, or style; when editing app.css or any .svelte file under src/lib/components; or when the user asks for UI or UX work in this repo.
---

# Building Mandala UI

Read `DESIGN.md` first if it isn't already in context. This skill is the workflow; `DESIGN.md` holds the rules.

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

**1. Find the closest pattern.** Search before writing. A dialog → copy `PresetPicker.svelte`. A toggle → `SegmentedControl` like the theme row in `ChartApp.svelte`. An overflow action → `MenuItem` in the topbar menu. A header → `Eyebrow` + serif heading + muted line, like `SidePanel.svelte`.

**2. Decide hierarchy.** List the actions. Exactly one gets `Button` `variant="primary"` (or none). Secondary → `soft`. Informational or escape → `ghost` or `IconButton`. Rarely used or destructive → the overflow menu, not a visible button.

**3. Build with primitives and utilities.** `Button`, `IconButton`, `SegmentedControl`, `Eyebrow`, `Menu`, `Dialog`, `Notice`, `Dock`, `chart.say()` for toasts. Icons via `<Icon name="…" size={16|18} />`; add missing paths to `Icon.svelte`. Grid cells keep the class names `cell`, `goal`, `pillar`, `action`, `block`, and `mandala` because `src/print.css` selects them.

**4. New CSS goes in `src/app.css` only for tokens or a shared `@utility`.** Chart print goes in `src/print.css` (imported from `app.css`). Never a component `<style>`. Only tokens, never raw colors. If you add a token: light value in `:root`, dark value in **both** dark blocks. Animate with `motion-safe:`.

**5. State.** Read and mutate through the `chart` singleton (`$lib/chart/chart.svelte.ts`). Derived UI state uses `$derived`, not `$effect`. Local UI state uses `$state` in the component.

**6. Verify.** Run `bun run check` (0 errors, 0 warnings). Then look at the result: light + dark, desktop split mode + ≤900px width, Tab through it. Finish with the checklist in `.cursor/skills/mandala-ui-review/SKILL.md`.

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

**"Add a 'Duplicate chart' action."** Rare, non-destructive: a `.menu-item` in `ChartSwitcher`'s menu, not a new button in the hero. On success, `chart.say('Chart duplicated')`.

**"Add a confirm step before Clear."** Native `<dialog class="method-dialog">`, serif heading "Clear this chart?", one line of muted body, `.dialog-foot` with `btn btn-soft` Cancel and a `btn btn-primary` "Clear chart". The danger color goes only on the menu item that opened it, not on the button fill.

**"The stats need a label."** `.eyebrow` above, number in tabular-nums below. No box, no border.
