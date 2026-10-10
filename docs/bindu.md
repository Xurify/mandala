# Bindu

**Date:** 2026-10-10
**Status:** Describes the code. "Order" at the bottom is what is still planned.

Bindu is the helper in the corner of the chart. It reads three things: the chart, the log of what was picked and ticked, and the method. It runs on rules, instantly, on the device. Writing lines is the one job rules can't do, so Bindu writes a prompt for whatever chat app the person already uses, and reads the reply they paste back. The name and its face come from the center dot of a mandala; see `DESIGN.md` → Voice and copy.

## Where it lives

| File | What it holds |
| --- | --- |
| `src/lib/chart/helper.ts` | Pure rules: review (`lineFault`, `reviewChart`), picks, insights, progress, the first page (`noteFor`, `nextMove`, `doorsFor`), `fillEdits`, `askPrompt` |
| `src/lib/chart/helper.svelte.ts` | `HelperStore` and the `helper` singleton: the page in view, the picks on the table, the write round trip, a finished moment |
| `src/lib/chart/draft.ts` | The new-chart and fill prompts, and `parseDraftText`, which reads a pasted reply |
| `src/lib/components/Helper.svelte` | The launcher and the floating panel |
| `src/lib/components/HelperPanel.svelte` | The header, the page turns, the height that eases between pages, Escape and paste |
| `src/lib/components/HelperHome.svelte`, `HelperPicks.svelte`, `HelperProgress.svelte`, `HelperReview.svelte`, `HelperWrite.svelte`, `HelperMoment.svelte` | One page each |
| `src/lib/components/HelperFace.svelte`, `MiniChart.svelte` | The face and its moods, and the 9×9 chart drawn small |
| `src/routes/dev/ai/+page.svelte` | The lab: the panel against a sandbox chart, the rules, the parser, the faces |

## The pages

Bindu is a few pages, not a chat. Nothing is typed to it except a goal, a question for a chat app, or a pasted reply.

| Page | What it shows | What you can do |
| --- | --- | --- |
| First page | A note: the strongest insight, or what is missing, or the next step. One primary button for the next move (`nextMove`). A door per job, each with a line of what it would find (`doorsFor`) | Open a page. "Open it" on a note about one action |
| Today's three | Three picks, one per pillar, each saying why. A pick whose pillar has a shelf shows the tool it would use | Swap one, open the tool, put them on today, or "Not now" |
| This week | About six picks, one per pillar | Swap one, pin them, or "Not now" |
| How it is going | The last 7 days as a column per day and a pip per tick in the pillar's hue, then ticks, pillars and days in a row, then up to three insights | "Open it" on an insight about one action |
| Review | The chart drawn small, swept in reading order, with each weak line marked. The list of lines, each with why | Open a line in the chart. The list is live: a line fixed in the chart leaves it |
| Write with a chat app | Three steps on a thread: copy the prompt, paste it into any chat app, paste the reply here. Modes: a new chart, fill the gaps, or ask | Copy. Paste the reply, see what it would add, and keep it |

The next move is: start a chart when there is no goal, fill the gaps while any line is empty, pick today's three when today has no picks, and otherwise see how it is going.

A thing that just became true takes the page as a moment: today set, the week pinned, a chart kept, lines added. The ring draws the pillars it touched, then the words land, then one button, Done, closes the panel. Lines that fill the last gaps make the chart whole, so that moment says "Every line is written" and draws all eight; the chart's own toast stays quiet, since the moment said it.

The panel opens where it was left, so a person who went to paste a prompt comes back to the box for the reply. A moment does not wait for a reopen. A different chart starts on the first page.

## Writing with a chat app

- **New chart.** The prompt carries the goal, if one was typed, and asks the chat app to ask up to three questions first: time on a normal day, a date, where the person stands, anything to work around. Then it writes all 64 actions as JSON, with a `brief` of what the person said.
- **Fill the gaps.** The prompt carries the chart so far as JSON and the brief, and asks for every empty line, keeping the written ones word for word.
- **Ask.** The prompt carries the chart in plain text, the brief, and the question if one was typed. The answer stays in the chat app.

A pasted reply is read by `parseDraftText`, from the reply box or pasted anywhere in the panel. For this chart's goal it offers only the cells that are empty here (`fillEdits`); a written cell is never replaced. Any other goal opens as a new chart beside this one, or fills this one when it is empty. The brief is kept on the chart, syncs, and stays out of share links.

## Why there is no model

Until 2026-10-10 Bindu could download Qwen3 4B (2.3 GB, WebGPU, through web-llm) to write pillars and actions, rewrite flagged lines and answer open questions. It was taken out:

- **Cost.** A 2.3 GB download and WebGPU, for jobs a person does a few times per chart.
- **Quality.** By hand grade on the CPU, 59% of its lines passed: tickable, in the person's control, and sensible for them. Half its pillars were good. The rule checks passed lines like "Track progress" that a person would not.
- **Facts.** Smaller models invented counts and facts. Chrome's built-in model only ran where WebGPU was off, and answered a Spanish brief in English.
- **What people already have.** The chat app on their phone writes better lines than any of these, so the prompt hand-off gives a better chart for no download.

What stayed is what was rules all along: review, picks, insights and progress. The chat that routed typed messages to them went next: a page per job does the same with a tap, and a chat app answers open questions better than a bank of written replies. The measurements and the writer's design notes are in git history (`docs/bindu-models.md`, `docs/coach-writing.md`, `scripts/coach-eval/`), before the commit that removed them.

## How picks work

Each open action gets a score from the day logs (`pickHistory`, `suggestToday`):

- **Pillar wait:** days since the pillar last had a tick. A pick without a tick doesn't count as done.
- **Action wait:** days since the action was last ticked.
- **Pinned:** always first.
- **One-time step:** a small bonus for a milestone not done yet.
- **Penalties:** a pick that didn't get ticked, and an action taken off the list this week.
- **Left out entirely:** anything turned down or taken off today's list, anything already ticked today, and anything picked 3 times in 14 days without a tick. Unless it's pinned, the last one shows up as an insight instead.
- **Ties:** a seed from the date and the action settles them. Picks stay the same all day but change from day to day, so a fresh chart no longer always starts in the top-left.

The three are a mix, one per pillar while there are enough pillars:
1. Pins.
2. The best action in the pillar that has waited longest. The note on the first page names the same pillar.
3. One you ticked in the last 7 days, to keep it going.
4. The best of the rest.

Each pick says why it was chosen. "Swap" replaces one pick and records the old one as turned down today. "Not now" turns down all of them. Asking again then gives different picks. On a week plan, Swap and "Not now" don't touch today.

Routines are habits that are always on, so they are never picked.

### What the day log keeps

`DayLog` holds the day's `focus` (picks) and `checked` (ticks), plus:
- `at`: the time of each tick, "HH:MM".
- `dropped`: picks you took off the list that day. When Bindu's picks replace the list, the old ones are not counted.
- `declined`: Bindu's suggestions turned down that day.
- `shown`: insights Bindu opened with that day.

All of it syncs with the chart.

## Insights

**Built** (`insightsFor`): a repeat tool opened on 10 of the last 14 days ("Know it by now?"), today's picks done, yesterday's result, a comeback after 4+ quiet days, a streak of 3+, a pick that keeps not getting ticked (with "Open it"), an action taken off the list twice this week, the pillar that has waited longest, time of day once there are 5 timed ticks in 2 weeks, last week's reflection note, follow-through by pillar over 4 weeks, and a routine ready to retire. The note on the first page is the strongest one not shown lately (`unseenInsights`), held still while the panel is open. "How it is going" lists up to three under its counts. Most need only a day or two of history.

**Still to build:** the four below, and "Not useful" on an insight.

Everything here comes from data the chart already keeps: `days` (each day's picks and ticks), `meta` (routine or milestone, pinned, done, `doneAt`, note) and `weeks` (reflection notes and swaps). Tick times, picks taken off the list, and turned-down suggestions are logged from 2026-10-05 on.

Still to build, with what each would say:

| Insight | Fires when | Bindu says | Next step |
| --- | --- | --- | --- |
| Lopsided month | One pillar has half the ticks in 4 weeks | "Most of this month's ticks are Career. Health has one." | Plan the week around Health |
| Rhythm | 20+ ticks, and the weekdays are uneven | "Most of your ticks land Monday to Wednesday. Weekends are empty." | Pick one for Saturday |
| Pinned, untouched | A pin not picked by midweek | "*Book the exam* is pinned and hasn't come up yet." | Put it in today |
| Thin pillar | A pillar with fewer than 4 actions, or only milestones | "Money has 3 actions, all one-time. Add a routine?" | Fill Money |

These are how Bindu helps people see their own patterns: when they work, what they finish, what they keep postponing, what they said last week. Each one is their pattern, said back plainly.

Picking: each insight has a weight. Opening the panel shows at most one, as the note, and only when its weight is 30 or more. A day-bound insight waits a day before it can open the panel again, the rest wait three.

## How we'll know

`bindu-eval.ts` holds 50 labeled lines, and `bindu-eval.test.ts` holds the floor: 90% of weak lines caught, no good line flagged. First run, with three wrong labels corrected: 24 of 25 weak lines caught, 0 of 25 good lines flagged. "Become a morning person" still passes review, because "morning" reads as a time. Still missing: lines written by someone who isn't tuning the rules, which is the honest measure.

## Order

1. Lines written by someone else, for an honest review score.
2. Guided rewrite: for a line review flags, ask "When?" and "How much?" with one-tap answers, and keep the person's verb.
3. The four insights still to build.
4. "Not useful" on an insight.
