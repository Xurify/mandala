# Mandala method — sources

The coaching rules are in [SKILL.md](SKILL.md). This file is the lineage and the examples those rules came from.

## What the grid is

A 9×9 sheet: nine 3×3 blocks. The center cell of the center block is the goal. The eight cells around it are the pillars. Each pillar is copied into the center of one surrounding block, and the eight cells around that center are its actions. 8 × 8 = 64 actions. 81 cells in all. “Open Window 64” counts the actions, not an 8×8 grid.

In this app the pillar is stored once and shown twice (beside the goal, and at the center of its block).

## Who made it

Keep these apart. English blogs collapse them.

| Name | What they actually did |
| --- | --- |
| Yasuo Matsumura, Clover Management Research | Mandalachart, 1979. Official account: a 3×3 or 9×9 with a center, meant to see the whole, the parts, and the relationships. [mandalachart.com](https://mandalachart.com/world/en/mandalachart.html) |
| Hiroaki Imaizumi | Often credited in English writeups (Hana Studio says 1987) as the designer of the 9-grid. Treat that as a secondary telling. Do not override Matsumura’s own site with a blog. |
| Takashi Harada | The Harada Method. Open Window 64 is one of five tools, taught through coach Hiroshi Sasaki’s program at Hanamaki Higashi. Harada did not invent the mandala grid, and the method is wider than the sheet. English book with Norman Bodek, 2012: *The Harada Method: The Spirit of Self-Reliance*. |
| Shohei Ohtani | Filled one sheet as a first-year at Hanamaki Higashi. He is the famous example, not the author. |

Harada’s five tools: a 33-question self-analysis, a long-term goal form, Open Window 64, a routine check sheet, a daily journal. The routine sheet is where a few of the 64 become tracked habits. The journal is the daily look-back. This app implements only the grid.

Matsumura’s fill order, from the official site, follows the Vajradhatu mandala: the cross first (down, left, up, right), then the corners from the bottom left, because the cross is linear and the blank corners pull out less obvious ideas. Useful when a page is blank. Not the storage order in `model.ts`.

## Ohtani’s sheet

Center, from the handwritten sheet Sports Nippon printed in 2013: be the No. 1 draft pick of all eight NPB clubs. He was a first-year; the horizon was years, not the week.

Eight pillars, as this app’s method guide states them: body building, control, sharpness, 160 km/h, breaking balls, mental strength, character, luck.

Frances Frei (Harvard Business School, [Gazette, Feb 2026](https://news.harvard.edu/gazette/story/2026/02/crush-your-goals-the-ohtani-way/)) teaches the same sheet as: one multi-year ambition, eight things that would make this year matter, then eight behaviours a day could hold. Her names for his pillars: physical conditioning, mental strength, control, sharpness, speed, trickery, character, karma. She wants character and karma on every chart she teaches. The line that stuck with her was “be a person that people root for.” “Pick up the trash” and “clean your room” matter because nobody is grading them.

Do not invent the other cells. The published anchors are enough: under luck, greeting people, caring for equipment, picking up trash, bowing to umpires, thanking the driver, writing thanks. Under mind, “cool head, hot heart.”

## Erin McGurk

Channel: [erin meryl study](https://www.youtube.com/@erinmerylstudy). Two videos, same method. Captions pulled from the Android player. Do not paste her script back to the user. Use the rules.

[even the most insane goal can be achieved with this method](https://www.youtube.com/watch?v=C02GWTOKgIw) (~10 min). She calls it the Mandala goal setting method. Saying “I want this” is not the same as doing it, because the want has no framework. The 9×9 is intimidating, so she starts on a 3×3, on paper or a whiteboard.

Her own center, mentioned and then set aside: build the best personal-agent hardware in the world. The worked example is “get a first” / top grades, so students can follow it. Inner-ring examples: study 30 minutes a day, read a book a week, a lecture series each month, persuasive writing, write math problems that are not in the textbook, allocate time to relax. The question she asks twice: what has to be true, and what do I have to do differently? Keep drivers that would manifestly change the outcome. Brain-dump, then cut. The first eight are allowed to be wrong.

Tests, in her words. Tickable: “study 30 minutes a day” goes on a calendar; “ask more questions in class” does not, because three, then four, then five never finishes. She rewrites it to “ask at least one question when you are stuck.” Control: “10 million views a month” is out; “two Instagram videos a day” is in.

After the 64, people do nothing because it is overwhelming. She picks the highest-leverage cells, ideally one from each outer block, and anything that serves two pillars at once. Five to eight for week one. Week two, keep those and add five to eight more. Eight to twelve weeks to absorb the sheet. That week’s items go on a calendar and a physical tick list the same day, while the motivation from drawing the chart is still there. “Study 30 minutes” becomes “set up the office as soon as I get home from class.” The sheet changes when priorities change. Once it has been done once, the same shape is reused for the next goal.

[9 September 2026](https://www.youtube.com/shorts/JbAWi3PJN3w) (~2 min) is the same method, compressed. The center may be vague. Hers is “make more useful videos.” “Get fit” and “get better grades” are fine centers because the grid is what specifies them. “Do better in geography” fails the calendar test. “Study geography for 20 minutes a day” passes. A gym pillar (“30 minutes a day”) breaks into facilitators: on the calendar every day, shoes by the door. Then follow through. The short stops there. It does not replace the longer video’s week-by-week ramp.

Her other pieces sit **beside** the chart:

- [the planning system that keeps me sane](https://erinmerylstudy.substack.com/p/the-planning-system-that-keeps-me): dump the tasks, pick three for the day, time-block 8:00–20:00 in 30-minute slots after meals and people are blocked, start with the hardest, keep about an hour of buffer. Vague intentions raise procrastination because the brain has no success test. A long list (she cites ~20) drops the quality of decisions; three focus tasks answer “where do I begin?”
- “The 3×3 method to become more interesting” is a **different** video (daily three facts, weekly three changes, monthly three topics, then an output). Do not confuse that 3×3 with the goal-matrix 3×3. Transcript: [SozAI](https://sozai.app/transcript/3x3-method-become-more-interesting/).
- [the unfinished task is the proof you are still alive](https://erinmerylstudy.substack.com/p/the-unfinished-task-is-the-proof): a concrete when-and-how plan quiets an open loop (Baumeister & Masicampo; Gollwitzer’s implementation intentions). That is an argument for tickable cells, not for finishing all 64.
- [failure as data](https://erinmerylstudy.substack.com/p/failure-as-data): a missed action is evidence about the approach. On review, change the cell. Do not turn the miss into a verdict on the person.
- [the productivity industrial complex](https://erinmerylstudy.substack.com/p/the-productivity-industrial-complex): organizing the system can be a way to avoid the work. A review that only reshuffles labels has failed.

Her LinkedIn note on the Eisenhower matrix is a separate tool for a crowded day. It does not replace the chart.

## How other writeups differ

Use them as warnings, not as extra rules.

- **Life-area templates** (Miro’s basic mandala, Lucidspark, a lot of printable “balance” sheets) put health, career, and relationships around every center. That is a life wheel. This app wants the eight drivers of *this* direction.
- **Hana Studio** ([mandalart.hanastudio.co](https://mandalart.hanastudio.co/en)): one goal, eight focus areas, 64 actions, and the Ohtani luck examples. Their inventor credit (Imaizumi, 1987) disagrees with Matsumura’s site. Follow Matsumura for origin, Hana for the plain four steps.
- **Xmind** ([mandala chart templates](https://xmind.com/blog/mandala-chart-templates)): radial, spiral, and 5W1H layouts. Those are other diagrams. Do not import them into this grid.
- **Yoshie** ([Japanese with Yoshie](https://japanesewithyoshie.com/mandala-chart-japanese/)): a full 9×9 for “Master Japanese” whose pillars are grammar, listening, vocabulary, reading, speaking, kanji, culture, writing, and whose actions are topics (particles, keigo, dictation). Good as a map of the subject. Weak as a plan until each topic becomes a session you can tick.
- **Routinery** ([template](https://www.routinery.app/blog/mandalart-chart-template), [Harada writeup](https://www.routinery.app/blog/ohtani-goal-setting-harada-method)): actions as small repeatable behaviours, then highlight the daily ones and pick a few for the next seven days. Matches this app. Their claim that the layout “comes from” Harada is the collapsed version; the layout is older.
- **This repo’s method guide** (`src/lib/components/MethodGuide.svelte`) and **draft prompt** (`src/lib/chart/draft.ts`) are the product’s own wording. When a blog and the prompt disagree, the prompt wins for anything the app will store.

## A short good and bad

Center: “Speak Slovak well enough to live a week with the family.”

| | Pillar | One action |
| --- | --- | --- |
| Passes | “Daily speaking” | “10 minutes of voice notes after breakfast” |
| Fails | “Become fluent” | “Speak better” |
| Fails | “Get compliments from native speakers” | “Go viral in Slovak” |
| Duplicate | “Study 30 minutes a day” next to “Study 5 hours a week” | same habit, two cells |
