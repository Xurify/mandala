# Mandala design system

Direction: **calm editorial**. Warm paper, ink, one typeface, pill-shaped controls, color reserved for the chart itself. The app should feel like a good notebook, not a dashboard.

Studied on Mobbin while building this (all self-improvement / planning apps): Finch, Me+, Tiimo, Structured, stoic., Bloom, ABY Journal, Atoms, timespent, pliability, QUITTR, Liven. What we took:

| From | Lesson |
| --- | --- |
| stoic., ABY Journal, Bloom | Serif headlines on warm paper read as reflective, not productive-anxious |
| Structured, Tiimo | One primary action per screen, in solid ink; everything else recedes |
| Atoms, timespent | Progress as a ring/segments, not a bar; numbers set large and quiet |
| Finch, Me+ | Floating bottom pill bar for primary navigation on every size |
| pliability, Liven | Surfaces separated by tone and soft shadow, never by borders |

## Principles

1. **Color belongs to the chart.** Chrome is paper and ink. The eight pillar hues appear only where they mean a pillar (cells, ring, brand mark). Never use a hue for decoration or for a button.
2. **One loud thing.** Each view has at most one `btn-primary`. If you want two, one of them is wrong.
3. **Tone over lines.** Separate regions with `--surface` vs `--bg` vs `--sunken` and `--shadow-sm`. Borders (`--line`) are for dividers inside a menu, not for boxing things.
4. **One typeface.** Source Sans 3 everywhere. Titles, the goal, and dialog headings use the same face as controls; size and weight do the hierarchy. Do not add Fraunces, Bricolage Grotesque, or Epilogue.
5. **Round everything you can press.** Buttons, segmented controls, chips, dock: `border-radius: 999px`. Cards and dialogs: 20–28px.
6. **Quiet until touched.** Hover and press states do the talking: tone shift on hover, `scale(0.97)` on press. No resting glow, no gradients on chrome.
7. **Both themes are first-class.** Every new token gets a dark value in the same commit.

## Tokens

All tokens live at the top of `src/app.css` as CSS custom properties in OKLCH. The dark block is written twice (`[data-theme='dark']` and the `prefers-color-scheme: dark` fallback for `:root:not([data-theme='light'])`). **Edit both.**

### Surfaces and text

| Token | Role |
| --- | --- |
| `--bg` | Page paper |
| `--surface` | Raised: cards, panels, dialogs, dock, active segment |
| `--sunken` / `--sunken-hover` | Recessed: soft buttons, segmented track, inputs, hover wash |
| `--text` | Body and headings |
| `--muted` | Secondary copy, ghost buttons, eyebrows |
| `--line` | Hairline dividers only |
| `--ink` / `--ink-hover` / `--on-ink` | Primary action fill, selected dock tab, goal cell. Inverts in dark (light ink on dark paper) |
| `--success` / `--danger` | Status text and destructive menu items. Never as fills |

### Chart color

Pillar hues are fixed: `HUES = [25, 60, 100, 150, 195, 240, 290, 345]` in `src/lib/chart/model.ts`, indexed by pillar `k` (row-major: TL, T, TR, L, R, BL, B, BR). Lightness and chroma come from theme tokens so the hue stays constant across themes:

| Token pair | Used for |
| --- | --- |
| `--p-l` / `--p-c` (+ `-hover`) | Pillar cells |
| `--t-l` / `--t-c` (+ `-hover`) | Action cells |
| `--dot-l` / `--dot-c` / `--dot-fg-l` | Small pillar dots, pips |
| `--ring-track-l` / `--ring-fill-l` | Progress ring and brand mark arcs |
| `--goal-*` | Goal cell (ink) |

Write colors as `oklch(var(--p-l) var(--p-c) var(--h))` with `--h` set inline per element. Outside CSS (PNG icons, poster export), convert with `oklchToRgb` from `src/lib/chart/ring.ts`. Don't hand-pick hex.

### Elevation and motion

- `--shadow-sm`: resting cards. In dark it's a 1px light hairline, because shadows vanish on dark paper.
- `--shadow-md`: floating things (menus, dialogs, dock, toast).
- `--ease: cubic-bezier(0.2, 0, 0, 1)` for all UI transitions, 150ms for state changes, 180–240ms for enter/exit.
- Playful overshoot `cubic-bezier(0.34, 1.56, 0.64, 1)` is allowed only on the brand mark and chart hover.
- Motion uses the `motion-safe:` variant so it drops out under `prefers-reduced-motion`.

## Typography

| Use | Family | Size / weight |
| --- | --- | --- |
| Chart title (hero) | `--font` | large, fluid, tight tracking |
| Dialog / panel heading | `--font` | medium |
| Goal cell text | `--font` | fluid, via container query units |
| Wordmark | `--font` | small, semibold |
| Body / lede | `--font` | ~1rem, 400, `--muted` for lede |
| Controls | `--font` | 0.84–0.9rem, 560 |
| Eyebrow | `--font` | 0.72rem, 600, uppercase, `0.12em` tracking, `--muted` |
| Stats numbers | `--font` | tabular-nums |

Exact sizes live on the nearest component; copy that rather than inventing a new step.

Rules: headings `text-wrap: balance`, paragraphs `text-wrap: pretty`, no all-caps except `.eyebrow`, max ~62ch for prose.

## Components

Primitives live in `src/lib/components/ui/` (`Button`, `IconButton`, `SegmentedControl`, `Menu`, `Dialog`, `Dock`, `Toast`, `Notice`, `Eyebrow`, `Card`). They own color, radius, and type. Feature screens pass layout classes only. Preview at `/dev/ui`.

### Buttons

| Component | When |
| --- | --- |
| `Button` `variant="primary"` | The single main action of a view or dialog ("Start from a preset", "Use this preset") |
| `Button` `variant="soft"` | Secondary actions that still matter ("Get a prompt", "Cancel") |
| `Button` `variant="ghost"` | Tertiary / informational ("How it works") |
| `size="sm"` | Dense contexts (notice rows, toolbars, inside dialogs) |
| `IconButton` | 42px round, icon only. Must have `aria-label`. Close buttons, the overflow menu |

Order in a row: primary first on the left in content; in a dialog footer cancel left, primary right. Icon sizes: 16 in `sm`, 18 in the default button and `IconButton`.

### Segmented control

`SegmentedControl`, buttons with `aria-pressed`. Use for 2–4 mutually exclusive options that apply instantly (theme, Fit/Large). Not for navigation, which uses the dock.

### Dock

`Dock` + `DockTab`, `role="tablist"`, with `aria-selected` giving the ink fill. It holds view modes only (Chart / Edit / Split, Split desktop only). `Toast` sits directly above it.

### Menus

`Menu` owns open, escape, outside click, and focus return. `MenuItem`, `MenuDivider`. Destructive items go last, after a divider, in the danger tone.

### Dialogs

`Dialog` is a native `<dialog>`. Header = heading + close; scrolling body; footer snippet for actions. Radius 30px, `--shadow-md`, warm translucent backdrop with a 3px blur, `dialog-in` rise on open. Width `min(38rem, 100vw - 32px)`.

### Feedback

- `Toast` (`role="status"`) reads `chart.say()`. One line, past tense, no exclamation marks: "Copied as text", "Preset applied".
- `Notice` for persistent inline info with an optional small primary or soft `Button`.

### Brand

- `BrandMark.svelte`: eight arcs + goal dot, same geometry as `ProgressRing.svelte`, both from `src/lib/chart/ring.ts` (`PILLAR_ANGLES`, `pillarArc`, `arcPath`). Arc positions are **spatial**: each pillar's arc sits at the angle where that pillar sits in the grid.
- App icons, `favicon.svg`, and `logo.svg` are generated by `bun run gen:icons` (`scripts/generate-pwa-icons.ts`). Don't edit the outputs by hand; change the script or `ring.ts` and regenerate.

## Layout

- Page max width 1180px, 28px gutters, safe-area aware.
- Hero: title + actions on the left, progress ring + stats on the right. The method lives in How it works. Collapses to a stack at ≤900px.
- The chart uses container queries (`cqi`) so cell text scales with the grid, not the viewport.
- Modes: `view` (chart only, square), `edit` (panel only), `split` (side by side, desktop only).
- The page reserves 128px of bottom padding for the fixed dock (112px under 900px). Anything new that scrolls on its own must do the same.

## Voice and copy

Short, warm, plain. Sentence case everywhere. Say what happens, not what the feature is called ("Start from a preset", not "Presets"). Numbers as numerals ("3 of 8 actions"). No emoji in UI.

## Accessibility

- Visible focus: `outline: 2px solid var(--ink); outline-offset: 2px` on buttons, menu items, dock tabs, fields, and cells.
- Hit targets ≥42px (≥44px on coarse pointers, handled by the `pointer: coarse` block).
- Text contrast ≥4.5:1 in both themes; `--muted` on `--sunken` is the tightest pair, so check it when adjusting.
- Every icon-only control has `aria-label`; toggles use `aria-pressed`, tabs `aria-selected`, menus `aria-expanded`.
- Never convey state by hue alone; pair it with text, a count, or a shape.

## Do / don't

| Do | Don't |
| --- | --- |
| Reuse `Button` variants | Invent a new button style in a component `<style>` |
| Separate with tone and `--shadow-sm` | Wrap things in `1px solid` borders |
| Use one primary `Button` per view | Put two ink buttons side by side |
| Use pillar hues only for pillars | Tint a button or badge with a pillar hue |
| Add dark values for new tokens in both dark blocks | Hardcode hex / rgb in components |
| Serif for reflective content | Serif on buttons, labels, or inputs |
| Pill radii on controls | Square or 6px-radius buttons |
