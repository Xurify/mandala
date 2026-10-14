# Bindu

**Date:** 2026-10-14
**Status:** Describes the code. "Order" at the bottom is what is still planned.

Bindu is the helper in the corner of the chart. It reads three things: the chart, the log of what was picked and ticked, and the method. Picks, notes and progress run on rules, instantly, on the device. Writing and reviewing lines are jobs rules can't do, so Bindu writes a prompt for whatever chat app the person already uses, and reads the reply they paste back. A person who adds their own Claude key can send that prompt from the panel instead. The name and its face come from the center dot of a mandala; see `DESIGN.md` → Voice and copy.

## Where it lives

| File | What it holds |
| --- | --- |
| `src/lib/chart/helper.ts` | Pure rules: picks, insights, progress, the first page (`noteFor`, `nextMove`, `doorsFor`), `fillEdits`, `reviseEdits`, `askPrompt` |
| `src/lib/chart/helper.svelte.ts` | `HelperStore` and the `helper` singleton: the page in view, the picks on the table, the write round trip, a finished moment |
| `src/lib/chart/draft.ts` | The new-chart, fill and review prompts, and `parseDraftText`, which reads a pasted reply |
| `src/lib/chart/claude.ts` | The person's own Anthropic key (device only) and `askClaude`, one request from the browser |
| `src/lib/chart/webmcp.ts` | The tools an agent in the browser can call (`agentTools`), and registering them with WebMCP (`registerAgentTools`) |
| `src/lib/components/Helper.svelte` | The launcher and the floating panel |
| `src/lib/components/HelperPanel.svelte` | The header, the page turns, the height that eases between pages, Escape and paste |
| `src/lib/components/HelperHome.svelte`, `HelperPicks.svelte`, `HelperProgress.svelte`, `HelperWrite.svelte`, `HelperMoment.svelte` | One page each |
| `src/lib/components/HelperDraft.svelte`, `HelperOffer.svelte` | Lines waiting to be kept, from a reply or an agent; the page an agent's lines wait on |
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
| Lines to look over | Lines an agent in the browser proposed, each under the line it replaces, or a whole chart | Keep them, or "Not now" |
| Fill chart using a prompt | Three steps on a thread: copy the prompt (or open it in Claude, ChatGPT, Gemini, Mistral, Perplexity or Grok with one tap), paste it into any chat app, paste the reply here. Modes: a new chart, fill the gaps, review, or ask. "Review my chart" on the first page opens it on Review. With a Claude key saved, step one also has Write with Claude (or Review, or Ask), and the reply lands in step three by itself | Copy, or send to Claude. See what the reply would add or rewrite, and keep it |

The next move is: start a chart when there is no goal, fill the gaps while any line is empty, pick today's three when today has no picks, and otherwise see how it is going.

A thing that just became true takes the page as a moment: today set, the week pinned, a chart kept, lines added. The ring draws the pillars it touched, then the words land, then one button, Done, closes the panel. Lines that fill the last gaps make the chart whole, so that moment says "Every line is written" and draws all eight; the chart's own toast stays quiet, since the moment said it.

The panel opens where it was left, so a person who went to paste a prompt comes back to the box for the reply. A moment does not wait for a reopen. A different chart starts on the first page.

## Writing with a chat app

- **New chart.** The prompt carries the goal, if one was typed, and asks the chat app to ask up to three questions first: time on a normal day, a date, where the person stands, anything to work around. Then it writes all 64 actions as JSON, with a `brief` of what the person said.
- **Fill the gaps.** The prompt carries the chart so far as JSON and the brief, and asks for every empty line, keeping the written ones word for word.
- **Review.** The prompt carries the whole chart and the two tests, and asks for the chart back with only the failing lines rewritten, in the chart's own language. The reply shows each rewrite under the line it replaces; **Keep** writes them in.
- **Ask.** The prompt carries the chart in plain text, the brief, and the question if one was typed. The answer stays in the chat app.

### With the person's own Claude key

"Use your own Claude key" at the foot of the page takes an Anthropic API key. It is kept in `localStorage` under `mandala_claude_key` and goes nowhere else: not into sync, a share, a backup, or an export. A request goes from the browser straight to Anthropic (`dangerouslyAllowBrowser`, the documented browser path), billed to the person's account. The SDK is its own chunk, imported on first use, so it stays out of the page's startup. The service worker still precaches it with the rest of the build.

The request is the same prompt a chat app would get, with one change: a new chart is one request with no back and forth, so the prompt says to write at once from reasonable assumptions instead of asking three questions first (`newChartPrompt(goal, true)`), and a goal must be typed. The reply goes into the reply box as if it had been pasted, so the rest of the page is the same. An answer to Ask shows in step two. Stop drops a reply that comes back late. A refused request, a reply that ran out of room, a bad key, no credit and a busy service each get one plain sentence.

The model is `claude-opus-5-5`, at medium effort, with the server-side refusal fallback on.

A pasted reply is read by `parseDraftText`, from the reply box or pasted anywhere in the panel. The length caps in the prompt are a request: a reply is read up to the cell limit, so a line returned word for word in a longer language is not clipped into a rewrite, and an empty line stays empty. For this chart's goal it offers only the cells that are empty here (`fillEdits`); a written cell is never replaced. Any other goal opens as a new chart beside this one, or fills this one when it is empty. The brief is kept on the chart, syncs, and stays out of share links.

## Agents in the browser

A browser with an agent in it can call tools a page registers through [WebMCP](https://developer.chrome.com/docs/ai/webmcp). Mandala registers nineteen when `document.modelContext` is there, and nothing changes where it is not. Chrome has it behind an origin trial from 149; to try it locally, turn on `chrome://flags/#enable-webmcp-testing`. The `/dev/demo` cards under Bindu call the same tools an agent would, without one.

The agent is the model Bindu does not have. What needs judgment about the person's words (writing lines, reviewing them, telling a habit from a one-off, a note for the week) is the agent's, in whatever language the chart is in; nothing on the page reads meaning from words. What rules do well stays rules: picks, progress, the week in numbers.

| Tool | What it does |
| --- | --- |
| `read_chart` | The open chart: goal, brief, each pillar's shelf, each line with its cell, id, kind, board lane and done state, today's and tomorrow's lists, a running timer |
| `review_chart` | The chart's lines with the method's tests (`METHOD` in `draft.ts`, the same words the prompts use), for the agent to judge |
| `suggest_today` | Today's three, each with why |
| `progress` | The last 7 days, as on How it is going |
| `week_history` | One week: ticks by day, milestones finished, minutes per pillar, and its note |
| `propose_lines` | Pillars or actions for Bindu to show on Lines to look over |
| `propose_chart` | A whole chart for Bindu to show; keeping it opens it beside this one |
| `propose_kinds` | Routine, milestone or standard for each action, shown on How each one repeats |
| `propose_reflection` | A draft of the week's note, shown on A line for next week |
| `finish_action`, `reopen_action` | A tick, or taking one back, by action id |
| `set_today`, `plan_tomorrow` | Today's or tomorrow's list, by action id |
| `pin_actions` | Pin or unpin actions, which lead Bindu's picks |
| `move_card` | Move an action between the board's lists |
| `log_time`, `start_timer`, `stop_timer` | Time on an action: logged afterwards, a stopwatch or a focus block, and stopping it |
| `add_link` | A link to a pillar's shelf, such as the page the person is on |

The rules they keep:

- **The agent proposes, the person keeps.** An agent can press the page's buttons, so its own press is not the person's say-so. Lines, kinds and the week's note wait in Bindu, each beside what it replaces, until the person presses Keep. A line or kind the person changed while the offer waited stays theirs. The goal is not a cell an agent can propose.
- **Small daily things apply at once, and say so.** Ticks, lists, pins, board moves, time and links go through the same store methods a tap does, and a slip names the assistant ("Your assistant finished …"), since the person did not tap it. A timer leaves on its own (its slip on the dock), and its stopping says what it logged.
- **Replies say what is now true.** `set_today` names what Today shows, not what was asked; a routine is on Today already, and an action finished on another day is refused.
- **Nothing leaves.** No tool shares, syncs, exports, backs up, or deletes. Day logs are the person's own; an agent that read a hostile page in another tab could otherwise send them out through this one.
- **Read tools are marked** `readOnlyHint` and `untrustedContentHint`: line text and shelf titles came from people and pasted links, so they are data, not instructions.
- **Limits are the cell's, not the prompt's.** As with a pasted reply, the prompt asks for 32 characters a pillar and 48 an action, and a line is refused only past 120, so a longer language is not cut.

## Why there is no model on the device

Until 2026-10-10 Bindu could download Qwen3 4B (2.3 GB, WebGPU, through web-llm) to write pillars and actions, rewrite flagged lines and answer open questions. It was taken out:

- **Cost.** A 2.3 GB download and WebGPU, for jobs a person does a few times per chart.
- **Quality.** By hand grade on the CPU, 59% of its lines passed: tickable, in the person's control, and sensible for them. Half its pillars were good. The rule checks passed lines like "Track progress" that a person would not.
- **Facts.** Smaller models invented counts and facts. Chrome's built-in model only ran where WebGPU was off, and answered a Spanish brief in English.
- **What people already have.** The chat app on their phone writes better lines than any of these, so the prompt hand-off gives a better chart for no download.

What stayed is what was rules all along: picks, insights and progress. Review was rules too, until 2026-10-14: a set of regexes over English phrases. It caught weak English lines well, but it read every other language wrong. A Japanese chart came back with every line marked a repeat, since its normalizer kept only `a-z0-9`, and a German one passed lines like "Mehr sprechen". Review now goes through the prompt, which reads any language. The chat that routed typed messages to them went next: a page per job does the same with a tap, and a chat app answers open questions better than a bank of written replies. The measurements and the writer's design notes are in git history (`docs/bindu-models.md`, `docs/coach-writing.md`, `scripts/coach-eval/`), before the commit that removed them.

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
- `sessions`: time on an action, `{ key, at, minutes }`, from a stopwatch, a focus block, or Log time. It never ticks anything.

All of it syncs with the chart.

## Insights

**Built** (`insightsFor`): a repeat tool opened on 10 of the last 14 days ("Know it by now?"), today's picks done, yesterday's result, a comeback after 4+ quiet days, a streak of 3+, a pick that keeps not getting ticked (with "Open it"), an action taken off the list twice this week, the pillar that has waited longest, time of day once there are 5 timed ticks in 2 weeks, the pillar that got half or more of this week's time logged, once there is an hour of it, last week's reflection note, follow-through by pillar over 4 weeks, and a routine ready to retire. The note on the first page is the strongest one not shown lately (`unseenInsights`), held still while the panel is open. "How it is going" lists up to three under its counts, and time per pillar logged this week, longest first; the time insight stays off that list, since the bars say it. Most need only a day or two of history.

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

## Order

1. The four insights still to build.
2. "Not useful" on an insight.
