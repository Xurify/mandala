# Bindu

**Date:** 2026-10-10
**Status:** "What it does today" describes the code. The order at the bottom shows what is built from the plan.

Bindu is the helper in the corner of the chart ("Talk to Bindu"). It plans the day and the week, reviews the chart, and answers from the chart and the method. It runs on rules, instantly, with nothing to download. Writing a chart goes through a prompt the person copies into any chat app and a reply they paste back. The name and its face come from the center dot of a mandala; see `DESIGN.md` → Voice and copy.

## Where it lives

| File | What it holds |
| --- | --- |
| `src/lib/chart/helper.ts` | Pure logic: intent patterns, review checks, today and week picks, chips, greetings, the fill and question prompts, `fillEdits` |
| `src/lib/chart/helper.svelte.ts` | `HelperStore` and the `helper` singleton: messages and cards. `send()` reads a pasted reply first, then asks `routeOf` where a message goes |
| `src/lib/chart/draft.ts` | The draft prompt and `parseDraftText`, which reads a pasted reply |
| `src/lib/chart/intents.ts` | The intent bank: example phrases per route, scored by overlap, for what the exact rules miss |
| `src/lib/components/Helper.svelte`, `HelperPanel.svelte`, `HelperFace.svelte` | The button, the panel, the face and its moods |
| `src/routes/dev/ai/+page.svelte` | The lab: the panel against a sandbox chart, the rules, the router and parser, the faces |

## What it does today

| Use case | How you get there | Code |
| --- | --- | --- |
| Greeting and next-step chips | Open the panel | `greetingFor`, `chipsFor` |
| Review the chart, or the draft card that is open ("Review this draft"): lines that can't be ticked, results you don't control, a line that repeats its pillar, duplicates, too long, one word, cut off mid-phrase. The verdict names what it checked. Each finding opens its cell. Asking again with nothing changed says so instead of repeating, and the chip steps aside after a clean result | "Review my chart" chip or phrase, "review it again" | `reviewChart`, `lineFault` |
| Plan this week: about 6 actions, one per pillar, the ones that waited longest first | "Plan this week" | `suggestWeek` |
| Pick today's three, with Swap on each pick (see "How picks work") | "Pick today's three" | `suggestToday`, `swap` |
| Insights from today, yesterday and this week, in the greeting and in "How am I doing?" | Opening the panel, "How am I doing?" | `insightsFor` |
| Fill the gaps: a prompt with the chart so far that asks only for the empty lines. The pasted reply becomes a card with just the empty cells, and Bindu confirms in the chart's words ("Added 8 actions to Health.") | "Fill the gaps" chip, "fill Health", "write the actions" | `fillPrompt`, `fillEdits`, `editWords` |
| Draft a whole chart: the goal, then only what is still missing (time a day, a date), then a prompt that carries those answers | "Start a chart" (panel chip, or the empty chart's button) | `splitGoal`, `followUpQuestion`, `draftPrompt` |
| Spot a new goal in a message ("I want to learn Spanish") and offer to start a chart for it. The rest of the message (a level, what is hard) is kept as answers | Typing it | `aimParts`, `followUpQuestion` |
| Paste a reply from another chat app. On a chart with the same goal it fills only the empty cells; otherwise it is a chart card that opens as a new chart | Pasting it | `parseDraftText`, `fillEdits` |
| How am I doing: ticks in the last 7 days, quiet pillars, streak, milestones | "How am I doing?", "which pillar have I been ignoring?" | `progressReport` |
| Help: the next move on this chart | "Help", "I'm stuck", "where do I start?" | `helpReply` |
| Thanks, hello, "I missed three days" | Typing it | `chatReply` |
| Answer method questions: what a pillar is, why 64, how many a day, two goals, a missed day, routines and milestones, privacy, where the grid comes from | Asking it | `methodAnswer` |
| What I know: the draft answers Bindu kept, each with Forget | "what do you know about me?" | `showFacts`, `forget` |
| Cancel, "not this one" | Typing it | `isCancellation`, `isCardRejection` |
| Anything else: says it answers from the chart and the method, and hands over a prompt with the chart and the question | Any message that matches nothing above | `askPrompt` |

On the 404 page, Bindu cycles through canned notes. It doesn't touch the store.

Nothing waits. Writing lines is the one job rules can't do, and a chat app the person already uses does it better than any model a browser can download. See "Why there is no model".

### How a message is routed

`send()` in `helper.svelte.ts` handles three things first:

1. A pasted reply (`parseDraftText`), shown in the conversation as "A pasted reply."
2. Mid-draft steps (the goal, then "anything that would change the plan"), and the new-chart offer.
3. "No" or "skip" while a card is open.

Then `routeOf(text, data)` in `helper.ts` decides, in this order:

4. `intentOf`: a pasted chart; thanks, hello, a missed day; questions that ask for a job ("What should I do today?", "Is my chart any good?", "How am I doing?"); any other question, which goes on; then cancel, today, week, review, fill, progress, draft.
5. `askRoute`: a bare ask for help, answered from the chart; a method question, answered from the written bank; a new goal (`aimOf`); a pillar name together with fill, finish or work on.
6. The intent bank (`intents.ts`), for what the rules above miss. Each route has example phrases. A message is scored against each by weighted word overlap, after shorthand ("gimme", "rn", "u") is folded and words are stemmed. A strong, clear match acts. A likely match asks, naming each reading ("Should I plan this week?"), with a chip per reading and an "Ask a chat app" chip, and the chip acts on the first message as sent. A weak match goes on.
7. Everything else gets the question prompt for a chat app.

`HelperStore` follows the route in one place (`#dispatch`), for a typed message and for a clarify chip alike. When a phrasing lands in the wrong place, add it to the bank as an example rather than writing a pattern. Cancel stays out of the bank: "how do I stop procrastinating" is not a request to stop.

### What Bindu remembers today

- Each chart has its own conversation. Switching charts swaps it. A draft that opens as a new chart takes its conversation along. Conversations are in memory only and are gone on reload.
- The draft answers (timeline, situation, focus, constraint) are saved on the chart as `brief`. A chart card from a pasted reply carries them. The brief syncs between your devices and stays out of share links. "What I know" shows it, and Forget removes a line.
- Insights shown in a greeting are logged, so the greeting doesn't repeat one: a day-bound insight (today, yesterday, comeback) waits a day, the rest wait three.

## Why there is no model

Until 2026-10-10 Bindu could download Qwen3 4B (2.3 GB, WebGPU, through web-llm) to write pillars and actions, rewrite flagged lines and answer open questions. It was taken out:

- **Cost.** A 2.3 GB download and WebGPU, for jobs a person does a few times per chart.
- **Quality.** By hand grade on the CPU, 59% of its lines passed: tickable, in the person's control, and sensible for them. Half its pillars were good. The rule checks passed lines like "Track progress" that a person would not.
- **Routing.** As a router it scored 48 of 66 to the rules' 64, and took seconds.
- **Facts.** Smaller models invented counts and facts. Chrome's built-in model only ran where WebGPU was off, and answered a Spanish brief in English.
- **What people already have.** The chat app on their phone writes better lines than any of these, so the prompt hand-off gives a better chart for no download.

What stayed is everything that was rules all along: routing, review, picks, insights, progress and the method answers. The measurements and the writer's design notes are in git history (`docs/bindu-models.md`, `docs/coach-writing.md`, `scripts/coach-eval/`), before the commit that removed them.

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
2. The best action in the pillar that has waited longest. The greeting names the same pillar.
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

## Where Bindu should go

Bindu answers from three sources: the chart, the log of what you picked and ticked, and the method. Writing lines goes to a chat app through a prompt.

Rules for the engine:

- **Every reply ends with a next step.** It never says "I am not sure." When it can't tell what you meant, it asks, with the two or three likeliest readings as chips.
- **Numbers come from the data.** Counts, streaks, and dates are computed, never written.
- **Say what it saw, then what to do.** "Home has been quiet for 12 days. Pick one Home action for today?"
- **Observations, not verdicts.** A missed action is evidence about the action, not about the person.
- **Varied wording.** Each reply has two to four phrasings, so it doesn't read like a form.
- **Instant.** Nothing waits on a download.

### Shape

Understand, decide, reply. `routeOf` reads a message (exact rules, then the intent bank, then a clarify question). A job or a written answer replies from the chart, the log and memory. Writing and open questions go out as a prompt, and the pasted reply comes back as a card. See "How a message is routed".

### Skills

| Group | Skill |
| --- | --- |
| Day and week | Today's three · plan the week · "I have 20 minutes" (one action that fits) · swap one pick · what's left today |
| Chart | Review · guided rewrite (below) · fill and draft through a prompt · new-chart offer |
| Progress | How am I doing · a pillar's story · streaks · the week in review |
| Insights | The catalog below, on request and one at a time on open |
| Method | Questions about the method, answered from a written bank |
| Memory | Remember this · what do you know about me · forget that |
| Conversation | Hi, thanks, help, what can you do, undo, cancel |
| Last resort | Open questions nothing else covers, as a prompt for a chat app |

### Insights

**Built** (`insightsFor`): today's picks done, yesterday's result, a comeback after 4+ quiet days, a streak of 3+, a pick that keeps not getting ticked (with an "Open it" chip), an action taken off the list twice this week, the pillar that has waited longest, time of day once there are 5 timed ticks in 2 weeks, last week's reflection note, follow-through by pillar over 4 weeks, and a routine ready to retire. The greeting leads with the strongest one not shown lately (`unseenInsights`). "How am I doing?" adds up to two after its counts. Most need only a day or two of history.

**Still to build:** the four below, and "Not useful" on an insight.

Everything here comes from data the chart already keeps: `days` (each day's picks and ticks), `meta` (routine or milestone, pinned, done, `doneAt`, note) and `weeks` (reflection notes and swaps). Tick times, picks taken off the list, and turned-down suggestions are logged from 2026-10-05 on.

Still to build, with what each would say:

| Insight | Fires when | Bindu says | Chip |
| --- | --- | --- | --- |
| Lopsided month | One pillar has half the ticks in 4 weeks | "Most of this month's ticks are Career. Health has one." | Plan the week around Health |
| Rhythm | 20+ ticks, and the weekdays are uneven | "Most of your ticks land Monday to Wednesday. Weekends are empty." | Pick one for Saturday |
| Pinned, untouched | A pin not picked by midweek | "*Book the exam* is pinned and hasn't come up yet." | Put it in today |
| Thin pillar | A pillar with fewer than 4 actions, or only milestones | "Money has 3 actions, all one-time. Add a routine?" | Fill Money |

These are how Bindu helps people see their own patterns: when they work, what they finish, what they keep postponing, what they said last week. Each one is their pattern, said back plainly.

Picking: each insight has a weight. Opening the panel shows at most one, in the greeting, and only when its weight is 30 or more. A day-bound insight waits a day before it can open the panel again, the rest wait three.

### Method answers

Built: 15 answers in `methodAnswer`, the ones people ask most. The plan is a bank of about 30 short answers, taken from `MethodGuide.svelte` and `.cursor/skills/mandala-method/`: what a pillar is, why 64, the two tests, how many actions a day, what to do after a missed week, one goal or two, when to change a pillar, routines against milestones, where the grid comes from. Each answer is three sentences at most and ends with a chip that does something to this chart. The bank lives in code, next to `helper.ts`.

### Guided rewrite

For a line review flags, Bindu asks for the missing pieces instead of rewriting the line. "When?" (after breakfast, at lunch, before bed, on Sunday) and "How much?" (10 minutes, 20 minutes, one page). The verb stays yours: "Read more books" becomes "Read 20 minutes before bed."

## Memory

Memory is something rules read.

- **What you did** is the chart's own log: `days`, `meta` and `weeks`. The insights read it.
- **What you turned down** is logged per day: picks taken off the list and suggestions declined, so Bindu doesn't offer them again soon. Insights shown in a greeting are logged too.
- **Facts about you** are the draft answers, kept on the chart as `brief` (timeline, where you stand, focus, a constraint). "What I know" lists them, each with Forget. The draft prompt carries them.
- **Next:** facts from chat ("mornings only", "bad knee"), confirmed with an Undo chip.

The conversation is display history, kept per chart.

## How we'll know

**Routing and fallthrough.** The rule side runs in `bun run test`, with floors as assertions, so a change that makes Bindu worse fails.

**Built so far:** `bindu-eval.ts` holds 50 lines and three routing sets:

- `routingSet`, 66 messages written after the rules by the same hand. The rules are tuned on it.
- `secondRoutingSet`, 46 messages written later for the model test. The rules were not tuned on it, but the intent bank was built from it and from `routingSet`.
- `unseenRoutingSet`, 51 messages written before the bank existed, including two that are not English. Nothing was built from it, but some rule fixes came after reading its misses, so its later scores are optimistic too.

| Router | Tuned | Second | Unseen |
| --- | --- | --- | --- |
| Rules alone | 66 of 66 | 20 of 46 | 14 of 51 |
| Rules and bank, first run | 65 of 66 | 43 of 46 | 20 of 51, the one clean measure |
| Rules and bank, now | 65 of 66 | 44 of 46, 1 more asked | 24 of 51, 7 more asked |

"Asked" means a clarify question whose chips include the right reading: one tap, not a wrong answer. On the unseen set, the rest gets the question prompt (19) or to fill instead of the named pillar (1, "write actions for Money", which fills Money either way). No open question in any set starts a job, except "give me three things", which is terse enough to read either way. The bank can't read the two messages that aren't English. Those get the question prompt.

Lines, first run, with three wrong labels corrected: 24 of 25 weak lines caught, 0 of 25 good lines flagged. "Become a morning person" still passes review, because "morning" reads as a time.

`bindu-eval.test.ts` holds the floors: 95% of the tuned set, 90% of the second, 45% of the unseen set right and 60% right or asked well, no new open question sent to a job, 90% of weak lines caught, no good line flagged. Still missing: messages written by someone else, which is the honest measure.

## Order

1. Messages written by someone else, for an honest routing score.
2. Guided rewrite.
3. The four insights still to build.
4. Facts from chat.
5. The rest of the method answers (15 of about 30).
