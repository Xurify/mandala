import type { HelperRoute } from './helper.ts';

/**
 * What the bank can name. Aim and pillar need the chart, so the exact rules keep them. Cancel stays exact:
 * "how do I stop procrastinating" is not a request to stop.
 */
export type BankRoute = Extract<HelperRoute, 'today' | 'week' | 'review' | 'fill' | 'draft' | 'progress' | 'chat' | 'facts' | 'help' | 'method'>;

export type IntentGuess = { kind: 'route'; route: BankRoute } | { kind: 'clarify'; routes: BankRoute[] } | { kind: 'none' };

export type ChatKind = 'hello' | 'missed' | 'thanks';

/** Chat gets one of three written replies, so its examples say which. */
const CHAT: Record<ChatKind, readonly string[]> = {
	hello: ['hello', 'good morning'],
	missed: ['sorry I disappeared for a week', 'I skipped yesterday', 'I have not done anything in a week'],
	thanks: ['thanks', 'thank you so much', 'cool', 'ok cool']
};

/**
 * Example phrasings per route, for messages the exact rules in `helper.ts` do not catch. This is data: when
 * a phrasing lands in the wrong place, add it here instead of writing a pattern. Built from `routingSet` and
 * `secondRoutingSet` in `bindu-eval.ts`. Never from `unseenRoutingSet`, which measures it.
 */
const BANK: Record<BankRoute, readonly string[]> = {
	today: [
		'what should I do today',
		'pick three actions for today',
		'choose three for today',
		'what is on for today',
		'what is my focus today',
		'give me three things to do now',
		'something to do right now',
		'what should I work on tonight',
		'I have an hour free what should I do',
		'help me pick something for this morning',
		'my list for today',
		'plan my day',
		'today list please'
	],
	week: [
		'plan my week',
		'plan the week',
		'plan next week',
		'what should this week look like',
		'set me up for the next seven days',
		'sketch out my week',
		'weekly plan please',
		'what should I work on this week',
		'plan my week but skip one pillar'
	],
	review: [
		'review my chart',
		'is my chart any good',
		'are my actions any good',
		'check my pillars',
		'which of my actions are too vague',
		'give me feedback on my chart',
		'roast my chart',
		'what is wrong with this chart',
		'tighten the chart',
		'does my chart look okay'
	],
	fill: [
		'fill in the gaps',
		'my chart has holes fill them',
		'write the rest of the actions',
		'complete my chart',
		'finish the chart',
		'fill the missing ones',
		'suggest some pillars',
		'fill the whole chart',
		'write all the actions'
	],
	draft: [
		'start a new chart',
		'make a new chart',
		'scrap this and start over',
		'I need a brand new chart',
		'make a chart from scratch',
		'start again',
		'I want a different goal'
	],
	progress: [
		'how am I doing',
		'show my progress',
		'am I on track',
		'how did the last week go',
		'what have I been slacking on',
		'which pillars am I neglecting',
		'how far along am I',
		'how many ticks this month',
		'show me my stats'
	],
	chat: Object.values(CHAT).flat(),
	facts: ['what do you know about me', 'what do you remember about me', 'what did I tell you', 'what have I told you so far'],
	help: ['help me', 'I feel stuck', 'where do I begin', 'what can you even do', 'I do not get how this works'],
	method: [
		'what is a pillar',
		'why sixty four actions',
		'why eight pillars',
		'how many should I pick each day',
		'is it ok to tick only one thing a day',
		'can I have two goals',
		'what happens if I miss a day',
		'what is the difference between a pillar and an action',
		'how is this different from a to do list',
		'what is the difference between a routine and a milestone',
		'how often should I review the chart',
		'what counts as an action'
	]
};

/** Shorthand people type, folded into the words the bank uses. */
const SPELLINGS: Record<string, string> = {
	thx: 'thanks',
	ty: 'thanks',
	thank: 'thanks',
	u: 'you',
	ur: 'your',
	rn: 'now',
	'2day': 'today',
	todays: 'today',
	gimme: 'give',
	wanna: 'want',
	hi: 'hello',
	hey: 'hello',
	hiya: 'hello',
	yo: 'hello',
	'3': 'three',
	'7': 'seven',
	'64': 'sixty'
};

const STOP = new Set(
	'i me my you your the a an to for of on in at is are am be it this that these those do does did can could would will should please pls plz some any and or so just with about there here me im its even'.split(
		' '
	)
);

function stem(word: string): string {
	let out = word;
	if (out.length > 5 && out.endsWith('ing')) out = out.slice(0, -3);
	else if (out.length > 4 && out.endsWith('ed')) out = out.slice(0, -2);
	else if (out.length > 3 && out.endsWith('s') && !out.endsWith('ss')) out = out.slice(0, -1);
	// "planning" → "plann" → "plan"
	if (out.length > 3 && out.at(-1) === out.at(-2)) out = out.slice(0, -1);
	return out;
}

export function intentWords(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[’']/g, '')
		.split(/[^a-z0-9]+/)
		.map((word) => SPELLINGS[word] ?? word)
		.flatMap((word) => word.split(' '))
		.filter((word) => word !== '' && !STOP.has(word))
		.map(stem);
}

const wordSet = (phrase: string) => new Set(intentWords(phrase));
const EXAMPLES = (Object.entries(BANK) as [BankRoute, readonly string[]][]).flatMap(([route, phrases]) =>
	phrases.map((phrase) => ({ route, words: wordSet(phrase) }))
);
const CHAT_EXAMPLES = (Object.entries(CHAT) as [ChatKind, readonly string[]][]).flatMap(([kind, phrases]) =>
	phrases.map((phrase) => ({ kind, words: wordSet(phrase) }))
);

/** Rare words count for more: "roast" says more about a message than "today" does. */
const WEIGHT = (() => {
	const seen = new Map<string, number>();
	for (const example of EXAMPLES) for (const word of example.words) seen.set(word, (seen.get(word) ?? 0) + 1);
	const weights = new Map<string, number>();
	for (const [word, count] of seen) weights.set(word, Math.log(1 + EXAMPLES.length / count));
	return weights;
})();
const UNSEEN_WEIGHT = Math.log(1 + EXAMPLES.length);

function overlap(message: ReadonlySet<string>, example: ReadonlySet<string>): number {
	let shared = 0;
	let union = 0;
	for (const word of new Set([...message, ...example])) {
		const weight = WEIGHT.get(word) ?? UNSEEN_WEIGHT;
		union += weight;
		if (message.has(word) && example.has(word)) shared += weight;
	}
	return union === 0 ? 0 : shared / union;
}

/** Each route's best match, strongest first. */
export function readIntent(text: string): { route: BankRoute; score: number }[] {
	const words = wordSet(text);
	const best = new Map<BankRoute, number>();
	for (const example of EXAMPLES) {
		const score = overlap(words, example.words);
		if (score > (best.get(example.route) ?? 0)) best.set(example.route, score);
	}
	return [...best].map(([route, score]) => ({ route, score })).sort((a, b) => b.score - a.score);
}

/** Sure enough to act. */
const SURE = 0.5;
/** Close enough to ask about. */
const MAYBE = 0.3;
/** How far the best must lead the next to act on it alone. */
const LEAD = 0.15;

/**
 * One route when the bank is sure. When it is likely but not sure, the readings to ask about, best first:
 * one tap beats an answer that cannot do the job. None when nothing fits, so open questions stay open.
 */
export function guessIntent(text: string): IntentGuess {
	const readings = readIntent(text);
	const [first, second] = readings;
	if (!first || first.score < MAYBE) return { kind: 'none' };
	if (first.score >= SURE && (!second || first.score - second.score >= LEAD)) return { kind: 'route', route: first.route };
	const close = readings
		.filter((reading) => reading.score >= MAYBE && first.score - reading.score < LEAD)
		.slice(0, 3)
		.map((reading) => reading.route);
	return { kind: 'clarify', routes: close };
}

/** Which chat reply fits a message the bank read as chat. */
export function chatKind(text: string): ChatKind {
	const message = wordSet(text);
	let best: { kind: ChatKind; score: number } = { kind: 'thanks', score: 0 };
	for (const example of CHAT_EXAMPLES) {
		const score = overlap(message, example.words);
		if (score > best.score) best = { kind: example.kind, score };
	}
	return best.kind;
}
