import { norm, restated, UNCONTROLLED, UNTICKABLE } from './coach-score.ts';
import {
	ACTION_MAX,
	briefToUserMessage,
	emptyBrief,
	GOAL_MAX,
	jsonValue,
	parseDraftText,
	PILLAR_MAX,
	type CoachBrief
} from './draft.ts';
import {
	dateKeyOf,
	getByKey,
	isOpenFocus,
	labelOfKey,
	pillarActivityLast7,
	type ChartData
} from './model.ts';

export type HelperJob = 'draft' | 'fill' | 'review' | 'week' | 'today';
export type HelperIntent = HelperJob | 'chart' | 'ask';
export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type HelperFinding = {
	key: string;
	text: string;
	reason: string;
	code: 'untickable' | 'uncontrolled' | 'restated' | 'repeated' | 'long' | 'vague';
};

export type HelperPick = { key: string; text: string; pillarIndex: number; why: string };

export type FillPlan = { kind: 'pillars'; empty: number[] } | { kind: 'actions'; pillarIndex: number; empty: number[] };

export const DRAFT_QUESTIONS = [
	'What do you want to grow into? One line is enough.',
	'Anything I should know? By when, where you stand, what gets in the way. Or say "go".'
] as const;

const TIMELINE =
	/\b(?:by|before|within|in)\s+((?:\d+|a|one|two|three|six|twelve)\s+(?:days?|weeks?|months?|years?)|(?:the end of )?(?:january|february|march|april|may|june|july|august|september|october|november|december|spring|summer|autumn|fall|winter|next year|the year)(?:\s+\d{4})?|\d{4})\b/i;
const SKIP = /^(go|skip|no|nope|nothing|none|just write it|write it|that's it|thats it|-)\.?$/i;

export function briefFromAnswers(direction: string, extra: string): CoachBrief {
	const brief = emptyBrief();
	brief.direction = direction.replace(/\s+/g, ' ').trim();
	const rest = extra.replace(/\s+/g, ' ').trim();
	if (!rest || SKIP.test(rest)) return brief;
	const timeline = rest.match(TIMELINE);
	if (timeline?.[1]) brief.timeline = timeline[1];
	brief.situation = rest;
	return brief;
}

export function intentOf(text: string): HelperIntent {
	if (parseDraftText(text)) return 'chart';
	const value = text.toLowerCase();
	if (/\b(today|tonight|this morning|three for)\b/.test(value)) return 'today';
	if (/\b(this week|week|weekly)\b/.test(value)) return 'week';
	if (/\b(review|check|weak|tighten|improve|critique|feedback)\b/.test(value)) return 'review';
	if (/\b(fill|blank|blanks|empty|missing|finish the)\b/.test(value)) return 'fill';
	if (/\b(new chart|start a chart|draft|from scratch|write a chart|make a chart|start over)\b/.test(value)) return 'draft';
	return 'ask';
}

function actionKey(pillarIndex: number, actionIndex: number): string {
	return `a${pillarIndex}_${actionIndex}`;
}

function filled(value: string | undefined): boolean {
	return (value ?? '').trim() !== '';
}

export function fillPlan(data: ChartData, preferredPillar: number | null = null): FillPlan | null {
	if (!filled(data.goal)) return null;
	const emptyPillars = data.pillars.flatMap((pillar, index) => (filled(pillar) ? [] : [index]));
	if (emptyPillars.length > 0) return { kind: 'pillars', empty: emptyPillars };
	const order =
		preferredPillar === null ? [0, 1, 2, 3, 4, 5, 6, 7] : [preferredPillar, ...[0, 1, 2, 3, 4, 5, 6, 7].filter((k) => k !== preferredPillar)];
	for (const pillarIndex of order) {
		const row = data.actions[pillarIndex] ?? [];
		const empty = row.flatMap((action, index) => (filled(action) ? [] : [index]));
		if (empty.length > 0) return { kind: 'actions', pillarIndex, empty };
	}
	return null;
}

const CELL_RULES =
	'Each line is a behaviour this person can schedule. No results they cannot control, no "work hard", no "be more". Three to seven words.';

const ACTION_EXAMPLE = [
	"Someone else's chart. Do not copy it.",
	'Pillar: Gym, 30 minutes a day',
	'- Shoes by the door',
	'- On the calendar every Sunday',
	'- Pack the bag the night before',
	'- Book the lane on Monday',
	'Inner ring "Study 30 minutes a day". Outer ring "Set up the desk as soon as I get home."'
].join('\n');

export type LineReject = { text: string; reason: string };

/** The brief, with empty fields left out, so a later call still knows the person. */
export function factsFor(brief: CoachBrief): string {
	const rows: [string, string][] = [
		['Direction', brief.direction],
		['Timeline', brief.timeline],
		['Where they stand', brief.situation],
		['Focus', brief.focus],
		['Constraint', brief.constraint]
	];
	const lines = rows.filter(([, value]) => value.trim() !== '').map(([label, value]) => `- ${label}: ${value.trim()}`);
	return lines.length > 0 ? ['About this person:', ...lines].join('\n') : '';
}

/** Goal and the other pillars, for a chart that already exists. */
export function factsFromChart(data: ChartData, skipPillar?: number): string {
	const others = data.pillars.flatMap((pillar, index) => (index === skipPillar || !pillar.trim() ? [] : [pillar.trim()]));
	const lines = [`Goal: ${data.goal.trim() || 'not set'}`];
	if (others.length > 0) lines.push(`Other pillars: ${others.join('; ')}. Do not repeat them.`);
	return lines.join('\n');
}

function factBlock(facts: string): string[] {
	const text = facts.trim();
	return text ? [text] : [];
}

function rejectBlock(rejected: readonly LineReject[]): string[] {
	if (rejected.length === 0) return [];
	return ['These were rejected. Write replacements. Do not repeat them.', ...rejected.map((item) => `Rejected: "${item.text}" — ${item.reason}`)];
}

export function pillarsMessages(brief: CoachBrief): ChatMessage[] {
	return [
		{
			role: 'system',
			content: [
				'You are a Mandala Method coach.',
				'The goal is one line for the center of the chart. The eight pillars are the drivers that make it come true. Drop nice-to-haves. Do not merge two aims into one pillar.',
				'Each pillar is something this person does, two to four words. A follower count, a grade, or a finish time is not a pillar.',
				'Return only this JSON: {"goal":"...","pillars":["...", 8 strings]}.'
			].join('\n')
		},
		{
			role: 'user',
			content: [factsFor(brief), briefToUserMessage(brief).replace('Return 8 pillars. Each pillar has exactly 8 actions.', 'Return the goal and 8 pillars.')]
				.filter(Boolean)
				.join('\n')
		}
	];
}

export function goalAndPillars(raw: string): { goal: string; pillars: string[] } | null {
	const value = jsonValue(raw);
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const record = value as Record<string, unknown>;
	const goal = typeof record.goal === 'string' ? cleanLine(record.goal) : '';
	if (!goal || goal.length > GOAL_MAX || !Array.isArray(record.pillars)) return null;
	const pillars: string[] = [];
	for (const item of record.pillars) {
		const pillar = typeof item === 'string' ? cleanLine(item) : '';
		if (!pillar || pillar.length > PILLAR_MAX) continue;
		if (!pillars.some((seen) => norm(seen) === norm(pillar))) pillars.push(pillar);
	}
	return pillars.length >= 8 ? { goal, pillars: pillars.slice(0, 8) } : null;
}

function cleanLine(value: string): string {
	return value.replace(/\s+/g, ' ').trim().replace(/[.;,]+$/, '');
}

/** What Bindu shows while the on-device model is coming in. Engine text stays off the screen. */
export type CoachLoad = {
	label: string;
	/** 0–1 when this step has a measurable fill. */
	ratio: number | null;
	detail: string;
};

function clampRatio(ratio: number | null | undefined): number | null {
	if (ratio == null || !Number.isFinite(ratio)) return null;
	return Math.min(1, Math.max(0, ratio));
}

/** Turn a web-llm progress line into a short status. `ratio` wins over the percent buried in the text. */
export function describeCoachProgress(text: string, ratio?: number | null): CoachLoad {
	const cleaned = text.replace(/\s*\[[^\]]*\]\s*/g, ' ').replace(/\s+/g, ' ').trim();
	const reported = clampRatio(ratio);
	const fromText = cleaned.match(/(\d+(?:\.\d+)?)\s*%\s*completed/i);
	const measured = reported ?? (fromText ? clampRatio(Number(fromText[1]) / 100) : null);
	const mb = cleaned.match(/(\d+)\s*MB/i)?.[1];
	const detail = mb ? `${mb} MB` : '';

	if (/start to fetch/i.test(cleaned)) return { label: 'Starting the download.', ratio: measured ?? 0, detail: '' };
	if (/fetching param/i.test(cleaned)) return { label: 'Downloading.', ratio: measured, detail };
	if (/loading model from cache/i.test(cleaned)) return { label: 'Loading it.', ratio: measured, detail };
	if (/shader/i.test(cleaned)) return { label: 'Getting ready.', ratio: measured, detail: '' };
	if (/warming up/i.test(cleaned)) return { label: 'Warming up.', ratio: null, detail: '' };
	if (/coach is ready/i.test(cleaned)) return { label: 'Ready, on this device.', ratio: null, detail: '' };
	return { label: cleaned, ratio: null, detail: '' };
}

/** Cut at the last whole word that fits. The writer does not use this. A long line is rejected. */
export function clipWords(value: string, max: number): string {
	const text = value.replace(/\s+/g, ' ').trim().replace(/[.;,]+$/, '');
	if (text.length <= max) return text;
	const cut = text.slice(0, max + 1);
	const space = cut.lastIndexOf(' ');
	return (space > max * 0.5 ? cut.slice(0, space) : text.slice(0, max)).replace(/[\s,;:-]+$/, '');
}

export function fillPillarsMessages(data: ChartData, count: number, facts = '', rejected: readonly LineReject[] = []): ChatMessage[] {
	const named = data.pillars.filter(filled);
	return [
		{
			role: 'system',
			content: `You name pillars for a Mandala chart. A pillar is one driver of the goal. ${CELL_RULES} Two to four words. Return exactly ${count} lines, numbered 1. to ${count}. No other text.`
		},
		{
			role: 'user',
			content: [
				...factBlock(facts),
				`Goal: ${data.goal.trim()}`,
				named.length ? `Pillars already named: ${named.join('; ')}` : 'No pillars yet.',
				`Write ${count} more pillars. Do not repeat the ones already named.`,
				...rejectBlock(rejected)
			].join('\n')
		}
	];
}

export function fillActionsMessages(
	data: ChartData,
	pillarIndex: number,
	count: number,
	facts = '',
	rejected: readonly LineReject[] = []
): ChatMessage[] {
	const existing = (data.actions[pillarIndex] ?? []).filter(filled);
	return [
		{
			role: 'system',
			content: [`You write Mandala actions. ${CELL_RULES}`, 'Return exactly the requested numbered lines. No other text.', ACTION_EXAMPLE].join('\n')
		},
		{
			role: 'user',
			content: [
				...factBlock(facts),
				`Goal: ${data.goal.trim()}`,
				`Pillar: ${(data.pillars[pillarIndex] ?? '').trim()}`,
				existing.length ? `Actions already there: ${existing.join('; ')}` : 'No actions yet.',
				`Write ${count} more actions for this pillar. Do not restate the pillar or repeat an action.`,
				...rejectBlock(rejected)
			].join('\n')
		}
	];
}

function splitLines(raw: string): string[] {
	return raw
		.split('\n')
		.map((line) => line.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').replace(/^["']|["']$/g, '').trim())
		.map((line) => cleanLine(line))
		.filter((line) => line !== '' && !/^[[{\]}]/.test(line) && !/:$/.test(line));
}

/** Numbered or bulleted lines. A line past `max` is dropped, not cut. */
export function replyLines(raw: string, count: number, max: number): string[] | null {
	const unique: string[] = [];
	for (const line of splitLines(raw)) {
		if (line.length > max) continue;
		if (!unique.some((seen) => norm(seen) === norm(line))) unique.push(line);
	}
	return unique.length >= count ? unique.slice(0, count) : null;
}

export function lineFault(
	text: string,
	options: { max: number; kind: 'pillar' | 'action'; pillar?: string; siblings?: readonly string[] }
): { code: HelperFinding['code']; reason: string } | null {
	const value = text.trim();
	if (!value) return null;
	if (UNCONTROLLED.test(value)) return { code: 'uncontrolled', reason: 'A result, not something you do.' };
	if (UNTICKABLE.test(value)) {
		return options.kind === 'pillar'
			? { code: 'untickable', reason: 'Hard to tick. Name what you do.' }
			: { code: 'untickable', reason: 'Hard to tick. Say what you do on a day.' };
	}
	if (options.kind === 'action' && options.pillar && restated(options.pillar, value)) return { code: 'restated', reason: 'Says the pillar again.' };
	if (options.siblings?.some((seen) => norm(seen) === norm(value))) {
		return { code: 'repeated', reason: options.kind === 'pillar' ? 'Same as one already named.' : 'Same as another action here.' };
	}
	if (options.kind === 'action' && !/\s/.test(value)) return { code: 'vague', reason: 'One word. Say what you do and how often.' };
	if (value.length > options.max) {
		return options.kind === 'pillar'
			? { code: 'long', reason: 'Long for a pillar. Two or three words.' }
			: { code: 'long', reason: 'Long for one cell. Shorten it.' };
	}
	return null;
}

/** Lines that pass the same tests as a review. The rest come back with a reason. */
export function keptLines(
	raw: string,
	count: number,
	options: { max: number; kind: 'pillar' | 'action'; pillar?: string; siblings?: readonly string[] }
): { kept: string[]; rejected: LineReject[] } {
	const kept: string[] = [];
	const rejected: LineReject[] = [];
	const siblings = [...(options.siblings ?? [])];
	for (const line of splitLines(raw)) {
		if (kept.length >= count) break;
		const fault = lineFault(line, { ...options, siblings });
		if (fault) rejected.push({ text: line, reason: fault.reason });
		else kept.push(line);
		siblings.push(line);
	}
	return { kept, rejected };
}

export function reviewChart(data: ChartData, limit = 6): HelperFinding[] {
	const findings: HelperFinding[] = [];
	const add = (finding: HelperFinding) => {
		if (!findings.some((seen) => seen.key === finding.key)) findings.push(finding);
	};
	data.pillars.forEach((pillar, pillarIndex) => {
		const key = `p${pillarIndex}`;
		const text = pillar.trim();
		if (!text) return;
		const fault = lineFault(text, { max: PILLAR_MAX, kind: 'pillar' });
		if (fault) add({ key, text, ...fault });
	});
	data.actions.forEach((row, pillarIndex) => {
		const pillar = data.pillars[pillarIndex] ?? '';
		const siblings: string[] = [];
		row.forEach((action, actionIndex) => {
			const key = actionKey(pillarIndex, actionIndex);
			const text = action.trim();
			if (!text) return;
			const fault = lineFault(text, { max: ACTION_MAX, kind: 'action', pillar, siblings });
			if (fault) add({ key, text, ...fault });
			siblings.push(text);
		});
	});
	return findings.slice(0, limit);
}

export function rewriteMessages(data: ChartData, finding: HelperFinding, facts = '', again = false): ChatMessage[] {
	const isPillar = finding.key.startsWith('p');
	const pillarIndex = Number(finding.key.slice(1).split('_')[0]);
	return [
		{
			role: 'system',
			content: [
				'You replace one cell of a Mandala chart with a behaviour, three to seven words.',
				'Return only the new line. Do not mention the problem.',
				'"Work hard" → "Block 25 minutes after lunch". "Get 10 million views" → "Post one short video on Tuesday". Do not copy these.'
			].join('\n')
		},
		{
			role: 'user',
			content: [
				...factBlock(facts),
				`Goal: ${data.goal.trim()}`,
				isPillar ? '' : `Pillar: ${(data.pillars[pillarIndex] ?? '').trim()}`,
				`Replace: ${finding.text}`,
				'This cannot be scheduled as written. Write the behaviour.',
				again ? 'That still names the problem. Return only the new behaviour.' : ''
			]
				.filter(Boolean)
				.join('\n')
		}
	];
}

export function oneLine(raw: string, max: number): string | null {
	const line = raw
		.split('\n')
		.map((part) => cleanLine(part.replace(/^\s*(?:rewrite|new text|cell)\s*:\s*/i, '').replace(/^["'\s]+|["'\s.]+$/g, '')))
		.find((part) => part !== '');
	if (!line || line.length > max) return null;
	return line;
}

function lastTouched(data: ChartData): Map<string, string> {
	const touched = new Map<string, string>();
	for (const [dateKey, log] of Object.entries(data.days ?? {})) {
		for (const key of [...log.focus, ...log.checked]) {
			const seen = touched.get(key);
			if (!seen || seen < dateKey) touched.set(key, dateKey);
		}
	}
	return touched;
}

function openActions(data: ChartData): { key: string; pillarIndex: number; text: string }[] {
	const out: { key: string; pillarIndex: number; text: string }[] = [];
	data.actions.forEach((row, pillarIndex) => {
		row.forEach((action, actionIndex) => {
			const key = actionKey(pillarIndex, actionIndex);
			if (filled(action) && isOpenFocus(data.meta?.[key])) out.push({ key, pillarIndex, text: action.trim() });
		});
	});
	return out;
}

function pickWhy(key: string, pillarIndex: number, activity: number[], touched: Map<string, string>, pinned: boolean): string {
	if (pinned) return 'Pinned for this week.';
	if ((activity[pillarIndex] ?? 0) === 0) return 'This pillar was quiet this week.';
	if (!touched.has(key)) return 'Not started yet.';
	return 'Longest since you did it.';
}

/** Five to eight actions, spread across the quietest pillars first. */
export function suggestWeek(data: ChartData, count = 6): HelperPick[] {
	const activity = pillarActivityLast7(data);
	const touched = lastTouched(data);
	const byPillar = new Map<number, { key: string; pillarIndex: number; text: string }[]>();
	for (const action of openActions(data)) {
		const list = byPillar.get(action.pillarIndex) ?? [];
		list.push(action);
		byPillar.set(action.pillarIndex, list);
	}
	for (const list of byPillar.values()) {
		list.sort((a, b) => (touched.get(a.key) ?? '').localeCompare(touched.get(b.key) ?? ''));
	}
	const pillarOrder = [...byPillar.keys()].sort((a, b) => (activity[a] ?? 0) - (activity[b] ?? 0) || a - b);
	const picks: HelperPick[] = [];
	for (let round = 0; picks.length < count; round++) {
		let added = false;
		for (const pillarIndex of pillarOrder) {
			const action = byPillar.get(pillarIndex)?.[round];
			if (!action || picks.length >= count) continue;
			picks.push({ ...action, why: pickWhy(action.key, pillarIndex, activity, touched, false) });
			added = true;
		}
		if (!added) break;
	}
	return picks;
}

/** Three for today: the week's pins first, one per pillar where possible. */
export function suggestToday(data: ChartData, now: Date = new Date(), count = 3): HelperPick[] {
	const today = dateKeyOf(now);
	const done = new Set(data.days?.[today]?.checked ?? []);
	const activity = pillarActivityLast7(data);
	const touched = lastTouched(data);
	const open = openActions(data).filter((action) => !done.has(action.key));
	const pinned = open.filter((action) => data.meta?.[action.key]?.pinned);
	const pinnedKeys = new Set(pinned.map((action) => action.key));
	const ordered = [
		...pinned.sort((a, b) => (touched.get(a.key) ?? '').localeCompare(touched.get(b.key) ?? '')),
		...suggestWeek(data, 64).filter((pick) => !pinnedKeys.has(pick.key) && !done.has(pick.key))
	];
	const picks: HelperPick[] = [];
	const usedPillars = new Set<number>();
	for (const pass of [true, false]) {
		for (const action of ordered) {
			if (picks.length >= count) break;
			if (picks.some((pick) => pick.key === action.key)) continue;
			if (pass && usedPillars.has(action.pillarIndex)) continue;
			usedPillars.add(action.pillarIndex);
			picks.push({
				key: action.key,
				text: action.text,
				pillarIndex: action.pillarIndex,
				why: pickWhy(action.key, action.pillarIndex, activity, touched, pinnedKeys.has(action.key))
			});
		}
	}
	return picks;
}

export function chartContext(data: ChartData): string {
	const lines = [`Goal: ${data.goal.trim() || 'not set'}`];
	data.pillars.forEach((pillar, pillarIndex) => {
		if (!filled(pillar)) return;
		const count = (data.actions[pillarIndex] ?? []).filter(filled).length;
		lines.push(`- ${pillar.trim()} (${count} of 8 actions)`);
	});
	return lines.join('\n');
}

export function askMessages(data: ChartData, question: string): ChatMessage[] {
	return [
		{
			role: 'system',
			content: [
				'You are Bindu, a calm helper inside Mandala, a goal chart: one goal, eight pillars, eight actions each.',
				'Answer in at most three short sentences, in plain words. Be warm and specific to the chart. No lists, no emoji.',
				`If they want something written, say they can ask you to fill the blanks, review the chart, plan the week, or pick today's three.`,
				'',
				chartContext(data)
			].join('\n')
		},
		{ role: 'user', content: question.slice(0, 400) }
	];
}

export function greetingFor(data: ChartData): string {
	if (!filled(data.goal)) return "Hi, I'm Bindu. Tell me what you want to grow into, and I'll sketch a whole chart with you.";
	const plan = fillPlan(data);
	if (plan?.kind === 'pillars') return `Hi again. "${data.goal.trim()}" still has ${plan.empty.length} open pillars. Want me to suggest some?`;
	if (plan?.kind === 'actions') {
		const name = (data.pillars[plan.pillarIndex] ?? '').trim();
		return `Hi again. ${name} has ${plan.empty.length} empty actions. I can fill them, or we can plan the week.`;
	}
	return "Hi again. Your chart is full. I can review it, pick this week's actions, or choose today's three.";
}

export type HelperChip = { job: HelperJob; label: string };

export function chipsFor(data: ChartData, preferredPillar: number | null = null): HelperChip[] {
	if (!filled(data.goal)) return [{ job: 'draft', label: 'Start a chart' }];
	const chips: HelperChip[] = [];
	const plan = fillPlan(data, preferredPillar);
	if (plan?.kind === 'pillars') chips.push({ job: 'fill', label: 'Suggest pillars' });
	if (plan?.kind === 'actions') {
		chips.push({ job: 'fill', label: `Fill ${(data.pillars[plan.pillarIndex] ?? '').trim() || 'the blanks'}` });
	}
	const hasActions = data.actions.some((row) => row.some(filled));
	if (hasActions) {
		chips.push({ job: 'review', label: 'Review my chart' });
		chips.push({ job: 'week', label: 'Plan this week' });
		chips.push({ job: 'today', label: "Pick today's three" });
	}
	chips.push({ job: 'draft', label: 'New chart' });
	return chips;
}

export function describeKey(data: ChartData, key: string): string {
	if (key.startsWith('p')) return `Pillar ${Number(key.slice(1)) + 1}`;
	return labelOfKey(data, key);
}

export function textOfKey(data: ChartData, key: string): string {
	return getByKey(data, key).trim();
}