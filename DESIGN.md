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
| `--dot-l` / `--dot-c` / `--dot-fg-l` | Pale pillar tints behind small things (an empty slot, a mini chart's pillar cell). Not a marker: at 8px it nearly vanishes, in dark most of all |
| `--ring-track-l` / `--ring-fill-l` | Progress ring and brand mark arcs |
| `--goal-*` | Goal cell (ink) |

A dot that marks a pillar beside text (a pick, a finding, a legend) is the `pip` utility with `--pip-h`, which holds its lightness in both themes. Pillar names set in their hue use `pillar-ink`.

Write colors as `oklch(var(--p-l) var(--p-c) var(--h))` with `--h` set inline per element. Outside CSS (PNG icons, poster export), convert with `oklchToRgb` from `src/lib/chart/ring.ts`. Don't hand-pick hex.

### Elevation and motion

- `--shadow-sm`: resting cards. In dark it's a 1px light hairline, because shadows vanish on dark paper.
- `--shadow-md`: floating things (menus, dialogs, dock, toast).
- `--ease: cubic-bezier(0.2, 0, 0, 1)` for small state changes, about 150ms.
- An arrival that lands (a sheet, a dealt card) may overshoot with `cubic-bezier(0.34, 1.56, 0.64, 1)`, 280–420ms. A departure never overshoots. It eases, takes about 500–700ms, and a timed one begins before removal. See Making a component.
- Motion uses the `motion-safe:` variant so it drops out under `prefers-reduced-motion`. Opacity may still fade.
- A container whose content changes size eases to the new height (about 420ms, expo-out) instead of jumping. It never animates from zero on first paint.

Reuse a motion before adding one. Keyframes live in `src/app.css` as `--animate-*`; Svelte transitions live in `src/lib/components/ui/motion.ts`.

| Motion | Use it for |
| --- | --- |
| `pop-in` | A line or row arriving. Stagger a list by index, 40–50ms apart |
| `deal-in` | A hand of cards arriving, 70ms apart. Overshoots |
| `flip-in` | One card replaced in place (a swap). The old face fades where it is; the new one swings in. A pillar's block turned over to its shelf does the same, and the block eases to the new face's height |
| `stack-in` | Pips stacking into a column, staggered by column, then by row |
| `scan` + `mark-in` | Reading a chart: cells light in reading order, then each flagged cell gets a ring that closes in |
| `seal-in` + `seal-draw` | A moment: the ring arrives, its arcs draw in pillar order, the check is the last stroke |
| `done-in` | The words of a moment, after the picture |
| `note-in` / `noteOut` | A floating panel opening from its corner, and folding back |
| `pageIn` / `pageOut` | Turning pages inside a panel. In: slides about 28px from the side it comes from. Out: fades in place and drifts a few pixels the other way |
| `foldOut` | A row leaving a live list because it no longer applies. Fades, then its height closes up |
| `slipOut` | A slip being replaced. Fades without travel |
| `morph` (`src/lib/chart/morph.ts`) | Switching views, theme, or accent, as one view transition. The chrome swaps at once, the stage (`main`) fades out fast and rises in, and the selected block travels between the chart and the editor (`view-transition-name: focus-block`). A search hit travels into its cell (`travel`). A theme or accent change crossfades the whole page. Morphs called in the same moment join one transition. A name is only on one element at a time, so a block that is on screen twice (split) carries none |
| `deal-in` on the start sheet | A borrowed preset's pillars, or a pillar's actions, arriving in the ring in pillar order. Lines the person wrote sit still |
| `swell` + `seal-draw` on the hero ring | A pillar that just got its last line redraws its arc, swelling once. A full chart redraws all eight in order, then the count steps aside for a check |
| `stamp` | A check pressed onto a pill: it comes down large and tilted, and lands flat |
| `glow` | A block whose pillar just became whole: a ring of its hue spreads out and fades |
| Spatial slide (`SidePanel.svelte`) | The editor's block arrives from where it sits on the map: pillar 1 from the top left, pillar 8 from the bottom right. A Web Animations call, since the direction is computed |

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

`SegmentedControl`, buttons with `aria-pressed`. Use for 2–4 mutually exclusive options that apply instantly (theme, Fit/Large). Not for navigation, which uses the dock. With `tabs` it switches what one panel shows (a pillar's actions and its shelf): `role="tab"`, `aria-selected`, and arrow keys move between them. An option's `detail` is a quiet count beside its label.

### Select

`Select` is a listbox. The trigger is `field-ink`, same height as a text field (42px, or 34px at `size="sm"`). The panel matches a menu: paper, `--shadow-float`, 20px radius. It owns open, escape, outside click, focus return, and arrow keys. The chosen row carries a check. Pass `label` for the accessible name, or `labelledBy` when a visible label already exists.

### Dock

`Dock` + `DockTab`, `role="tablist"`, with `aria-selected` giving the accent fill. It holds view modes only (Chart / Edit / Split, Split desktop only). Today and Split wait until a chart is started (Starting a chart). `Toast` sits directly above it.

### Menus

`Menu` owns open, escape, outside click, focus return, and arrow keys. `MenuItem`, `MenuDivider`. Destructive items go last, after a divider, in the danger tone. A long chart list scrolls on its own; the actions under it stay on screen, and the panel stops above the dock. The chart list ends on a fade into the actions (`to-surface`), not on a shadow: a shadow next to the divider reads as two edges. Pair short sibling actions two to a row so the actions stay short and the list keeps the height. **Select charts** and **Recently deleted** are the same dialog with two jobs: rows with a box each, shift-click for a run, Select all for what the search shows ("Select these" while searching), and the one action in the footer with the count on it. Deleting from Select charts is one click, since the charts wait in recently deleted and the slip undoes the whole batch.

### Dialogs

`Dialog` is a native `<dialog>`. Header = heading + close; scrolling body; footer snippet for actions. Header, body, and footer share the sheet's paper. No shadow, hairline, or fade where the body scrolls; the scrollbar says there is more. Radius 30px, `--shadow-md`, warm translucent backdrop with a 3px blur, `dialog-in` rise on open. Width `min(38rem, 100vw - 32px)`.

### Pages in a panel

A floating panel with more than one job is a few pages, not a chat and not tabs. Bindu is the worked example (`HelperPanel.svelte`).

- **The first page** says one thing and offers one move: a note (what is true right now, in a sentence), one primary button for the next move, then a door per job. Each door says what it would find, from the data ("From Health, Words and Sleep", "5 lines to tighten"), not what the feature is called.
- **Each job is its own page**, with at most one primary button. A page that is long keeps its actions in a sticky row at the bottom, on the panel's paper.
- **Turning.** The new page slides in from the side it comes from while the old one fades where it is. Both sit in one grid cell, so nothing jumps. The panel eases to the new page's height.
- **The header stays.** The back button opens out from nothing beside the face, and the title crossfades. Its focus ring is not clipped.
- **Keys and focus.** Escape goes back a page, then closes. Opening a page focuses its back button. Going back focuses the door it came from. A control that a page replaces (a swapped card) hands focus to its replacement.
- **Reopening** returns to the page that was left, so a person who stepped away to paste something finds the box waiting. A finished moment does not wait for a reopen.
- **A moment** takes the page when something becomes true: the ring draws the pillars it touched, then the words, then Done. The moment says it, so no toast says it again.
- **Steps on a thread.** A round trip of a few steps (copy, paste there, paste back) is numbered markers joined by a thread. Done is an ink disc with a drawn check, the current step an ink ring, the rest recessed. The thread fills in ink below each done step.
- **Pages in a dialog.** The weekly reflection is the same pattern inside `Dialog`: a row of marks for where you are (the current page a longer mark, the read ones ink), one page at a time through `Pages`, and the footer's two buttons relabelled rather than replaced, so focus stays put as pages turn. Saving lands on a moment inside the dialog, with Done as its only door.
- **`Pages`** (`ui/Pages.svelte`) is the primitive: a `view`, a `direction`, a snippet per page. It turns, eases its height, and scrolls each new page to the top.

### Floating chrome

The dock (with its toast), Bindu, and an open menu float over the stage and stay still while it changes. In a view transition each has its own layer, above the stage, with no animation, the menu above the rest since it is what the person is using, and the dock's frosted bar turns solid paper for the duration (`[data-morphing]` on the root): a frosted thing is captured without what is behind it, and would read as see-through. The dock carries its `view-transition-name` only while `[data-morphing]` is set. A named element is a backdrop root, so at rest the name would leave the bar's blur nothing to sample, and the bar would read as see-through all the time.

### Moments on the chart

Writing the last line of a pillar, or of the chart, is a moment too, without a layout of its own, because the person is at the keyboard. It plays where the data already shows: the editor's pill stamps its check, the block glows once in its hue, and the hero ring redraws the arc. A full chart redraws all eight and ends on a check, and says so in one toast. `chart.landed` carries it for three seconds and is never saved, so a reload does not replay it. Several lines landing together (a fill) make one moment at once. A typed line waits for the pen to lift: the field is left, or typing pauses for a beat (`chart.settle`). A line cleared again before that lets go, so a half-typed word never stamps.

### Picking the day

Today, before the day starts, is one sheet of paper with the decks below it on the desk. The sheet holds the date and the question, three slots, the habits already in the day (read, not ticked: they are ticked once the day starts), and one line of status beside Deal and Start my day. The calendar is an icon in the sheet's header. Each deck below is a pillar's top card with the rest of the deck as edges under it, and a quiet foot that counts the cards and spreads them. The sheet is where cards go; the decks are where they come from. In the Plan tomorrow dialog the dialog is the sheet.

### The calendar

Every day's finished things, on a month (`CalendarView.svelte`, rules in `calendar.ts`). A day shows a pip per tick in the pillar's hue, so a month reads as colour before it reads as numbers; today wears a ring; days ahead are quiet. A tapped day lists what was finished, in the order it was ticked, with the time when the log kept it, and a milestone says so. Months turn as pages (the `Pages` primitive), no further back than the first month with anything in it. It is reached from Today, from Bindu's progress page, from the command palette and the C key; it is not in the dock, which stays four doors wide.

### When the week is offered

The weekly reflection is offered from an hour of a weekday the person chooses (Sunday from 6 pm to start), in the reflection's first page. The offer stands until the next one: a Monday morning still gets the week that just ended. It is offered only for a week with a tick, and goes quiet once saved or set aside.

### Tools on a shelf

A video, a text, a site is a **tool**: material behind a pillar, not a cell. The cell stays a sentence you can tick ("Play 15 minutes of audio at breakfast"); the shelf behind the pillar holds what it plays. Thirty videos never become thirty actions.

- **The back of the block.** In the editor a pillar's block has two faces, picked under its name: Actions and Shelf, with the shelf's count beside it (`chart.face`). Turning it over swings the shelf in where the grid was, at the top, so the shelf never waits below the action bar and the tips. Moving to another pillar keeps the face, so shelves can be read one after another. A door that names a cell (a search hit, See action 2 on a tool, a tick in the calendar) turns the block back to its actions. Today's tool row has a shelf button and the command palette has Open the … shelf; both land on this face (`chart.openShelf`).

- **One face** (`ToolFace.svelte`): YouTube's own thumbnail when the link has one, else the icon the person gave the site, else a link glyph, with the site's name beside it. An icon belongs to a host (`data.icons`), so every tool on that site wears it. Add an icon, in a tool's settings, opens a menu: choose an image, paste one, and once one is set, remove it. A picture pasted anywhere on that tool's row (a copied image, or SVG code from a design tool) sets it too, and the row takes focus on a click so a paste right after lands there. A picture pasted into the link field is not a link: the field says where it goes instead. It takes any picture the browser can draw: an SVG is kept as written when it is small, anything else is drawn down to 128px. Icons stay out of share links, which they would outgrow. Its caption is one string built in script, since Svelte trims the space at the start of a block.
- **Two kinds and one exit.** `once` retires itself the first time it is opened. `repeat` stays in rotation until the person presses **Know this**. "Watch daily" and "until it sticks" are both repeat; the difference is whether that button ever gets pressed.
- **Who hands it out.** A tool named for an action is handed out by that action. An unassigned tool is handed out by any routine in its pillar. Today shows the day's tool under the action's row, with one tap to open it and an arrow for another. Opening is logged; the tick stays the person's.
- **Rotation.** Never opened first, then the one that waited longest, holding still within a day and seeded by the action, so two routines on one shelf do not hand out the same thing.
- **Known by now.** A repeat tool opened on 10 of the last 14 days gets a line on the shelf and a note from Bindu. The shelf has the button. Known tools wait folded at the end of the shelf, under Known by now, so the plank holds only what is in rotation.
- **A row is one line.** The shelf is one plank (`bg-bg`) of rows. A row is the face, and under the title who hands it out and how often ("any routine", "for action 2 · once"), with an Up next tag on the tool Today shows (`upNext`, dealt in Today's order by `dealKeys`). The arrow opens that row's settings under it, one row at a time, and the row lifts onto the panel's paper: Handed out by, Comes round, Know this, the site's icon, and Remove last, in the danger tone. Settings that are set once stay closed. The field that adds one is the last slot on the plank, so a pasted link lands just above it. Removing a tool leaves a slip with Undo, which puts it back where it was.
- **One link field.** An action's own field is a note ("a chapter or a page"). A link pasted into it goes on the pillar's shelf, handed out by that action, and the note stays as it was. A link already typed as a note offers Move to the shelf. In the editor, an action cell counts what it hands out with the shelf mark, and the action's "Hands out 3 from the shelf" turns the block over. A tool named for an action has See action 2 in its settings, which turns back to that cell.
- **Through the app.** The calendar's day lists what was opened from a shelf, under what was finished. The command palette finds a tool by its title and opens it, which counts as opening it.
- **Capture.** A link pasted anywhere that is not a field opens **Add to a shelf**: the tool's face, then a pillar per row. The manifest's share target does the same from Android's share sheet. A paste inside a field, or inside Bindu, is left alone.
- Shelves travel with a shared chart; what was opened when, and what is known, stays on the device.

### Starting a chart

The method is one sitting: a goal, eight pillars, eight actions under each, all 64 written, then a few revisions. What keeps that from being a wall is the order, not leaving most of it out. A new chart is written the way a mandala is drawn, from the center out, one ring and then one block at a time (`CenterOut.svelte`, rules in `start.ts`). In chart view, a chart with nothing on it is not a grid of placeholders and not 64 cells of someone else's plan. It is one sheet that asks one thing per page, with three marks for the rings.

- **The center.** The empty ring draws itself and the dot lands beside "What do you want to get done?", one field, and the presets as goals to borrow. The lede says what comes and that it usually takes one sitting, and that stopping anywhere is fine. Borrowing puts the preset's goal in the field to change, and nothing else yet. The other door is a chat app, through Bindu.
- **The first ring.** The goal sits in the middle of a 3×3 and the eight pillars around it are the fields. The ask is eight; a pillar is left empty only when its driver is not known yet. A borrowed goal deals its preset's pillars in, in pillar order. A ring the person has not touched follows a change of preset; one they have, never.
- **The outer ring.** A hub: the named pillars are cards with a count (2/8) or a check when the block is whole, and an unnamed one is a plus that turns back to the ring with its field ready. Start writing, then Next pillar, walks the blocks in pillar order, skipping whole ones. Each block is its own page with the pillar in the middle and the eight actions around it, the preset's dealt in when the pillar still has the preset's name. The lede carries the two tests and asks for a gap over filler. All pillars, without a change, puts lent lines away again, so the hub counts only what was kept.
- **The ending.** When no named block has an empty line, Finish plays it. A whole chart is Chart complete: all eight arcs, then the check, and the line that the 64 are not all done at once (Today asks for three a day). A chart with a pillar still unnamed is Chart drawn, and says where the hole is. See the chart is its only door. Lines are written quietly, so the last one does not also toast.

Done for now is on every page after the goal. It keeps every line and goes back to the grid, since every line is written to the chart as it is typed. A whole chart still gets its ending. While a chart has a goal and fewer than eight whole blocks, the row above the grid carries Keep building and the count, in place of the double-click hint. It reopens the sheet where the chart left off (a half-written block, else the outer ring), still lending from the preset whose pillar names the chart carries. `chart.starting` keeps the sheet up once the goal makes the chart non-empty. A whole chart arriving from elsewhere (a preset, a draft, an import) ends it.

While the sheet is up, the page holds only what can be used on it: no search, no stats card, no scale row, no Bindu launcher (the sheet has the chat app door), and the dock is Chart and Edit. On the first chart the hero steps aside too, since there is nothing to switch to, and How it works moves into the sheet beside the marks. When the sheet closes, Today and Split land in the dock. The full preset, all 64 at once, is still in the command palette and the editor's start buttons for anyone who asks for it.

### Feedback

- `Toast` sits above the dock as one paper slip (`bg-surface`, `--shadow-float`): the brand mark, an eyebrow for the verb, the chart name at title size. A plain `chart.say()` is one sentence, past tense, no exclamation, and no eyebrow. One slip at a time. Repeating that action while it shows adds a sheet behind it and ticks `×n`, and restarts the clock. A different action fades this slip and lands the next one. Charts that do not share a name read as “2 charts”. A delete carries Undo (`Button` `soft`) and stays 8 seconds; everything else 5. The ring empties one pillar at a time. During the last stretch the pile closes and the slip lifts and fades. Hover fans the sheets behind it, pauses the clock, and brings a fading slip back. It never drops into the dock. On a phone it shares the row above the dock with the Bindu launcher, so it centers in the space beside the launcher (`--dock-aside`), never over it.
- `Notice` for persistent inline info with an optional small primary or soft `Button`.

### Brand

- `BrandMark.svelte`: eight arcs + goal dot, same geometry as `ProgressRing.svelte`, both from `src/lib/chart/ring.ts` (`PILLAR_ANGLES`, `pillarArc`, `arcPath`). Arc positions are **spatial**: each pillar's arc sits at the angle where that pillar sits in the grid.
- App icons, `favicon.svg`, and `logo.svg` are generated by `bun run gen:icons` (`scripts/generate-pwa-icons.ts`). Don't edit the outputs by hand; change the script or `ring.ts` and regenerate.

## Trying it

`/dev/demo` sets the app up to show one thing at a time, as a new chart: the last line of a chart, a pillar finishing, a blank chart, the views and the dock, moving around the map, search travel, today, the weekly reflection, and each of Bindu's pages. A demo card lists what to do once it opens. The demos that need a chat app's reply carry a sample to copy. New motion gets a demo there, so it can be felt, not read.

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
