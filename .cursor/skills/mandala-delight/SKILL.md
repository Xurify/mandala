---
name: mandala-delight
description: >-
  Turns a correct but flat Mandala screen into a tactile one, and a finished
  state into a moment, without leaving the design system. Use when the user
  says a UI is bland, boring, cheap, overwhelming, or cluttered; asks for
  something creative, delightful, outstanding, or astonishing; asks for an
  experience, a ceremony, or a screen that feels finished; or when designing a
  picker, review, onboarding, empty state, toast, or a drag, flip, deal, stack,
  or expand interaction.
---

# Mandala delight

`mandala-component` makes a screen correct by following `DESIGN.md`. This skill makes it something people want to touch, and a finished moment something they remember. Those rules still apply. Finish with `mandala-ui-review`.

Read the closest one before building:

- `src/lib/components/FocusPicker.svelte` for a choice
- `src/lib/components/DaySeal.svelte` and the closed branch of `TodayView.svelte` for a moment that just became true
- `src/lib/components/HelperPanel.svelte` for a panel of pages that turn, and `HelperMoment.svelte` for a moment inside one
- `HelperPicks.svelte` for a dealt hand with a swap, `HelperReview.svelte` for a sweep that marks and a live list, `HelperWrite.svelte` for steps on a thread
- [recipes.md](recipes.md) for pointer drag, page turns, swaps, sweeps, and threads

## 1. Change the concept, not the polish

When the user says "bland", "overwhelming", or "try something else", restyling won't fix it. Swap the concept.

1. Name the **verb** (choose, sort, review, commit, reflect, close).
2. Sketch three physical metaphors. Pick the one whose verbs are tactile (deal, draw, stamp, seal, drop).
3. Let that metaphor drive layout, motion, and copy together. A part that ignores it reads as decoration.
4. Ask the user which direction when two options are both strong (AskQuestion, 2–3 options).

A second copy of the chart, a control that hides the groups, and a sheet of everything have all failed here. Show every group, and one item of each at a time.

A chat that routes typed requests to a handful of jobs is a menu with extra steps. Bindu was one, with an intent bank to guess what people meant. As a notebook of pages it does the same jobs with a tap, and the open questions go to a chat app that answers them better. When the jobs can be listed, give each a door.

## 2. A moment gets its own layout

When something becomes true, swap the composition. The working list with a check on it is still the working list.

## 3. The picture is the data

Light only what changed. A circle uses `pillarArc` and `arcPath`, so it matches the grid. The count or the check sits in the center. The `aria-label` is the same sentence the page says.

## 4. Play it once, in order

Set a flag at the instant the moment happens, and clear it when the moment un-happens. A reload shows the settled picture and does not replay.

Order: the picture arrives, the parts draw in data order, the last stroke is the punchline, then the words. Reuse `seal-in`, `seal-draw`, `done-in`, and `pop-in` before adding a keyframe. Headings and paragraphs need `m-0`.

## 5. One sentence, then one door

Say what changed, in words. Then exactly one primary button. No second action, streak, or confetti on the climax.

Pace a moment by its total length, not per part. Eight arcs at the step that suits two make the person wait three seconds for the button. Shrink the step as the count grows, so the words land at about 1.3 seconds whatever was touched.

When a moment says it, nothing else does. A toast that repeats the moment's sentence is the same news twice.

## 6. Breadth visible, depth on demand

Show one representative of every group. The rest is one gesture away. A door says what is behind it, counted from the data ("5 lines to tighten", "From Health, Words and Sleep"), and its icon can be the data too: the hues of the picks it would deal, the ring lit for pillars ticked this week. The destination sits above the source. Only the next empty spot invites the action. Commitment reads as more color, not as a checkmark. Hitting the limit shakes the tray and says how to recover.

## 7. Physicality

- [ ] Depth: `shadow-card` at rest, `shadow-float` when lifted or chosen
- [ ] Hover lift `can-hover:hover:-translate-y-1`; press `active:scale-[0.97]`
- [ ] Arrivals overshoot. A group arriving together staggers by index
- [ ] A lifted piece leaves a hole, so what is underneath shows through
- [ ] Every state, including "nothing left here", still belongs to the metaphor

## 8. Motion rules that bite

- Keyframes animate `transform`. Resting tilt, shift, and scale use the individual `rotate`, `translate`, and `scale` properties, so the two never overwrite each other.
- A keyframe `to` that omits `transform` keeps the element's own rotation.
- `animation-fill-mode: both` pins `opacity: 1`, so `opacity-0` loses to it. Hide animated elements with `invisible`.
- An inline `style:rotate` beats a `hover:` class. Drive per-item values through a custom property.
- Overshoot `cubic-bezier(0.34, 1.56, 0.64, 1)` for things landing. Expo-out `cubic-bezier(0.16, 1, 0.3, 1)` for UI. Arrivals stay between 150 and 420ms.
- A departure does not overshoot, and it does not reuse the arrival curve. Ease it, 500–700ms. A timed one starts before removal. See §13.
- New keyframes go in `src/app.css` as `--animate-*` and are used as `motion-safe:animate-*`. Check the motion table in `DESIGN.md` first.
- Two things that swap in place (two pages, two faces of a card) share one grid cell, `[grid-area:1/1]`, inside `{#key}`. The new one arrives while the old one leaves, and the layout never holds both stacked.
- A Svelte transition's parameters are read when it starts. An `out:` reads them at the moment of leaving, so `out:pageOut={{ direction: store.direction }}` gets the direction of the turn that is happening.
- A container that changes content eases its `height` to the new content, measured with a `ResizeObserver`. Turn the transition on a frame after mount, so the first paint does not grow from nothing.
- Something that opens out from nothing (a back button) animates `grid-template-columns` from `0fr` to `1fr`, with opacity. Clip it with `overflow-clip` and `overflow-clip-margin`, not `overflow-hidden`, or its focus ring is cut.
- A ring that closes in on a mark animates `outline-offset` and `outline-color`. An outline draws outside the element's own clip, so it reads on a cell a few pixels wide.
- A line that stops applying (a fixed finding) folds out: it fades first, then its height closes so the rest move up together.

## 9. Direct manipulation, with parity

Drag is the delight. Tap, buttons, and keys do the same job. Use pointer events in an `{@attach}`. HTML5 drag and drop misses touch and gives no ghost. The recipe is in [recipes.md](recipes.md).

Scope hit-testing to the component root, since two of the same component can be mounted. The `aria-live` line narrates the gesture. Escape inside a dialog must `stopPropagation` so the dialog stays open.

## 10. Focus survives the motion

- A `{#key}` that replaces a focused control destroys it, and focus drops to the body. Send focus to its replacement after `tick()`, found by its label.
- After a page turn, focus goes into the new page: its back button going in, the door it came from going back. Only move focus when it was already in the panel.
- Data that marks itself seen (an insight in a note) is held still while it is on screen. Recomputing it would swap the sentence mid-read.

## 11. Copy

Use the metaphor's verbs. Sentence case, short, warm, no emoji, no exclamation. A status line says what to do next.

## 12. Try several, in place, then keep one

When the concept is still a guess, do not polish the first idea into the product. Build four to eight takes of the same moments and put them where the real component sits. Include the generic version (a plain pill, a stock card) so the one you keep has to beat it. `/dev/ui` is the lab. The takes that lose stay there.

Same data in every take: the repeat, the undo, the long name, the plain case, nothing showing. Play them in order, like a person would hit them. Then pick the one whose metaphor holds together. Ask the user when two of them are both strong.

## 13. Departures

Arrivals land. Departures leave. They are not the same animation run backwards.

- A leaving thing eases. It never bounces. A spring on the way out reads as a mistake.
- It does not travel into the thing beside it. The toast used to drop into the dock. That was the jarring part, not the fade.
- A clock starts the fade before the deadline, about 500–700ms early, so the end is visible while it happens. Pointing at it (hover or focus) pauses the clock and reverses the fade. The person pointing still wants it.
- A replacement fades the old one in place. The new one lands on its own. They do not cross.
- Reduced motion skips the travel and the early fade. Opacity may still ease.

## 14. Verify the feel

Small things that only show in a screenshot:
- A pillar dot beside text is `pip`. `pillar-dot` is a pale tint and vanishes at 8px, worst in dark.
- Svelte trims a leading space inside an element, so `2<span> days</span>` reads "2days". Space with a margin.
- A chart of a quiet week should not be a tall empty box. Size it to the busiest day.
- A long list of cards hides its button below the fold. Make the action row sticky on the panel's paper.


Screenshot each round: desktop dark, phone light (`emulate` `390x844x2,mobile,touch`), and the dialog variant. Restore emulation afterwards (`1280x800x1`, `colorScheme: auto`). `emulate` reloads the page, so reopen the surface before the screenshot.

The devtools `drag` tool fires HTML5 drag events, which pointer code never sees. Simulate the pointer sequence. See [recipes.md](recipes.md). Capture a mid-drag frame. Rotated layers get clipped inside scroll containers, so give the grid a little padding in a dialog.
