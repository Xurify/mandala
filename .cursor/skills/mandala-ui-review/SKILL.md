---
name: mandala-ui-review
description: Reviews and verifies Mandala UI/UX against DESIGN.md and the Mandala method, researches reference patterns on Mobbin, and checks rendered output in both themes and on mobile. Use when the user asks for a design or UX review, says something looks or feels off, wants redesign ideas or inspiration, or before calling a UI change done.
---

# Mandala UI review

## When a change is "done": checklist

Run through every item; fix before reporting.

**Hierarchy**
- [ ] At most one `Button` `variant="primary"` visible per view or dialog
- [ ] Rare or destructive actions live in a menu, not the main surface
- [ ] The screen reads in one glance: `Eyebrow` → `font-serif` title → action

**System**
- [ ] Primitives from `src/lib/components/ui/`. Feature screens pass layout classes only. No raw hex/rgb, no component `<style>`
- [ ] No raw `<button>` or text field left on the browser face. Primitive, or `border-0` plus an explicit background. Two to four exclusive options are `SegmentedControl`
- [ ] Pillar hues used only for pillars. Chrome is paper and ink. Accent is only the primary button and the selected dock tab
- [ ] Separation by tone/shadow, not borders
- [ ] Pill radius on every pressable control
- [ ] `font-serif` only for titles, the goal, headings, and the wordmark. It is still Source Sans 3 (`--serif` aliases `--font`)

**The chart**
- [ ] Copy says goal, pillar, action. It does not rename them sub-goals, themes, or tasks in the same screen
- [ ] The grid reads as a map kept and reviewed, not a list to refill every morning
- [ ] Empty cells read as gaps, with a next step. Sample text can be ticked and is under the person’s control
- [ ] No life-wheel, streak, or “do all 64” control unless that was the ask. A week’s handful of actions stays off the grid
- [ ] One chart is one direction in the switcher, presets, and empty state

**States**
- [ ] Hover, active (`scale`), focus-visible, disabled all defined
- [ ] Empty state has a friendly line and a next step
- [ ] New motion uses `motion-safe:` so reduced motion skips it
- [ ] An arrival may land. A departure eases, longer, with no overshoot, and does not travel into the neighbor. A timed one starts before removal. Hover or focus can bring it back
- [ ] A replacement fades the old one. It does not pop
- [ ] A finished moment is its own layout
- [ ] A celebration plays when the moment happens, and does not replay on reload

**Themes and sizes**
- [ ] Light and dark both look intentional (new tokens exist in both dark blocks)
- [ ] ≤900px: nothing overflows, dock doesn't cover content, targets ≥44px
- [ ] Desktop split mode still balances

**Accessibility and copy**
- [ ] Icon-only controls have `aria-label`; correct `aria-pressed/selected/expanded`
- [ ] Contrast ≥4.5:1 (watch `--muted` on `--sunken`)
- [ ] Sentence case, short, no emoji, toasts in past tense

**Build**
- [ ] `bun run check` → 0 errors, 0 warnings; `bun run test` passes

## Visual verification

Use the `user-chrome-devtools` MCP when available (check its schema with GetDynamicTools first):

1. `list_pages` and reuse the user's dev server tab if one exists; otherwise start `bun run dev` and `new_page`.
2. `take_screenshot` at desktop width in split mode.
3. Switch theme via the overflow menu (or `evaluate_script`: `document.documentElement.dataset.theme = 'dark'`) and screenshot again.
4. `resize_page` to 390×844 and screenshot light + dark.
5. Tab through the changed area with `press_key` and confirm focus rings.

Show the screenshots to the user inline. If a screenshot times out, retry once on another existing tab before giving up and saying so.

## Researching patterns on Mobbin

Use the `user-Mobbin` MCP (`search_screens`, `search_flows`, `search_sections`; read schemas first).

- Stay in our field: habit, journaling, planning, self-improvement, focus. Proven references: Finch, Me+, Tiimo, Structured, stoic., Bloom, ABY Journal, Atoms, timespent, pliability, QUITTR, Liven.
- Reject patterns that fight the method: daily grid rewrites, eight life-area wheels, streak counters, two primary actions, pillar hues on chrome. Take structure (one action, quiet paper, a ring) and leave the rest.
- Search for the **pattern**, not the feature name: "onboarding goal setting", "progress ring", "bottom sheet picker", "empty state journal", "settings list".
- Pull 3–6 examples, then name what each does well in one line and what we'd take. Map every idea back to existing tokens/classes. If it needs a new token or component, say so explicitly.
- Never copy another app's hues or branding. Our color stays paper, ink, accent, and the eight pillar hues.
- When proposing directions, give the user 2–3 distinct options via AskQuestion, not a single take.

## Report format

```
Verdict: ship / fix first

Fix first
- <problem> → <concrete change> (file)

Nice to have
- …

Screenshots: <inline>
```
