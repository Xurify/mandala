---
name: mandala-component
description: Builds or changes Svelte 5 UI in the Mandala app using its calm-editorial design system (paper/ink tokens, pill buttons, Source Sans 3, pillar hues). Use when adding a component, screen, dialog, menu item, button, or style; when editing app.css or any .svelte file under src/lib/components; or when the user asks for UI or UX work in this repo.
---

# Building Mandala UI

Read `DESIGN.md` first if it isn't already in context. This skill is the workflow; `DESIGN.md` holds the rules.

Feature screens still use the global classes below. `src/lib/components/ui/` is the Tailwind set (`tv` + `cn`), previewed at `/dev/ui`. Use those primitives on the catalog, or when the migration plan says to swap a surface. Don't put utilities on `.btn` in a feature screen, and don't restyle a primitive's color, radius, or type.

## Workflow

```
- [ ] 1. Find the closest existing pattern
- [ ] 2. Decide the hierarchy (what is the one primary action?)
- [ ] 3. Build with existing global classes
- [ ] 4. Add CSS only if nothing fits
- [ ] 5. Wire state through `chart`
- [ ] 6. Verify (check, both themes, mobile, keyboard)
```

**1. Find the closest pattern.** Search before writing. A dialog → copy `PresetPicker.svelte`. A toggle → `.seg` like the theme row in `ChartApp.svelte`. An overflow action → a `.menu-item` in the topbar menu. A header → `.eyebrow` + serif heading + muted `.sub`, like `SidePanel.svelte`.

**2. Decide hierarchy.** List the actions. Exactly one gets `btn-primary` (or none). Secondary → `btn-soft`. Informational or escape → `btn-ghost` or `icon-btn`. Rarely used or destructive → the overflow menu, not a visible button.

**3. Build with global classes.** `btn`, `btn-primary | btn-soft | btn-ghost`, `btn-sm`, `icon-btn`, `seg`/`seg-sm`, `eyebrow`, `menu-*`, `method-dialog` + `dialog-foot`, `notice`, `chart.say()` for toasts. Icons via `<Icon name="…" size={16|18} />`; add missing paths to `Icon.svelte`.

**4. New CSS goes in `src/app.css`**, in the matching section, never in a component `<style>`. Only tokens, never raw colors. If you add a token: light value in `:root`, dark value in **both** dark blocks. If you animate: add the selector to the `prefers-reduced-motion` block.

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
