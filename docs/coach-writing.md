# Why 1.5B writes badly

**Date:** 2026-10-03
**Status:** Diagnosis kept. Fixes not built.

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

A chart that fits still wants a model around 75%+ on IFBench, with reasoning on. DeepSeek V4.1 Flash on above.dev is the candidate (79% at max effort, 47% with reasoning off). That sends the chart off the device, so it stays a separate decision. These fixes are the writing pipeline either way.

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

These changes fix the pipeline: facts arrive, bad lines are refused, the example shows the shape, clipping stops pretending to be editing. On 1.5B the chart becomes occasionally acceptable. A chart that fits still needs a stronger model. Do not spend another pass tuning this prompt and calling it done.
