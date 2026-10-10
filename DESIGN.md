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

1. **Color belongs to the chart.** Chrome is paper and ink. The eight pillar hues appear only where they mean a pillar (cells, ring, brand mark). The one exception is `--accent`: the primary button, the selected dock tab, and input chrome (the field halo, a selected radio, a checkbox). It aliases `--ink` until the more-actions menu picks Leaf, Field, Walnut, or Olive. A swatch replaces only `--accent`, `--accent-hover`, and `--on-accent`, and the label on it is white. The goal stays `--ink`: dark on paper, white in the dark. It does not follow the accent. Paper, focus rings on buttons, and the pillar hues stay. Danger sits at hue 8 so Clear stays a red. Never use a pillar hue, or the accent, for decoration.
2. **One loud thing.** Each view has at most one `btn-primary`. If you want two, one of them is wrong.
3. **Tone over lines.** Separate regions with `--surface` vs `--bg` vs `--sunken` and `--shadow-sm`. Borders (`--line`) are for dividers inside a menu, not for boxing things.
4. **One typeface.** Source Sans 3 everywhere. Titles, the goal, and dialog headings use the same face as controls; size and weight do the hierarchy. Do not add Fraunces, Bricolage Grotesque, or Epilogue.
5. **Round everything you can press.** Buttons, segmented controls, chips, dock: `border-radius: 999px`. Cards and dialogs: 20–28px.
6. **Quiet until touched.** Hover and press states do the talking: tone shift on hover, `scale(0.97)` on press. No resting glow, no gradients on chrome.
7. **Both themes are first-class.** Every new token gets a dark value in the same commit.

## Making a component

Correct and on-token is the floor. A component that could be lifted into any other app is not finished. This is the pass that decides what it is.

1. **Name the object it is, in this app.** Mandala is a notebook on a desk. A confirmation is a slip of paper. A finished day is a seal. A choice is a card drawn from a deck. If the only name you have is the widget ("toast", "modal", "badge"), you do not have a design yet. The metaphor picks the surface, the type, and the motion together. A part that ignores it is decoration.
2. **One job, fully said.** List what it tells the person and the one thing they can do from it. If there is no action that changes something, there is no button. A second action, a second copy of the same news, or a count that fights the layout is hedging. Confidence is one object.
3. **Draw it several ways before you keep one.** Same moments, same place it will actually sit (above the dock, in the dialog, on the grid). Four to eight takes, on `/dev/ui`, including the generic version you are tempted to ship. Keep the one that belongs to the metaphor. Leave the others in the lab so the next decision has something to point at.
4. **The picture is the data.** A ring uses `pillarArc` and `arcPath`, so it matches the grid. A repeat is another sheet in the pile, not a new sentence. Time, count, and status should be readable with the words covered.
5. **Arrival and departure are different gestures.** Something landing may overshoot, briefly, between 280 and 420ms. Something leaving never overshoots: a bounce on the way out feels like a mistake. A departure eases, runs longer (about 500–700ms), and does not travel into whatever sits next to it. A timed departure starts before the deadline, so the end is visible while it is happening. Hover or focus pauses that clock and reverses the fade. The person pointing at it still wants it.
6. **Look at the awkward states, in place.** Repeat, undo, a long name, the plain case, nothing showing. Light and dark. Desktop and a phone. Keyboard focus. A component that only looks right alone, once, is not done.

The toast is the worked example. It is a paper slip, not an ink pill: the mark, an eyebrow, the chart name in the title size. Repeats thicken the pile and tick ×n. Only a delete offers Undo. The ring empties one pillar at a time, and the slip closes, lifts, and fades during the last pillar, instead of being cut on the final frame. Replacing it fades the old one in place while the new one lands. Seed and the ink pill stay beside it in the toast lab on `/dev/ui`.

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
| `--ink` / `--ink-hover` / `--on-ink` | Goal cell, focus ring, and ink fills that are not the primary action. Inverts in dark (light ink on dark paper) |
| `--accent` / `--accent-hover` / `--on-accent` | Primary button, selected dock tab, field halo, selected radio, checkbox. Aliases of `--ink` until a saved accent (`data-accent`) overrides them |
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
- `--ease: cubic-bezier(0.2, 0, 0, 1)` for small state changes, about 150ms.
- An arrival that lands (a sheet, a dealt card) may overshoot with `cubic-bezier(0.34, 1.56, 0.64, 1)`, 280–420ms. A departure never overshoots. It eases, takes about 500–700ms, and a timed one begins before removal. See Making a component.
- Motion uses the `motion-safe:` variant so it drops out under `prefers-reduced-motion`. Opacity may still fade.

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

Primitives live in `src/lib/components/ui/` (`Button`, `IconButton`, `SegmentedControl`, `Select`, `Menu`, `Dialog`, `Dock`, `Toast`, `Notice`, `Eyebrow`, `Card`). They own color, radius, and type. Feature screens pass layout classes only. Preview at `/dev/ui`.

### Native chrome

Tailwind preflight is off. A raw `<input>`, `<textarea>`, or `<select>` keeps the browser border and gray face unless the classes replace them. Buttons rest transparent in the base layer, so a pill does not pick up that face. A field still needs `border-0` and an explicit background.

- A pressable control is a primitive: `Button`, `IconButton`, `SegmentedControl`, `Select`, `DockTab`, or `MenuItem`. Do not draw a new pill out of raw `<button>` elements. Do not use a raw `<select>`.
- Two to four short options that apply immediately are a `SegmentedControl`. The selected option is the surface thumb, not an ink fill. A longer list, or a choice that waits for another action, is a `Select`.
- A text field uses `textField` from `src/lib/components/ui/styles.ts`. A longer note uses `textArea`. Both are the `field-ink` utility: resting fill `--sunken`, hover deepens to `--sunken-hover` and draws an ink hairline at 16%, focus lifts to `--surface` with a 1px ink ring at 42% and a 4px ink wash at 9%. No browser outline. Callers add width and icon insets (`ps-10`) on top. Chart cells are not `field-ink`; their focus ring stays a solid ink stroke so the selected cell reads in the grid.
- A control that must stay a raw element (a text-link button, a checkbox) still sets `border-0` and an explicit background (`bg-transparent` or `bg-sunken`). Checkboxes and radios stay native. Their checked color is `accent-color: var(--accent)`.
- A fill that changes on hover, focus, or selection is a normal background utility (`hover:bg-sunken`, `bg-accent`). Do not transition `background-color` on a control that contains text: that promotes the glyphs and they jump at fractional device scale. `transition-colors` fades color and border only. Chart cells and text fields change fill the same way, with no background transition. Buttons rest transparent and at `scale: 1`, so a press scale does not animate from `none` and a raw button does not keep the gray browser face.

### Buttons

| Component | When |
| --- | --- |
| `Button` `variant="primary"` | The single main action of a view or dialog ("Start from a preset", "Use this preset") |
| `Button` `variant="soft"` | Secondary actions that still matter ("Get a prompt", "Cancel") |
| `Button` `variant="ghost"` | Tertiary / informational ("How it works") |
| `Button` `variant="danger"` | Throw away, or kill a link. Danger text and wash only, never a fill. A recoverable confirm stays `primary` |
| `size="sm"` | Dense contexts (notice rows, toolbars, inside dialogs) |
| `IconButton` | 42px round, icon only. Must have `aria-label`. Close buttons, the overflow menu |

Order in a row: primary first on the left in content; in a dialog footer cancel left, primary right. Icon sizes: 16 in `sm`, 18 in the default button and `IconButton`.

### Segmented control

`SegmentedControl`, buttons with `aria-pressed`. Use for 2–4 mutually exclusive options that apply instantly (theme, Fit/Large). Not for navigation, which uses the dock.

### Select

`Select` is a listbox. The trigger is `field-ink`, same height as a text field (42px, or 34px at `size="sm"`). The panel matches a menu: paper, `--shadow-float`, 20px radius. It owns open, escape, outside click, focus return, and arrow keys. The chosen row carries a check. Pass `label` for the accessible name, or `labelledBy` when a visible label already exists.

### Dock

`Dock` + `DockTab`, `role="tablist"`, with `aria-selected` giving the accent fill. It holds view modes only (Chart / Edit / Split, Split desktop only). `Toast` sits directly above it.

### Menus

`Menu` owns open, escape, outside click, focus return, and arrow keys. `MenuItem`, `MenuDivider`. Destructive items go last, after a divider, in the danger tone. A long chart list scrolls on its own; the actions under it stay on screen, and the panel stops above the dock. The chart list ends on a fade into the actions (`to-surface`), not on a shadow: a shadow next to the divider reads as two edges. Pair short sibling actions two to a row so the actions stay short and the list keeps the height.

### Dialogs

`Dialog` is a native `<dialog>`. Header = heading + close; scrolling body; footer snippet for actions. Header, body, and footer share the sheet's paper. No shadow, hairline, or fade where the body scrolls; the scrollbar says there is more. Radius 30px, `--shadow-md`, warm translucent backdrop with a 3px blur, `dialog-in` rise on open. Width `min(38rem, 100vw - 32px)`.

### Feedback

- `Toast` sits above the dock as one paper slip (`bg-surface`, `--shadow-float`): the brand mark, an eyebrow for the verb, the chart name at title size. A plain `chart.say()` is one sentence, past tense, no exclamation, and no eyebrow. One slip at a time. Repeating that action while it shows adds a sheet behind it and ticks `×n`, and restarts the clock. A different action fades this slip and lands the next one. Charts that do not share a name read as “2 charts”. A delete carries Undo (`Button` `soft`) and stays 8 seconds; everything else 5. The ring empties one pillar at a time. During the last stretch the pile closes and the slip lifts and fades. Hover fans the sheets behind it, pauses the clock, and brings a fading slip back. It never drops into the dock. On a phone it shares the row above the dock with the Bindu launcher, so it centers in the space beside the launcher (`--dock-aside`), never over it.
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

Short, warm, plain. Sentence case everywhere. Say what happens, not what the feature is called ("Start from a preset", not "Presets"). Numbers as numerals ("3 of 8 actions"). No emoji in UI. An action is a sentence you could say, inside the character cap. A pillar is a short heading for one driver, like the presets' "Long runs" or "Core phrases".

**Bindu** is the chart helper ("Open Bindu"). The name is Sanskrit *bindu*, the center dot of a mandala; our center cell is the goal, so the helper is a person at that center, not a generic "AI" or "Coach" label. Bindu is a small notebook of pages, not a chat: a note and one next move on the first page, a door per job below it, and each job on a page of its own. Pages turn sideways and the panel eases to the new page's height. A thing that just became true (today set, a chart kept, lines added) takes the page as a moment: the ring draws the pillars it touched, then the words, then Done. Writing lines goes to the person's own chat app as a prompt, and the reply is pasted back. What Bindu does: [docs/bindu.md](docs/bindu.md).

## Accessibility

- Visible focus: `outline: 2px solid var(--ink); outline-offset: 2px` on buttons, menu items, dock tabs, and cells. Text fields use the `field-ink` halo instead of that outline.
- Hit targets ≥42px (≥44px on coarse pointers, handled by the `pointer: coarse` block).
- Text contrast ≥4.5:1 in both themes; `--muted` on `--sunken` is the tightest pair, so check it when adjusting.
- Every icon-only control has `aria-label`; toggles use `aria-pressed`, tabs `aria-selected`, menus `aria-expanded`.
- Never convey state by hue alone; pair it with text, a count, or a shape.

## Do / don't

| Do | Don't |
| --- | --- |
| Reuse `Button` variants | Invent a new button style in a component `<style>` |
| Use a primitive, or `border-0` plus an explicit background | Leave a raw button or input on the browser's border and gray face |
| Separate with tone and `--shadow-sm` | Wrap things in `1px solid` borders |
| Use one primary `Button` per view | Put two accent buttons side by side |
| Use pillar hues only for pillars | Tint a button or badge with a pillar hue |
| Keep accent on the primary button, the selected dock tab, and input chrome | Paint the goal, a badge, or a pillar with accent |
| Add dark values for new tokens in both dark blocks | Hardcode hex / rgb in components |
| Serif for reflective content | Serif on buttons, labels, or inputs |
| Pill radii on controls | Square or 6px-radius buttons |
| Let a timed thing start leaving before it is removed | Cut it on the last frame, or bounce it on the way out |
| Arrive with a little weight | Use the same spring for the exit |
