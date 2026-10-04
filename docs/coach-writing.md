# Why 1.5B writes badly

**Date:** 2026-10-03
**Status:** The writing pipeline is built (`factsFor`, `lineFault`, `keptLines`, one retry, no clipping, worked example, temperature 0.2). Model swap and training are not started.

The failures we already saw are the size of the model, not a prompt that is a few words short.

Qwen2.5-1.5B-Instruct runs in the browser (`COACH_MODEL_ID` in `src/lib/chart/coach.browser.ts`). The prompts live in `src/lib/chart/helper.ts`. The two tests (calendar, control) live in `src/lib/chart/coach-score.ts` and `reviewChart`.

## It can only keep one constraint in view

"Exactly eight," "under 48 characters," "tickable," "yours to do," "specific to this person," and "JSON only" do not fit in a 1.5B model at the same time. It writes something on the topic and drops the rest.

On IFBench, Qwen2.5 7B Instruct scores about 26%. Qwen3.5 0.8B is about 21%, 2B about 41%, 4B about 59%, 9B about 67%, 27B about 76%. 1.5B sits under the 7B number. It is the wrong size class.

## It cannot count characters while it writes

"At most 48 characters" is not a length it can feel. It writes a normal sentence. `clipWords` then cuts at the last whole word, which is how "Review bank statements monthly to avoid late fees" becomes "Review bank statements monthly to avoid late." The cell fits. The sentence is broken. Rejecting the long line and asking again is the fix. Chopping it is not.

`clipWords` is used by `replyLines`, `oneLine`, and `goalAndPillars`.

## It copies the instruction

Asked to rewrite "Work hard every day," it answered `Tick "Work hard every day" with a reminder...`. A small model completes the prompt. It does not transform the cell. The `\btick\b` reject in `rewriteCell` catches that one echo. The next echo will be a different word.

## The person's facts never reach the action calls

The pillar step gets the brief (`pillarsMessages` → `briefToUserMessage`). Each action step (`fillActionsMessages`) only gets the goal, the pillar name, and the actions already written. Situation, timeline, and the thing that would make a generic plan wrong are gone. So the model retrieves a stock paragraph. "Have a plan" and "get started now" are that. So are the finance lines it wrote onto a running chart: weekly grocery list, invest in stocks, switch energy bills.

`proposeChart` calls `fillActions(draft, pillarIndex, 8)` with no brief. `briefFromAnswers` also flattens the second answer into `situation` and only peels a timeline out, so focus and constraint never exist as their own fields in the helper flow.

## The checker never talks back to the writer

`reviewChart` already knows untickable, uncontrolled, restated, repeated, vague, and long. It runs on the lab page after the fact. The generator does not see those failures and try again. A retry only helps a model that can use the reason. 1.5B usually fails the retry the same way.

## There is no worked example in the prompt

The method notes are specific: "study 30 minutes a day" in the inner ring, "set up the desk as soon as I get home" in the outer one; "gym, 30 minutes," then "shoes by the door." The model is told the rules in the abstract (`CELL_RULES`) and then asked to invent eight actions. Small models need the example. Strong models still write tighter charts with it.

The examples live in `.cursor/skills/mandala-method/SKILL.md`. They are not in `helper.ts`.

## What prompt work can and cannot do

Prompt work on this model can move it from unusable to occasionally acceptable on an easy chart. Few-shot, passing the situation into every call, temperature near 0, and reject-and-retry will do that. They will not make it almost perfect. The IFBench gap, from the mid-20s up to around 80, is the model.

A chart that fits still wants a model around 75%+ on [IFBench](https://artificialanalysis.ai/evaluations/ifbench), with reasoning on. The candidate is DeepSeek V4.1 Flash, called `deepseek-flash` at `https://api.deepseek.com` (79% at max effort, 47% with reasoning off). That sends the chart off the device, so it stays a separate decision. These fixes are the writing pipeline either way. Hosts and training are below.

---



# How to fix the six failures

One shared judge, one shared fact line, one example. The model proposes. The judge disposes. A failed line is asked again once. It is never clipped into the chart.

## 1. One fact line on every call

Add `factsFor(brief: CoachBrief): string` next to `briefToUserMessage`. It lists only the fields that are filled: direction, timeline, situation, focus, constraint. Empty fields are omitted, so the model is not told to invent around "Not given."

Pass that string into `pillarsMessages`, `fillPillarsMessages`, `fillActionsMessages`, and `rewriteMessages`. `proposeChart(brief)` keeps the brief and hands the same string to every `fillActions` call.

For a chart that already exists and has no brief, build the line from the chart: goal, the other pillar names, and "stay on this goal." Do not let a money pillar on a running chart drift into grocery lists.

`briefFromAnswers` should keep the whole second answer on the brief even when a timeline is peeled out, so "bad knee" and "I run twice a week" both survive into `factsFor`.

## 2. Judge the line, then retry once

Extract `lineFault(text, { pillar, siblings, max })` from the same rules `reviewChart` uses: uncontrolled, untickable, restated, repeated, vague (one word), long (over `max`). `reviewChart` calls it. The generator calls it before a line is kept.

`replyLines` stops calling `clipWords`. A line over the max is `long`, not a shortened sentence.

Flow in `fillActions` and `fillPillars`:

1. Ask for exactly `count` numbered lines, three to seven words. Do not ask the model to count characters.
2. Keep the lines `lineFault` accepts.
3. If fewer than `count` remain, one retry. The user message lists each reject as `Rejected: "…" — {reason}` and asks for that many new lines, with the fact line repeated.
4. If the retry is still short, return the lines that passed. The card says the pillar is short. An empty cell is better than a broken sentence.

`goalAndPillars` treats an over-long goal or pillar the same way: reject and retry the head call, do not clip.

Cap the retry at one. A second retry on 1.5B repeats the same miss and burns the wait.

## 3. A rewrite that does not hand back the banned words

`rewriteMessages` should show the bad line and the required shape, not the name of the failure.

- Bad: `Problem: Hard to tick. Say what you do on a day.` The model writes "Tick …".
- Good: `This cannot be scheduled. Replace it with a behaviour, three to seven words.` Plus one transform, from a different goal: `"Work hard" → "Block 25 minutes after lunch"`. `"Get 10 million views" → "Post one short video on Tuesday"`.

`rewriteCell` rejects a line that contains the original text, fails `lineFault`, or contains `tick`, `rewrite`, `reminder`, or `cell`. On reject, one retry with `That still names the problem. Return only the new behaviour.`

## 4. One worked pillar, marked as someone else's

Put a single example in the action system prompt, about eight lines, taken from the method notes. Label it as a different person and a different goal. Tell the model not to copy the words.

```
Someone else's chart. Do not copy it.
Pillar: Gym, 30 minutes a day
- Shoes by the door
- On the calendar every Sunday
- Pack the bag the night before
- Book the lane on Monday
```

The grades pair can sit beside it in one line: inner ring "Study 30 minutes a day", outer ring "Set up the desk as soon as I get home." That is the whole lesson. A longer prompt gives 1.5B more to drop.

## 5. Temperature

Draft and fill calls in `coach.browser.ts` use 0.3 to 0.5. Drop them to 0.2. Specificity should come from the fact line, not from sampling. Leave `answer` (free questions) at 0.6.

## What stays true after this

These changes fix the pipeline: facts arrive, bad lines are refused, the example shows the shape, clipping stops pretending to be editing. On 1.5B the chart becomes occasionally acceptable. A chart that fits still needs a stronger model, or a fine-tune of a bigger small model on checker-clean charts. Do not spend another pass tuning this prompt and calling it done.

---



# Where a stronger model actually lives

[models.dev/providers](https://models.dev/providers/) is a host list. Most rows resell the same weights. Pick the model first, then the first-party API, so cache discounts are not marked up.

A chart is about 2,000 input tokens and 1,200 answer tokens, plus a couple thousand if reasoning is on. Prices are per million tokens.


| Model                                          | Call it at                                                                                 | IFBench                                                        | Price                                                                                       | Use                                                                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| DeepSeek V4.1 Flash, thinking on               | [api.deepseek.com](https://api-docs.deepseek.com/quick_start/pricing), id `deepseek-flash` | ~79% max effort, ~47% thinking off                             | Off-peak $0.15 in / $0.60 out, cache hit $0.003. Peak is double.                            | Default. Under a cent a chart.                                                                                                    |
| Same model via [above.dev](https://above.dev/) | `https://api.above.dev/v1`                                                                 | Same weights                                                   | About 10% over the first-party price                                                        | Only if we already have credit there.                                                                                             |
| MiniMax M3                                     | [platform.minimax.io](https://platform.minimax.io/docs/guides/pricing-paygo.md)            | 82.9%, top of the AA board with Grok 4.3                       | About $0.30 in / $1.20 out after their standing discount                                    | The constraint specialist. A few cents a chart.                                                                                   |
| Gemini 3.8 Flash                               | [Google AI for Developers](https://ai.google.dev/gemini-api/docs/pricing)                  | Gemini 3.5 Flash was ~76%. 3.8 Flash is not the number I have. | Free tier exists. Paid $0.75 in / $3.75 out through 2026, thinking tokens billed as output. | The only strong model with a free tier. Fine for a trial. Weak as the product: quota, and the free tier is not a privacy promise. |


Skip speed hosts (Groq, Cerebras) and catalogs (OpenRouter, Kilo, NanoGPT, above.dev's other slots). They serve these same models. Skip flagship Claude and GPT for this job. Their intelligence-index lead is coding and long agent work, at 10–30× the price, for an 80-character cell.

The app shape, if a chart may leave the device: the person pastes their own key. No Mandala account, no proxy. Browser model stays for anyone who refuses.

---



# Should we retrain?

A full retrain, no. A supervised fine-tune, later, yes, and only for the on-device path.

This task is a rare good fit for training because every failure is a function we can already write: count, length, untickable, uncontrolled, restated, repeated. That is the setting where a verifier helps. The IFBench paper's method is reinforcement learning against a checker. Our checker is narrower than IFBench, and the rules do not change, so the training problem is easier than general instruction following.

What training can teach a small model: eight lines, short lines, don't echo "tick", don't restate the pillar, copy the voice of the worked example.

A concrete constraint is not the size problem. "Bad knee, so no hill sprints" is one fact a 1.5B model can use when that sentence is in the prompt. The action calls were dropping the brief, so the model never saw the knee and wrote a stock paragraph. That was our bug. The pipeline above sends the fact through.

What stays hard at 1.5B is a stack of rules at once, and a vague brief with nothing to hold onto ("be healthier"). Then it reaches for a life wheel. A bigger model invents better drivers from a thin brief. This one needs the constraint written down. Training does not replace a fact we forgot to send. It makes the shape reliable after the fact is present. Qwen2.5 7B sits near 26% on IFBench before any of our data. 1.5B is under that.

The right student, if we train, is Qwen3.5 4B. About 2.4 GB, already ~59% on IFBench, same browser path. 1.5B is only a dry run of the data pipeline.

Order:

1. Build `lineFault`. That function is the reward. Training before it exists teaches the model to emit clipped sentences and `Tick "…"`.
2. A strong teacher (DeepSeek Flash, thinking on) writes invented charts from briefs like `coach-holdout.ts`. Real charts stay on the device. The original plan was a one-time teacher. This is that.
3. Keep a chart only when every cell passes `lineFault`.
4. Measure the base model with the new prompts. If an easy chart is acceptable, stop. Do not train.
5. If it is not, supervised fine-tune on the clean set. A few hundred charts teach the shape. A couple of thousand, with the person's facts in the prompt, is the test of whether drivers get specific.
6. If it still echoes, one reinforcement round (GRPO or the same RLVR recipe) with `lineFault` as the reward. One round, not a research project.
7. Merge the adapter and compile to MLC. WebLLM loads a compiled model, not a Hugging Face folder. `COACH_MODEL_ID` swaps after that compile. The compile is the expensive part. The training run is cheap.

Do not train on the lab's bad outputs. Do not fine-tune 1.5B and call the product done. Freeform questions (`answer`) can stay on the base model so the fine-tune does not have to remain a general chat model.