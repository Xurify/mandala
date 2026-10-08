# Bindu

**Date:** 2026-10-05
**Status:** "What it does today" describes the code. The order at the bottom shows what is built from the plan.

Bindu is the helper in the corner of the chart ("Talk to Bindu"). It plans the day and the week, reviews the chart, and writes pillars and actions. The name and its face come from the center dot of a mandala; see `DESIGN.md` → Voice and copy.

## Where it lives

| File | What it holds |
| --- | --- |
| `src/lib/chart/helper.ts` | Pure logic: intent patterns, review checks, today and week picks, chips, greetings, every prompt the model sees |
| `src/lib/chart/helper.svelte.ts` | `HelperStore` and the `helper` singleton: messages, cards, the download consent. `send()` asks `routeOf` where a message goes |
| `src/lib/chart/intents.ts` | The intent bank: example phrases per route, scored by overlap, for what the exact rules miss |
| `src/lib/chart/coach.browser.ts` | Every model job, with retries and line checks. Picks the provider and the model for each call |
| `src/lib/chart/coach-provider.ts` | The provider interface, `chooseEngine`, and the message split for the Prompt API |
| `src/lib/chart/coach-webllm.ts`, `coach.worker.ts` | Downloaded weights on WebGPU through web-llm, in a worker |
| `src/lib/chart/coach-builtin.ts` | The browser's own model through Chrome's Prompt API (`LanguageModel`), when it exists |
| `src/lib/chart/coach-model.ts` | Which model loads, the lab's candidates, and the download size on the consent card |
| `src/lib/chart/coach-score.ts` | The phrase lists and copy checks that review and the writer share |
| `src/lib/components/Helper.svelte`, `HelperPanel.svelte`, `HelperFace.svelte` | The button, the panel, the face and its moods |
| `src/routes/dev/ai/+page.svelte` | The lab: every job against a sandbox chart, the model picker, the holdout run |
| `docs/coach-writing.md` | Why the writer is built the way it is, and the holdout results |
| `docs/bindu-models.md`, `scripts/coach-eval/` | Every model and rare case measured on the CPU, and the harness that reruns it |

## What it does today

| Use case | How you get there | Uses the model | Code |
| --- | --- | --- | --- |
| Greeting and next-step chips | Open the panel | No | `greetingFor`, `chipsFor` |
| Review the chart, or the draft card that is open ("Review this draft"): lines that can't be ticked, results you don't control, a line that repeats its pillar, duplicates, too long, one word, cut off mid-phrase. The verdict names what it checked. Asking again with nothing changed says so instead of repeating, and the chip steps aside after a clean result | "Review my chart" chip or phrase, "review it again" | No | `reviewChart`, `lineFault` |
| Rewrite the lines a review flagged. For a draft, the rewrites change the draft, not the chart behind it | "Rewrite them" on the findings card | Yes | `rewriteCell` |
| Plan this week: about 6 actions, one per pillar, the ones that waited longest first | "Plan this week" | No | `suggestWeek` |
| Pick today's three, with Swap on each pick (see "How picks work") | "Pick today's three" | No | `suggestToday`, `swap` |
| Insights from today, yesterday and this week, in the greeting and in "How am I doing?" | Opening the panel, "How am I doing?" | No | `insightsFor` |
| Fill empty pillars, the empty actions of one pillar, or every pillar with gaps at once. The card names each pillar once, says "Add to chart" or "Replace them", and Bindu confirms in the chart's words ("Added 8 actions to Health.") | "Suggest pillars", "Fill Health", "Fill all 3 pillars", "Fill the whole chart", "Write all the actions", or naming a pillar with fill or write | Yes | `fillPlan`, `actionGaps`, `fillActions`, `groupEdits`, `editWords` |
| Draft a whole chart: the goal, then only what is still missing (time a day, a date), then goal and pillars, then 64 actions | "Start a chart" (panel chip, or the empty chart's button) | Yes | `splitGoal`, `followUpQuestion`, `proposePillars`, `fillDraftActions` |
| Spot a new goal in a message ("I want to learn Spanish") and offer to sketch it. The rest of the message (a level, what is hard) is kept for the pillars and the brief. The sketch card writes the actions or tries other pillars, and has no "Use" until it has actions | Typing it | Detection no, sketch yes | `aimParts`, `followUpQuestion` |
| Paste a reply from another chat app and get a chart card | Pasting it | No | `parseDraftText` |
| Copy the draft prompt for another chat app | Declining the download, or no WebGPU | No | `draftPrompt` |
| How am I doing: ticks in the last 7 days, quiet pillars, streak, milestones | "How am I doing?", "which pillar have I been ignoring?" | No | `progressReport` |
| Help: the next move on this chart | "Help", "I'm stuck", "where do I start?" | No | `helpReply` |
| Thanks, hello, "I missed three days" | Typing it | No | `chatReply` |
| Answer method questions: what a pillar is, why 64, how many a day, two goals, a missed day, routines and milestones, privacy, where the grid comes from | Asking it | No | `methodAnswer` |
| What I know: the draft answers Bindu kept, each with Forget | "what do you know about me?" | No | `showFacts`, `forget` |
| Cancel, "not this one" | Typing it | No | `isCancellation`, `isCardRejection` |
| Answer anything else | Any message that matches nothing above | Yes | `askMessages`, `answer` |
| Stop a running job | "Stop Bindu" in the command palette | No | `interruptCoach` |

On the 404 page, Bindu cycles through canned notes. It doesn't touch the store.

Most of the jobs need no model. They run instantly, without a download, and in browsers without WebGPU. Draft, fill and rewrite are the jobs that need it, and they suit a small model: short output, one job, a rule check on every line, and retries. See "Providers".

### How a message is routed

`send()` in `helper.svelte.ts` handles two things first:

1. Mid-draft steps (the goal, then "anything that would change the plan"), and the new-chart offer.
2. "No" or "skip" while a card is open.

Then `routeOf(text, data)` in `helper.ts` decides, in this order:

3. `intentOf`: a pasted chart; thanks, hello, a missed day; questions that ask for a job ("What should I do today?", "Is my chart any good?", "How am I doing?"); any other question, which goes on; then cancel, today, week, review, fill, progress, draft.
4. `askRoute`: a bare ask for help, answered from the chart; a method question, answered from the written bank; a new goal (`aimOf`); a pillar name together with fill, finish or work on.
5. The intent bank (`intents.ts`), for what the rules above miss. Each route has example phrases. A message is scored against each by weighted word overlap, after shorthand ("gimme", "rn", "u") is folded and words are stemmed. A strong, clear match acts. A likely match asks, naming each reading ("Should I plan this week?"), with a chip per reading and a "Just answer" chip, and the chip acts on the first message as sent. A weak match goes on.
6. Everything else goes to the model. When nothing can run a model here, the reply says so. When the model still has to download, the reply is the download card.

`HelperStore` follows the route in one place (`#dispatch`), for a typed message and for a clarify chip alike. When a phrasing lands in the wrong place, add it to the bank as an example rather than writing a pattern. Cancel stays out of the bank: "how do I stop procrastinating" is not a request to stop.

### What Bindu remembers today

- Each chart has its own conversation. Switching charts swaps it, and a job still running for the old chart stops. A draft that opens as a new chart takes its conversation along. Conversations are in memory only and are gone on reload.
- Open chat gets the last 8 messages, without greetings and status lines. A card goes in as one line: what was offered, and whether it was used or skipped.
- Open chat also gets the chart: each pillar with its action count and how often it was used in the last 7 days, the actions of the pillar the question names (or the selected one), and today's picks.
- The draft answers (timeline, situation, focus, constraint) are saved on the chart as `brief`. Fills, rewrites and answers get them as one line. The brief syncs between your devices and stays out of share links. "What I know" shows it, and Forget removes a line.
- Insights shown in a greeting are logged, so the greeting doesn't repeat one: a day-bound insight (today, yesterday, comeback) waits a day, the rest wait three.
- The models the person agreed to download are stored as `mandala-helper-model`, comma-separated. An older value holds one id and reads the same. A model that fails to load is taken off the list.

## While Bindu works

Nothing a person waits on leaves blank space.

| Wait | What shows |
| --- | --- |
| Download, loading, warming up | The header bar with the size and percent, and the download card's line |
| Naming pillars, filling, rewriting | The step ("Naming the pillars", "Writing actions for Words") and the card on its way in outline, until the real one replaces it |
| Writing a chart's actions | The chart card with a small 9×9 map that fills in pillar by pillar, the count, and the step |
| Filling several pillars | One card that grows as each pillar lands ("2 of 7 pillars so far"), then becomes the card to add |
| An open question | Moving dots where the answer will appear |

While the conversation names the step, the header only says "Working", so the same news is not said twice. `HelperStore.pending` says which outline to hold: a chart, cells, or a reply.

## Providers

A provider runs the model jobs. Every job uses the same model.

| Provider | When | Download |
| --- | --- | --- |
| web-llm, Qwen3 4B | WebGPU works | 2.3 GB, once |
| Built-in (`LanguageModel`), ready | No WebGPU, and the browser has its model | None |
| Built-in, still to fetch | No WebGPU, and the browser can fetch its model | The browser's, shared by every site |

`chooseEngine` in `coach-provider.ts` holds this order. The built-in model comes second because it has only been tested through a stand-in (`docs/bindu-models.md`). A built-in model that fails to load is skipped for the rest of the session. It gets the same messages, line checks and retries as web-llm. The Prompt API has no output cap, so the reply is cut at about four characters a token. When `LanguageModel.params()` is missing, the browser's own sampling applies, and the writer's three temperatures become three tries at the same one.

`needFor()` decides the provider and model before a job runs, and the job then runs on exactly that. The download card shows what `needFor` returned. Opening the panel warms the model only when that costs no new download: one already agreed to, or the browser's own when it is there.

A smaller model for open questions was tried and taken out. The run in `docs/bindu-models.md` found Qwen3 1.7B invented counts and facts, and wrote weaker lines.

The lab (`/dev/ai`) can force either provider, and its holdout labels each row with what actually ran. `scripts/coach-eval` runs the same coach code against GGUF models on the CPU.

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

## What the probe found

A quick check on 2026-10-05 ran 25 everyday messages and 40 lines through the current rules. The phrasings are mine, so read this as a smoke test, not a benchmark.

**Routing: 3 of 25 messages reached the right job.** "Fill the empty ones", "start over", and "I want to run a marathon" did. These went to the model instead:

- "What should I do today?", "pick 3 for today", "plan my week", "review", "is my chart any good?"
- "How am I doing?", "which pillar have I been ignoring?", "what's a pillar?", "I missed three days", "thanks"

Why:

1. `intentOf` checks for a question before it checks the jobs, so "What should I do today?" never reaches the today pattern.
2. The patterns are exact phrases. "Plan my week" misses "plan this week". "Pick 3" misses "pick three". "New goal" misses "new chart".
3. "Help me finish my chart" reads as a new goal, and Bindu offers to start a second chart.
4. Without the download, every miss lands on the download card. Asking what to do today offers 2.3 GB.

**Review: 6 of 25 weak lines caught, 0 of 15 good lines flagged.** `UNTICKABLE` and `UNCONTROLLED` are short phrase lists. They never flag a good line, but "Eat healthier", "Read more books", "Exercise regularly", "Lose 10 kg", "Get promoted" and "Become fluent" all pass.

Neither is a model problem. Both are rules that cover too little.

**After the fix, the same probe: 21 of 25 routed, 24 of 25 weak lines caught, 0 good lines flagged, no lines flagged in any preset.** The four messages still missing are features that don't exist yet: "I have 20 minutes" (quick pick), "what's a pillar?" and "how many actions a day?" (method answers), and "undo that". "Learn Python" still passes review. The fix was tuned on this probe, so these numbers are optimistic. Tests 1 and 2 below are the honest measure. The messages and lines are in `helper.test.ts`.

## Where Bindu should go

Bindu answers from three sources: the chart, the log of what you picked and ticked, and the method. The model writes pillars and actions. Nothing else needs it.

Rules for the engine:

- **Every reply ends with a next step.** It never says "I am not sure." When it can't tell what you meant, it asks, with the two or three likeliest readings as chips.
- **Numbers come from the data.** Counts, streaks, and dates are computed, never written by a model.
- **Say what it saw, then what to do.** "Home has been quiet for 12 days. Pick one Home action for today?"
- **Observations, not verdicts.** A missed action is evidence about the action, not about the person.
- **Varied wording.** Each reply has two to four phrasings, so it doesn't read like a form.
- **Instant.** Nothing except writing lines waits on a download.

### Shape

Three pure steps, each tested on its own:

1. **Understand.** `understand(text, data)` returns the top three readings, each with a confidence and the pieces it found. An intent bank lists, for each intent, example phrases, key words, synonyms, and words that rule it out. A message is scored against each intent by overlap. The pieces it can find are a pillar (by name, loosely matched, or "pillar 3"), an action, a length of time ("20 minutes"), a day ("tomorrow", "this week", "Sunday") and a count ("3", "three"). Questions are scored like anything else, not routed first.
2. **Decide.** Each intent has a skill. A skill reads the chart, the log and memory, and returns a reply. When the top reading is weak, a clarify skill asks.
3. **Reply.** `{ text, card?, chips }`, built from templates in the voice of `DESIGN.md`.

### Skills

| Group | Skill | Model |
| --- | --- | --- |
| Day and week | Today's three · plan the week · "I have 20 minutes" (one action that fits) · swap one pick · what's left today | No |
| Chart | Review · guided rewrite (below) · rewrite · fill · draft, or the prompt for another app · new-chart offer | Rewrite, fill and draft only |
| Progress | How am I doing · a pillar's story · streaks · the week in review | No |
| Insights | The catalog below, on request and one at a time on open | No |
| Method | Questions about the method, answered from a written bank | No |
| Memory | Remember this · what do you know about me · forget that | No |
| Conversation | Hi, thanks, help, what can you do, undo, cancel | No |
| Last resort | Open questions nothing else covers, only when the model is already loaded | Yes |

### Insights

**Built** (`insightsFor`): today's picks done, yesterday's result, a comeback after 4+ quiet days, a streak of 3+, a pick that keeps not getting ticked (with an "Open it" chip), an action taken off the list twice this week, the pillar that has waited longest, time of day once there are 5 timed ticks in 2 weeks, last week's reflection note, follow-through by pillar over 4 weeks, and a routine ready to retire. The greeting leads with the strongest one not shown lately (`unseenInsights`). "How am I doing?" adds up to two after its counts. Most need only a day or two of history.

**Still to build**, from the catalog below: lopsided month, weekday rhythm, pinned untouched, thin pillar, and "Not useful" on an insight.

Everything here comes from data the chart already keeps: `days` (each day's picks and ticks), `meta` (routine or milestone, pinned, done, `doneAt`, note) and `weeks` (reflection notes and swaps). Tick times, picks taken off the list, and turned-down suggestions are logged from 2026-10-05 on.

| Insight | Fires when | Bindu says | Chip |
| --- | --- | --- | --- |
| Quiet pillar | No picks or ticks in a pillar for 7+ days | "Home has been quiet for 12 days." | Pick one Home action |
| Lopsided month | One pillar has half the ticks in 4 weeks | "Most of this month's ticks are Career. Health has one." | Plan the week around Health |
| Picked, not done | An action picked 3+ times, never ticked | "You've picked *Stretch at 3* four times and haven't ticked it. Make it smaller?" | Make it smaller |
| Follow-through | The pillar you tick most against the one you tick least, once there are 10+ picks | "You finish Learning picks 9 of 10 times. Health, 2 of 8." | Look at Health |
| Ready to retire | A routine ticked on 10 of the last 14 days | "*Water on the desk* might be a habit now. Retire it and free the cell?" | Retire it |
| Rhythm | 20+ ticks, and the weekdays are uneven | "Most of your ticks land Monday to Wednesday. Weekends are empty." | Pick one for Saturday |
| Comeback | First tick after 5+ quiet days | "First tick in 9 days. Good to see you." | Pick today's three |
| Streak | The current streak passes the old best | "Eleven days in a row. That's your best." | — |
| Pinned, untouched | A pin not picked by midweek | "*Book the exam* is pinned and hasn't come up yet." | Put it in today |
| Your own words | A reflection is due and last week's note exists | "Last week you wrote: 'too tired after work.' Still true?" | Yes · Not anymore |
| Thin pillar | A pillar with fewer than 4 actions, or only milestones | "Money has 3 actions, all one-time. Add a routine?" | Fill Money |

These are how Bindu helps people see their own patterns: when they work, what they finish, what they keep postponing, what they said last week. Each one is their pattern, said back plainly.

Picking: each insight has a weight. Opening the panel shows at most one, in the greeting, and only when its weight is 30 or more. A day-bound insight waits a day before it can open the panel again, the rest wait three.

### Method answers

Built: 15 answers in `methodAnswer`, the ones people ask most. The plan is a bank of about 30 short answers, taken from `MethodGuide.svelte` and `.cursor/skills/mandala-method/`: what a pillar is, why 64, the two tests, how many actions a day, what to do after a missed week, one goal or two, when to change a pillar, routines against milestones, where the grid comes from. Each answer is three sentences at most and ends with a chip that does something to this chart. The bank lives in code, next to `helper.ts`.

### Guided rewrite without the model

For a line review flags, Bindu asks for the missing pieces instead of rewriting the line. "When?" (after breakfast, at lunch, before bed, on Sunday) and "How much?" (10 minutes, 20 minutes, one page). The verb stays yours: "Read more books" becomes "Read 20 minutes before bed." When the model is loaded, "Rewrite it for me" sits next to those chips.

## Memory

Memory is something rules read. The model gets one short line of it at most.

1. **What you did.** It's already stored in `days`, `meta` and `weeks`. The insights read it. Nothing new to keep.
2. **What you turned down.** Suggestions and rewrites you skipped, and picks you swapped out. Bindu doesn't offer them again for a while.
3. **A few facts about you.** A handful of short lines per chart: a time budget, a timeline, a constraint ("mornings only", "bad knee", "by March"). They come from the draft answers, which are thrown away today, or from a message that clearly states one. Bindu confirms each one ("Noted: mornings only.") with an Undo chip. Rules use them: a 20-minute budget filters picks, for example. Fill, rewrite and draft get them as one line in the prompt.

Shape, stored on the chart so it moves with export, sync and the chart switcher, and changed only through `chart` methods:

```ts
type HelperMemory = {
	facts: { id: string; text: string; kind: 'time' | 'timeline' | 'constraint' | 'note'; from: 'draft' | 'chat'; at: string }[];
	declined: Record<string, string>; // suggestion id → date
	seen: Record<string, string>; // insight id → date last shown
};
```

`ChartData.brief` is the first piece of this: the draft answers, kept on the chart. Facts from chat, declined, and seen fold in next to it.

The panel shows the facts under "What I know", each with Forget. The conversation is display history, kept per chart. It is never sent to the model as context, and the model never writes a summary of you.

## Where the model helps, and how we'll know

| Task | Today | Would the model do better? |
| --- | --- | --- |
| Write pillars and actions | Model | Yes. Nothing else can. Keep it. |
| Rewrite a weak line | Model | Maybe. People may prefer the guided rewrite, because the line stays theirs. Test it. |
| Judge a line (review) | Rules | Plausibly. "Eat healthier" fails on meaning, not on a phrase. Test 1. |
| Understand a message | Rules | Probably not. The domain is narrow, a bank of phrases goes far, and the model costs seconds and a download. Test 2 settles it. |
| Picks, progress, insights | Rules | No. These are counts, and a 4B model invents numbers. |
| Open questions | Model | Only for what the method bank misses. Count how often that happens (test 4). |

**Test 1, line judge.** 200 labeled lines (pass, or fail with a code), at least half written by someone who isn't tuning the rules. Tune on 100 and report on the other 100. Compare the rules, the 4B model as a one-word judge, and both together. Measure weak lines caught, good lines wrongly flagged, and time per line. Model review ships only if it catches 15 more weak lines per 100 with no more false flags than the rules, and only as "Look closer" when the model is already loaded. A false flag costs more than a miss, because it tells someone a good line is bad.

**Test 2, routing.** About 300 labeled messages across the skills above, including typos, questions, lines with two asks, and lines that should get a clarifying question. Same tune and report split. Rules need 90% right on the first reading and 98% within the top three, since the top three become the clarify chips. Run the model as a classifier on the same set and write the number down, so the question stays answered.

**Test 3, insights.** A fixture builder writes `days` histories with a known pattern. Each insight fires on its pattern and stays quiet on noise and on an empty log.

**Test 4, fallthrough.** The share of the routing set that still reaches the model. Under 10%.

The rule side runs in `bun run test`, with these floors as assertions, so a change that makes Bindu worse fails. The model side runs on `/dev/ai`, like the holdout run, and the results go in this file.

**Built so far:** `bindu-eval.ts` holds 50 lines and three routing sets:

- `routingSet`, 66 messages written after the rules by the same hand. The rules are tuned on it.
- `secondRoutingSet`, 46 messages written later for the model test. The rules were not tuned on it, but the intent bank was built from it and from `routingSet`.
- `unseenRoutingSet`, 51 messages written before the bank existed, including two that are not English. Nothing was built from it, but some rule fixes came after reading its misses, so its later scores are optimistic too.

| Router | Tuned | Second | Unseen |
| --- | --- | --- | --- |
| Rules alone | 66 of 66 | 20 of 46 | 14 of 51 |
| Rules and bank, first run | 65 of 66 | 43 of 46 | 20 of 51, the one clean measure |
| Rules and bank, now | 65 of 66 | 44 of 46, 1 more asked | 24 of 51, 7 more asked |

"Asked" means a clarify question whose chips include the right reading: one tap, not a wrong answer. On the unseen set, the rest goes to the model (19) or to fill instead of the named pillar (1, "write actions for Money", which fills Money either way). No open question in any set starts a job, except "give me three things", which is terse enough to read either way. The bank can't read the two messages that aren't English. Those go to the model, which can.

Lines, first run, with three wrong labels corrected: 24 of 25 weak lines caught, 0 of 25 good lines flagged. "Become a morning person" still passes review, because "morning" reads as a time.

`bindu-eval.test.ts` holds the floors: 95% of the tuned set, 90% of the second, 45% of the unseen set right and 60% right or asked well, no new open question sent to a job, 90% of weak lines caught, no good line flagged. Still missing: messages written by someone else, which is the honest measure, the 200 and 300 sizes, and the model side on `/dev/ai`.

## Order

1. ~~Fix the three routing bugs, and add the message set as a test.~~ Done, with the progress reply, help from the chart, and thanks and hello.
2. ~~The intent bank and clarify chips~~ (done; the loaded 4B as a tie-breaker for clarify is not built). ~~Method answers~~ (15 of about 30).
3. ~~Insights: quiet pillar, picked not done, comeback, your own words, follow-through, ready to retire~~ (done, with better picks and Swap).
4. Memory: ~~facts from the draft answers, shown under "What I know" with Forget; declined; seen~~. Facts from chat are next.
5. Guided rewrite.
6. Test 1, then decide on model review.
7. Open chat becomes the last resort.
