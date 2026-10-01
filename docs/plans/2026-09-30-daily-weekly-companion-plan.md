# Implementation Plan — Daily & Weekly Companion

**Design doc:** `docs/plans/2026-09-30-daily-weekly-companion-design.md`  
**Target:** 0 errors, 0 warnings on `bun run check`; all tests pass.

---

## Phase 1 — Data model (`src/lib/chart/model.ts`)

**Goal:** Add the new types and update `ChartData`. Zero behavior change for existing charts.

### Steps

1. Add `ActionKind`, `ActionMeta`, `DayLog`, `WeekReflection` type exports.
2. Add `meta?`, `days?`, `weeks?` optional fields to `ChartData`.
3. Add helper functions:
   - `getMeta(data, key): ActionMeta | undefined`
   - `setMeta(data, key, meta: Partial<ActionMeta>): void` — merges, saves
   - `todayKey(): string` — returns `YYYY-MM-DD` for local date
   - `weekStartKey(date?: Date): string` — returns ISO date of the Monday of that week
   - `getDayLog(data, dateKey): DayLog` — returns existing or `{ focus: [], checked: [] }`
   - `getWeekReflection(data, weekKey): WeekReflection` — returns existing or `{ note: '', swapped: [] }`
   - `pillarActivityLast7(data): number[]` — returns 0–7 count of days each pillar had at least one check in the last 7 `DayLog` entries (used for balance hints)
4. Update `parseChart` to tolerate the new optional fields (they pass through `JSON.parse` already — just add them to the return value without strict validation).
5. Update `emptyChart` — no change needed (optional fields absent by default).

**Tests to add in `model.test.ts`:**
- `todayKey()` returns a valid `YYYY-MM-DD` string
- `weekStartKey()` returns the correct Monday
- `pillarActivityLast7` with mock day logs returns correct counts
- `getMeta` / `setMeta` round-trip correctly
- `parseChart` with and without the new fields

---

## Phase 2 — Store methods (`src/lib/chart/chart.svelte.ts`)

**Goal:** Expose action metadata, day log, and week reflection read/write through `ChartStore`.

### New state

```ts
viewMode: ViewMode = $state(...)  // extend union: 'view' | 'edit' | 'split' | 'today'
```

### New methods

- `setMeta(key, patch: Partial<ActionMeta>): void` — calls `model.setMeta`, `save()`
- `toggleDone(key): void` — toggles `meta.done`; sets `meta.doneAt` to today or clears it; `save()`
- `setFocus(dateKey, keys: string[]): void` — writes `days[dateKey].focus`; `save()`
- `toggleChecked(dateKey, key): void` — adds/removes from `days[dateKey].checked`; `save()`
- `saveWeekReflection(weekKey, patch: Partial<WeekReflection>): void` — merges; `save()`
- `dismissWeekNotice(weekKey): void` — sets a `dismissed: true` flag on the week entry; `save()`

### Derived state

```ts
todayLog = $derived(getDayLog(this.data, todayKey()))
weekReflectionDue = $derived(/* Sunday + has DayLog in last 7 days + not dismissed */)
```

### `setViewMode` update

Extend to accept `'today'`. Persist to `localStorage` like the others. Update `ChartApp` derived `effectiveViewMode` to not collapse `'today'` to `'edit'` on mobile.

---

## Phase 3 — Icon additions (`src/lib/components/Icon.svelte`)

Add paths for icons needed by the new UI. New icon names:

- `'sun-rise'` or reuse `'sun'` — not needed, use existing `'list'` for Today
- `'pin'` — for pinned routines
- `'link'` — for note/URL indicator  
- `'rotate-ccw'` or `'refresh'` — for "swap out" in reflection tune-up
- `'calendar'` — for Today dock tab

---

## Phase 4 — Today dock tab and view (`ChartApp.svelte` + new `TodayView.svelte`)

### `ChartApp.svelte` changes

1. Import `TodayView`.
2. Add `'today'` to dock:
   ```svelte
   <DockTab icon="calendar" selected={effectiveViewMode === 'today'} onclick={() => chart.setViewMode('today')}>
     Today
   </DockTab>
   ```
   Place it before `Chart`. On mobile, it replaces nothing — Split is already hidden.
3. In the main content area, add a branch:
   ```svelte
   {#if effectiveViewMode === 'today'}
     <TodayView />
   {/if}
   ```
   alongside the existing `chart` and `side` divs (which stay hidden when Today is active).

### `TodayView.svelte` (new file: `src/lib/components/TodayView.svelte`)

Two internal states: `picking` and `active`.

**Picking state** (no focus confirmed for today):

```
BalanceHintStrip        — 8 dots, pillar hues, dimmed by neglect
ActionPickerList        — grouped by pillar, sorted by neglect
  per action:
    - action text
    - note/link line (if meta.note)
    - selection indicator
FocusCounter            — "0 / 3"
ConfirmButton           — disabled until ≥1 selected
```

**Active state** (focus confirmed):

```
Checklist               — today's 3 actions, large tap targets
  per item:
    - checkbox (toggle via chart.toggleChecked)
    - action text
    - note/link line (if meta.note, tappable if URL)
AdjustButton            — returns to picking
AllDoneRing             — subtle ring pulse when all 3 checked (motion-safe only)
```

**Balance hint sorting:**  
Use `pillarActivityLast7(chart.data)` — pillars with lower scores float up.

**URL detection:**  
```ts
function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}
```

**Shake on 4th tap:**  
CSS `@keyframes shake` + a short `$state` flag that adds/removes the class.

---

## Phase 5 — Action metadata editor in `SidePanel.svelte`

For action cells (not goal, not pillar), add below the textarea:

```
[Routine] [Milestone]    ← pill toggle, only visible when cell has text
[Pin]                    ← appears only if kind === 'routine'
[+ note]                 ← collapsed; expands to an <input> on tap
```

Implementation:
- `kindOf(key): ActionKind | undefined` — reads `chart.data.meta?.[key]?.kind`
- Clicking a pill calls `chart.setMeta(key, { kind })`.
- Pin toggle calls `chart.setMeta(key, { pinned: !current })`.
- Note input calls `chart.setMeta(key, { note: value })` on `oninput`.
- The metadata UI only renders when `info(chart.sel, cellIndex).type === 'action'` and the action text is non-empty. Keeps the panel uncluttered for empty cells.

---

## Phase 6 — Grid indicators (`MandalaGrid.svelte`)

Read `chart.data.meta` in the cell render loop. For each action cell:

- If `meta?.pinned` → render a 3px dot at top-left (pillar hue color).
- If `meta?.done` → add a CSS class that sets `color: var(--muted)` and `text-decoration: line-through` on the cell text.
- If `meta?.note` → render a 3px dot at bottom-right (`--muted` color).

Dots only render when the cell container is large enough (use a `@container` size query or a simple pixel threshold via CSS).

---

## Phase 7 — Sunday Reflection (`WeeklyReflection.svelte`)

### Notice in `TodayView.svelte`

```svelte
{#if chart.weekReflectionDue}
  <Notice>
    Take a moment to reflect on this week.
    <Button onclick={() => reflectionOpen = true}>Open</Button>
  </Notice>
{/if}
```

### `WeeklyReflection.svelte` (new file: `src/lib/components/WeeklyReflection.svelte`)

A `Dialog` with three sections:

**Section 1 — 7-day ring**  
Reuse `ProgressRing` with a `scores` prop (0–7 per pillar from `pillarActivityLast7`). The ring already accepts per-pillar fill; map 0 → dimmed, >0 → full opacity. If `ProgressRing`'s API doesn't support this directly, pass a `mode='activity'` prop and handle it inside.

**Section 2 — Milestones closed**  
Derive from `chart.data.meta`: keys where `done === true` and `doneAt` is within the last 7 days. Resolve to text via `getByKey(chart.data, key)`. Show "Nothing closed this week — that's fine." if empty.

**Section 3 — Tune up**  
Pillars where `pillarActivityLast7[k] === 0`. Render a collapsed `<details>` per pillar with action rows. Each row has a small inline edit input (calls `chart.setText`). Prompt: *"Feeling stuck? Swap it out."*

**Note textarea** → calls `chart.saveWeekReflection(weekKey, { note: value })` on blur.

**Done button** → `chart.saveWeekReflection(weekKey, { ... })` + close dialog.

**Dismiss** → `chart.dismissWeekNotice(weekKey)` + close.

---

## Phase 8 — Harada 4P Onboarding (`HaradaOnboarding.svelte`)

### Trigger in `ChartApp.svelte`

```ts
const haradaDue = $derived(
  chart.data.goal.trim() !== '' &&
  chart.data.pillars.filter(p => p.trim()).length < 3 &&
  !sessionStorage.getItem('harada-done')
);
```

A `Notice` in the Edit tab panel area (not modal): *"Want help choosing balanced pillars?"*  
Button opens the dialog.

### `HaradaOnboarding.svelte` (new file)

A `Dialog` with a 3-step internal stepper (`step = $state(1)`).

**Step 1 — Framing**  
Display `chart.data.goal`. Two buttons: "Mainly for me" / "For me and others". Sets a local `forOthers: boolean`.

**Step 2 — 4-quadrant sheet**  
2×2 CSS grid. Four `<textarea>` elements, one per quadrant. Labels and seed prompts per the design. Stored in component-local `$state`, never persisted.

**Step 3 — Suggestions**  
Derive up to 4 pillar names from the quadrant answers:
```ts
function extractSuggestion(answer: string): string {
  return answer.trim().split(/[.!?\n]/)[0]?.trim().slice(0, 40) ?? '';
}
```
Render as 4 editable `<input>` fields (pre-filled). User can clear or retype. **Apply** button:
```ts
function apply(): void {
  suggestions.forEach((suggestion, index) => {
    if (suggestion.trim()) chart.setText(`p${index}`, suggestion);
  });
  sessionStorage.setItem('harada-done', '1');
  open = false;
  chart.say('Pillars updated.');
}
```

---

## Phase 9 — CSS additions (`src/app.css`)

New tokens needed (add to both light and dark blocks):

```css
/* Today view */
--color-today-ring-inactive: oklch(0.88 0.01 60); /* dimmed pillar dot */
```

New keyframe:
```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
```

No new semantic tokens beyond this — the existing `--surface`, `--sunken`, `--text`, `--muted`, `--line`, `--success` cover everything.

---

## Order of execution

```
Phase 1  model.ts types + helpers + tests
Phase 2  store methods + 'today' viewMode
Phase 3  Icon additions
Phase 4  TodayView (picking + active states)
Phase 5  SidePanel action metadata editor
Phase 6  MandalaGrid indicators
Phase 7  WeeklyReflection dialog
Phase 8  HaradaOnboarding dialog
Phase 9  CSS additions (woven in as needed per phase)
```

Run `bun run check` and `bun run test` after each phase before moving to the next.

---

## Files created / modified

| File | Change |
|------|--------|
| `src/lib/chart/model.ts` | New types + helpers |
| `src/lib/chart/model.test.ts` | New tests |
| `src/lib/chart/chart.svelte.ts` | New methods + `'today'` viewMode |
| `src/lib/components/Icon.svelte` | New icon paths |
| `src/lib/components/ChartApp.svelte` | Today tab + view branch + Harada notice |
| `src/lib/components/SidePanel.svelte` | Action metadata editor |
| `src/lib/components/MandalaGrid.svelte` | Cell indicator dots + done styling |
| `src/lib/components/TodayView.svelte` | **new** |
| `src/lib/components/WeeklyReflection.svelte` | **new** |
| `src/lib/components/HaradaOnboarding.svelte` | **new** |
| `src/app.css` | Shake keyframe; today ring token |
