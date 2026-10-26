# Mandala design system

Direction: **calm editorial**. Warm paper and sand, espresso ink, a serif for titles over a sans for the rest, a clay accent, pill-shaped controls, color reserved for the chart itself. The app should feel like a good notebook, not a dashboard.

Studied on Mobbin while building this (all self-improvement / planning apps): Finch, Me+, Tiimo, Structured, stoic., Bloom, ABY Journal, Atoms, timespent, pliability, QUITTR, Liven. What we took:

| From | Lesson |
| --- | --- |
| stoic., ABY Journal, Bloom | Serif headlines on warm paper read as reflective, not productive-anxious |
| Structured, Tiimo | One primary action per screen, in solid ink; everything else recedes |
| Atoms, timespent | Progress as a ring/segments, not a bar; numbers set large and quiet |
| Finch, Me+ | Floating bottom pill bar for primary navigation on every size |
| pliability, Liven | Surfaces separated by tone and soft shadow, never by borders |

A second pass asked what makes a warm, oatmeal app look crafted rather than plain (Claude, Origin, Tiimo, 5 Minute Journal, Rox):

| From | Lesson |
| --- | --- |
| Claude, Origin, Tiimo, 5 Minute Journal | A serif title over a sans body is what makes warm paper read as considered |
| Claude, Rox | The accent is a warm clay from the paper's own palette. Black on cream reads as a default |
| Rox, Claude | What sits under the page is sand, a step warmer than it, and quiet text is brown, not grey |

## Principles

1. **Color belongs to the chart.** Chrome is paper and ink. The eight pillar hues appear only where they mean a pillar (cells, ring, brand mark). The one exception is `--accent`: the primary button, the selected dock tab, and input chrome (the field halo, a selected radio, a checkbox). It is clay (`--swatch-clay`) unless the more-actions menu picks Ink, Walnut, Olive, Field, or Leaf. A swatch replaces only `--accent`, `--accent-hover`, and `--on-accent`, and the label on it is white. The goal stays `--ink`: dark on paper, white in the dark. It does not follow the accent. Paper, focus rings on buttons, and the pillar hues stay. Danger sits at hue 8 so Delete stays a red. Never use a pillar hue, or the accent, for decoration.
2. **One loud thing.** Each view has at most one `btn-primary`. If you want two, one of them is wrong.
3. **Tone over lines.** Separate regions with `--surface` vs `--bg` vs `--sunken` and `--shadow-sm`. Borders (`--line`) are for dividers inside a menu, not for boxing things.
4. **Two faces, one family.** Source Serif 4 for titles, dialog headings, the goal, and the wordmark (`font-serif`, through `--serif`); its sibling Source Sans 3 for everything else, controls included. Size and weight do the rest of the hierarchy. Do not add Fraunces, Bricolage Grotesque, Epilogue, or any other family.
5. **Round everything you can press.** Buttons, segmented controls, chips, dock: `border-radius: 999px`. Cards and dialogs: 20–28px.
6. **Quiet until touched.** Hover and press states do the talking: tone shift on hover, `scale(0.97)` on press. No resting glow, no gradients on chrome.
7. **Both themes are first-class.** Every new token gets a dark value in the same commit. The theme and the accent belong to the device (`theme.ts`): they paint before first paint from `app.html`, another open tab follows a change at once, and the browser's bar takes the page's own paper (`THEME_COLORS`, held to `--bg` by a test).

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
| `--accent` / `--accent-hover` / `--on-accent` | Primary button, selected dock tab, field halo, selected radio, checkbox. Clay (`--swatch-clay`) by default. A saved accent (`data-accent`) swaps them, Ink included |
| `--success` / `--danger` | Status text and destructive menu items. Never as fills |

### Chart color

Pillar hues are fixed: `HUES = [25, 60, 100, 150, 195, 240, 290, 345]` in `src/lib/chart/model.ts`, indexed by pillar `k` (row-major: TL, T, TR, L, R, BL, B, BR). Lightness and chroma come from theme tokens so the hue stays constant across themes:

| Token pair | Used for |
| --- | --- |
| `--p-l` / `--p-c` (+ `-hover`) | Pillar cells |
| `--t-l` / `--t-c` (+ `-hover`) | Action cells |
| `--card-l` / `--card-c` / `--card-lift` (`pillar-card`) | A board card: a light pillar tint on a 1px warm lift, with no outline and no halo |
| `--dot-l` / `--dot-c` / `--dot-fg-l` | Pale pillar tints behind small things (an empty slot, a mini chart's pillar cell). Not a marker: at 8px it nearly vanishes, in dark most of all |
| `--ring-track-l` / `--ring-fill-l` | Progress ring and brand mark arcs |
| `--goal-*` | Goal cell (ink) |

A dot that marks a pillar beside text (a pick, a finding, a legend) is the `pip` utility with `--pip-h`, which holds its lightness in both themes. Pillar names set in their hue use `pillar-ink`.

Write colors as `oklch(var(--p-l) var(--p-c) var(--h))` with `--h` set inline per element. Outside CSS (PNG icons, poster export), convert with `oklchToRgb` from `src/lib/chart/ring.ts`. Don't hand-pick hex.

### Elevation and motion

- `--shadow-sm`: resting cards. A faint ring and a soft, diffuse drop, so a card sits on the paper instead of being outlined. In dark it's a 1px light hairline, because shadows vanish on dark paper.
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
| `scan` | A chart arriving: its written cells light up, pillar by pillar |
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
| Chart title (hero) | `--serif` | large, fluid, light negative tracking |
| Dialog / panel heading | `--serif` | medium |
| Goal cell text | `--serif` | fluid, via container query units |
| Wordmark | `--serif` | small, semibold |
| Body / lede | `--font` | ~1rem, 400, `--muted` for lede |
| Controls | `--font` | 0.84–0.9rem, 560 |
| Eyebrow | `--font` | 0.72rem, 600, uppercase, `0.12em` tracking, `--muted` |
| Stats numbers | `--font`; the ring's count is `--serif` | tabular-nums |

Exact sizes live on the nearest component; copy that rather than inventing a new step.

Rules: headings `text-wrap: balance`, paragraphs `text-wrap: pretty`, no all-caps except `.eyebrow`, max ~62ch for prose. A serif title takes about half the negative tracking a sans would (−0.005 to −0.015em): tighter, and its letters touch.

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
| `Button` `variant="ghost"` | Tertiary ("Write it myself") |
| `Button` `variant="danger"` | Throw away, or kill a link. Danger text and wash only, never a fill. A recoverable confirm stays `primary` |
| `size="sm"` | Dense contexts (notice rows, toolbars, inside dialogs) |
| `SplitButton` | One action and its alternatives: the main half does the remembered choice, the chevron opens a menu of the others, grouped under eyebrows, the remembered one checked. Picking a row does it and makes it the main half. Bindu's prompt hand-off: Copy prompt, or Open in a chat app |
| `IconButton` | 42px round, icon only. Must have `aria-label`. Close buttons, the overflow menu |

Order in a row: primary first on the left in content; in a dialog footer cancel left, primary right. Icon sizes: 16 in `sm`, 18 in the default button and `IconButton`.

### Segmented control

`SegmentedControl`, buttons with `aria-pressed`. Use for 2–4 mutually exclusive options that apply instantly (theme, Fit/Large on desktop: on a phone the chart takes the width either way, so the choice is not offered). Not for navigation, which uses the dock. With `tabs` it switches what one panel shows (a pillar's actions and its shelf; the chart as View, Edit, or Split): `role="tab"`, `aria-selected`, and arrow keys move between them. An option's `detail` is a quiet count beside its label.

### Select

`Select` is a listbox. The trigger is `field-ink`, same height as a text field (42px, or 34px at `size="sm"`). The panel matches a menu: paper, `--shadow-float`, 20px radius. It owns open, escape, outside click, focus return, and arrow keys. The chosen row carries a check. Pass `label` for the accessible name, or `labelledBy` when a visible label already exists.

### Dock

`Dock` + `DockTab`, `role="tablist"`, with `aria-selected` giving the accent fill. It holds the places, four of them: Today, Board, Calendar, Chart. Today is a sun, the day, as Plan tomorrow is a moon; Calendar is the month. How you look at the chart is not a place: View, Edit, and Split (desktop only) are `SegmentedControl` tabs under the chart's title, and the Chart tab goes back to the one last open. The V, E, and S keys still switch them. Under 420px only the open tab shows its name, and the others are their icon with the name kept for screen readers and the title, so the dock fits at 320px. `Toast` sits directly above it. While the start sheet is on the stage the tabs step aside (`hideTabs`): the bar keeps its room, so the toast does not drop, and it lands again when the sheet closes.

### Menus

`Menu` owns open, escape, outside click, focus return, and arrow keys. `MenuItem`, `MenuDivider`. A menu that would open under the dock opens upward when there is room above it. Destructive items go last, after a divider, in the danger tone. **More actions** is short: a row that opens a list shows only while the list has something in it (Earlier versions, Shared pages, See all shelves), a row the page already offers is not repeated (commands sit behind the search field and Ctrl+K, the method behind the ⓘ). Its foot is three settings, a label each and the controls on one edge: Theme, Accent, and Bindu (Off, On, With AI). With AI asks for consent inside Bindu first, so the menu closes on it. A long chart list scrolls on its own; the actions under it stay on screen, and the panel stops above the dock. The chart list ends on a fade into the actions (`to-surface`), not on a shadow: a shadow next to the divider reads as two edges. Pair short sibling actions two to a row so the actions stay short and the list keeps the height. A page title that opens a menu (the chart, the calendar's scope) is `MenuTitle`: a round chevron that rides on the last word, so it never wraps alone, and a title too long for two lines ends in an ellipsis before it, cut where the line runs out (mid-word, as a phone cuts a title), so the chevron is never clamped away and the line is full. A chart with something left today (`leftToday`: its routines and open picks) says "2 left today" behind an ink dot where it would say when it was saved, and while any other chart does, the title's chevron wears the same dot, so a goal out of view is not forgotten. Ink, not accent: the dot is the goal's own center dot, as on the calendar. **Select charts** and **Recently deleted** are the same dialog with two jobs: rows with a box each, shift-click for a run, and above them a box that picks them all (`PickAll`): in the rows' own column, a dash when some are picked, and its words say how many ("2 of 14 selected", "Select these" while searching). It stays at the top while the list scrolls. The footer holds the actions only, with the count on them. Deleting from Select charts is one click, since the charts wait in recently deleted and the slip undoes the whole batch.

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

Today, before the day starts, is one sheet of paper with the decks below it on the desk. The sheet holds the date and the question, three slots, the habits already in the day (read, not ticked: they are ticked once the day starts), and one line of status beside Deal and Start my day. Each deck below is a pillar's top card with the rest of the deck as edges under it, and a quiet foot that counts the cards and spreads them. The sheet is where cards go; the decks are where they come from. In the Plan tomorrow dialog the dialog is the sheet.

Once the day has started, and once it is done, a small card under the list says **Also today**: each other chart with something left today, how much, and a row that opens it. Each goal keeps its own Today, so the others say what they still hold rather than wait to be remembered.

### The calendar

Every day's finished things, on a month, across every chart (`CalendarView.svelte`, rules in `calendar.ts`). Your days hold all your goals, so it opens on All charts: a day shows an ink dot for each goal that finished something (the goal's own center dot), a tapped day lists what was finished under each goal's name, and once the month has anything finished, a list at its foot (Goals this month) says how much each goal finished, an ink dot for one that did and a hollow one for Nothing yet; a row narrows the calendar to that goal. The page header says the scope (Your calendar, over All charts) instead of the open chart, and its menu narrows the calendar to one chart, whose days show a ring of its pillars in their hues, so a month reads as colour before it reads as numbers. Pillar hues repeat from chart to chart, which is why All charts marks goals and not pillars. A line from another chart opens that chart at its cell; today wears a ring; days ahead are quiet. A tapped day lists what was finished, in the order it was ticked, with the time when the log kept it, and a milestone says so. Months turn as pages (the `Pages` primitive), no further back than the first month with anything in it. It is in the dock, and on the C key, the command palette, and Bindu's progress page. Narrowed to one chart, it says under the month what the other charts finished, with Show all charts, so one goal in view never reads as all of them.

### The board

What is in play, as a work board (`BoardView.svelte`, rules in `board.ts`). Every written action is a card in one of four lists: **Open**, **To do**, **Doing**, **Done**. The cards are `pillar-card`: a light tint of their pillar on a soft lift, no outline, with the pillar's name above the action in `pillar-ink` and one quiet mark on the right (when it was done, Today, or Routine), all on the card's one left edge; the lists are trays a shade under the paper, their titles on that same edge. It is in the dock and on the B key, and it is meant to be glanced at daily and read back at the end of the week.

- **Where a card is lives on its action.** `meta.lane` (`todo` or `doing`) and `meta.rank` place an open action; `meta.done` puts it in Done, whatever its lane. Nothing new is stored, so sync and another tab carry the board as they carry the chart. A share does not: where a card sits is your history.
- **Order.** Open keeps the chart's order. To do and Doing keep the order you give them and are renumbered from 0 on every move. Done is newest first, the last card moved there leading its day, with an **Earlier** mark where this week ends.
- **One record of done.** Ticking an action in Today, dropping its card in Done, and Mark done in the editor are the same act (`finish` in `board.ts`): the action is done that day (a plain action becomes a milestone, so it leaves the picks) and the day's log gets the tick and its time. Today shows it ticked, the board files it in Done, and the calendar lists it once on that day. Unticking it, dragging it out of Done, or Completed in the editor reopens it everywhere and takes it off that day (`reopen`). Its check stamps as it lands. A routine never goes to Done: it is ticked in Today, day by day. Done dims while a routine is held over it and the card goes home.
- **Moving.** Drag with a pointer; on touch, hold a moment first so a swipe still scrolls. The held card tilts like a drawn card, a recessed slot opens where it will land, and on release it flies into that slot. Near a list's edge the list scrolls under it. With the keyboard, Space picks a card up, the arrows carry it (left and right between lists, up and down in To do and Doing), Space or Enter puts it down, Escape puts it back; a live region says where it is. A click or Enter opens the card itself, as a ticket beside the board (`CardSheet.svelte`).
- **The card is a ticket.** It opens as a sheet on the right, not modal, so clicking another card shows that one in its place, the way an issue opens beside a board. It holds the action as an editable title, its list and kind, a line about where it stands, **Notes** (`meta.details`: what a tutor said, new words, longer than the one-line `note`, and kept off Today), and **Activity**, read from the day logs (`historyOf`). A card with notes wears a small page mark. Escape closes it and hands focus back to the card. On a phone it rises as a sheet from the bottom. It is moved to the end of the page (`toBody`), so the dock and Bindu stay under it.
- **On a phone** the lists stay side by side, as columns you swipe between (snap), each a little narrower than the screen so the next one shows at the edge. They reach down to the dock, so the page holds still and each list scrolls on its own; the board's title goes to screen readers and the pillar filter sits beside the week's line to give them the room. Hold a card for a moment to drag it; held at the screen's edge, it turns one list at a time. The keyboard's arrows carry a card across and bring its list into view.
- **Narrowing.** A pillar select, and the header search: on the board, search narrows the cards instead of listing hits. Counts follow what is shown.
- **New card.** The plus on a list writes a new action into the first empty cell of the pillar you pick, then files it in that list. Hidden once every pillar has eight.
- **Today deals from it.** The Today picker puts pinned first, then Doing, then To do, each in board order. A card in today's three says Today; a routine says Routine, and once ticked today it says Today with a check.
- **Today's three are in Doing.** Whatever list a pick was filed in, it shows in Doing for its day, and a pick finished today stays on Today's list, ticked. Moving a pick on the board files it in Doing for good; moving it back to To do or Open takes it off today's list, logged as dropped like one taken off in Today. A pick left alone goes back to its own list when the day ends. Tomorrow's plan shows in To do, marked Tomorrow, and moving a planned card to Open takes it off the plan.
- **The day turns over on its own.** The store's `chart.today` rolls at midnight and when the page wakes, and Today, the board, and the calendar start the new day without a reload.

### When the week is offered

The weekly reflection is offered from an hour of a weekday the person chooses (Sunday from 6 pm to start), in the reflection's first page. The offer stands until the next one: a Monday morning still gets the week that just ended. It is offered only for a week with a tick, and goes quiet once saved or set aside.

### Tools on a shelf

A video, a text, a site is a **tool**: material behind a pillar, not a cell. The cell stays a sentence you can tick ("Play 15 minutes of audio at breakfast"); the shelf behind the pillar holds what it plays. Thirty videos never become thirty actions.

- **The back of the block.** In the editor a pillar's block has two faces, picked under its name: Actions and Shelf, with the shelf's count beside it (`chart.face`). Turning it over swings the shelf in where the grid was, at the top, so the shelf never waits below the action bar and the tips. Moving to another pillar keeps the face, so shelves can be read one after another. A door that names a cell (a search hit, See action 2 on a tool, a tick in the calendar) turns the block back to its actions. Today's tool row has a shelf button and the command palette has Open the … shelf; both land on this face (`chart.openShelf`).

- **One face** (`ToolFace.svelte`): YouTube's own thumbnail when the link has one, else the icon the person gave the site, else a link glyph, with the site's name beside it. An icon belongs to a host (`data.icons`), so every tool on that site wears it. Add an icon, in a tool's settings, opens a menu: choose an image, paste one, and once one is set, remove it. A picture pasted anywhere on that tool's row (a copied image, or SVG code from a design tool) sets it too, and the row takes focus on a click so a paste right after lands there. A picture pasted into the link field is not a link: the field says where it goes instead. It takes any picture the browser can draw: an SVG is kept as written when it is small, anything else is drawn down to 128px. Icons stay out of share links, which they would outgrow. Its caption is one string built in script, since Svelte trims the space at the start of a block.
- **Three kinds and one exit.** `once` retires itself the first time it is opened. `repeat` stays in rotation until the person presses **Know this**. "Watch daily" and "until it sticks" are both repeat; the difference is whether that button ever gets pressed. `staple` never leaves: a dictionary, a reader, a course gone back to for good. It comes round like a repeat, is never asked "Know it by now?", and has no Know this. Making a known link a staple puts it back in rotation. Nothing leaves a shelf on its own; only Remove takes a link off.
- **Who hands it out.** A tool named for an action is handed out by that action. An unassigned tool is handed out by any routine in its pillar. Today shows the day's tool under the action's row, with one tap to open it and an arrow for another. Opening is logged; the tick stays the person's.
- **Rotation.** Never opened first, then the one that waited longest, holding still within a day and seeded by the action, so two routines on one shelf do not hand out the same thing.
- **Known by now.** A repeat tool opened on 10 of the last 14 days gets a line on the shelf and a note from Bindu. The shelf has the button. Known tools wait folded at the end of the shelf, under Known by now, so the plank holds only what is in rotation.
- **A row is one line** (`ToolRow.svelte`, the same on the shelf and in all shelves). The shelf is one plank (`bg-bg`) of rows. A row is the face, and under the title who hands it out and how often ("any routine", "for action 2 · once"), with an Up next tag on the tool Today shows (`upNext`, dealt in Today's order by `dealKeys`). Everything else is in the row's ⋯ menu, two clicks at most from anywhere: Know this (not on a staple), Comes round (Repeat, Once, Staple, applied at once), Move to another shelf (a second page of the menu, the pillars by pip, Has it on one that already holds the link), Who hands it out, and Remove last, in the danger tone. Delete, on a focused row, removes it too. Who hands it out opens that row's settings under it, one row at a time, and the row lifts onto the panel's paper: Handed out by, See action 2, and the site's icon, closed again by Done. A move drops the action that handed it out, since that action stays on its own pillar, so the routines there hand it out. The field that adds one is the last slot on the plank, so a pasted link lands just above it. Removing a tool leaves a slip with Undo, which puts it back where it was. Focus goes to the row beside the one that left.
- **One copy of a link.** The same video however YouTube writes it, or the same page whatever the www or the closing slash (`sameLink`), is one link. Pasting it again on its own shelf adds nothing: the slip says Already on this shelf and the row lands again. Pasted into an action's note, it hands the one already there to that action. Add to a shelf marks the pillars that have it, and says so above them.
- **One link field.** An action's own field is a note ("a chapter or a page"). A link pasted into it goes on the pillar's shelf, handed out by that action, and the note stays as it was. A link already typed as a note offers Move to the shelf. In the editor, an action cell counts what it hands out with the shelf mark, and the action's "Hands out 3 from the shelf" turns the block over. A tool named for an action has See action 2 in its settings, which turns back to that cell.
- **Through the app.** The calendar's day lists what was opened from a shelf, under what was finished. The command palette finds a tool by its title and opens it, which counts as opening it.
- **All shelves at once** (`Shelves.svelte`). **See all shelves**, at the foot of any shelf (with how many more the others hold), in the more-actions menu while a shelf holds something, and in the command palette, opens the whole bookcase in a dialog: a plank per pillar that holds something, in pillar order, its pip, name and count, then the same rows as the shelf, with the same menu, the known ones last and dimmed. A row opens its link and counts the open. Who hands it out, and **Open** on a plank, close the dialog and turn that pillar's block to its shelf, the first with that row's settings open. **Select links**, in the footer, turns every row into a box, with the box that picks them all above the planks (`PickAll`) and shift-click for a run; the footer then holds Cancel, Move (a menu of the pillars), and Remove, with the count on them. Removing several is one slip, whose Undo puts each back in place. A closing line names the pillars with nothing on them yet.
- **Capture.** A link pasted anywhere that is not a field opens **Add to a shelf**: the tool's face, then a pillar per row. The manifest's share target does the same from Android's share sheet. A paste inside a field, or inside Bindu, is left alone.
- Shelves travel with a shared chart; what was opened when, and what is known, stays on the device.

### What a copy or a share carries

A chart has a plan (goal, pillars, actions, how each is set up, the shelves' links) and a history (days, ticks, time logged, done marks, the board's lanes, reflections). **Duplicate chart** (the chart menu, D, or the command palette) opens a small dialog. Its field is the copy's goal, selected, so a copy made for a new goal is named on the way in, and Enter keeps the same one. When the chart has history, **Include history** sits under it, off, with what it would carry in the calendar's words ("16 things finished on 6 days, 5 h 15 min logged"), since the calendar adds up every chart and would count those twice. A chart with nothing behind it shows no box. Either way the slip says Duplicated. A share, by link or by page, carries the plan and never the history. Notes are the person's own: a share leaves out each action's note and its board notes unless **Include notes**, in Export, is on for that chart. The rules live in `contract.ts`. A published page belongs to the chart: **Shared pages** (More actions, once a page is published) lists every page from every chart here, live or in recently deleted, each as a row with the chart's name, when it was last published, its link, **Copy link** and **Stop**. Stopping takes the page down first and only then forgets it, so a page the server could not be reached for stays in the list. Deleting a chart takes its page down too.

### Time on an action

How long something took, beside whether it got done. The tick stays the person's: time never ticks an action, and an action can be ticked with no time on it. Rules in `timer.ts`.

- **Three ways in, one button.** A row in Today has a timer button, quiet until the row is pointed at (always there on touch). It opens a menu: **Stopwatch** counts up until stopped; **Focus block** runs 25 minutes, then offers a 5-minute break; **Log time** writes in time spent away from the screen, 15 to 60 minutes or any length typed.
- **The slip on the dock** (`TimerSlip.svelte`). A running timer is a paper slip riding on the dock, between it and the toast, so it follows every view. The ring (`TimerRing.svelte`) is the action's pillar hue: a block empties over its length, the stopwatch goes round once an hour, and a break, which belongs to no pillar, draws in ink. The center dot is the goal's dot. The slip says what is being timed and the time, and its one control stops it; the rest of the slip goes to Today. On the row, a small ring stands in for the timer button, and stops it too. The tab title counts while it runs.
- **Ending.** Only whole minutes are logged, so under a minute logs nothing. Stopping by hand logs the minutes and the slip says so, with Tick it, then leaves on its own after 6 seconds (pointing at it holds it). A block that runs out chimes, closes its ring on a check, logs its full length, and waits for an answer: Take 5, or Tick it. A break that runs out offers Another 25 on the same action. A block that ended while the page was shut logs quietly the next time the page is open. Starting a timer while another runs logs the first, with a slip. Taking an action off today's list, by hand, by Bindu, on the board, or by an agent, does the same to its timer: what it ran is logged, and it stops.
- **Buttons under the words.** A slip that ended keeps its buttons on a row of their own under the sentence, lined up with it, so a long action name never squeezes them on a phone.
- **A stopwatch left on.** Stopping a stopwatch that ran over 3 hours logs nothing yet. It asks how long it really took, or not to log it.
- **Taking it off.** The row's timer button has Remove time entry, in the danger tone, once there is some. The calendar's day has a cross beside each stretch. Either leaves a slip with Undo.
- **Where it reads back.** The row says how long today ("25 min today"). The calendar's day lists the time logged under what was finished, and the month line adds it up. Bindu's progress page shows time per pillar this week, longest first, and its first note can say where most of the week's time went.
- **Time from a page.** A browser extension that watches a page (a video, a course, a practice site) posts what ran to the open tab (`ingest.ts`), and it lands on the shelf link's action or a pillar's routine, the way links are handed out. Each session carries an id, so a repeat is logged once. Time that ran **in the background** (audio while doing something else) is a passive session: the calendar's row says so, and it counts by the chart's passive weight (nothing, half, or full; half unless changed) wherever time is added up. The control sits under the day's time, and shows only once a day has some.
- **Storage.** Sessions live in the day log and point at an action by its id. Like ticks, they and the running timer reach your own devices and never another person.

### The chart on a phone

Under 900px View still shows the whole chart, all 81 cells, but only the pillars carry words: 81 lines are too many to read on a phone. On a grid under 480px wide an action or the goal is a dot (a done one faded), and a pillar keeps its name (`fitNames`). The names share one size, the largest all of them fit at between words, from 9.5px down to 7px, so they read as a set; a name too long for its cell even at 7px ends in an ellipsis, on the word too wide or on the last line that fits, instead of shrinking the rest. The dot is a whole number of pixels, so it stays round in every column. A tap writes: a cell opens its pillar's block in a dialog (`BlockSheet.svelte`), nine square fields at the editor's size whose words shrink to fit (`fitCellField`, shared with the editor), the one tapped already taken, Enter to the next cell, arrows that walk round the pillars, and Open in the editor for a line's kind, notes, and shelf. A pillar in the center block opens its own block; the goal opens the editor. Cells are squares everywhere: the grid, the sheet, and the editor.

The page fits a 360×740 phone without scrolling. The search field becomes a search button in the top bar, which opens the command palette (it finds lines in the chart too), and the progress ring rides the row of View and Edit, with the guide's ⓘ beside it.

### Starting a chart

The method is one sitting: a goal, eight pillars, eight actions under each, all 64 written, then a few revisions. What keeps that from being a wall is the order, not leaving most of it out. A new chart is written the way a mandala is drawn, from the center out, one ring and then one block at a time (`CenterOut.svelte`, rules in `start.ts`). In chart view, a chart with nothing on it is not a grid of placeholders and not 64 cells of someone else's plan. It is one sheet that asks one thing per page, with three marks for the rings.

- **The center.** The empty ring draws itself and the dot lands beside "What do you want to get done?", one field, and the presets as goals to borrow. The lede says what comes and that it usually takes one sitting, and that stopping anywhere is fine. Borrowing puts the preset's goal in the field to change, and nothing else yet. The other door is a chat app, through Bindu.
- **The first ring.** The goal sits in the middle of a 3×3 and the eight pillars around it are the fields. The ask is eight; a pillar is left empty only when its driver is not known yet. A borrowed goal deals its preset's pillars in, in pillar order. A ring the person has not touched follows a change of preset; one they have, never.
- **The outer ring.** A hub: the named pillars are cards with a count (2/8) or a check when the block is whole, and an unnamed one is a plus that turns back to the ring with its field ready. Start writing, then Next pillar, walks the blocks in pillar order, skipping whole ones. Each block is its own page with the pillar in the middle and the eight actions around it, the preset's dealt in when the pillar still has the preset's name. The lede carries the two tests and asks for a gap over filler. All pillars, without a change, puts lent lines away again, so the hub counts only what was kept.
- **The ending.** When no named block has an empty line, Finish plays it. A whole chart is Chart complete: all eight arcs, then the check, and the line that the 64 are not all done at once (Today asks for three a day). A chart with a pillar still unnamed is Chart drawn, and says where the hole is. See the chart is its only door. Lines are written quietly, so the last one does not also toast.

Done for now is on every page after the goal. It keeps every line and goes back to the grid, since every line is written to the chart as it is typed. A whole chart still gets its ending. While a chart has a goal and fewer than eight whole blocks, the row above the grid carries Keep building and the count, in place of the double-click hint. It reopens the sheet where the chart left off (a half-written block, else the outer ring), still lending from the preset whose pillar names the chart carries. `chart.inStartSheet` keeps the sheet up once the goal makes the chart non-empty. A whole chart arriving from elsewhere (a preset, a draft, an import) ends it.

While the sheet is up, the page holds only what can be used on it: no search field or search button, no stats card, no scale row, no Bindu face in the corner or the top bar (the sheet has the chat app door), and the dock's tabs step aside. On the first chart the hero steps aside too, since there is nothing to switch to, and How the method works moves into the sheet beside the marks. When the sheet closes, the dock's tabs land again. The full preset, all 64 at once, is still in the command palette and the editor's start buttons for anyone who asks for it.

### Sync devices

More actions, **Sync devices** (also in the command palette), opens one small dialog with three faces, each with one move (`SyncDialog.svelte`, rules in [docs/device-sync.md](docs/device-sync.md)). When a face swaps, the control that was pressed goes with it, so the dialog puts focus back (`refocus` on `Dialog`): on the new face's Enter-safe button when it has one, else on the panel. Sync now keeps focus too: while a round runs it is `aria-disabled`, not `disabled`.

- **Off.** What sync is, in one sentence. **Turn on sync** is the primary; **I have a sync key** turns the same dialog into a password field for the key, so a saved one fills in, with an eye to show it. A key that is not one says what a key looks like, under the field.
- **On.** The status in words, never a colored dot ("Synced 3 min ago", "Offline. It catches up when the connection is back."), with a refresh button beside it. The way in for another device is a **QR code** on its own card (`QrCode.svelte`): the phone's camera opens the link, which carries the key in the hash, straight into joining. The code stays dark on light paper in both themes (`--qr-ink`, `--qr-paper`), since many cameras cannot read it inverted. Under it, quiet: **Copy link**, **Save to passwords** (the key goes into the browser's password manager as "Mandala sync", so it follows the person to a new phone), and **Show the key**, which reveals it in five groups that wrap whole. The word key is never the first thing anyone reads. **Turn off here** asks once, taking the body of the dialog (**Turn off sync here?**, with the one sentence that matters: the charts stay, and what it takes to sync again), so the ask is in view on a phone and under the key alike; **Keep sync** takes focus, so Enter keeps it. Turning off closes the dialog, and the slip says so. When the server has no database, the dialog says so and offers nothing else.
- **Joining.** A link opens **Sync this device?**: the charts here and there end up on both, and nothing is removed. A device that holds only a blank chart drops it for the ones that arrive. Saying yes closes the dialog, so the slip for what arrived is seen.

The menu row carries a badge only while sync is on: On, Offline, or Not syncing. Sync is quiet otherwise. A slip says so only when the person would otherwise wonder what changed: "Added 2 charts from your other device.", or "Updated from your other device." when the open chart changed under them. Two cases lose something, so their slip carries Undo instead of asking first: **Changed on both devices** with the words kept, those of the side edited last (Undo takes the other's), and **Deleted on your other device** with the chart's name (Undo brings it back as a new chart, opens it, drops the blank chart that stood in for it if nothing was typed there, and says "Brought it back as a new chart."). A slip leaves after a few seconds, so each of these also keeps a copy under More actions, **Earlier versions** (`VersionsDialog.svelte`), a row in the menu while any copy is kept (with how many), since the copies stay 30 days after sync is turned off: rows by chart, each saying why it was kept, when, and the goal it had, with **Go back** (or **Bring back** for a chart no longer here). Going back keeps the chart as it is now, so it can be undone the same way.

### Feedback

- `Toast` sits above the dock as one paper slip (`bg-surface`, `--shadow-float`): the brand mark, an eyebrow for the verb, the chart name at title size. The mark sits centered on the eyebrow and name together. The name keeps to one line, so the slip hugs it: a wrapped name leaves the box at its widest, and the space beside the short line reads as a hole. A name longer than the slip (30rem, or the screen) ends in an ellipsis, and hovering shows all of it. A plain `chart.say()` is one sentence, past tense, no exclamation, and no eyebrow. One slip at a time. Repeating that action while it shows adds a sheet behind it and ticks `×n`, and restarts the clock. A different action fades this slip and lands the next one. Charts that do not share a name read as “2 charts”. A delete carries Undo (`Button` `soft`) and stays 8 seconds; everything else 5. The ring empties one pillar at a time. During the last stretch the pile closes and the slip lifts and fades. Hover fans the sheets behind it, pauses the clock, and brings a fading slip back. It never drops into the dock.
- `Notice` for persistent inline info with an optional small primary or soft `Button`.
- A chart on its way (the shared page, `ChartSkeleton.svelte`) is the paper it will land on: the same nine blocks and 81 cells in `--sunken`, the goal a shade deeper, and each pillar's center breathing in its own hue, clockwise from the top as on the ring (`breathe`, delayed by `PILLAR_ANGLES`). No spinner and no word. The chart lands with `pop-in`. Reduced motion holds the centers lit.

### Brand

- `BrandMark.svelte`: eight arcs + goal dot, same geometry as `ProgressRing.svelte`, both from `src/lib/chart/ring.ts` (`PILLAR_ANGLES`, `pillarArc`, `arcPath`). Arc positions are **spatial**: each pillar's arc sits at the angle where that pillar sits in the grid.
- App icons, `static/icon.svg`, and `logo.svg` are generated by `bun run gen:icons` (`scripts/generate-pwa-icons.ts`). The site icon is a public file, linked from `app.html`. Don't edit the outputs by hand; change the script or `ring.ts` and regenerate.

## Trying it

`/dev/demo` sets the app up to show one thing at a time, as a new chart: the moments that need a nearly full chart (the last line, a pillar finishing), a chart half written from the center (a borrowed goal, Keep building), days with history behind them (Today, the calendar across charts, the board, the weekly reflection), time on an action (a stopwatch, a focus block and its break, time logged afterwards, a stopwatch left on, a week of it), shelves of real links, a pile of copies to clear, and each of Bindu's pages. A screen one click away does not get a demo. A demo card lists what to do once it opens. The demos that need a chat app's reply carry a sample to copy. New motion gets a demo there, so it can be felt, not read.

## Layout

- Page max width 1180px, 28px gutters, safe-area aware.
- Hero: title + actions on the left, progress ring + stats on the right. The method lives in the guide (`MethodGuide`), opened from the ⓘ on the progress card, since it explains what those numbers count, from the start sheet on a first chart, and from the command palette. It is not in the row under the title, which holds the chart's views. Collapses to a stack at ≤900px.
- The chart uses container queries (`cqi`) so cell text scales with the grid, not the viewport.
- Modes: `view` (chart only, square), `edit` (panel only), `split` (side by side, desktop only), and `today`, `board`, `calendar`, which take the stage and keep the chart's hero card out of it.
- The page reserves 128px of bottom padding for the fixed dock (92px under 900px). Bindu floats at the bottom right on a desktop; under 900px its face sits in the top bar beside search instead, so the dock and the toast have the bottom row to themselves, centered. Its panel still rises from the bottom as a sheet.

## Voice and copy

Short, warm, plain. Sentence case everywhere. Say what happens, not what the feature is called ("Start from a preset", not "Presets"). Numbers as numerals ("3 of 8 actions"). No emoji in UI. An action is a sentence you could say, inside the character cap. A pillar is a short heading for one driver, like the presets' "Long runs" or "Practice tests".

**Bindu** is the chart helper ("Open Bindu"). The name is Sanskrit *bindu*, the center dot of a mandala; our center cell is the goal, so the helper is a person at that center, not a generic "AI" or "Coach" label. Bindu is a small notebook of pages, not a chat: a note and one next move on the first page, a door per job below it, and each job on a page of its own. Pages turn sideways and the panel eases to the new page's height. A thing that just became true (today set, a chart kept, lines added) takes the page as a moment: the ring draws the pillars it touched, then the words, then Done. Writing and reviewing lines go to the person's own chat app as a prompt, and the reply is pasted back. A person who turns AI on and connects their own provider can send the same prompt from the panel and skip the paste. An agent in the browser can propose lines, kinds and the week's note too, and they wait on their own page until the person keeps them. More actions turns the AI provider off, and turns Bindu off altogether. What Bindu does: [docs/bindu.md](docs/bindu.md).

## Accessibility

- Visible focus: `outline: 2px solid var(--ink); outline-offset: 2px` on buttons, menu items, dock tabs, and cells. Text fields use the `field-ink` halo instead of that outline.
- Hit targets ≥42px (≥44px on coarse pointers, handled by the `pointer: coarse` block; a small `Button` grows to 44px there through its own `coarse:` rule).
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
