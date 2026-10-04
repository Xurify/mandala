---
name: mandala-component
description: >-
  Builds or changes UI in this repo. Read DESIGN.md and follow it; do not
  restate it. Use when adding a component, screen, dialog, menu item, button,
  or style, or when editing app.css or any .svelte file under
  src/lib/components. Chart content and method copy follow mandala-method.
---

# Building Mandala UI

`DESIGN.md` is the design. Read it and follow it. This file is only the wiring it does not cover. Words on screen about how a chart works follow `mandala-method`.

- Search before writing. Dialog → `PresetPicker.svelte`. Toggle → the theme row in `ChartApp.svelte`. Overflow action → a `MenuItem` in the topbar menu. Header → `SidePanel.svelte`.
- Primitives live in `src/lib/components/ui/` and are previewed at `/dev/ui`. A feature screen may pass layout classes only.
- State goes through `chart` (`$lib/chart/chart.svelte.ts`). Derived UI is `$derived`. Local UI is `$state`. `$effect` is for a subscription.
- Svelte 5: `$props()`, `onclick`, `{#snippet}` / `{@render}`, `{@attach}`. No `svelte/store`, no `export let`, no `$:`.
- Icons via `<Icon>`. Add a missing path in `Icon.svelte`. Grid cells keep `cell`, `goal`, `pillar`, `action`, `block`, and `mandala` because `src/print.css` selects them.
- New CSS is a token or a shared `@utility` in `src/app.css`. Chart print goes in `src/print.css`. No component `<style>`.
- Verify with `bun run check` (0 errors, 0 warnings), then `.cursor/skills/mandala-ui-review/SKILL.md`.
