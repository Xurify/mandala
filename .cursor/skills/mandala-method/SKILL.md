---
name: mandala-method
description: >-
  Coaches a Mandala chart (Mandalart, Open Window 64): one goal, eight pillars,
  64 actions. Use when starting, filling, reviewing, or tightening a chart;
  writing method copy or the draft prompt; or when the user mentions Mandala,
  Mandalart, Harada, Ohtani’s sheet, pillars, or actions. UI work stays in
  mandala-component.
---

# Mandala method

This app is one 9×9 chart: a goal, eight pillars, eight actions each. The chart is the map. The day’s list is a few actions pulled off it. Coach the map. Do not turn the grid into a daily rewrite, a life wheel, or a second planner.

Words in this repo: **goal**, **pillar**, **action**. Pillar `k` is 0–7, row-major around the center: top left, top, top right, left, right, bottom left, bottom, bottom right. Use the helpers in `src/lib/chart/model.ts`. A pillar is written beside the goal and copied into the center of its own block.

Draft length, when returning a chart the app can import: goal ≤ 80 characters, each pillar ≤ 32, each action ≤ 48. Shape:

```json
{"goal":"...","pillars":["..."],"actions":[["..."],["..."]]}
```

Exactly 8 pillars, exactly 8 actions each. No commentary around the JSON when the user is pasting into the draft dialog. The prompt that produces this lives in `src/lib/chart/draft.ts`. If you change the rules here, change that prompt so they stay the same.

History, Ohtani’s sheet, and source notes: [reference.md](reference.md).

## Before you fill anything

Ask only for what is missing, in one pass:

- Direction (the center)
- Timeline
- Current situation
- What they are focused on now
- A constraint that would make a generic plan wrong (body, money, time, a habit, a skill)

If they want a draft anyway, assume the gaps, say what you assumed, and still fill all 64.

One chart is one direction. A second real aim (another language, another project) is another chart. Do not merge two named aims into one pillar.

## How to start

1. **Center.** One direction. It can outlast any one project, and it can be vague. A result may live here (a draft slot, a grade, a finish). The grid is what makes it specific.
2. **3×3 first.** Erin’s rule: the 9×9 looks scary, so do not open on it. Write the goal in the middle of a 3×3, on paper or a board. Around it, the eight things that have to be true, or that this person has to do differently, for the goal to happen. Brain-dump more than eight, then keep the ones that would manifestly change the outcome. The first eight will be wrong. Iterate. Drop nice-to-haves. “Study 30 minutes a day” and “study 5 hours a week” are the same driver.
3. **Copy.** Each pillar goes into the center of its block.
4. **Actions.** Repeat the same question on that pillar. Eight facilitators of *that* behaviour, not eight restatements. Her grades example puts “study 30 minutes a day” in the inner ring, then “set up the desk as soon as I get home from class” in the outer one. Her fit example puts “gym, 30 minutes a day” in the inner ring, then “on the calendar every day” and “shoes by the door” in the outer one.
5. **Stop at 64.** The chart holds all 64. Do not rank them inside the chart, and do not hand back only the first week.

A single 3×3 is also the small form for working one pillar. It is not a daily rewrite of the full chart.

Matsumura’s blank-page order (cross first: down, left, up, right; then the corners from the bottom left) is a thinking trick when someone is stuck. It is not the order this app stores. Stored pillars stay row-major around the center.

## Two tests

Every pillar and every action passes both.

1. **Calendar.** It can be scheduled and ticked. Done, or not done. “Study geography for 20 minutes a day” passes. “Do better in geography” fails. “Ask at least one question when stuck” passes. “Ask more questions” fails, because it never ends.
2. **Control.** It is a behaviour this person can do. “Post two videos a day” passes. “Get 10 million views” fails. A finish time, a grade, or a follower count stays out of the pillars and actions. It may sit in the center.

If a named aim is a result, write the behaviour that produces it, and keep the aim recognizable.

Not every action is a daily habit. Harada’s grid mixes routines, practice, and one-time moves. A one-time move still has to be tickable (“book the exam”, “send the three letters”).

## What a strong chart looks like

- **Drivers, not a life wheel.** Health, career, and relationships appear only when they actually feed this direction. Do not paste the same eight life areas onto every goal.
- **Skill and the conditions around it.** Ohtani’s sheet is not eight pitching drills. Four pillars are the craft; the others are body, mind, character, and luck. Luck, on his sheet, is engineered goodwill (pick up trash, greet people, thank the driver), not a wish. Frances Frei teaches a character pillar and a karma pillar on every chart. Use that when those conditions would change the outcome. Do not force the labels if the person already has eight real drivers.
- **Topics are not actions.** A syllabus (Yoshie’s Japanese chart: grammar, particles, keigo) is a fair first pass at “what the subject contains”. Each outer cell still has to become a behaviour before it counts as an action.
- **Gaps stay visible.** An empty cell means the plan has a hole. Do not stuff it with “stay positive”, “work hard”, or “be successful”.
- **Distinct cells.** If two cells would be ticked by the same afternoon, they are one cell.

## How often

| When | What |
| --- | --- |
| Setup | Once, usually one sitting, then a few revisions. |
| Review | Weekly, monthly, or quarterly. Retire what is now a habit. Swap actions that are not happening. Move a pillar when the drivers of the direction have changed. |
| Day to day | Leave the grid alone. Pull a few actions onto a normal list. |

Erin, the moment the sheet is full: 64 actions overnight is how people freeze and do nothing. Pick the highest-leverage ones. Ideally one from each outer block. Prefer an action that feeds two pillars at once. **Five to eight** for week one. Week two, keep those and add another five to eight. About 8 to 12 weeks to take on the whole sheet. The same day, put that week’s actions on a calendar and a list you can tick. “Study 30 minutes” becomes “set up the desk when I get home.” The wave of motivation is the day you draw the chart. Use it to schedule, not to start all 64.

Her separate daily planner (dump the tasks, pick three, time-block, do the hardest first) is for a crowded day. It is not a second way to fill the grid.

The Harada Method is wider than this grid: self-analysis, a long-term goal form, Open Window 64, a routine check sheet, a daily journal. This app is the grid. Mention the other four when someone is asking how to live the plan. Do not build them into the 9×9.

## Review a chart that already exists

Walk the cells in this order and name the failures:

1. Center is one direction, and it is the only direction on the sheet.
2. Eight pillars are different drivers. No duplicate, no nice-to-have, no result the person cannot do.
3. Each action passes Calendar and Control, and is not a paraphrase of its pillar.
4. The outer blocks cover the craft and the conditions that make the craft possible.
5. The set is realistic for the situation they described.
6. Something on the sheet can be the next three days. If every cell is a six-month project, the map has no route.

Then rewrite the failing cells. Leave cells that already pass.

## Don’t

- Stop at the wish. “I want top grades” is the center, not a plan.
- Fill a cell with a nice-to-have.
- Write one habit twice.
- Write a cell you cannot tick.
- Put a result the person cannot control in a pillar or an action.
- Restate a pillar as its eight actions.
- Merge two named aims into one pillar.
- Use “work hard”, “be successful”, or “stay positive”.
- Return only the first week. The chart holds all 64.
- Redraw the grid every morning.
- Treat radial, spiral, or 5W1H “mandala” diagrams as this chart. This app is the 9×9 goal grid.
- Credit Ohtani, Harada, or a blog with inventing the grid. See [reference.md](reference.md).

## Copy

Sentence case, short, warm. Say what the cell should become. “This one can’t be ticked. Write the session, not the grade.”
