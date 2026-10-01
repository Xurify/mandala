# Daily & Weekly Companion — Design

**Date:** 2026-09-30  
**Status:** Approved

## Overview

Four interlocking features that turn Mandala from a static chart into a daily and weekly driver:

1. **Today View** — a dedicated dock tab for daily focus selection and check-off
2. **Action Taxonomy** — tag actions as routine or milestone; attach a note/link
3. **Sunday Reflection** — a weekly 2-minute review dialog
4. **Harada 4P Onboarding** — a guided pillar-selection flow based on the 4-quadrant model

All features are local-first. No accounts, no external services. Data stays in `localStorage` alongside existing chart data.

---

## Section 1 — Data Model Extensions

All new fields are optional on `ChartData`. Existing charts load without migration.

### New types (`src/lib/chart/model.ts`)

```ts
export type ActionKind = 'routine' | 'milestone';

export type ActionMeta = {
  kind: ActionKind;
  pinned?: boolean;    // routines only: always surfaces first in Today
  done?: boolean;      // milestones only: completed
  doneAt?: string;     // milestones only: ISO date string of completion
  note?: string;       // URL or free text — the "open this" resource
};

export type DayLog = {
  focus: string[];     // action keys chosen as Today's focus (up to 3)
  checked: string[];   // action keys checked off that day
};

export type WeekReflection = {
  note: string;        // free-text reflection
  swapped: string[];   // action keys the user swapped out that week
};
```

### `ChartData` extensions

```ts
export type ChartData = {
  goal: string;
  pillars: string[];
  actions: string[][];
  // new optional fields
  meta?: Record<string, ActionMeta>;       // action key → metadata
  days?: Record<string, DayLog>;           // YYYY-MM-DD → day log
  weeks?: Record<string, WeekReflection>;  // Monday ISO date → reflection
};
```

### Compatibility

- All three fields are `?` optional — `emptyChart()` returns them absent.
- `parseChart` tolerates their presence or absence without changes.
- `saveNow`/`load` JSON-round-trip the whole object; no extra persistence logic needed.
- Storage impact: negligible (<50 KB even with 64 annotated actions + 365 day logs).

---

## Section 2 — Today View

### Dock integration

A **Today** tab is added to the left of Chart/Edit/Split. On mobile, Split is hidden, so Today fits in the same dock row without wrapping. Selecting Today renders a dedicated full-page panel replacing the grid/editor area.

### Morning state (no focus chosen yet)

- **Balance hint strip** — 8 colored dots (pillar hues), dimmed proportionally by neglect over the last 7 `DayLog` entries. Neglected pillars surface higher in the action list.
- **Action list** — all filled actions grouped by pillar, sorted so neglected pillars float up. Pinned routines appear at the top of their group with a subtle pin indicator.
- **Selection** — tap to select up to 3 actions as today's focus. A live counter (`0 / 3`) updates inline. Attempting a 4th selection is a no-op with a gentle shake animation.
- **Confirm** — becomes active with at least 1 selection. Saves the `DayLog.focus` for today.

### Active state (focus chosen)

- Clean checklist of today's 3 selected actions with large tap targets.
- If an action has a `note`, it renders as a secondary line — a tappable link if URL, plain hint text otherwise.
- Checking an action adds its key to `DayLog.checked` and triggers a brief visual response.
- Checking all actions triggers a quiet ring pulse (no confetti).
- An **Adjust** button returns to the picker to swap selections for the day.

### Note/link display

- Notes auto-detected as URLs open in a new tab.
- Plain-text notes render as a muted secondary line beneath the action title.
- The 9×9 grid shows a 3px dot at the bottom-right corner of cells with a note.

---

## Section 3 — Action Taxonomy

### Tagging in the SidePanel editor

Each of the 8 action rows gains:

1. A **kind toggle** — `Routine` / `Milestone` pill options (no selection = untagged, existing behavior).
2. A **pin toggle** (routines only) — appears inline once `Routine` is selected.
3. A **note field** — collapsed by default with a faint `+ note` affordance; expands on tap. Accepts a URL or free text.

### Visual indicators on the 9×9 grid

Indicators are only visible at sizes where they resolve clearly:

| State | Indicator |
|-------|-----------|
| Routine + pinned | 3px dot, top-left, pillar hue |
| Milestone, open | none (default) |
| Milestone, done | text in `--muted`, thin line-through |
| Note present | 3px dot, bottom-right, `--muted` |

### Untagged actions

No tag required. Untagged actions appear in Today, contribute to balance hints, and have no completion tracking.

---

## Section 4 — Sunday Weekly Reflection

### Trigger

Detected client-side: if today is Sunday, `weeks[weekStartDate]` doesn't exist yet, and the user has at least one `DayLog` in the last 7 days — a quiet notice appears in the Today tab. Dismissing it sets a `dismissed` flag on the week entry so it won't reappear until next Sunday.

### Reflection dialog

Opened from the Today notice. Three sections, all optional:

**1 — This week at a glance**  
Reuses `ProgressRing` geometry to show a 7-day pillar activity ring. Slices use their pillar hue at full opacity if active, dimmed if not. No numbers — just visual balance.

**2 — Milestones closed**  
Lists action keys marked `done` in the last 7 days, resolved to their text. If none: *"Nothing closed this week — that's fine."*

**3 — Tune up**  
Collapsed rows for each pillar with zero activity this week. Each row shows the pillar name and its actions. Tap any action to edit its text or note inline. Prompt: *"Feeling stuck? Swap it out."*

**Free-text note**  
A small textarea at the bottom. Saves to `WeekReflection.note`.

### Done

Saves the `WeekReflection` keyed by the Monday ISO date of the current week. Notice won't reappear until next Sunday.

---

## Section 5 — Guided Harada 4P Onboarding

### Trigger

Fires once: when `goal` transitions from empty to non-empty and fewer than 3 pillars are filled. A notice in the Edit tab: *"Want help choosing balanced pillars?"* Never auto-triggers again after dismissal or completion.

### The flow (Dialog, 3 steps)

**Step 1 — Framing**  
Displays the user's goal. One question: *"Who is this ultimately for?"* Options: mainly yourself / also others. Informs soft framing of quadrant prompts.

**Step 2 — 4-Quadrant Sheet**  
A 2×2 grid rendered inline:

| | Self | Others |
|---|---|---|
| **Tangible** | What skill will you build? What habit will anchor this? | What will people see you do differently? |
| **Intangible** | What belief needs to change for this to work? | Who do you want to show up for? |

Each quadrant has a small textarea. All optional.

**Step 3 — Pillar suggestions**  
Up to 4 editable pillar-name suggestions derived from the quadrant answers (simple extraction — first meaningful noun phrase or the raw answer trimmed). The remaining 4 pillars stay blank for the user to fill. Tap **Apply** to write suggestions to `ChartData.pillars`.

### Storage

Quadrant answers live in `sessionStorage` only — cleared after Apply. Not persisted to `localStorage`.

---

## Non-goals

- No streaks, no scores, no gamification.
- No server sync or account.
- No push notifications.
- Multiple links per action — kept as a single `note` field; revisit after real usage.
- Per-day notes — not stored; reflection lives at the week level only.
