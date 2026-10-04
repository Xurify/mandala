import { emptyChart, TEXT_MAX, type ChartData } from './model.ts';

export const GOAL_MAX = 80;
export const PILLAR_MAX = 32;
export const ACTION_MAX = 48;

function clip(value: unknown, max: number): string {
	if (typeof value !== 'string') return '';
	return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

export type CoachBrief = {
	direction: string;
	timeline: string;
	situation: string;
	focus: string;
	constraint: string;
};

export function emptyBrief(): CoachBrief {
	return { direction: '', timeline: '', situation: '', focus: '', constraint: '' };
}

/** Rules for the in-browser model. Shorter than {@link draftPrompt} so a 4096-token window can still finish the chart. */
export function draftSystemPrompt(): string {
	return [
		'You are a Mandala Method coach.',
		'',
		'Create a personalised 9×9 chart from the user brief.',
		'The center is one direction. It can outlast any one project, and it can be vague. The grid is what makes it specific.',
		'The eight cells around the center are the drivers of that direction. Each named aim becomes its own pillar. Do not merge two aims into one cell.',
		'',
		'[How to fill it]',
		'1. Pillars. Ask what actually has to happen for the direction to come true. Keep the eight that would make a real difference. Drop nice-to-haves. "Study 30 minutes a day" and "study 5 hours a week" are the same driver, so keep one.',
		'2. Actions. For each pillar, write eight facilitators of that behaviour. Do not restate the pillar in eight wordings.',
		'',
		'[Tests]',
		'Every pillar and every action must pass both tests:',
		'1. Calendar. It can be scheduled and ticked. Done, or not done. "Study geography for 20 minutes a day" passes. "Do better in geography" fails. "Ask at least one question when stuck" passes. "Ask more questions" fails, because it never ends.',
		'2. Control. It is a behaviour this person can do. "Post two videos a day" passes. "Get 10 million views" fails. A finish time, a grade, or a follower count stays out of the pillars and actions. It may sit in the center.',
		'',
		"[Don't]",
		'- Do not use "work hard", "be successful", or "stay positive".',
		'- Do not write a cell you cannot tick.',
		'- Do not write a result this person cannot control.',
		'- Do not restate a pillar as its eight actions.',
		'- Do not return only the first week. The chart holds all 64.',
		'',
		'[Rules]',
		'- If something is missing, make a reasonable assumption and create a first draft.',
		'- Return only this JSON, with no commentary:',
		'{"goal":"...","pillars":["..."],"actions":[["..."],["..."]]}',
		`- goal is one line, at most ${GOAL_MAX} characters. Exactly 8 pillars, each at most ${PILLAR_MAX} characters. Each pillar has exactly 8 actions, each at most ${ACTION_MAX} characters.`,
		'- actions is 8 arrays. Each array has 8 strings. Do not stop after one or two.'
	].join('\n');
}

export function briefToUserMessage(brief: CoachBrief): string {
	const line = (label: string, value: string) => {
		const text = value.replace(/\s+/g, ' ').trim();
		return `- ${label}: ${text || 'Not given. Make a reasonable assumption.'}`;
	};
	return [
		'Create the chart from this brief.',
		line('Direction', brief.direction),
		line('Timeline', brief.timeline),
		line('Current situation', brief.situation),
		line('Focus right now', brief.focus),
		line('Constraint', brief.constraint),
		'Return 8 pillars. Each pillar has exactly 8 actions.'
	].join('\n');
}

export function draftPrompt(): string {
	return [
		'You are a Mandala Method coach.',
		'',
		'Create a personalised 9×9 chart from the information below.',
		'The center is one direction. It can outlast any one project, and it can be vague. The grid is what makes it specific.',
		'The eight cells around the center are the drivers of that direction. Each named aim becomes its own pillar. Do not merge two aims into one cell.',
		'',
		'[User information]',
		'- Direction:',
		'- Timeline:',
		'- Current situation:',
		'- Focus right now:',
		'- Body:',
		'- Money or career:',
		'- Habit to change:',
		'- Skill to develop:',
		'- Life to build:',
		'',
		'[How to fill it]',
		'Use the same question twice.',
		'1. Pillars. Ask what actually has to happen for the direction to come true. List more than eight, then keep the eight that would make a real difference. If fewer than eight aims are named, add the missing drivers. Drop nice-to-haves. "Study 30 minutes a day" and "study 5 hours a week" are the same driver, so keep one.',
		'2. Actions. For each pillar, ask what has to happen in order to do that pillar. Write eight facilitators. Do not restate the pillar in eight wordings.',
		'',
		'[Tests]',
		'Every pillar and every action must pass both tests:',
		'1. Calendar. It can be scheduled and ticked. Done, or not done. "Study geography for 20 minutes a day" passes. "Do better in geography" fails. "Ask at least one question when stuck" passes. "Ask more questions" fails, because it never ends.',
		'2. Control. It is a behaviour this person can do. "Post two videos a day" passes. "Get 10 million views" fails. A finish time, a grade, or a follower count stays out of the pillars and actions. It may sit in the center.',
		'If a named aim is a result, write the behaviour that produces it, and keep the aim recognizable.',
		'',
		'[Don\'t]',
		'- Do not stop at the wish. "I want top grades" is the center, not a plan.',
		'- Do not fill a cell with a nice-to-have. If it would not change the outcome, leave it out.',
		'- Do not write one habit twice. "Study 30 minutes a day" and "study 5 hours a week" are the same driver.',
		'- Do not write a cell you cannot tick. "Do better in geography" fails. "Ask more questions" fails, because there is always one more.',
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
	].join('\n');
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
	return chart;
}

export function parseDraftText(raw: string): ChartData | null {
	const value = jsonValue(raw);
	if (!value) return null;
	return chartFromDraft(value);
}

export function partialDraft(raw: string): { goal: string; pillars: string[]; actions: string[][] } | null {
	const value = jsonValue(raw);
	if (!value || typeof value !== 'object') return null;
	const record = value as Record<string, unknown>;
	const goal = clip(record.goal, Math.min(GOAL_MAX, TEXT_MAX));
	if (!goal) return null;
	const pillars = asStringList(record.pillars, 8, PILLAR_MAX);
	if (!pillars) return null;
	if (!Array.isArray(record.actions)) return null;
	const actions = record.actions.slice(0, 8).map((row) => {
		if (!Array.isArray(row)) return [];
		return row
			.map((item) => clip(item, Math.min(ACTION_MAX, TEXT_MAX)))
			.filter((item) => item !== '');
	});
	while (actions.length < 8) actions.push([]);
	return { goal, pillars, actions };
}

/** Eight action lines, either a JSON array or a numbered list. */
export function eightActions(raw: string): string[] | null {
	const value = jsonValue(raw);
	const fromJson = Array.isArray(value)
		? value.map((item) => clip(item, Math.min(ACTION_MAX, TEXT_MAX))).filter((item) => item !== '')
		: [];
	if (fromJson.length >= 8) return fromJson.slice(0, 8);
	const lines = raw
		.split('\n')
		.map((line) => line.replace(/^\s*\d+[.)]\s*/, '').trim())
		.map((line) => clip(line, Math.min(ACTION_MAX, TEXT_MAX)))
		.filter((line) => line !== '' && !line.startsWith('{') && !line.startsWith('['));
	if (lines.length >= 8) return lines.slice(0, 8);
	return null;
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

