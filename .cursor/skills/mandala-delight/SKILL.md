---
name: mandala-delight
description: Turns a correct but flat Mandala screen into a tactile, playful one without leaving the design system, by choosing a physical metaphor, then adding depth, motion, direct manipulation, and game-verb copy. Use when the user says a UI is bland, boring, overwhelming, cluttered, not fun, or asks for something creative, delightful, outstanding, or astonishing; when designing a new interactive surface (pickers, reviews, onboarding, empty states); or when adding drag, flip, deal, stack, or expand interactions.
---

# Mandala delight

`mandala-component` makes a screen correct. This skill makes it something people want to touch. Its rules still apply: tokens only, one primary button, pillar hues mean pillars, `motion-safe:`, `bun run check` clean. Finish with `mandala-ui-review`.

Canonical example: `src/lib/components/FocusPicker.svelte` (the "pick three for today" card deck). Read it before building something similar.

## 1. Change the concept, not the polish

When the user says "bland", "overwhelming", or "try something else", restyling won't fix it. Swap the concept.

The focus picker took five rounds:

| Round | Concept | Why it failed or worked |
|---|---|---|
| 1 | A 3×3 grid around the goal | Looked like a second mandala and repeated the chart |
| 2 | Accordion of pillars | Hid the pillars, so the user lost sight of goals |
| 3 | Tabs plus a list | Correct but forgettable |
| 4 | A sheet with all 64 actions | Everything visible, which overwhelmed the user |
| 5 | Eight decks, one card face up, deal three into slots | Loved: all pillars present, one choice each, tactile |

Workflow:

1. Name the **verb** of the screen (choose, sort, review, commit, reflect).
2. Sketch three physical metaphors for that verb, for example cards and a hand, a shelf, a stamp, a seal, or a tray. Pick the one whose verbs are tactile (deal, draw, flip, stack, swap, drop).
3. Let the metaphor drive layout, motion, and copy together. If one part ignores the metaphor, it reads as decoration.
4. Ask the user which direction when two options are both strong (AskQuestion, 2–3 options).

## 2. Breadth visible, depth on demand

"Show everything" and "hide things" both fail. Show **one representative of every group** and make the rest one gesture away.

- Each of the eight pillars shows a face-up top card with a `1 / 8` counter. The other cards are a flip (next arrow, ArrowLeft/ArrowRight) or a spread (expand) away.
- Stacked layers behind the top card say "there's more" without words. Fan them with small opposite rotations (`rotate-[3deg]`, `rotate-[-4deg]`), not offsets.
- An expanded group takes a full row (`col-span-full`). Use `grid-flow-dense` on the parent so the other groups reflow instead of leaving holes.

## 3. Put the destination on top

The outcome sits above the source: three numbered slots, then the decks.

- Empty slots invite the action: a big muted numeral and one line of copy on the next free slot only ("Drag a card here", then "Drag another").
- Filled slots are a **promotion** in saturation. A card in the deck uses `pillar-action` (tint), the same card in a slot uses `pillar-cell` (strong), and "in your day" inside a spread uses `bg-ink`. Commitment reads as more color, not as a checkmark.
- A tiny static tilt per slot (`SLOT_TILT = [-1.6, 1.1, -0.6]` degrees, applied through `--tilt`) makes the slots look placed by hand. Hover straightens the tilt.

## 4. Physicality checklist

- [ ] Depth: `shadow-card` at rest, `shadow-float` when lifted, hovered, or chosen
- [ ] Hover lift `can-hover:hover:-translate-y-1`; press `active:scale-[0.97]`
- [ ] Arrivals overshoot (`animate-deal-in`). Flips turn (`animate-card-in`). Spreads stagger (`animation-delay: index * 35ms`)
- [ ] A lifted card leaves a hole in its deck (`invisible`), so the layers below show through
- [ ] Hitting the limit shakes the tray and says how to fix it ("Drop a card on one to swap it"), not just "no"
- [ ] Every state, including the empty deck ("All in your day"), still looks like part of the game

## 5. Motion rules that bite

- Animation keyframes use `transform`. Resting states use the individual `rotate`, `translate`, and `scale` properties (which are what Tailwind v4 `rotate-*`, `translate-*`, and `scale-*` set), so the two never overwrite each other.
- If a keyframe's `to` omits `transform`, the element's own static rotation survives the animation (`deal-in` does this).
- `animation-fill-mode: both` pins `opacity: 1`, so `opacity-0` loses to it. Hide animated elements with `invisible`.
- An inline `style:rotate` beats `hover:` classes. Drive per-item values through a custom property (`style:--tilt` plus `rotate-[var(--tilt)]`).
- Easing: overshoot `cubic-bezier(0.34, 1.56, 0.64, 1)` for things landing, expo-out `cubic-bezier(0.16, 1, 0.3, 1)` for UI. Durations stay between 150 and 420ms.
- New keyframes go in `src/app.css` as `--animate-*` theme tokens. Always use them as `motion-safe:animate-*`.

## 6. Direct manipulation, with parity

Drag is the delight. Tap, buttons, and keys are the contract. Every gesture also has a non-gesture path.

- Use pointer events in an `{@attach}`. Don't use HTML5 drag and drop: it doesn't work on touch and gives no control over the ghost. Recipe: [recipes.md](recipes.md).
- Mouse starts dragging after 6px of movement. Touch needs a 220ms still press, so a swipe keeps scrolling the page.
- While dragging, a fixed, `pointer-events-none` ghost follows the pointer and tilts. Over a target it straightens and shrinks slightly, as if about to land.
- Find the drop target with `elementFromPoint` plus `closest('[data-drop]')`, scoped to the component root (two pickers can be mounted at once).
- Drop rules: an empty slot fills the next free slot. An occupied slot swaps out its card. A drop anywhere else springs the ghost back home.
- The `aria-live` status line narrates the drag ("Drop it into your day." or "Drop it on a card to swap.").
- Swallow the click that follows a drag. Add `select-none [-webkit-touch-callout:none]` to drag sources.
- Expand moves focus to the first card. Collapse returns focus to the expand control. Escape collapses, and it must `stopPropagation` so a surrounding `Dialog` stays open.

## 7. Copy is part of the game

Use the metaphor's verbs in sentence case, kept short and warm: "Deal me three", "Deal the rest", "Stack", "Swap", "Drop it here", "That's your day." Status lines say what to do next, never what went wrong. Don't use exclamation marks or emoji.

## 8. Verify the feel, not only the look

- Screenshot every round: desktop in dark, phone (`emulate` `390x844x2,mobile,touch`) in light, and the inset or dialog variant. Restore the emulation afterwards (`1280x800x1`, `colorScheme: auto`).
- `emulate` reloads the page. Reopen the surface before you screenshot.
- The devtools `drag` tool fires HTML5 drag events, which never reach pointer-event code. Simulate the pointer sequence instead. See [recipes.md](recipes.md).
- Capture a mid-drag frame: ghost, hole, and highlighted landing slot. The middle of the drag is where most bugs show up.
- Check that rotated layers aren't clipped inside scroll containers. Give the grid a little padding when it sits inside a dialog (`inset && 'px-2'`).
