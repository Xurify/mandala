import { emptyChart, parseBrief, TEXT_MAX, type ChartBrief, type ChartData } from './model.ts';

export const GOAL_MAX = 80;
export const PILLAR_MAX = 32;
export const ACTION_MAX = 48;

function clip(value: unknown, max: number): string {
	if (typeof value !== 'string') return '';
	return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

/** What the prompt says before the person's part: who writes, and what a chart is. */
const PROMPT_INTRO = [
	'You are a Mandala Method coach.',
	'',
	'The center is one direction. It can outlast any one project, and it can be vague. The grid is what makes it specific.',
	'The eight pillars around the center are the drivers of that direction. Each named aim becomes its own pillar. Do not merge two aims into one pillar.',
	'',
];

/** How to fill a chart, the tests every line passes, and the JSON shape to return. */
const PROMPT_METHOD = [
	'',
	'[How to fill it]',
	'Use the same question twice.',
	'1. Pillars. Ask what actually has to happen for the direction to come true. List more than eight, then keep the eight that would make a real difference. If fewer than eight aims are named, add the missing drivers. Drop nice-to-haves. "Study 30 minutes a day" and "study 5 hours a week" are the same driver, so keep one.',
	'2. Actions. For each pillar, ask what has to happen in order to do that pillar. Write eight facilitators. Do not restate the pillar in eight wordings.',
	'Write each pillar as a short heading for one driver, a few words: "Speaking time", "Core phrases". Write each action as a sentence you could say: a verb and the thing it applies to. "Play Spanish audio for 15 minutes at breakfast."',
	'',
	'[Tests]',
	'Every action must pass both tests. Every pillar must pass the second:',
	'1. Calendar. It can be scheduled and marked done. Done, or not done. "Study geography for 20 minutes a day" passes. "Do better in geography" fails. "Ask at least one question when stuck" passes. "Ask more questions" fails, because it never ends.',
	'2. Control. It is a behaviour this person can do. "Post two videos a day" passes. "Get 10 million views" fails. A finish time, a grade, or a follower count stays out of the pillars and actions. It may sit in the center.',
	'If a named aim is a result, write the behaviour that produces it, and keep the aim recognizable.',
	'',
	'[Don\'t]',
	'- Do not stop at the wish. "I want top grades" is the center, not a plan.',
	'- Do not fill a line with a nice-to-have. If it would not change the outcome, leave it out.',
	'- Do not write one habit twice. "Study 30 minutes a day" and "study 5 hours a week" are the same driver.',
	'- Do not write a line you cannot mark done. "Do better in geography" fails. "Ask more questions" fails, because there is always one more.',
	'- Do not write a result this person cannot control. "Get 10 million views a month" fails. A finish time, a grade, or a follower count is not a pillar or an action.',
	'- Do not restate a pillar as its eight actions.',
	'- Do not merge two named aims into one pillar.',
	'- Do not use "work hard", "be successful", or "stay positive".',
	'- Do not return only the first week. The first week uses five to eight actions, chosen after this chart exists. The chart itself still holds all 64. Do not add a ranking or a starter list.',
	'',
	'[Rules]',
	'- Fill all 64 actions. The chart is the map. The person will not start them all in one week.',
	'- If something is missing, make a reasonable assumption and create a first draft.',
	'- Keep it realistic for their current situation.',
	'- Return only this JSON, with no commentary:',
	'{"goal":"...","pillars":["..."],"actions":[["..."],["..."]]}',
	`- goal is one line, at most ${GOAL_MAX} characters. Exactly 8 pillars, each at most ${PILLAR_MAX} characters. Each pillar has exactly 8 actions, each at most ${ACTION_MAX} characters.`
];

/** The new chart's reply also carries what the person said, so later prompts can use it. */
const BRIEF_RULE =
	'- Add "brief" to the JSON with what I told you, a few words each: {"timeline":"...","situation":"...","focus":"...","constraint":"..."}. Leave out a field I did not answer.';

/** The prompt for a new chart. The chat app asks what would change the plan, then writes all of it. */
export function newChartPrompt(goal = ''): string {
	const aim = goal.replace(/\s+/g, ' ').trim().slice(0, 200);
	return [
		...PROMPT_INTRO,
		'Help me make my chart.',
		'',
		'[Before you write]',
		aim ? `My goal: ${aim}` : 'I have not said my goal yet. Ask for it first.',
		'Then ask me up to three short questions in one message: how much time I have on a normal day, whether there is a date, where I stand now, and anything to work around. Wait for my answers. If I say "just write it", make reasonable assumptions.',
		...PROMPT_METHOD,
		BRIEF_RULE
	].join('\n');
}

/** The prompt that completes a chart: every written line stays as it is, every empty one gets filled. */
export function fillPrompt(data: ChartData): string {
	const sofar = JSON.stringify({ goal: data.goal.trim(), pillars: data.pillars.map((pillar) => pillar.trim()), actions: data.actions.map((row) => row.map((action) => action.trim())) });
	return [
		...PROMPT_INTRO,
		"Complete this person's chart. Keep every line that is already written, word for word. Fill every empty string, in the same voice.",
		...briefLines(data.brief),
		'',
		'[Their chart so far]',
		sofar,
		...PROMPT_METHOD
	].join('\n');
}

/** What the person told the chat app when the chart was made, for the prompts that come after. */
export function briefLines(brief: ChartBrief | undefined): string[] {
	if (!brief) return [];
	const said = [
		brief.timeline && `- Timeline: ${brief.timeline}`,
		brief.situation && `- Where they stand: ${brief.situation}`,
		brief.focus && `- Focus right now: ${brief.focus}`,
		brief.constraint && `- To work around: ${brief.constraint}`
	].filter((line): line is string => Boolean(line));
	return said.length ? ['', '[What they told you before]', ...said] : [];
}

function asStringList(value: unknown, count: number, max: number): string[] | null {
	if (!Array.isArray(value) || value.length < count) return null;
	const items = value.slice(0, count).map((item) => clip(item, Math.min(max, TEXT_MAX)));
	if (items.some((item) => item === '')) return null;
	return items;
}

export function chartFromDraft(value: unknown): ChartData | null {
	if (!value || typeof value !== 'object') return null;
	const record = value as Record<string, unknown>;
	const goal = clip(record.goal, Math.min(GOAL_MAX, TEXT_MAX));
	if (!goal) return null;
	const pillars = asStringList(record.pillars, 8, PILLAR_MAX);
	if (!pillars) return null;
	if (!Array.isArray(record.actions) || record.actions.length < 8) return null;
	const actions: string[][] = [];
	for (let index = 0; index < 8; index++) {
		const row = asStringList(record.actions[index], 8, ACTION_MAX);
		if (!row) return null;
		actions.push(row);
	}
	const chart = emptyChart();
	chart.goal = goal;
	chart.pillars = pillars;
	chart.actions = actions;
	const brief = parseBrief(record.brief);
	if (brief) chart.brief = brief;
	return chart;
}

export function parseDraftText(raw: string): ChartData | null {
	const value = jsonValue(raw);
	if (!value) return null;
	return chartFromDraft(value);
}

export function jsonValue(raw: string): unknown {
	let text = raw.trim();
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (fenced?.[1]) text = fenced[1].trim();
	const startObj = text.indexOf('{');
	const startArr = text.indexOf('[');
	const start =
		startObj < 0 ? startArr : startArr < 0 ? startObj : Math.min(startObj, startArr);
	if (start < 0) return null;
	const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
	if (end <= start) return null;
	try {
		return JSON.parse(text.slice(start, end + 1)) as unknown;
	} catch {
		return null;
	}
}

