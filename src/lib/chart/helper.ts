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
	isRoutine,
	parseBrief,
	pillarActivityLast7,
	weekStartKey,
	type ChartBrief,
	type ChartData
} from './model.ts';

export type HelperJob = 'draft' | 'fill' | 'review' | 'week' | 'today';
export type HelperIntent = HelperJob | 'chart' | 'ask' | 'cancel' | 'progress' | 'chat' | 'facts';
export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type CellEdit = { key: string; before: string; after: string; reason?: string };

export type HelperCard =
	/** `sketch`: the goal and pillars only, while the person decides. Its buttons write the actions or try other pillars. */
	| { kind: 'chart'; data: ChartData; sketch?: boolean }
	| { kind: 'cells'; edits: CellEdit[] }
	| { kind: 'picks'; scope: 'today' | 'week'; picks: HelperPick[] }
	| { kind: 'findings'; findings: HelperFinding[] }
	/** `size` is the weight download, or '' when the browser fetches its own model and the size is its business. */
	| { kind: 'download'; size: string; builtin: boolean }
	| { kind: 'prompt' }
	| { kind: 'facts' };

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

export type HelperCardKind = 'chart' | 'cells' | 'picks' | 'findings' | 'download' | 'prompt' | 'facts';

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

export type FillPlan =
	| { kind: 'pillars'; empty: number[] }
	| { kind: 'actions'; pillarIndex: number; empty: number[] }
	/** Every pillar that has gaps, in order. Asked for as "fill the whole chart". */
	| { kind: 'all'; rows: { pillarIndex: number; empty: number[] }[] };

const DAILY_TIME = /\b\d+\s*(?:min|mins|minutes?|h|hrs?|hours?)\b|\b(?:minutes?|hours?|an hour)\s+(?:a|per|each)\s+(?:day|night|week|evening|morning)\b/i;

/**
 * The second draft question, asking only for what the person has not said yet. With nothing said beyond
 * the goal, the open question. With time and a date both given, no question.
 */
export function followUpQuestion(said: string): string | null {
	const text = said.trim();
	if (!text) return DRAFT_QUESTIONS[1];
	const time = DAILY_TIME.test(text);
	const date = TIMELINE.test(text);
	if (time && date) return null;
	if (time) return 'Is there a date you want this by?';
	if (date) return 'How much time can you give it a day?';
	return 'How much time can you give it a day, and is there a date?';
}

/** Answers to the follow-up question, one tap each. */
export function followUpChips(said: string): HelperChip[] {
	const text = said.trim();
	if (!text) return [];
	const chips: HelperChip[] = [];
	if (!DAILY_TIME.test(text)) {
		for (const label of ['15 minutes a day', '30 minutes a day', 'An hour a day']) chips.push({ label, act: { kind: 'send', text: label } });
	}
	if (!TIMELINE.test(text)) chips.push({ label: 'No date', act: { kind: 'send', text: 'No date' } });
	return chips;
}

export const DRAFT_QUESTIONS = [
	'What is the goal? One line is enough.',
	'Anything that would change the plan? A date, how much time you have, or write the actions.'
] as const;

const TIMELINE =
	/\b(?:by|before|within|in)\s+((?:\d+|a|one|two|three|six|twelve)\s+(?:days?|weeks?|months?|years?)|(?:the end of )?(?:january|february|march|april|may|june|july|august|september|october|november|december|spring|summer|autumn|fall|winter|next year|the year)(?:\s+\d{4})?|\d{4})\b/i;
const SKIP = /^(go|skip|no|nope|nothing|none|just write it|write it|no date|no deadline|that's it|thats it|write the actions|-)\.?$/i;

/** `said` is what came with the goal ("I'm A1, reading is hard"). `extra` answers the next question, or skips it. */
export function chartAnswersFromText(direction: string, extra: string, said = ''): ChartAnswers {
	const answers = emptyChartAnswers();
	answers.direction = direction.replace(/\s+/g, ' ').trim();
	const answer = extra.replace(/\s+/g, ' ').trim();
	const rest = [said.replace(/\s+/g, ' ').trim(), SKIP.test(answer) ? '' : answer].filter(Boolean).join(' ');
	if (!rest) return answers;
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
	/\b(?:(?:fill|write)(?:\s+(?:in|out|up))?\s+(?:it|everything|(?:(?:all(?:\s+of)?|the\s+whole|the\s+entire|the\s+rest\s+of)\s+)?(?:(?:the|my|this)\s+)?(?:blanks?|empty(?:\s+ones)?|missing(?:\s+ones)?|gaps|rest|chart|grid|cells|actions))|(?:finish|complete)\s+(?:the|my|this)\s+chart|suggest\s+pillars)\b/i;
const DRAFT_COMMAND =
	/\b(?:new\s+chart|start\s+(?:a\s+)?(?:new\s+|fresh\s+)?chart|make\s+(?:a\s+)?(?:new\s+)?chart|create\s+(?:a\s+)?(?:new\s+)?chart|write\s+(?:a\s+)?(?:new\s+)?chart|start\s+from\s+scratch|start\s+over|start\s+again|(?:a\s+)?(?:new|different)\s+goal)\b/i;
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

const FACTS_QUESTION =
	/\bwhat\s+(?:do|did)\s+you\s+(?:know|remember|keep)(?:\s+about\s+me)?\b|\bwhat\s+(?:have|did)\s+i\s+(?:tell|told)\s+you\b|\bwhat\s+i\s+told\s+you\b|^what\s+i\s+told\s+you|^(?:what\s+you\s+know|my\s+(?:answers|brief|facts))[.!?]*$/i;

const THANKS =
	/^(?:thanks?(?:\s+you)?|thank\s+you|thx|ty|cheers|great|nice|cool|perfect|awesome|got\s+it|ok(?:ay)?|sounds\s+good)(?:\s+(?:so\s+much|a\s+lot|bindu))?[.!]*$/i;
const HELLO = /^(?:hi|hello|hey|hiya|good\s+(?:morning|afternoon|evening))(?:\s+(?:there|bindu))?[.!]*$/i;
const MISSED = /\bi\s+(?:missed|skipped|fell\s+off|lost\s+(?:track|my\s+streak|the\s+streak))\b|\bi\s+haven'?t\s+(?:done|ticked|touched|opened)\b/i;
const QUESTION_PATTERNS = /\?$|^(?:how|why|what|when|where|who|which|can you explain|could you explain|is it|are there|tell me about)\b/i;

const CANCEL_COMMAND =
	/^(?:cancel(?:\s+(?:this|it|that|the\s+draft|draft))?|stop(?:\s+(?:this|it|that))?|nevermind|never\s+mind|abort|quit|forget\s+it|exit|back|no\s+thanks)\.?$/i;

const REJECT_CARD =
	/^(?:cancel(?:\s+(?:this|it|that))?|stop(?:\s+(?:this|it|that))?|nevermind|never\s+mind|abort|quit|forget\s+it|skip|no|nope|nah|not\s+now|not\s+this\s+one|leave\s+it|leave\s+them|discard|dismiss)\.?$/i;

const RETRY =
	/^(?:(?:please\s+)?try\s+(?:it\s+)?again|again|redo(?:\s+(?:it|that|them|the\s+pillars))?|another\s+(?:one|try|set)|different\s+(?:ones|pillars)|new\s+pillars|start\s+over)(?:\s+please)?[.!]*$/i;
const MISSING_CARD =
	/\b(?:(?:do\s*n'?o?t|do\s+not|can'?t|cannot|can\s+not)\s+(?:see|find)|where(?:'s|\s+is|\s+are|\s+did)|show\s+me|lost|missing|disappeared|nothing\s+(?:showed|shows|appeared))\b.*\b(?:chart|card|draft|pillars|actions|it)\b|\b(?:chart|card|draft|pillars|actions)\b.*\b(?:disappeared|vanished|is\s+gone|went\s+away|is\s+missing|isn'?t\s+(?:there|showing)|not\s+showing)\b/i;

/** "Try again" while a sketch waits: redo the pillars, not an answer to the next question. */
export function isRetry(text: string): boolean {
	return RETRY.test(text.trim());
}

/** "I don't see the chart": the card is in the panel, so a rule answers, not the model. */
export function isMissingCard(text: string): boolean {
	return MISSING_CARD.test(text.trim());
}

/** The panel shows text as is, so markdown from the model would show as asterisks. */
export function plainReply(raw: string): string {
	return raw
		.replace(/\*\*|__/g, '')
		.replace(/^\s{0,3}#{1,6}\s+/gm, '')
		.replace(/(^|\s)[*•]\s+/g, '$1')
		.replace(/^\s*-\s+/gm, '')
		.replace(/[ \t]+/g, ' ')
		.replace(/\s*\n\s*/g, '\n')
		.trim();
}

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
	if (FACTS_QUESTION.test(trimmed)) return 'facts';
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
/**
 * The goal line and everything else said with it. The goal is the first sentence, up to a ", but".
 * The rest ("I'm A1 maybe A2, but my vocabulary is thin") is kept for the plan, never dropped.
 */
export function splitGoal(text: string): { goal: string; said: string } {
	const body = text.replace(/\s+/g, ' ').trim();
	const sentence = body.match(/^(.+?[.!?])(?=\s|$)/)?.[1] ?? body;
	const but = sentence.search(/[,.;]?\s+but\b/i);
	const head = but >= 0 ? sentence.slice(0, but) : sentence;
	const said = body
		.slice(head.length)
		.replace(/^[\s,.;:!?-]+/, '')
		.replace(/^but\s+/i, '')
		.trim();
	return { goal: head.replace(/[.?!]+$/g, '').trim(), said };
}

/** A new goal in a message, with what came with it. Null when the message is not a new goal. */
export function aimParts(text: string, data: ChartData): { aim: string; said: string } | null {
	if (intentOf(text) !== 'ask' || isHelpRequest(text)) return null;
	const trimmed = text.replace(/\s+/g, ' ').trim();
	if (COMPARISON_OR_INDECISION.test(trimmed)) return null;
	const match = trimmed.match(AIM_FRAME);
	if (!match?.[1]) return null;
	const { goal: aim, said } = splitGoal(match[1]);
	if (aim.length < 3) return null;
	const goal = data.goal.trim();
	if (goal && norm(aim) === norm(goal)) return null;
	return { aim, said };
}

export function aimOf(text: string, data: ChartData): string | null {
	return aimParts(text, data)?.aim ?? null;
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
/** A pillar a message is about, for a question or for a job like fill. */
export function pillarMentioned(text: string, data: ChartData): number | null {
	if (intentOf(text) !== 'ask') return null;
	return pillarNamed(text, data);
}

/** The longest pillar name that appears in the text as words, whatever the message asks for. */
export function pillarNamed(text: string, data: ChartData): number | null {
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

/** Pillars with empty actions, and which ones are empty. */
export function actionGaps(data: ChartData): { pillarIndex: number; empty: number[] }[] {
	return [0, 1, 2, 3, 4, 5, 6, 7].flatMap((pillarIndex) => {
		const empty = (data.actions[pillarIndex] ?? []).flatMap((action, index) => (filled(action) ? [] : [index]));
		return filled(data.pillars[pillarIndex]) && empty.length > 0 ? [{ pillarIndex, empty }] : [];
	});
}

/** Empty pillars come first. Then one pillar's actions, or with `all`, every pillar that has gaps. */
export function fillPlan(data: ChartData, preferredPillar?: number | null, all?: false): Exclude<FillPlan, { kind: 'all' }> | null;
export function fillPlan(data: ChartData, preferredPillar: number | null, all: boolean): FillPlan | null;
export function fillPlan(data: ChartData, preferredPillar: number | null = null, all = false): FillPlan | null {
	if (!filled(data.goal)) return null;
	const emptyPillars = data.pillars.flatMap((pillar, index) => (filled(pillar) ? [] : [index]));
	if (emptyPillars.length > 0) return { kind: 'pillars', empty: emptyPillars };
	if (all) {
		const rows = actionGaps(data);
		if (rows.length > 1) return { kind: 'all', rows };
	}
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

/** The worked example in the writer prompt. Its topic is one few people chart, so it does not leak into theirs. */
export const EXAMPLE_LINES = [
	'Test the tank water on Sunday morning',
	'Rinse the filter sponge every other Friday',
	'Feed a pinch of flakes at 8',
	'Swap a quarter of the water on the 1st'
] as const;

const ACTION_EXAMPLE = [
	"Someone else's chart. Do not copy it.",
	'Pillar: Keep the aquarium clean',
	...EXAMPLE_LINES.map((line) => `- ${line}`)
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
				'The goal is one step past where they stand now. When they name a level, the goal is above it.',
				'When they say what is weak or hard, each of those gets its own pillar.',
				'A pillar is a skill or a habit, not a tool: no apps, videos, podcasts or tests as pillars.',
				'The goal already names the subject, so a pillar does not repeat it.',
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

const SUBJECT_STOP = new Set(['about', 'after', 'before', 'every', 'daily', 'weekly', 'more', 'with', 'your', 'from', 'into', 'than']);

/**
 * Drops a word the goal names when it repeats in most pillars: "Study Slovak vocabulary" under
 * "Learn Slovak" becomes "Study vocabulary". The goal already says it, and the cell has 32 characters.
 */
export function dropSharedWord(goal: string, pillars: readonly string[]): string[] {
	const goalWords = new Set(norm(goal).split(' ').filter((word) => word.length >= 4 && !SUBJECT_STOP.has(word)));
	let result = [...pillars];
	for (const word of goalWords) {
		const pattern = new RegExp(`\\s*\\b${escapeRegExp(word)}\\b`, 'i');
		const hits = result.filter((pillar) => pattern.test(pillar)).length;
		if (hits < 5) continue;
		const trimmed = result.map((pillar) => pillar.replace(pattern, '').replace(/\s+/g, ' ').trim());
		// A pillar that was only the subject keeps it.
		result = trimmed.map((pillar, index) => (pillar.split(' ').length >= 2 ? pillar : result[index]!));
	}
	return result;
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
	return pillars.length >= 8 ? { goal, pillars: dropSharedWord(goal, pillars.slice(0, 8)) } : null;
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
	if (/downloading the built-in model/i.test(cleaned)) return { label: 'Downloading.', downloadFillRatio, detail: '' };
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

/** The rewrite prompt's examples. A rewrite that copies one is rejected. */
export const REWRITE_EXAMPLES = ['Block 25 minutes after lunch', 'Post one short video on Tuesday'] as const;

export function rewriteMessages(data: ChartData, finding: HelperFinding, facts = '', again = false): ChatMessage[] {
	const isPillar = finding.key.startsWith('p');
	const pillarIndex = Number(finding.key.slice(1).split('_')[0]);
	return [
		{
			role: 'system',
			content: [
				'You replace one line of a Mandala chart with something this person does: a verb and the thing it applies to.',
				'Return only the new line. Do not mention the problem.',
				`"Work hard" → "${REWRITE_EXAMPLES[0]}". "Get 10 million views" → "${REWRITE_EXAMPLES[1]}". Do not copy these.`
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
		"- You cannot see or change the screen. Charts and suggestions appear as cards in this panel. If they can't find one, say it is in the panel, and never write a chart out in text.",
		'- Plain sentences only. No markdown, no asterisks.',
		'',
		...contextLines
	].join('\n');

	return [
		{ role: 'system', content: systemPrompt },
		...history,
		{ role: 'user', content: question.slice(0, 600) }
	];
}

/** The insight worth opening with, if one is strong and not shown lately. */
export function greetingInsight(data: ChartData, now: Date = new Date()): HelperInsight | null {
	const top = unseenInsights(data, now)[0];
	return top && top.weight >= 30 ? top : null;
}

export function greetingFor(data: ChartData, now: Date = new Date()): string {
	if (!filled(data.goal)) return "Hi, I'm Bindu. Tell me the goal, and I'll start the chart with you.";
	const insight = greetingInsight(data, now);
	if (insight) return `Hi again. ${insight.text}`;
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
	| { kind: 'job'; job: HelperJob; pillar?: number; all?: boolean }
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
		const gaps = actionGaps(data).length;
		if (gaps > 1) chips.push({ label: `Fill all ${gaps} pillars`, act: { kind: 'job', job: 'fill', all: true } });
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

/** Chips while the second draft question waits. A sketch card carries its own buttons. */
export function extraChips(sketch: boolean, said = ''): HelperChip[] {
	const chips = followUpChips(said);
	if (!sketch) chips.push({ label: 'Write the actions', act: { kind: 'send', text: 'go' } });
	return chips;
}

export function fillPillarChip(name: string, pillar: number): HelperChip {
	return jobChip('fill', `Fill ${name}`, pillar);
}

/** A cells card's edits, one group per pillar, so the pillar is named once. Pillar names form their own group. */
export function groupEdits(data: ChartData, edits: readonly CellEdit[]): { key: string; label: string; pillarIndex: number | null; edits: CellEdit[] }[] {
	const groups: { key: string; label: string; pillarIndex: number | null; edits: CellEdit[] }[] = [];
	for (const edit of edits) {
		const isPillar = edit.key.startsWith('p');
		const pillarIndex = isPillar ? null : Number(edit.key.slice(1).split('_')[0]);
		const key = isPillar ? 'pillars' : `a${pillarIndex}`;
		let group = groups.find((entry) => entry.key === key);
		if (!group) {
			const label = isPillar ? 'Pillars' : (data.pillars[pillarIndex!] ?? '').trim() || `Pillar ${pillarIndex! + 1}`;
			group = { key, label, pillarIndex, edits: [] };
			groups.push(group);
		}
		group.edits.push(edit);
	}
	return groups;
}

/** What a cells card does, in the chart's words: its button, and what Bindu says once it is used. */
export function editWords(data: ChartData, edits: readonly CellEdit[]): { button: string; done: string } {
	const count = edits.length;
	const pillars = edits.every((edit) => edit.key.startsWith('p'));
	const counted = pillars ? plural(count, 'pillar') : plural(count, 'action');
	const replacing = edits.some((edit) => edit.before.trim());
	if (replacing) return { button: count === 1 ? 'Replace it' : 'Replace them', done: `Replaced ${counted}.` };
	const groups = groupEdits(data, edits);
	const where = !pillars && groups.length === 1 ? ` to ${groups[0]!.label}` : '';
	return { button: 'Add to chart', done: `Added ${counted}${where}.` };
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
	id: 'today' | 'yesterday' | 'comeback' | 'streak' | 'stuck' | 'dropped' | 'quiet' | 'rhythm' | 'words' | 'follow' | 'retire';
	text: string;
	/** Higher shows first. Above 30 is worth a greeting. */
	weight: number;
	/** The action it is about, when there is one. */
	key?: string;
	/** What else makes it the same insight: a pillar, a week. */
	ref?: string;
};

export function insightSignature(insight: HelperInsight): string {
	return `${insight.id}:${insight.key ?? insight.ref ?? ''}`;
}

const DAY_BOUND = new Set<HelperInsight['id']>(['today', 'yesterday', 'comeback']);
const SHOWN_WINDOW = 3;

/** Insights not shown lately. A day-bound one waits a day, the rest wait three. */
export function unseenInsights(data: ChartData, now: Date = new Date()): HelperInsight[] {
	const shown = new Map<string, number>();
	for (const [dateKey, log] of Object.entries(data.days ?? {})) {
		const ago = daysBetween(dateKey, now);
		if (ago < 0 || ago >= SHOWN_WINDOW) continue;
		for (const signature of log.shown ?? []) shown.set(signature, Math.min(ago, shown.get(signature) ?? ago));
	}
	return insightsFor(data, now).filter((insight) => {
		const ago = shown.get(insightSignature(insight));
		if (ago === undefined) return true;
		return DAY_BOUND.has(insight.id) ? ago > 0 : false;
	});
}

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
			ref: `p${longest}`,
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

	insights.push(...ownWords(data, now), ...followThrough(data, now), ...readyToRetire(data, now));

	return insights.sort((a, b) => b.weight - a.weight);
}

/** Last week's reflection note, said back once the new week starts. */
function ownWords(data: ChartData, now: Date): HelperInsight[] {
	const lastWeek = new Date(now);
	lastWeek.setDate(now.getDate() - 7);
	const previous = weekStartKey(lastWeek);
	const note = (data.weeks?.[previous]?.note ?? '').replace(/\s+/g, ' ').trim();
	if (!note || (data.weeks?.[weekStartKey(now)]?.note ?? '').trim()) return [];
	const said = note.length > 120 ? `${note.slice(0, 117).replace(/\s+\S*$/, '')}\u2026` : note;
	return [{ id: 'words', ref: previous, text: `Last week you wrote: ${quote(said)} Still true?`, weight: 33 }];
}

const FOLLOW_WINDOW = 28;

/** Which pillar's picks get finished, against which don't. Needs enough picks to mean something. */
function followThrough(data: ChartData, now: Date): HelperInsight[] {
	const picked = Array.from({ length: 8 }, () => 0);
	const finished = Array.from({ length: 8 }, () => 0);
	for (const [dateKey, log] of Object.entries(data.days ?? {})) {
		const ago = daysBetween(dateKey, now);
		if (ago <= 0 || ago > FOLLOW_WINDOW) continue;
		for (const key of log.focus) {
			const pillarIndex = Number(key.slice(1).split('_')[0]);
			if (!key.startsWith('a') || !(pillarIndex >= 0 && pillarIndex < 8)) continue;
			picked[pillarIndex]! += 1;
			if (log.checked.includes(key)) finished[pillarIndex]! += 1;
		}
	}
	const total = picked.reduce((sum, count) => sum + count, 0);
	const counted = picked.flatMap((count, index) => (count >= 4 && filled(data.pillars[index]) ? [index] : []));
	if (total < 10 || counted.length < 2) return [];
	const rate = (index: number) => finished[index]! / picked[index]!;
	const ranked = [...counted].sort((a, b) => rate(b) - rate(a));
	const best = ranked[0]!;
	const worst = ranked[ranked.length - 1]!;
	if (rate(best) - rate(worst) < 0.4) return [];
	return [
		{
			id: 'follow',
			ref: `p${worst}`,
			text: `You finish ${pillarName(data, best)} picks ${finished[best]} of ${picked[best]} times. ${pillarName(data, worst)}, ${finished[worst]} of ${picked[worst]}.`,
			weight: 22
		}
	];
}

/** A routine ticked most days for two weeks may have become a habit, and its cell could hold something new. */
function readyToRetire(data: ChartData, now: Date): HelperInsight[] {
	const out: HelperInsight[] = [];
	for (const [key, meta] of Object.entries(data.meta ?? {})) {
		if (!isRoutine(meta)) continue;
		const text = textOfKey(data, key);
		if (!text) continue;
		let days = 0;
		for (let offset = 0; offset < 14; offset++) {
			const date = new Date(now);
			date.setDate(now.getDate() - offset);
			if (data.days?.[dateKeyOf(date)]?.checked.includes(key)) days += 1;
		}
		if (days >= 10) {
			out.push({ id: 'retire', key, text: `${quote(text)} is ticked on ${days} of the last 14 days. It may be a habit now, and the cell could hold something new.`, weight: 24 });
		}
	}
	return out;
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

type MethodEntry = { match: RegExp; text: string; job?: HelperJob };

// Answers about the method, from MethodGuide and the method notes. No model.
const METHOD: readonly MethodEntry[] = [
	{
		match: /\bwho\s+are\s+you\b|\bwhat(?:'s|\s+is)\s+(?:a\s+)?bindu\b|\bwhy\s+(?:the\s+name\s+)?bindu\b|\byour\s+name\b/i,
		text: "I'm Bindu, named for the dot at the center of a mandala. I help you start the chart, pick what to do, and see how it's going."
	},
	{
		match: /\bwhat(?:'s|\s+is|\s+are)\s+(?:a\s+)?pillars?\b|\bwhat\s+(?:does|do)\s+(?:a\s+)?pillars?\s+mean\b/i,
		text: 'A pillar is one of the eight things that has to be true for the goal to happen. Each gets eight actions around it. Keep them as different drivers, not eight versions of one.'
	},
	{
		match: /\bwhat(?:'s|\s+is)\s+(?:the\s+)?(?:goal|center|centre|middle)\b|\bwhat\s+goes\s+in\s+the\s+(?:center|centre|middle)\b/i,
		text: 'The center is one direction. It can be big, or a little vague. The pillars and actions around it are what make it specific.'
	},
	{
		match: /\bwhat(?:'s|\s+is)\s+(?:a\s+)?(?:good\s+)?action\b|\bwhat\s+counts\s+as\s+an?\s+action\b|\bexample\s+of\s+an?\s+(?:good\s+)?action\b|\btwo\s+tests\b|\bcalendar\s+test\b|\bcontrol\s+test\b/i,
		text: 'An action is something you do and can tick off. It passes two tests: it could go on a calendar, and it is yours to do, not a result. "Run 20 minutes on Tuesday" passes. "Get fit" does not.',
		job: 'review'
	},
	{
		match: /\bwhy\s+(?:64|sixty[-\s]four|eight|8)\b|\bwhy\s+so\s+many\b|\bdo\s+i\s+(?:have|need)\s+to\s+(?:fill|do)\s+(?:all|every)/i,
		text: 'Eight pillars with eight actions each makes 64. The number pushes you past the first obvious ideas. You never do all 64 at once.'
	},
	{
		match: /\bhow\s+many\b[^?]*\b(?:a|per|each|every)\s+day\b|\bhow\s+many\b[^?]*\btoday\b|\bshould\s+i\s+do\s+(?:all|every)\b/i,
		text: 'Three a day is plenty, ideally from different pillars. The chart is the map. A day is a few actions pulled off it.',
		job: 'today'
	},
	{
		match: /\bhow\s+many\b[^?]*\b(?:a|per|each|this)\s+week\b|\bwhere\s+do\s+i\s+start\s+(?:with|on)\s+(?:the\s+)?(?:chart|64)\b/i,
		text: 'Five to eight for the first week. Keep what works and add a few more each week. Most people take on the whole sheet over 8 to 12 weeks.',
		job: 'week'
	},
	{
		match: /\b(?:two|2|more\s+than\s+one|multiple|several|another)\s+goals?\b|\bsecond\s+goal\b/i,
		text: 'One chart holds one direction. A second goal gets its own chart, so each stays clear.',
		job: 'draft'
	},
	{
		match: /\bwhat\s+(?:if|happens\s+if)\s+i\s+(?:miss|skip|fall\s+behind|don'?t)\b|\bfell\s+behind\b|\bmissed\s+a\s+(?:day|week)\b/i,
		text: 'A missed day says something about the plan, not about you. Make the action smaller or move it, then pick three for today.',
		job: 'today'
	},
	{
		match: /\bhow\s+often\b[^?]*\b(?:review|change|update|look\s+at|redo)\b|\bwhen\s+(?:should\s+i\s+)?(?:change|update|swap|replace)\s+(?:a\s+)?(?:pillar|action)/i,
		text: 'Look at it weekly or monthly. Retire what has become a habit, swap actions that are not happening, and move a pillar when the drivers change.',
		job: 'review'
	},
	{
		match: /\b(?:routine|milestone)s?\b[^?]*\b(?:routine|milestone|difference|mean)\b|\bwhat(?:'s|\s+is)\s+an?\s+(?:routine|milestone)\b/i,
		text: 'A routine repeats, like a daily walk, and shows up every day. A milestone is done once, like booking the exam. Both have to be things you can tick.'
	},
	{
		match: /\bwhat\s+(?:does|do)\s+pin(?:ning|ned)?\b|\bwhat(?:'s|\s+is)\s+(?:a\s+)?pin(?:ned)?\b|\bwhy\s+pin\b/i,
		text: "Pinning puts an action at the front of your picks for the week. Pin the few that matter most right now."
	},
	{
		match: /\bwho\s+(?:invented|created|made)\b|\bwhere\s+(?:does|did)\s+(?:this|it|the\s+(?:method|chart|grid))\s+come\s+from\b|\bohtani\b|\bharada\b|\bhistory\s+of\b/i,
		text: "The grid is Yasuo Matsumura's Mandalachart, from 1979. Takashi Harada used it in his method, and Shohei Ohtani filled one in at school, which made it famous."
	},
	{
		match: /\b(?:is\s+(?:my\s+)?(?:data|chart|this)\s+private|privacy|where\s+(?:is|does)\s+my\s+(?:data|chart)|do\s+you\s+send|does\s+(?:my\s+)?(?:data|anything)\s+leave)\b/i,
		text: 'Your chart stays in this browser, and I run on this device too. Nothing leaves unless you share the chart or turn on sync.'
	},
	{
		match: /\bcan'?t\s+think\s+of\b|\b(?:stuck|blank)\s+on\s+(?:a\s+)?(?:pillar|actions?)\b|\bhow\s+do\s+i\s+(?:come\s+up\s+with|think\s+of|write)\s+actions?\b/i,
		text: 'Ask what would make the pillar easier to do: a time, a place, something to set up the night before. "Shoes by the door" is an action. I can fill the empty ones too.',
		job: 'fill'
	}
];

/** A written answer about the method, when the question matches one. */
export function methodAnswer(text: string): { text: string; job?: HelperJob } | null {
	const trimmed = text.replace(/\s+/g, ' ').trim();
	const entry = METHOD.find((item) => item.match.test(trimmed));
	return entry ? { text: entry.text, job: entry.job } : null;
}

export const BRIEF_LABELS: Record<keyof ChartBrief, string> = {
	timeline: 'Timeline',
	situation: 'Where you stand',
	focus: 'Focus',
	constraint: 'Something to work around'
};

export type AskRoute = 'help' | 'method' | 'aim' | 'pillar' | 'model';
export type HelperRoute = Exclude<HelperIntent, 'ask'> | AskRoute;

/** Where a message that matched no job goes. `HelperStore.send` follows this order. */
export function askRoute(text: string, data: ChartData): AskRoute {
	if (isHelpRequest(text)) return 'help';
	if (methodAnswer(text)) return 'method';
	if (aimOf(text, data)) return 'aim';
	const mentioned = pillarMentioned(text, data);
	if (mentioned !== null && isPillarActionRequest(text)) return 'pillar';
	return 'model';
}

/** Where a message lands when nothing else is going on: a job, a written reply, or the model. */
export function routeOf(text: string, data: ChartData): HelperRoute {
	const intent = intentOf(text);
	return intent === 'ask' ? askRoute(text, data) : intent;
}
