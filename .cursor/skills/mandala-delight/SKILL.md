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
- [recipes.md](recipes.md) for pointer drag

## 1. Change the concept, not the polish

When the user says "bland", "overwhelming", or "try something else", restyling won't fix it. Swap the concept.

1. Name the **verb** (choose, sort, review, commit, reflect, close).
2. Sketch three physical metaphors. Pick the one whose verbs are tactile (deal, draw, stamp, seal, drop).
3. Let that metaphor drive layout, motion, and copy together. A part that ignores it reads as decoration.
4. Ask the user which direction when two options are both strong (AskQuestion, 2–3 options).

A second copy of the chart, a control that hides the groups, and a sheet of everything have all failed here. Show every group, and one item of each at a time.

## 2. A moment gets its own layout

When something becomes true, swap the composition. The working list with a check on it is still the working list.

## 3. The picture is the data

Light only what changed. A circle uses `pillarArc` and `arcPath`, so it matches the grid. The count or the check sits in the center. The `aria-label` is the same sentence the page says.

## 4. Play it once, in order

Set a flag at the instant the moment happens, and clear it when the moment un-happens. A reload shows the settled picture and does not replay.

Order: the picture arrives, the parts draw in data order, the last stroke is the punchline, then the words. Reuse `seal-in`, `seal-draw`, `done-in`, and `pop-in` before adding a keyframe. Headings and paragraphs need `m-0`.

## 5. One sentence, then one door

Say what changed, in words. Then exactly one primary button. No second action, streak, or confetti on the climax.

## 6. Breadth visible, depth on demand

Show one representative of every group. The rest is one gesture away. The destination sits above the source. Only the next empty spot invites the action. Commitment reads as more color, not as a checkmark. Hitting the limit shakes the tray and says how to recover.

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
- A departure does not overshoot, and it does not reuse the arrival curve. Ease it, 500–700ms. A timed one starts before removal. See §12.
- New keyframes go in `src/app.css` as `--animate-*` and are used as `motion-safe:animate-*`.

## 9. Direct manipulation, with parity

Drag is the delight. Tap, buttons, and keys do the same job. Use pointer events in an `{@attach}`. HTML5 drag and drop misses touch and gives no ghost. The recipe is in [recipes.md](recipes.md).

Scope hit-testing to the component root, since two of the same component can be mounted. The `aria-live` line narrates the gesture. Escape inside a dialog must `stopPropagation` so the dialog stays open.

## 10. Copy

Use the metaphor's verbs. Sentence case, short, warm, no emoji, no exclamation. A status line says what to do next.

## 11. Try several, in place, then keep one

When the concept is still a guess, do not polish the first idea into the product. Build four to eight takes of the same moments and put them where the real component sits. Include the generic version (a plain pill, a stock card) so the one you keep has to beat it. `/dev/ui` is the lab. The takes that lose stay there.

Same data in every take: the repeat, the undo, the long name, the plain case, nothing showing. Play them in order, like a person would hit them. Then pick the one whose metaphor holds together. Ask the user when two of them are both strong.

## 12. Departures

Arrivals land. Departures leave. They are not the same animation run backwards.

- A leaving thing eases. It never bounces. A spring on the way out reads as a mistake.
- It does not travel into the thing beside it. The toast used to drop into the dock. That was the jarring part, not the fade.
- A clock starts the fade before the deadline, about 500–700ms early, so the end is visible while it happens. Pointing at it (hover or focus) pauses the clock and reverses the fade. The person pointing still wants it.
- A replacement fades the old one in place. The new one lands on its own. They do not cross.
- Reduced motion skips the travel and the early fade. Opacity may still ease.

## 13. Verify the feel

Screenshot each round: desktop dark, phone light (`emulate` `390x844x2,mobile,touch`), and the dialog variant. Restore emulation afterwards (`1280x800x1`, `colorScheme: auto`). `emulate` reloads the page, so reopen the surface before the screenshot.

The devtools `drag` tool fires HTML5 drag events, which pointer code never sees. Simulate the pointer sequence. See [recipes.md](recipes.md). Capture a mid-drag frame. Rotated layers get clipped inside scroll containers, so give the grid a little padding in a dialog.
