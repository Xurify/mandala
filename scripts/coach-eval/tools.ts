import { LlamaChatSession, QwenChatWrapper } from 'node-llama-cpp';
import { localProvider } from './provider.ts';
import { sampleChart, save, secs } from './common.ts';
import { routingSet } from '../../src/lib/chart/bindu-eval.ts';
import { routeOf, type HelperRoute } from '../../src/lib/chart/helper.ts';

/** Written for this test, after the rules, by someone who did not write them. Not tuned on. */
export const freshSet: [string, HelperRoute][] = [
	['whats on for today', 'today'],
	['gimme 3 things to do rn', 'today'],
	['I have an hour free tonight, what should I work on?', 'today'],
	["what's my focus today?", 'today'],
	['set me up for the next 7 days', 'week'],
	['can u sketch out my week', 'week'],
	['what should this week look like', 'week'],
	['are my actions any good', 'review'],
	['roast my chart', 'review'],
	['which of my actions are too vague?', 'review'],
	['my chart has holes, can you fill them', 'fill'],
	['write the rest of the actions for me', 'fill'],
	['suggest some pillars', 'fill'],
	['scrap this and start over', 'draft'],
	['I need a brand new chart', 'draft'],
	["let's make a chart from scratch", 'draft'],
	['am I on track?', 'progress'],
	['show me how the last week went', 'progress'],
	['what have I been slacking on', 'progress'],
	['ty!', 'chat'],
	['yo', 'chat'],
	['sorry I disappeared for a week', 'chat'],
	['ok cool', 'chat'],
	['what do you know about me', 'facts'],
	['what have I told you so far', 'facts'],
	["I don't get how this works", 'help'],
	['what can you even do?', 'help'],
	['where do I start', 'help'],
	['why eight pillars?', 'method'],
	['is it ok to tick only one thing a day?', 'method'],
	["what's the difference between a pillar and an action?", 'method'],
	['how is this different from a to-do list?', 'method'],
	['I wanna get into rock climbing', 'aim'],
	['thinking of training for a triathlon next year', 'aim'],
	['finish my Money pillar', 'pillar'],
	['can you work on Career for me', 'pillar'],
	['stop', 'cancel'],
	['forget it', 'cancel'],
	['how do I deal with a boss who micromanages?', 'model'],
	['is 6 hours of sleep enough?', 'model'],
	["what's a good way to save for a car?", 'model'],
	['I feel overwhelmed by Career and Money at once', 'model'],
	['plan my week but skip Home', 'week'],
	['can you check whether Money makes sense and fill it', 'pillar'],
	['help me pick something for this morning', 'today'],
	['how many ticks this month?', 'progress']
];

const TOOLS: Record<Exclude<HelperRoute, 'chart'>, string> = {
	today: "pick today's three actions",
	week: 'plan the actions for this week',
	review: 'check the chart for weak or vague lines',
	fill: 'write empty pillars or actions on the chart',
	draft: 'start a brand new chart from scratch',
	progress: 'report how they are doing: ticks, streaks, neglected pillars',
	chat: 'small talk: hello, thanks, okay, or saying they missed days',
	facts: 'show what Bindu remembers about them',
	help: 'they are stuck, ask what Bindu can do, or where to start',
	method: 'a question about how the Mandala method works',
	aim: 'they name a new goal they want to pursue',
	pillar: 'fill or work on one named pillar',
	cancel: 'stop or never mind',
	model: 'anything else: an open question to answer in conversation'
};
const ROUTES = Object.keys(TOOLS);

const [name] = process.argv.slice(2);
const local = await localProvider(name!);
const { llama, sequence } = local.raw;
const grammar = await llama.createGrammarForJsonSchema({
	type: 'object',
	properties: { route: { type: 'string', enum: ROUTES } },
	required: ['route']
} as const);
const pillars = sampleChart().pillars.join(', ');
const system = [
	'You are the router for Bindu, the helper in a goal chart app. Pick the one tool that answers the message.',
	'Tools:',
	...ROUTES.map((route) => `- ${route}: ${TOOLS[route as keyof typeof TOOLS]}`),
	`Pillars on this chart: ${pillars}.`,
	'Reply with JSON only.'
].join('\n');

async function route(text: string): Promise<{ route: string; ms: number }> {
	await sequence.clearHistory();
	const session = new LlamaChatSession({
		contextSequence: sequence,
		autoDisposeSequence: false,
		systemPrompt: system,
		...(name!.startsWith('qwen') ? { chatWrapper: new QwenChatWrapper({ thoughts: 'discourage' }) } : {})
	});
	const started = performance.now();
	const out = await session.prompt(text, { grammar, maxTokens: 24, temperature: 0 });
	session.dispose({ disposeSequence: false });
	return { route: (grammar.parse(out) as { route: string }).route, ms: performance.now() - started };
}

const data = sampleChart();
const rows = [];
for (const [set, items] of [['tuned', routingSet], ['fresh', freshSet]] as const) {
	for (const [text, label] of items) {
		const result = await route(text);
		const rules = routeOf(text, data);
		rows.push({ set, text, label, model: result.route, rules, seconds: secs(result.ms) });
	}
	const mine = rows.filter((row) => row.set === set);
	const right = (key: 'model' | 'rules') => mine.filter((row) => row[key] === row.label).length;
	console.log(`${name} ${set}: model ${right('model')}/${mine.length}, rules ${right('rules')}/${mine.length}, mean ${secs((mine.reduce((sum, row) => sum + row.seconds, 0) / mine.length) * 1000)}s`);
	save(`tools-${name}.json`, rows);
}
await local.dispose();
