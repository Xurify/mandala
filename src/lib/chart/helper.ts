import { nearCopy, norm, restated, UNCONTROLLED, UNTICKABLE } from './coach-score.ts';
import {
	ACTION_MAX,
	chartAnswersMessage,
	emptyChartAnswers,
	GOAL_MAX,
	jsonValue,
	parseDraftText,
	PILLAR_MAX,
	type ChartAnswers
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
	'What is the goal? One line is enough.',
	'Anything that would change the plan? A date, how much time you have. Or say go.'
] as const;

const TIMELINE =
	/\b(?:by|before|within|in)\s+((?:\d+|a|one|two|three|six|twelve)\s+(?:days?|weeks?|months?|years?)|(?:the end of )?(?:january|february|march|april|may|june|july|august|september|october|november|december|spring|summer|autumn|fall|winter|next year|the year)(?:\s+\d{4})?|\d{4})\b/i;
const SKIP = /^(go|skip|no|nope|nothing|none|just write it|write it|that's it|thats it|-)\.?$/i;

export function chartAnswersFromText(direction: string, extra: string): ChartAnswers {
	const answers = emptyChartAnswers();
	answers.direction = direction.replace(/\s+/g, ' ').trim();
	const rest = extra.replace(/\s+/g, ' ').trim();
	if (!rest || SKIP.test(rest)) return answers;
	const timeline = rest.match(TIMELINE);
	if (timeline?.[1]) answers.timeline = timeline[1];
	answers.situation = rest;
	return answers;
}

const TODAY_COMMAND = /\b(?:pick\s+today(?:'s)?(?:\s+three)?|today(?:'s)?\s+three|three\s+for\s+today)\b/i;
const WEEK_COMMAND = /\b(?:plan\s+(?:this\s+|the\s+)?week|this\s+week's\s+plan|picks?\s+for\s+the\s+week)\b/i;
const REVIEW_COMMAND =
	/\b(?:review(?:\s+(?:my|this|the))?\s+chart|check(?:\s+(?:my|this|the))?\s+chart|tighten(?:\s+(?:my|this|the))?\s+chart|audit(?:\s+(?:my|this|the))?\s+chart|feedback\s+on\s+(?:my|this|the)\s+chart)\b/i;
const FILL_COMMAND = /\b(?:fill(?:\s+(?:the|all|my))?\s+(?:blanks?|empty|missing)|finish\s+the\s+chart|suggest\s+pillars)\b/i;
const DRAFT_COMMAND =
	/\b(?:new\s+chart|start\s+(?:a\s+)?(?:new\s+)?chart|make\s+(?:a\s+)?(?:new\s+)?chart|create\s+(?:a\s+)?(?:new\s+)?chart|write\s+(?:a\s+)?(?:new\s+)?chart|start\s+from\s+scratch|start\s+over)\b/i;
const QUESTION_PATTERNS = /\?$|^(?:how|why|what|when|where|who|which|can you explain|could you explain|is it|are there|tell me about)\b/i;

export function intentOf(text: string): HelperIntent {
	if (parseDraftText(text)) return 'chart';
	const trimmed = text.trim();
	if (QUESTION_PATTERNS.test(trimmed)) return 'ask';
	if (TODAY_COMMAND.test(trimmed)) return 'today';
	if (WEEK_COMMAND.test(trimmed)) return 'week';
	if (REVIEW_COMMAND.test(trimmed)) return 'review';
	if (FILL_COMMAND.test(trimmed)) return 'fill';
	if (DRAFT_COMMAND.test(trimmed)) return 'draft';
	return 'ask';
}

const HELP_REQUEST =
	/^(?:please\s+)?(?:can you |could you |would you )?(?:help(?: me)?|i need help|what can you do|i(?:'|\s)?m stuck)[.?!]*$/i;

/** A bare ask for help, with no goal of its own. */
export function isHelpRequest(text: string): boolean {
	return HELP_REQUEST.test(text.replace(/\s+/g, ' ').trim());
}

const AIM_FRAME =
	/^(?:please\s+)?(?:can you help me\s+|could you help me\s+|help me\s+|i want to\s+|i wanna\s+|i'd like to\s+|i would like to\s+|i need to\s+|i want\s+|i am thinking of\s+|i'm thinking of\s+|i am thinking about\s+|i'm thinking about\s+|thinking of\s+|thinking about\s+|my goal is to\s+|my goal is\s+|let's make a chart for\s+|make a chart for\s+|can we make a chart for\s+|can we start a chart for\s+|start a chart for\s+|let's go with\s+|let's do\s+|i'll go with\s+|i will go with\s+|i choose\s+|i pick\s+)(.+)$/i;

const COMPARISON_OR_INDECISION =
	/\b(?:which|and\/or|\bor\b|should i|decide between|choose between|not sure which|versus|vs\.?)\b/i;

/** A new direction, when the line is not already a job and is not the current goal. */
export function aimOf(text: string, data: ChartData): string | null {
	if (intentOf(text) !== 'ask' || isHelpRequest(text)) return null;
	const trimmed = text.replace(/\s+/g, ' ').trim();
	if (COMPARISON_OR_INDECISION.test(trimmed)) return null;
	const match = trimmed.match(AIM_FRAME);
	if (!match?.[1]) return null;
	const aim = match[1]
		.replace(/[,.]?\s+but\b[\s\S]*$/i, '')
		.replace(/[.?!]+$/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	if (aim.length < 3) return null;
	const goal = data.goal.trim();
	if (goal && norm(aim) === norm(goal)) return null;
	return aim;
}

const PILLAR_ACTION_FRAME = /\b(?:fill|finish|complete|write|suggest\s+actions?\s+for|work\s+on|focus\s+on)\b/i;

export function isPillarActionRequest(text: string): boolean {
	return PILLAR_ACTION_FRAME.test(text);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A pillar already on the chart, named in the line. */
export function pillarMentioned(text: string, data: ChartData): number | null {
	if (intentOf(text) !== 'ask') return null;
	let bestIndex = -1;
	let bestLength = 0;
	for (let index = 0; index < data.pillars.length; index++) {
		const name = (data.pillars[index] ?? '').trim();
		if (name.length < 4) continue;
		if (!new RegExp(`\\b${escapeRegExp(name)}\\b`, 'i').test(text)) continue;
		if (name.length > bestLength) {
			bestIndex = index;
			bestLength = name.length;
		}
	}
	return bestIndex === -1 ? null : bestIndex;
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
	'Each line is something this person does, said the way you would say it: a verb and the thing it applies to. No results they cannot control, no "work hard", no "be more".';

const ACTION_EXAMPLE = [
	"Someone else's chart. Do not copy it.",
	'Pillar: Listen to Spanish for 15 minutes',
	'- Play Spanish audio for 15 minutes at breakfast',
	'- Shadow a two-minute clip after lunch',
	'- Watch one show on Friday',
	'- Note three phrases from the clip'
].join('\n');

export type LineReject = { text: string; reason: string };

/** The person's answers, with empty fields left out, so a later call still knows them. */
export function chartAnswerFacts(answers: ChartAnswers): string {
	const rows: [string, string][] = [
		['Direction', answers.direction],
		['Timeline', answers.timeline],
		['Where they stand', answers.situation],
		['Focus', answers.focus],
		['Constraint', answers.constraint]
	];
	const lines = rows.filter(([, value]) => value.trim() !== '').map(([label, value]) => `- ${label}: ${value.trim()}`);
	return lines.length > 0 ? ['About this person:', ...lines].join('\n') : '';
}

/** Goal and the other pillars, for a chart that already exists. */
export function chartContextFacts(data: ChartData, skipPillar?: number): string {
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

export function pillarsMessages(answers: ChartAnswers): ChatMessage[] {
	return [
		{
			role: 'system',
			content: [
				'You are a Mandala Method coach.',
				'The goal is one line for the center of the chart. The eight pillars are the drivers that make it come true. Drop nice-to-haves. Do not merge two aims into one pillar.',
				'Each pillar is a short sentence this person could say: a verb and the thing it applies to, at most 32 characters. A follower count, a grade, or a finish time is not a pillar.',
				'A constraint in the brief is a condition on the work, not eight products.',
				'Return only this JSON: {"goal":"...","pillars":["...", 8 strings]}.'
			].join('\n')
		},
		{
			role: 'user',
			content: [chartAnswerFacts(answers), chartAnswersMessage(answers).replace('Return 8 pillars. Each pillar has exactly 8 actions.', 'Return the goal and 8 pillars.')]
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
		if (!pillars.some((seen) => norm(seen) === norm(pillar) || nearCopy(seen, pillar))) pillars.push(pillar);
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
	downloadFillRatio: number | null;
	detail: string;
};

function clampRatio(ratio: number | null | undefined): number | null {
	if (ratio == null || !Number.isFinite(ratio)) return null;
	return Math.min(1, Math.max(0, ratio));
}

/** Turn a web-llm progress line into a short status. The reported ratio wins over the percent buried in the text. */
export function describeCoachProgress(text: string, reportedFillRatio?: number | null): CoachLoad {
	const source = typeof text === 'string' ? text : '';
	const cleaned = source.replace(/\s*\[[^\]]*\]\s*/g, ' ').replace(/\s+/g, ' ').trim();
	const fromReport = clampRatio(reportedFillRatio);
	const fromText = cleaned.match(/(\d+(?:\.\d+)?)\s*%\s*completed/i);
	const downloadFillRatio = fromReport ?? (fromText ? clampRatio(Number(fromText[1]) / 100) : null);
	const mb = cleaned.match(/(\d+)\s*MB/i)?.[1];
	const detail = mb ? `${mb} MB` : '';

	if (/start to fetch/i.test(cleaned)) return { label: 'Starting the download.', downloadFillRatio: downloadFillRatio ?? 0, detail: '' };
	if (/fetching param/i.test(cleaned)) return { label: 'Downloading.', downloadFillRatio, detail };
	if (/loading model from cache/i.test(cleaned)) return { label: 'Loading', downloadFillRatio, detail };
	if (/shader/i.test(cleaned)) return { label: 'Getting ready.', downloadFillRatio, detail: '' };
	if (/warming up/i.test(cleaned)) return { label: 'Warming up.', downloadFillRatio: null, detail: '' };
	if (/coach is ready/i.test(cleaned)) return { label: 'Ready, on this device.', downloadFillRatio: null, detail: '' };
	return { label: cleaned, downloadFillRatio: null, detail: '' };
}

/** Cut at the last whole word that fits. The writer does not use this. A long line is rejected. */
export function truncateAtWordBoundary(value: string, max: number): string {
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
			content: `You name pillars for a Mandala chart. A pillar is one part of the goal. ${CELL_RULES} At most 32 characters. A constraint is a condition on the work, not eight products. Return exactly ${count} lines, numbered 1. to ${count}. No other text.`
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
	if (UNCONTROLLED.test(value)) return { code: 'uncontrolled', reason: 'A result you cannot do. Write the step that gets you there.' };
	if (UNTICKABLE.test(value)) {
		return options.kind === 'pillar'
			? { code: 'untickable', reason: 'This cannot be marked done. Name what you do.' }
			: { code: 'untickable', reason: 'This cannot be marked done. Write the session, not the wish.' };
	}
	if (options.kind === 'action' && options.pillar && restated(options.pillar, value)) return { code: 'restated', reason: 'This repeats the pillar. Write what makes it happen.' };
	if (options.siblings?.some((seen) => norm(seen) === norm(value) || nearCopy(seen, value))) {
		return { code: 'repeated', reason: options.kind === 'pillar' ? 'Same as a pillar you already have.' : 'Same afternoon as another action on the chart.' };
	}
	if (options.kind === 'action' && !/\s/.test(value)) return { code: 'vague', reason: 'Too thin. Say what you do, and when.' };
	if (value.length > options.max) {
		return options.kind === 'pillar'
			? { code: 'long', reason: 'Too long for a pillar.' }
			: { code: 'long', reason: 'Too long for one action.' };
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
	const namedPillars: string[] = [];
	data.pillars.forEach((pillar, pillarIndex) => {
		const key = `p${pillarIndex}`;
		const text = pillar.trim();
		if (!text) return;
		const fault = lineFault(text, { max: PILLAR_MAX, kind: 'pillar', siblings: namedPillars });
		if (fault) add({ key, text, ...fault });
		namedPillars.push(text);
	});
	const seenActions: string[] = [];
	data.actions.forEach((row, pillarIndex) => {
		const pillar = data.pillars[pillarIndex] ?? '';
		row.forEach((action, actionIndex) => {
			const key = actionKey(pillarIndex, actionIndex);
			const text = action.trim();
			if (!text) return;
			const fault = lineFault(text, { max: ACTION_MAX, kind: 'action', pillar, siblings: seenActions });
			if (fault) add({ key, text, ...fault });
			seenActions.push(text);
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
				'You replace one line of a Mandala chart with something this person does: a verb and the thing it applies to.',
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
	if ((activity[pillarIndex] ?? 0) === 0) return 'You have not used this pillar this week.';
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

export function askMessages(data: ChartData, question: string, history: readonly ChatMessage[] = []): ChatMessage[] {
	const hasGoal = filled(data.goal);
	const contextLines = hasGoal
		? ['Current chart (reference context when relevant):', chartContext(data)]
		: ['The current chart has no goal set.'];

	const systemPrompt = [
		'You are Bindu, a calm, grounded companion inside Mandala, a goal chart app based on the Mandala Method (one center goal, eight pillars, eight actions each).',
		'Voice and tone: Short, warm, plain words. Two to three sentences. No emoji, no bullet lists unless asked, no empty cheerleading or motivational clichés (like "Stay consistent and you\'ll succeed").',
		'Mandala Method principles:',
		'- One chart holds one center goal. If someone is weighing multiple different goals (such as two different languages or unrelated projects), explain that each chart focuses on one direction to keep focus clear, and advise picking one primary goal per chart or creating separate charts for each.',
		'- Day to day: People pick three actions for today across different pillars. They do not try to tackle all eight pillars every day.',
		'- Pillars are the eight drivers that make the goal happen. Actions are tickable behaviors the person directly controls (calendar and control tests).',
		'Conversational guidelines:',
		'- If the user asks about their current chart, actions, or progress, use the reference chart below.',
		'- If the user wants to brainstorm, explore a new ambition, or decide between goals, discuss it thoughtfully. Never say a topic is "outside the chart\'s scope" or that you can only talk about the current chart.',
		'- When they settle on a goal or want to start fresh, invite them to sketch or start a new chart.',
		'',
		...contextLines
	].join('\n');

	return [
		{ role: 'system', content: systemPrompt },
		...history,
		{ role: 'user', content: question.slice(0, 600) }
	];
}

export function greetingFor(data: ChartData): string {
	if (!filled(data.goal)) return "Hi, I'm Bindu. Tell me the goal, and I'll start the chart with you.";
	const plan = fillPlan(data);
	if (plan?.kind === 'pillars') return `Hi again. "${data.goal.trim()}" still needs ${plan.empty.length} pillars. Want me to suggest some?`;
	if (plan?.kind === 'actions') {
		const name = (data.pillars[plan.pillarIndex] ?? '').trim();
		return `Hi again. ${name} still has ${plan.empty.length} empty actions. I can fill them, or we can plan the week.`;
	}
	return "Hi again. The chart is full. I can review it, plan the week, or pick today's three.";
}

export type ChipAct =
	| { kind: 'job'; job: HelperJob; pillar?: number }
	| { kind: 'send'; text: string }
	| { kind: 'sketch' }
	| { kind: 'dismiss' };

export type HelperChip = { label: string; act: ChipAct };

function jobChip(job: HelperJob, label: string, pillar?: number): HelperChip {
	return { label, act: pillar === undefined ? { kind: 'job', job } : { kind: 'job', job, pillar } };
}

export function chipsFor(data: ChartData, preferredPillar: number | null = null): HelperChip[] {
	if (!filled(data.goal)) return [jobChip('draft', 'Start a chart')];
	const chips: HelperChip[] = [];
	const plan = fillPlan(data, preferredPillar);
	if (plan?.kind === 'pillars') chips.push(jobChip('fill', 'Suggest pillars'));
	if (plan?.kind === 'actions') {
		const name = (data.pillars[plan.pillarIndex] ?? '').trim();
		chips.push(jobChip('fill', name ? `Fill ${name}` : 'Fill empty actions', plan.pillarIndex));
	}
	const hasActions = data.actions.some((row) => row.some(filled));
	if (hasActions) {
		chips.push(jobChip('review', 'Review my chart'));
		chips.push(jobChip('week', 'Plan this week'));
		chips.push(jobChip('today', "Pick today's three"));
	}
	chips.push(jobChip('draft', 'Start a chart'));
	return chips;
}

export function offerChips(): HelperChip[] {
	return [
		{ label: 'Sketch the new one', act: { kind: 'sketch' } },
		{ label: 'Stay on this chart', act: { kind: 'dismiss' } }
	];
}

export function helpChips(): HelperChip[] {
	return [jobChip('today', "Pick today's three"), jobChip('review', 'Review my chart')];
}

export function extraChips(sketch: boolean): HelperChip[] {
	const chips: HelperChip[] = [{ label: 'Write the actions', act: { kind: 'send', text: 'go' } }];
	if (sketch) chips.push({ label: 'Rename the pillars', act: { kind: 'sketch' } });
	return chips;
}

export function fillPillarChip(name: string, pillar: number): HelperChip {
	return jobChip('fill', `Fill ${name}`, pillar);
}

export function describeKey(data: ChartData, key: string): string {
	if (key.startsWith('p')) return `Pillar ${Number(key.slice(1)) + 1}`;
	return labelOfKey(data, key);
}

export function textOfKey(data: ChartData, key: string): string {
	return getByKey(data, key).trim();
}