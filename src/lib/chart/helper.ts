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
	parseBrief,
	pillarActivityLast7,
	type ChartBrief,
	type ChartData
} from './model.ts';

export type HelperJob = 'draft' | 'fill' | 'review' | 'week' | 'today';
export type HelperIntent = HelperJob | 'chart' | 'ask' | 'cancel' | 'progress' | 'chat';
export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type CellEdit = { key: string; before: string; after: string; reason?: string };

export type HelperCard =
	| { kind: 'chart'; data: ChartData }
	| { kind: 'cells'; edits: CellEdit[] }
	| { kind: 'picks'; scope: 'today' | 'week'; picks: HelperPick[] }
	| { kind: 'findings'; findings: HelperFinding[] }
	| { kind: 'download' }
	| { kind: 'prompt' };

export type CardState = 'working' | 'open' | 'used' | 'skipped';

export type HelperMessage = {
	id: number;
	from: 'helper' | 'you';
	text: string;
	card?: HelperCard;
	state?: CardState;
	/** Greetings and status lines. Shown, but not sent to the model as conversation. */
	aside?: boolean;
};

export type HelperMood =
	| 'idle'
	| 'listening'
	| 'thinking'
	| 'waiting'
	| 'happy'
	| 'sorry'
	| 'puzzled'
	| 'offering'
	| 'curious';

export type HelperCardKind = 'chart' | 'cells' | 'picks' | 'findings' | 'download' | 'prompt';

export type HelperMoodOptions = {
	busy?: boolean;
	status?: string | null;
	cheer?: boolean;
	sorry?: boolean;
	card?: HelperCardKind | null;
	step?: 'idle' | 'direction' | 'extra' | 'offer';
	listening?: boolean;
};

export function isWaitingStatus(status?: string | null): boolean {
	if (!status) return false;
	return /\b(?:download|downloading|cache|loading|shader|getting ready|warm|warming|waking up)\b/i.test(status);
}

export function moodFor(options: HelperMoodOptions = {}): HelperMood {
	if (options.busy) {
		return isWaitingStatus(options.status) ? 'waiting' : 'thinking';
	}
	if (options.cheer) return 'happy';
	if (options.sorry) return 'sorry';
	if (options.card === 'findings') return 'puzzled';
	if (options.listening) return 'listening';
	if (options.card) return 'offering';
	if (options.step && options.step !== 'idle') return 'curious';
	return 'idle';
}

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
	'Anything that would change the plan? A date, how much time you have, or write the actions.'
] as const;

const TIMELINE =
	/\b(?:by|before|within|in)\s+((?:\d+|a|one|two|three|six|twelve)\s+(?:days?|weeks?|months?|years?)|(?:the end of )?(?:january|february|march|april|may|june|july|august|september|october|november|december|spring|summer|autumn|fall|winter|next year|the year)(?:\s+\d{4})?|\d{4})\b/i;
const SKIP = /^(go|skip|no|nope|nothing|none|just write it|write it|that's it|thats it|write the actions|-)\.?$/i;

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

const TODAY_COMMAND =
	/\b(?:pick\s+(?:today(?:'s)?|(?:3|three)\b)|today(?:'s)?\s+(?:three|3|actions|picks|list|focus)\b|(?:3|three)\s+(?:things\s+|actions\s+)?for\s+today\b|plan\s+(?:my\s+)?(?:day|today)\b)/i;
const WEEK_COMMAND =
	/\b(?:plan\s+(?:this\s+|the\s+|my\s+|next\s+)?week|this\s+week's\s+plan|picks?\s+for\s+the\s+week|week(?:ly)?\s+plan)\b/i;
const REVIEW_COMMAND =
	/\b(?:review(?:\s+(?:my|this|the))?\s+chart|check(?:\s+(?:my|this|the))?\s+chart|tighten(?:\s+(?:my|this|the))?\s+chart|audit(?:\s+(?:my|this|the))?\s+chart|feedback\s+on\s+(?:my|this|the)\s+chart|(?:review|check)\s+(?:my|the|these)\s+(?:actions|pillars|lines))\b|^(?:review|check)(?:\s+(?:it|this|everything))?[.!]*$/i;
const FILL_COMMAND =
	/\b(?:fill(?:\s+in)?(?:\s+(?:the|all|my))?\s+(?:blanks?|empty|missing|gaps|rest|chart)|(?:finish|complete)\s+(?:the|my|this)\s+chart|suggest\s+pillars)\b/i;
const DRAFT_COMMAND =
	/\b(?:new\s+chart|start\s+(?:a\s+)?(?:new\s+)?chart|make\s+(?:a\s+)?(?:new\s+)?chart|create\s+(?:a\s+)?(?:new\s+)?chart|write\s+(?:a\s+)?(?:new\s+)?chart|start\s+from\s+scratch|start\s+over|start\s+again|(?:a\s+)?(?:new|different)\s+goal)\b/i;
const PROGRESS_COMMAND = /^(?:(?:show\s+(?:me\s+)?)?(?:my\s+)?(?:progress|stats))[.!]*$/i;

// Questions that ask for a job, not about one. "How should I plan my week?" stays a question.
const TODAY_QUESTION =
	/\bwhat\s+(?:should|can|could|do|shall)\s+i\s+(?:do|work\s+on|focus\s+on|start\s+with|tackle|pick)\s+(?:first\s+)?today\b|\bwhat(?:'s|\s+is)\s+(?:on\s+|for\s+)?today\b|\b(?:can|could|would)\s+you\s+(?:pick|choose|plan)\s+(?:my\s+)?(?:today|day|three)\b/i;
const WEEK_QUESTION =
	/\bwhat\s+(?:should|can|could|shall)\s+i\s+(?:do|work\s+on|focus\s+on)\s+(?:this|next)\s+week\b|\b(?:can|could|would)\s+you\s+plan\s+(?:my\s+|this\s+|the\s+)?week\b/i;
const REVIEW_QUESTION =
	/\b(?:is|does)\s+(?:my|this|the)\s+chart\s+(?:look\s+)?(?:any\s+)?(?:good|ok|okay|fine|right|work)\b|\b(?:can|could|would)\s+you\s+(?:review|check)\s+(?:my|this|the)\s+(?:chart|actions|pillars)\b|\bwhat(?:'s|\s+is)\s+wrong\s+with\s+(?:my|this|the)\s+chart\b/i;
const FILL_QUESTION = /\b(?:can|could|would)\s+you\s+(?:fill|finish|complete)\s+(?:in\s+)?(?:the|my|this)\s+(?:chart|blanks|rest|gaps)\b/i;
const PROGRESS_QUESTION =
	/\bhow\s+(?:am\s+i|i'?m)\s+doing\b|\bhow(?:'s|\s+is)\s+my\s+progress\b|\bhow\s+far\s+(?:along\s+)?am\s+i\b|\bwhich\s+pillars?\s+(?:have\s+i\s+|am\s+i\s+|did\s+i\s+)?(?:been\s+)?(?:ignor|neglect|skipp|miss)/i;

const THANKS =
	/^(?:thanks?(?:\s+you)?|thank\s+you|thx|ty|cheers|great|nice|cool|perfect|awesome|got\s+it|ok(?:ay)?|sounds\s+good)(?:\s+(?:so\s+much|a\s+lot|bindu))?[.!]*$/i;
const HELLO = /^(?:hi|hello|hey|hiya|good\s+(?:morning|afternoon|evening))(?:\s+(?:there|bindu))?[.!]*$/i;
const MISSED = /\bi\s+(?:missed|skipped|fell\s+off|lost\s+(?:track|my\s+streak|the\s+streak))\b|\bi\s+haven'?t\s+(?:done|ticked|touched|opened)\b/i;
const QUESTION_PATTERNS = /\?$|^(?:how|why|what|when|where|who|which|can you explain|could you explain|is it|are there|tell me about)\b/i;

const CANCEL_COMMAND =
	/^(?:cancel(?:\s+(?:this|it|that|the\s+draft|draft))?|stop(?:\s+(?:this|it|that))?|nevermind|never\s+mind|abort|quit|forget\s+it|exit|back|no\s+thanks)\.?$/i;

const REJECT_CARD =
	/^(?:cancel(?:\s+(?:this|it|that))?|stop(?:\s+(?:this|it|that))?|nevermind|never\s+mind|abort|quit|forget\s+it|skip|no|nope|nah|not\s+now|not\s+this\s+one|leave\s+it|leave\s+them|discard|dismiss)\.?$/i;

export function isCancellation(text: string): boolean {
	return CANCEL_COMMAND.test(text.replace(/\s+/g, ' ').trim());
}

export function isCardRejection(text: string): boolean {
	return REJECT_CARD.test(text.replace(/\s+/g, ' ').trim());
}

export function intentOf(text: string): HelperIntent {
	if (parseDraftText(text)) return 'chart';
	const trimmed = text.replace(/\s+/g, ' ').trim();
	if (THANKS.test(trimmed) || HELLO.test(trimmed) || MISSED.test(trimmed)) return 'chat';
	if (TODAY_QUESTION.test(trimmed)) return 'today';
	if (WEEK_QUESTION.test(trimmed)) return 'week';
	if (REVIEW_QUESTION.test(trimmed)) return 'review';
	if (FILL_QUESTION.test(trimmed)) return 'fill';
	if (PROGRESS_QUESTION.test(trimmed)) return 'progress';
	if (QUESTION_PATTERNS.test(trimmed)) return 'ask';
	if (isCancellation(trimmed)) return 'cancel';
	if (TODAY_COMMAND.test(trimmed)) return 'today';
	if (WEEK_COMMAND.test(trimmed)) return 'week';
	if (REVIEW_COMMAND.test(trimmed)) return 'review';
	if (FILL_COMMAND.test(trimmed)) return 'fill';
	if (PROGRESS_COMMAND.test(trimmed)) return 'progress';
	if (DRAFT_COMMAND.test(trimmed)) return 'draft';
	return 'ask';
}

const THANKS_REPLIES = ['Any time.', 'Glad it helped.', 'Happy to.'] as const;

/** Thanks, hello, and "I missed a few days". No model. `nextStep` asks for today's and review chips. */
export function chatReply(text: string, data: ChartData, turn = 0): { text: string; nextStep: boolean } {
	const trimmed = text.replace(/\s+/g, ' ').trim();
	if (HELLO.test(trimmed)) return { text: greetingFor(data), nextStep: false };
	if (MISSED.test(trimmed)) {
		return filled(data.goal)
			? { text: 'A missed day tells you about the plan, not about you. Pick three small ones for today?', nextStep: true }
			: { text: 'Nothing is lost. Tell me the goal, and we start from today.', nextStep: false };
	}
	return { text: THANKS_REPLIES[turn % THANKS_REPLIES.length]!, nextStep: false };
}

const HELP_REQUEST =
	/^(?:please\s+)?(?:can you |could you |would you )?(?:help(?: me)?|i need help|what can you do|what do you do|i(?:'|\s)?m (?:feeling |a bit |so )?stuck|i feel stuck|i don'?t know where to (?:start|begin)|where do i (?:start|begin))[.?!]*$/i;

/** A bare ask for help, with no goal of its own. */
export function isHelpRequest(text: string): boolean {
	return HELP_REQUEST.test(text.replace(/\s+/g, ' ').trim());
}

/** What a bare ask for help gets: the next move on this chart. */
export function helpReply(data: ChartData): string {
	if (!filled(data.goal)) return 'Start with the goal. One line is enough, and I can sketch the rest.';
	const plan = fillPlan(data);
	if (plan?.kind === 'pillars') return `The chart needs ${plan.empty.length === 1 ? 'one more pillar' : `${plan.empty.length} more pillars`}. I can suggest them.`;
	if (plan?.kind === 'actions') {
		const name = (data.pillars[plan.pillarIndex] ?? '').trim();
		return `${name} has empty actions. I can fill them, or we can pick today's three from what is there.`;
	}
	return "The chart is full. Three actions for today is the next move.";
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

const SHORT_STOP_WORDS = new Set([
	'in', 'on', 'at', 'to', 'by', 'of', 'or', 'an', 'as', 'is', 'it', 'if', 'be', 'we', 'me', 'my', 'up', 'do', 'go', 'no', 'so'
]);

/** A pillar already on the chart, named in the line. */
export function pillarMentioned(text: string, data: ChartData): number | null {
	if (intentOf(text) !== 'ask') return null;
	let bestIndex = -1;
	let bestLength = 0;
	for (let index = 0; index < data.pillars.length; index++) {
		const name = (data.pillars[index] ?? '').trim();
		if (name.length < 2 || (name.length === 2 && SHORT_STOP_WORDS.has(name.toLowerCase()))) continue;
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

/** What the person said when this chart was drafted, for later fills, rewrites, and answers. */
export function chartBriefFacts(data: ChartData): string {
	const brief = data.brief;
	if (!brief) return '';
	return chartAnswerFacts({
		...emptyChartAnswers(),
		timeline: brief.timeline ?? '',
		situation: brief.situation ?? '',
		focus: brief.focus ?? '',
		constraint: brief.constraint ?? ''
	});
}

export function briefOf(answers: ChartAnswers): ChartBrief | undefined {
	return parseBrief(answers);
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
				'A constraint in the answers is a condition on the work, not eight products.',
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
		const rawPillar = typeof item === 'string' ? cleanLine(item) : '';
		if (!rawPillar) continue;
		const pillar = rawPillar.length > PILLAR_MAX ? truncateAtWordBoundary(rawPillar, PILLAR_MAX) : rawPillar;
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

// A number, a length, a day, or a moment makes "more" and "be" lines tickable.
const ANCHOR =
	/\d|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty|forty|fifty|hundred|once|twice|daily|weekly|monthly|every|each|minutes?|mins?|hours?|pages?|times?|mornings?|evenings?|nights?|tonight|today|tomorrow|noon|lunch|breakfast|dinner|bed|bedtime|weekends?|after|before|when|until|during|mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?)\b/i;
const OPEN_ENDED = /\b(?:more|less|fewer|better|healthier|harder|faster|stronger|regularly|consistently|properly)\b/i;
const STATE = /^(?:be|become|stay|feel|remain|have\s+(?:a|an|more)|improve|master|get\s+(?:good|better)|work\s+on|focus\s+on)\b/i;
const RESULT =
	/^(?:lose|gain|drop)\s+\d[\d.,]*\s*(?:kg|kgs|kilos?|lbs?|pounds|stone)\b|\bget\s+(?:promoted|hired|a\s+raise|a\s+promotion|a\s+six[-\s]?pack|abs|fit|rich|famous|noticed)\b|^win\b|\b(?:become|be)\s+fluent\b|\bmake\s+\$?\d[\d,.]*k?\s+(?:sales|dollars|in\s+sales)\b|\b(?:hit|reach)\s+\d[\d,.]*k?\s+(?:followers|subscribers|views|sales|users|customers)\b/i;

export function lineFault(
	text: string,
	options: { max: number; kind: 'pillar' | 'action'; pillar?: string; siblings?: readonly string[] }
): { code: HelperFinding['code']; reason: string } | null {
	const value = text.trim();
	if (!value) return null;
	if (UNCONTROLLED.test(value) || RESULT.test(value)) {
		return { code: 'uncontrolled', reason: 'A result you cannot do. Write the step that gets you there.' };
	}
	if (UNTICKABLE.test(value)) {
		return options.kind === 'pillar'
			? { code: 'untickable', reason: 'This cannot be marked done. Name what you do.' }
			: { code: 'untickable', reason: 'This cannot be marked done. Write the session, not the wish.' };
	}
	if (options.kind === 'action' && (OPEN_ENDED.test(value) || STATE.test(value)) && !ANCHOR.test(value)) {
		return { code: 'untickable', reason: 'This has no end. Say how much, or when.' };
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

const DAY_MS = 86_400_000;
const STUCK_PICKS = 3;
const STUCK_WINDOW = 14;
const MOMENTUM_WINDOW = 7;

function daysBetween(fromKey: string, now: Date): number {
	const [year, month, day] = fromKey.split('-').map(Number);
	const from = new Date(year!, month! - 1, day!);
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	return Math.round((today.getTime() - from.getTime()) / DAY_MS);
}

/** Same number for the same day and key, so ties settle differently each day but hold still within one. */
function dayJitter(dateKey: string, key: string): number {
	let hash = 2166136261;
	for (const char of `${dateKey}:${key}`) {
		hash ^= char.charCodeAt(0);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0) / 4294967296;
}

export type ActionHistory = {
	/** Days since the last tick, or null if never ticked. */
	sinceTick: number | null;
	/** Ticks in the last 7 days, today excluded. */
	recentTicks: number;
	/** Days picked in the last 14 days without being ticked that day. */
	missedPicks: number;
	/** Days it was taken off the list in the last 7 days. */
	recentDrops: number;
};

export type PickHistory = {
	actions: Map<string, ActionHistory>;
	/** Days since each pillar last had a tick, or null if never. */
	pillarSinceTick: (number | null)[];
	declinedToday: Set<string>;
	droppedToday: Set<string>;
};

/** What the day logs say about each action and pillar. Picks without a tick do not count as done. */
export function pickHistory(data: ChartData, now: Date = new Date()): PickHistory {
	const actions = new Map<string, ActionHistory>();
	const entry = (key: string) => {
		let found = actions.get(key);
		if (!found) {
			found = { sinceTick: null, recentTicks: 0, missedPicks: 0, recentDrops: 0 };
			actions.set(key, found);
		}
		return found;
	};
	const pillarSinceTick: (number | null)[] = Array.from({ length: 8 }, () => null);
	for (const [dateKey, log] of Object.entries(data.days ?? {})) {
		const ago = daysBetween(dateKey, now);
		if (ago < 0) continue;
		for (const key of log.checked) {
			const found = entry(key);
			if (found.sinceTick === null || ago < found.sinceTick) found.sinceTick = ago;
			if (ago > 0 && ago <= MOMENTUM_WINDOW) found.recentTicks += 1;
			const pillarIndex = Number(key.slice(1).split('_')[0]);
			if (key.startsWith('a') && pillarIndex >= 0 && pillarIndex < 8) {
				const seen = pillarSinceTick[pillarIndex];
				if (seen == null || ago < seen) pillarSinceTick[pillarIndex] = ago;
			}
		}
		if (ago > 0 && ago <= STUCK_WINDOW) {
			for (const key of log.focus) if (!log.checked.includes(key)) entry(key).missedPicks += 1;
		}
		if (ago <= MOMENTUM_WINDOW) for (const key of log.dropped ?? []) entry(key).recentDrops += 1;
	}
	const today = data.days?.[dateKeyOf(now)];
	return {
		actions,
		pillarSinceTick,
		declinedToday: new Set(today?.declined ?? []),
		droppedToday: new Set(today?.dropped ?? [])
	};
}

/** Picked again and again, never ticked. Better made smaller than offered again. */
export function isStuck(history: ActionHistory | undefined): boolean {
	return (history?.missedPicks ?? 0) >= STUCK_PICKS && (history?.recentTicks ?? 0) === 0;
}

/** The pillar that has waited longest for a tick. Ties settle by the day, the same way picks do. */
export function quietestPillar(history: PickHistory, dateKey: string, among: readonly number[]): number | null {
	const gap = (index: number) => Math.min(history.pillarSinceTick[index] ?? 99, 99);
	const ranked = [...among].sort((a, b) => gap(b) - gap(a) || dayJitter(dateKey, `p${b}`) - dayJitter(dateKey, `p${a}`));
	return ranked[0] ?? null;
}

type Candidate = { key: string; pillarIndex: number; text: string; pinned: boolean; milestone: boolean; history: ActionHistory | undefined };

function candidates(data: ChartData, history: PickHistory, now: Date, exclude: ReadonlySet<string>): Candidate[] {
	const done = new Set(data.days?.[dateKeyOf(now)]?.checked ?? []);
	const out: Candidate[] = [];
	data.actions.forEach((row, pillarIndex) => {
		if (!filled(data.pillars[pillarIndex])) return;
		row.forEach((action, actionIndex) => {
			const key = actionKey(pillarIndex, actionIndex);
			const meta = data.meta?.[key];
			if (!filled(action) || !isOpenFocus(meta)) return;
			if (done.has(key) || exclude.has(key) || history.declinedToday.has(key) || history.droppedToday.has(key)) return;
			const past = history.actions.get(key);
			if (isStuck(past) && !meta?.pinned) return;
			out.push({ key, pillarIndex, text: action.trim(), pinned: meta?.pinned === true, milestone: meta?.kind === 'milestone', history: past });
		});
	});
	return out;
}

function scoreOf(candidate: Candidate, history: PickHistory, dateKey: string): number {
	const pillarGap = history.pillarSinceTick[candidate.pillarIndex];
	const actionGap = candidate.history?.sinceTick ?? null;
	let score = Math.min(pillarGap ?? 14, 14) * 2 + Math.min(actionGap ?? 21, 21);
	if (candidate.pinned) score += 100;
	if (candidate.milestone) score += 4;
	score -= (candidate.history?.missedPicks ?? 0) * 4;
	score -= (candidate.history?.recentDrops ?? 0) * 6;
	return score + dayJitter(dateKey, candidate.key) * 3;
}

function pillarName(data: ChartData, pillarIndex: number): string {
	return (data.pillars[pillarIndex] ?? '').trim();
}

function plural(count: number, one: string, many = `${one}s`): string {
	return `${count} ${count === 1 ? one : many}`;
}

type PickRole = 'pinned' | 'quiet' | 'momentum' | 'best';

function whyFor(data: ChartData, candidate: Candidate, role: PickRole, history: PickHistory): string {
	if (role === 'pinned' || candidate.pinned) return 'Pinned for this week.';
	const name = pillarName(data, candidate.pillarIndex);
	const pillarGap = history.pillarSinceTick[candidate.pillarIndex];
	if (role === 'quiet') {
		if (pillarGap === null) return `Nothing ticked in ${name} yet.`;
		return `${name} last had a tick ${pillarGap === 1 ? 'yesterday' : `${pillarGap} days ago`}.`;
	}
	const past = candidate.history;
	if (role === 'momentum' && past) return `Done ${past.recentTicks === 1 ? 'once' : plural(past.recentTicks, 'time')} this week. Keep it going.`;
	if (past?.sinceTick == null) return candidate.milestone ? 'A one-time step, not started yet.' : 'Not started yet.';
	return `Last done ${past.sinceTick === 1 ? 'yesterday' : `${past.sinceTick} days ago`}.`;
}

function toPick(data: ChartData, candidate: Candidate, role: PickRole, history: PickHistory): HelperPick {
	return { key: candidate.key, text: candidate.text, pillarIndex: candidate.pillarIndex, why: whyFor(data, candidate, role, history) };
}

/**
 * Today's three, as a mix: pins first, then one from the pillar that has waited longest,
 * one that keeps something going, and the best of the rest. One per pillar while it can.
 */
export function suggestToday(
	data: ChartData,
	now: Date = new Date(),
	count = 3,
	exclude: ReadonlySet<string> = new Set()
): HelperPick[] {
	const history = pickHistory(data, now);
	const dateKey = dateKeyOf(now);
	const pool = candidates(data, history, now, exclude)
		.map((candidate) => ({ candidate, score: scoreOf(candidate, history, dateKey) }))
		.sort((a, b) => b.score - a.score);
	const picks: HelperPick[] = [];
	const used = new Set<string>();
	const usedPillars = new Set<number>();
	const take = (candidate: Candidate | undefined, role: PickRole) => {
		if (!candidate || picks.length >= count || used.has(candidate.key)) return;
		picks.push(toPick(data, candidate, role, history));
		used.add(candidate.key);
		usedPillars.add(candidate.pillarIndex);
	};
	const fresh = (candidate: Candidate) => !used.has(candidate.key) && !usedPillars.has(candidate.pillarIndex);

	for (const { candidate } of pool) if (candidate.pinned && fresh(candidate)) take(candidate, 'pinned');
	const open = new Set(pool.filter(({ candidate }) => fresh(candidate)).map(({ candidate }) => candidate.pillarIndex));
	const quiet = quietestPillar(history, dateKey, [...open]);
	take(pool.find(({ candidate }) => candidate.pillarIndex === quiet && fresh(candidate))?.candidate, 'quiet');
	take(pool.find(({ candidate }) => fresh(candidate) && (candidate.history?.recentTicks ?? 0) > 0)?.candidate, 'momentum');
	for (const { candidate } of pool) if (fresh(candidate)) take(candidate, 'best');
	for (const { candidate } of pool) take(candidate, 'best');
	return picks;
}

/** Five to eight for the week: one per pillar, the ones that waited longest first. */
export function suggestWeek(
	data: ChartData,
	count = 6,
	now: Date = new Date(),
	exclude: ReadonlySet<string> = new Set()
): HelperPick[] {
	const history = pickHistory(data, now);
	const dateKey = dateKeyOf(now);
	const pool = candidates(data, history, now, exclude)
		.map((candidate) => ({ candidate, score: scoreOf(candidate, history, dateKey) }))
		.sort((a, b) => b.score - a.score);
	const picks: HelperPick[] = [];
	const used = new Set<string>();
	for (let round = 0; picks.length < count; round++) {
		const usedPillars = new Set<number>();
		let added = false;
		for (const { candidate } of pool) {
			if (picks.length >= count) break;
			if (used.has(candidate.key) || usedPillars.has(candidate.pillarIndex)) continue;
			if (picks.filter((pick) => pick.pillarIndex === candidate.pillarIndex).length > round) continue;
			picks.push(toPick(data, candidate, candidate.pinned ? 'pinned' : 'best', history));
			used.add(candidate.key);
			usedPillars.add(candidate.pillarIndex);
			added = true;
		}
		if (!added) break;
	}
	return picks;
}

/** The chart in a few lines: every pillar with its counts, one pillar's actions, today, and the last 7 days. */
export function chartContext(data: ChartData, pillar: number | null = null, now: Date = new Date()): string {
	const lines = [`Goal: ${data.goal.trim() || 'not set'}`];
	const activity = pillarActivityLast7(data);
	data.pillars.forEach((name, pillarIndex) => {
		if (!filled(name)) return;
		const count = (data.actions[pillarIndex] ?? []).filter(filled).length;
		const used = activity[pillarIndex] ?? 0;
		lines.push(`- ${name.trim()} (${count} of 8 actions, ${used === 0 ? 'not used' : `used ${used} ${used === 1 ? 'time' : 'times'}`} in the last 7 days)`);
	});
	if (pillar !== null && filled(data.pillars[pillar])) {
		const actions = (data.actions[pillar] ?? []).filter(filled).map((action) => action.trim());
		if (actions.length > 0) lines.push(`Actions in ${data.pillars[pillar]!.trim()}: ${actions.join('; ')}`);
	}
	const today = data.days?.[dateKeyOf(now)];
	if (today && today.focus.length > 0) {
		const done = new Set(today.checked);
		const picks = today.focus.map((key) => `${textOfKey(data, key)}${done.has(key) ? ' (done)' : ''}`).filter((line) => line.trim());
		if (picks.length > 0) lines.push(`Today's picks: ${picks.join('; ')}`);
	}
	const facts = chartBriefFacts(data);
	if (facts) lines.push(facts);
	return lines.join('\n');
}

export function askMessages(
	data: ChartData,
	question: string,
	history: readonly ChatMessage[] = [],
	pillar: number | null = null
): ChatMessage[] {
	const hasGoal = filled(data.goal);
	const contextLines = hasGoal
		? ['Current chart (reference context when relevant):', chartContext(data, pillar ?? pillarMentioned(question, data))]
		: ['The current chart has no goal set.'];

	const systemPrompt = [
		'You are Bindu, a calm, grounded companion inside Mandala, a goal chart app based on the Mandala Method (one center goal, eight pillars, eight actions each).',
		'Voice and tone: Short, warm, plain words. Two to three sentences. No emoji, no bullet lists unless asked, no empty cheerleading or motivational clichés (like "Stay consistent and you\'ll succeed").',
		'Mandala Method principles:',
		'- One chart holds one center goal. If someone is weighing multiple different goals (such as two different languages or unrelated projects), explain that each chart focuses on one direction to keep focus clear, and advise picking one primary goal per chart or creating separate charts for each.',
		'- Day to day: People pick three actions for today across different pillars. They do not try to tackle all eight pillars every day.',
		'- Pillars are the eight drivers that make the goal happen. Actions are behaviors the person directly controls that can be marked done (calendar and control tests).',
		'Conversational guidelines:',
		'- If the user asks about their current chart, actions, or progress, use the reference chart below.',
		'- If the user wants to brainstorm, explore a new ambition, or decide between goals, discuss it thoughtfully. Never say a topic is "outside the chart\'s scope" or that you can only talk about the current chart.',
		'- When they settle on a goal or want to start fresh, invite them to sketch or start a chart.',
		'',
		...contextLines
	].join('\n');

	return [
		{ role: 'system', content: systemPrompt },
		...history,
		{ role: 'user', content: question.slice(0, 600) }
	];
}

export function greetingFor(data: ChartData, now: Date = new Date()): string {
	if (!filled(data.goal)) return "Hi, I'm Bindu. Tell me the goal, and I'll start the chart with you.";
	const insight = insightsFor(data, now)[0];
	if (insight && insight.weight >= 30) return `Hi again. ${insight.text}`;
	const plan = fillPlan(data);
	if (plan?.kind === 'pillars') return `Hi again. "${data.goal.trim()}" still needs ${plan.empty.length} pillars. Want me to suggest some?`;
	if (plan?.kind === 'actions') {
		const name = (data.pillars[plan.pillarIndex] ?? '').trim();
		const count = plan.empty.length;
		return `Hi again. ${name} still has ${count === 1 ? '1 empty action' : `${count} empty actions`}. I can fill them, or we can plan the week.`;
	}
	return "Hi again. The chart is full. I can review it, plan the week, or pick today's three.";
}

export type ChipAct =
	| { kind: 'job'; job: HelperJob; pillar?: number }
	| { kind: 'send'; text: string }
	| { kind: 'sketch' }
	| { kind: 'dismiss' }
	| { kind: 'show'; key: string };

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

/** A chip for the action an insight is about. */
export function insightChip(insight: HelperInsight | undefined): HelperChip | null {
	return insight?.key ? { label: 'Open it', act: { kind: 'show', key: insight.key } } : null;
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
function currentStreak(data: ChartData, now: Date): number {
	let streak = 0;
	const date = new Date(now);
	const active = (key: string) => (data.days?.[key]?.checked.length ?? 0) > 0;
	if (!active(dateKeyOf(date))) date.setDate(date.getDate() - 1);
	while (active(dateKeyOf(date))) {
		streak += 1;
		date.setDate(date.getDate() - 1);
	}
	return streak;
}

function listNames(names: readonly string[]): string {
	if (names.length <= 1) return names[0] ?? '';
	return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function quietPillars(data: ChartData, history: PickHistory, days = 7): number[] {
	return data.pillars.flatMap((name, index) => {
		if (!filled(name) || !(data.actions[index] ?? []).some(filled)) return [];
		const gap = history.pillarSinceTick[index];
		return gap === null || gap >= days ? [index] : [];
	});
}

export type HelperInsight = {
	id: 'today' | 'yesterday' | 'comeback' | 'streak' | 'stuck' | 'dropped' | 'quiet' | 'rhythm';
	text: string;
	/** Higher shows first. Above 30 is worth a greeting. */
	weight: number;
	/** The action it is about, when there is one. */
	key?: string;
};

function quote(text: string): string {
	return `\u201c${text}\u201d`;
}

/**
 * What the log says right now. Short windows on purpose: today, yesterday, this week.
 * Every number is counted from `days`.
 */
export function insightsFor(data: ChartData, now: Date = new Date()): HelperInsight[] {
	if (!filled(data.goal) || !data.days) return [];
	const insights: HelperInsight[] = [];
	const history = pickHistory(data, now);
	const today = data.days[dateKeyOf(now)];
	const yesterdayDate = new Date(now);
	yesterdayDate.setDate(now.getDate() - 1);
	const yesterday = data.days[dateKeyOf(yesterdayDate)];
	const everTicked = Object.values(data.days).some((log) => log.checked.length > 0);
	if (!everTicked) return [];

	if (today && today.focus.length > 0) {
		const done = today.focus.filter((key) => today.checked.includes(key)).length;
		if (done === today.focus.length) insights.push({ id: 'today', text: done === 1 ? "Today's pick is done." : `All ${done} of today's picks are done.`, weight: 50 });
		else if (done > 0) insights.push({ id: 'today', text: `${done} of ${today.focus.length} done today.`, weight: 20 });
	}

	if (yesterday && yesterday.focus.length > 0) {
		const done = yesterday.focus.filter((key) => yesterday.checked.includes(key)).length;
		insights.push({
			id: 'yesterday',
			text: done === yesterday.focus.length ? 'Yesterday you finished everything you picked.' : `Yesterday you finished ${done} of ${yesterday.focus.length}.`,
			weight: done === yesterday.focus.length ? 28 : 18
		});
	}

	if (today && today.checked.length > 0) {
		let gap = 0;
		const date = new Date(now);
		for (let step = 1; step <= 60; step++) {
			date.setDate(date.getDate() - 1);
			if ((data.days[dateKeyOf(date)]?.checked.length ?? 0) > 0) break;
			gap = step;
		}
		if (gap >= 4 && gap < 60) insights.push({ id: 'comeback', text: `First tick in ${gap + 1} days. Good to see you.`, weight: 45 });
	}

	const streak = currentStreak(data, now);
	if (streak >= 3) insights.push({ id: 'streak', text: `${streak} days in a row.`, weight: 15 + Math.min(streak, 15) });

	for (const [key, past] of history.actions) {
		const text = textOfKey(data, key);
		if (!text) continue;
		if (isStuck(past)) {
			insights.push({ id: 'stuck', key, text: `You picked ${quote(text)} ${plural(past.missedPicks, 'time')} and haven't ticked it. A smaller version might go.`, weight: 40 + past.missedPicks });
		} else if (past.recentDrops >= 2) {
			insights.push({ id: 'dropped', key, text: `${quote(text)} came off the list ${past.recentDrops === 2 ? 'twice' : `${past.recentDrops} times`} this week.`, weight: 32 });
		}
	}

	const quiet = quietPillars(data, history);
	if (quiet.length > 0 && quiet.length < 8) {
		const longest = quietestPillar(history, dateKeyOf(now), quiet)!;
		const gap = history.pillarSinceTick[longest];
		const name = pillarName(data, longest);
		insights.push({
			id: 'quiet',
			text: gap === null ? `Nothing ticked in ${name} yet.` : `${name} hasn't had a tick in ${gap} days.`,
			weight: 30
		});
	}

	const times: number[] = [];
	for (const [dateKey, log] of Object.entries(data.days)) {
		const ago = daysBetween(dateKey, now);
		if (ago < 0 || ago > 14) continue;
		for (const clock of Object.values(log.at ?? {})) {
			const hour = Number(clock.split(':')[0]);
			if (Number.isFinite(hour)) times.push(hour);
		}
	}
	if (times.length >= 5) {
		const share = (test: (hour: number) => boolean) => times.filter(test).length / times.length;
		if (share((hour) => hour < 12) >= 0.7) insights.push({ id: 'rhythm', text: 'Most of your ticks land before noon.', weight: 16 });
		else if (share((hour) => hour >= 18) >= 0.7) insights.push({ id: 'rhythm', text: 'Most of your ticks happen in the evening.', weight: 16 });
		else if (share((hour) => hour >= 12 && hour < 18) >= 0.7) insights.push({ id: 'rhythm', text: 'Most of your ticks happen in the afternoon.', weight: 16 });
	}

	return insights.sort((a, b) => b.weight - a.weight);
}

/** "How am I doing?" from the log. Every number here is counted, not written. */
export function progressReport(data: ChartData, now: Date = new Date()): string {
	if (!filled(data.goal)) return 'There is no goal yet. Tell me the goal and we can start the chart.';
	const written = data.actions.flat().filter(filled).length;
	const everTicked = Object.values(data.days ?? {}).some((log) => log.checked.length > 0);
	if (!everTicked) {
		const first = written === 64 ? 'All 64 actions are written. Nothing ticked yet.' : `${written} of 64 actions are written. Nothing ticked yet.`;
		return `${first} ${written > 0 ? "Pick today's three and the log starts." : 'Fill a pillar first, then pick a few for today.'}`;
	}
	const history = pickHistory(data, now);
	let ticks = 0;
	for (let offset = 0; offset < 7; offset++) {
		const date = new Date(now);
		date.setDate(now.getDate() - offset);
		ticks += data.days?.[dateKeyOf(date)]?.checked.length ?? 0;
	}
	const ticked = history.pillarSinceTick.filter((gap, index) => gap !== null && gap < 7 && filled(data.pillars[index])).length;
	const lines: string[] = [
		ticks === 0
			? 'Nothing ticked in the last 7 days.'
			: `${plural(ticks, 'tick')} in the last 7 days, from ${plural(ticked, 'pillar')}.`
	];
	const quiet = quietPillars(data, history).map((index) => pillarName(data, index));
	if (quiet.length > 0 && quiet.length <= 3) lines.push(`Nothing from ${listNames(quiet)} this week.`);
	else if (quiet.length > 3 && quiet.length < 8) lines.push(`${quiet.length} pillars sat out this week, ${listNames(quiet.slice(0, 2))} among them.`);
	const streak = currentStreak(data, now);
	if (streak >= 2) lines.push(`${streak} days in a row.`);
	const milestones = Object.values(data.meta ?? {}).filter((meta) => meta.kind === 'milestone' && meta.done).length;
	if (milestones > 0) lines.push(`${plural(milestones, 'milestone')} done.`);
	const extra = insightsFor(data, now).filter((insight) => !['quiet', 'streak', 'today'].includes(insight.id)).slice(0, 2);
	return [...lines, ...extra.map((insight) => insight.text)].join(' ');
}

const CARD_LIST_MAX = 8;

/** A card as one line of text, so the model knows what was offered and what happened to it. */
export function describeCard(card: HelperCard, state?: CardState): string {
	const outcome = state === 'used' ? ' They used it.' : state === 'skipped' ? ' They skipped it.' : '';
	if (card.kind === 'chart') {
		const pillars = card.data.pillars.filter(filled).map((pillar) => pillar.trim());
		return `[Chart offered: "${card.data.goal.trim()}". Pillars: ${pillars.join('; ') || 'none'}.${outcome}]`;
	}
	if (card.kind === 'cells') {
		const lines = card.edits.slice(0, CARD_LIST_MAX).map((edit) => (edit.before ? `"${edit.before}" to "${edit.after}"` : `"${edit.after}"`));
		return `[Lines offered: ${lines.join('; ')}.${outcome}]`;
	}
	if (card.kind === 'picks') {
		return `[Picks for ${card.scope === 'today' ? 'today' : 'the week'}: ${card.picks.map((pick) => pick.text).join('; ')}.${outcome}]`;
	}
	if (card.kind === 'findings') {
		const lines = card.findings.slice(0, CARD_LIST_MAX).map((finding) => `"${finding.text}" (${finding.reason})`);
		return `[Lines flagged: ${lines.join('; ')}.${outcome}]`;
	}
	return '';
}

/** The last few turns for the model. Greetings and status lines stay out. Cards come in as one line each. */
export function conversationHistory(messages: readonly HelperMessage[], maxMessages = 8): ChatMessage[] {
	const history: ChatMessage[] = [];
	for (const message of messages.filter((entry) => !entry.aside).slice(-maxMessages)) {
		const card = message.card ? describeCard(message.card, message.state) : '';
		const content = [message.text.trim(), card].filter(Boolean).join(' ');
		if (!content) continue;
		history.push({ role: message.from === 'you' ? 'user' : 'assistant', content });
	}
	return history;
}
