import { emptyChart, TEXT_MAX, type ChartData } from './model.ts';

export const GOAL_MAX = 80;
export const PILLAR_MAX = 32;
export const ACTION_MAX = 48;

function clip(value: unknown, max: number): string {
	if (typeof value !== 'string') return '';
	return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

export function draftPrompt(): string {
	return [
		'You are a goal-design expert and a Mandala Method coach.',
		'',
		'Create a personalised 9×9 chart from the information below.',
		'The chart can hold several goals. The center is a direction that can outlast any one project.',
		'The eight cells around the center are distinct goals. Each named aim becomes its own pillar.',
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
		'[Task]',
		'1. Name one center direction.',
		'2. Create 8 pillars. Give each named aim its own pillar. If fewer than eight are named, add the systems those aims need.',
		'3. Create 8 actions for each pillar.',
		'4. Make each action a short, concrete behaviour.',
		'',
		'[Rules]',
		'- Avoid vague phrases such as "work hard", "be successful", or "stay positive".',
		'- If something is missing, make a reasonable assumption and create a first draft.',
		'- Keep it realistic and easy to do.',
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
	let text = raw.trim();
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (fenced?.[1]) text = fenced[1].trim();
	const start = text.indexOf('{');
	const end = text.lastIndexOf('}');
	if (start < 0 || end <= start) return null;
	try {
		return chartFromDraft(JSON.parse(text.slice(start, end + 1)) as unknown);
	} catch {
		return null;
	}
}

