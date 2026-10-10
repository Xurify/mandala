import { CoachStopped } from './coach-protocol.ts';
import { ACTION_MAX, GOAL_MAX, PILLAR_MAX, type ChartAnswers } from './draft.ts';
import {
	EXAMPLE_LINES,
	PILLAR_EXAMPLES,
	REWRITE_EXAMPLES,
	askMessages,
	chartAnswerFacts,
	chartBriefFacts,
	chartContextFacts,
	fillActionsMessages,
	fillPillarsMessages,
	pillarHead,
	keptLines,
	lineFault,
	nearCopy,
	norm,
	oneLine,
	pillarsMessages,
	plainReply,
	rewriteMessages,
	sameDriver,
	type ChatMessage,
	type HelperFinding,
	type LineReject
} from './helper.ts';
import { COACH_MODEL_ID, COACH_WEIGHT_DOWNLOAD } from './coach-model.ts';
import type { CoachProvider } from './coach-provider.ts';
import { createWebLLMProvider, type WebLLMProvider } from './coach-webllm.ts';

import { emptyChart, type ChartData } from './model.ts';

const RETRY_TEMPERATURES = [0.2, 0.6, 0.9];

/** `pillar`: the pillar being written, so the status can name it in its own hue. */
export type CoachProgress = { text: string; ratio: number | null; pillar?: { index: number; name: string } };

const listeners = new Set<(update: CoachProgress) => void>();
let stopped = false;

function onProgress(text: string, ratio: number | null = null, pillar?: CoachProgress['pillar']): void {
	const update = { text, ratio, pillar };
	for (const listener of listeners) listener(update);
}

export function watchCoachProgress(listener: (update: CoachProgress) => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export async function detectWebGPU(): Promise<boolean> {
	if (typeof navigator === 'undefined' || !('gpu' in navigator)) return false;
	try {
		const adapter = await navigator.gpu.requestAdapter();
		return adapter != null;
	} catch {
		return false;
	}
}

let webllm: WebLLMProvider | null = null;
let webgpu: Promise<boolean> | null = null;
let active: CoachProvider | null = null;

function webllmProvider(): WebLLMProvider {
	webllm ??= createWebLLMProvider(onProgress);
	return webllm;
}

/** A job's model, and what it still has to download. `download` is null when nothing is fetched. */
export type CoachNeed = { model: string; download: string | null };

/**
 * What a model job would run on, or null without WebGPU. Then Bindu offers the prompt for another chat
 * app instead. Chrome's own model (the Prompt API) was tried as a fallback and removed: browsers that
 * have it also have WebGPU, and its stand-in routed 12 of 66 messages (`docs/bindu-models.md`).
 */
export async function needFor(): Promise<CoachNeed | null> {
	webgpu ??= detectWebGPU();
	if (!(await webgpu)) return null;
	return { model: COACH_MODEL_ID, download: webllmProvider().loaded(COACH_MODEL_ID) ? null : COACH_WEIGHT_DOWNLOAD };
}

/** A provider from outside the app, such as `scripts/coach-eval` running models on the CPU. Bindu never sets it. */
let injected: CoachProvider | null = null;

export function useProvider(provider: CoachProvider | null): void {
	injected = provider;
	active = provider;
}

async function runner(): Promise<{ provider: CoachProvider; model: string }> {
	if (injected) return { provider: injected, model: COACH_MODEL_ID };
	if (!(await (webgpu ??= detectWebGPU()))) throw new Error('Nothing can run a model in this browser.');
	return { provider: webllmProvider(), model: COACH_MODEL_ID };
}

export function coachLoaded(): boolean {
	return active?.loaded() ?? false;
}

/** What is loaded, or about to be, for the lab. */
export function coachModel(): string {
	return webllm?.current() || COACH_MODEL_ID;
}

/** Loads the model. The lab gets its pinned model. */
export async function loadCoach(): Promise<void> {
	const { provider, model } = await runner();
	active = provider;
	await provider.load(model);
	onProgress('Coach is ready.');
}


export function resumeCoach(): void {
	stopped = false;
}

export async function interruptCoach(): Promise<void> {
	stopped = true;
	webllm?.interrupt();
}

async function complete(messages: ChatMessage[], options: { maxTokens?: number; temperature?: number } = {}): Promise<string> {
	if (stopped) throw new CoachStopped();
	const { provider, model } = await runner();
	if (!provider.loaded(model)) await loadCoach();
	active = provider;
	if (stopped) throw new CoachStopped();
	const text = await provider.complete(model, messages, {
		maxTokens: options.maxTokens ?? 512,
		temperature: options.temperature ?? 0.2
	});
	if (stopped) throw new CoachStopped();
	return text;
}

const ECHO = /\b(tick|rewrite|reminder|cell)\b/i;

async function writeLines(
	count: number,
	max: number,
	kind: 'pillar' | 'action',
	pillar: string,
	siblings: readonly string[],
	messages: (need: number, rejected: readonly LineReject[]) => ChatMessage[]
): Promise<string[] | null> {
	const kept: string[] = [];
	let rejected: LineReject[] = [];
	for (let attempt = 0; attempt < RETRY_TEMPERATURES.length && kept.length < count; attempt++) {
		const need = count - kept.length;
		const raw = await complete(messages(need, attempt === 0 ? [] : rejected), {
			maxTokens: 24 * need,
			temperature: RETRY_TEMPERATURES[attempt]
		});
		const round = keptLines(raw, need, { max, kind, pillar, siblings: [...siblings, ...kept, ...EXAMPLE_LINES] });
		kept.push(...round.kept);
		rejected = round.rejected;
	}
	return kept.length > 0 ? kept : null;
}

export async function fillPillars(data: ChartData, count: number, facts = ''): Promise<string[] | null> {
	onProgress('Naming pillars.');
	const person = [facts.trim() || chartBriefFacts(data), chartContextFacts(data)].filter(Boolean).join('\n');
	const named = data.pillars.map((pillar) => pillar.trim()).filter(Boolean);
	return writeLines(count, PILLAR_MAX, 'pillar', '', named, (need, rejected) => fillPillarsMessages(data, need, person, rejected));
}

export async function fillActions(data: ChartData, pillarIndex: number, count: number, facts = ''): Promise<string[] | null> {
	const pillar = (data.pillars[pillarIndex] ?? '').trim();
	onProgress(`Writing actions for ${pillar}.`, null, { index: pillarIndex, name: pillar });
	const person = [facts.trim() || chartBriefFacts(data), chartContextFacts(data, pillarIndex)].filter(Boolean).join('\n');
	const elsewhere = data.actions.flatMap((row, index) =>
		index === pillarIndex ? [] : row.map((action) => action.trim()).filter((action) => action !== '')
	);
	const existing = (data.actions[pillarIndex] ?? []).map((action) => action.trim()).filter(Boolean);
	return writeLines(count, ACTION_MAX, 'action', pillar, [...elsewhere, ...existing], (need, rejected) =>
		fillActionsMessages(data, pillarIndex, need, person, rejected)
	);
}

export async function rewriteCell(data: ChartData, finding: HelperFinding): Promise<string | null> {
	onProgress(`Rewriting "${finding.text}".`);
	const kind = finding.key.startsWith('p') ? 'pillar' : 'action';
	const max = kind === 'pillar' ? PILLAR_MAX : ACTION_MAX;
	const pillarIndex = Number(finding.key.slice(1).split('_')[0]);
	const pillar = kind === 'action' ? (data.pillars[pillarIndex] ?? '').trim() : '';
	const facts = [chartBriefFacts(data), chartContextFacts(data, kind === 'action' ? pillarIndex : undefined)].filter(Boolean).join('\n');
	const original = finding.text.toLowerCase();
	for (let attempt = 0; attempt < 2; attempt++) {
		const line = oneLine(await complete(rewriteMessages(data, finding, facts, attempt === 1), { maxTokens: 40, temperature: 0.2 }), max);
		if (!line) continue;
		const fault = lineFault(line, { max, kind, pillar, siblings: [finding.text, ...REWRITE_EXAMPLES, ...PILLAR_EXAMPLES, ...EXAMPLE_LINES] });
		if (!fault && !line.toLowerCase().includes(original) && !ECHO.test(line)) return line;
	}
	return null;
}

export async function answer(
	data: ChartData,
	question: string,
	history: readonly ChatMessage[] = [],
	pillar: number | null = null
): Promise<string> {
	onProgress('Thinking.');
	return plainReply(await complete(askMessages(data, question, history, pillar), { maxTokens: 180, temperature: 0.6 }));
}

/**
 * Goal and eight pillars. A pillar is never clipped: a cut one reads as a whole one that means something else.
 * A reply that does not parse is asked for again. Otherwise there is one retry, with the rejected pillars and
 * why, since more rarely changes what a small model writes and each costs seconds. Then the best set wins,
 * filled from the rest: a pillar with a soft fault (a tool, a catch-all, a second heading for one driver)
 * beats an empty one, and review flags it. A long or cut pillar never goes in. Only when that still leaves a
 * gap are the missing pillars asked for alone.
 */
async function namePillars(answers: ChartAnswers): Promise<{ goal: string; pillars: string[] } | null> {
	const heads: NonNullable<ReturnType<typeof pillarHead>>[] = [];
	let goal = '';
	let rejected: LineReject[] = [];
	for (let attempt = 0; attempt < RETRY_TEMPERATURES.length; attempt++) {
		const head = pillarHead(
			await complete(pillarsMessages(answers, rejected), { maxTokens: 200, temperature: RETRY_TEMPERATURES[attempt] })
		);
		if (!head) continue;
		heads.push(head);
		goal ||= head.goal;
		if (goal && (head.pillars.length >= 8 || heads.length >= 2)) break;
		rejected = head.rejected;
	}
	goal ||= ownGoal(answers.direction);
	if (heads.length === 0 || !goal) return null;
	const best = heads.reduce((most, head) => (head.pillars.length > most.pillars.length ? head : most));
	const pillars = best.pillars.slice(0, 8);
	const take = (text: string) => {
		if (pillars.length < 8 && !pillars.some((seen) => norm(seen) === norm(text) || nearCopy(seen, text))) pillars.push(text);
	};
	for (const head of heads) for (const pillar of head.pillars) if (!sameDriver(pillar, pillars)) take(pillar);
	for (const head of heads) {
		for (const { text } of head.rejected) {
			const code = lineFault(text, { max: PILLAR_MAX, kind: 'pillar' })?.code;
			if (code !== 'long' && code !== 'cut') take(text);
		}
	}
	if (pillars.length < 8) {
		const sofar = emptyChart();
		sofar.goal = goal;
		sofar.pillars = Array.from({ length: 8 }, (_, index) => pillars[index] ?? '');
		const facts = chartAnswerFacts(answers);
		const more = await writeLines(8 - pillars.length, PILLAR_MAX, 'pillar', '', pillars, (need, again) =>
			fillPillarsMessages(sofar, need, facts, again)
		);
		pillars.push(...(more ?? []));
	}
	return pillars.length >= 8 ? { goal, pillars: pillars.slice(0, 8) } : null;
}

/** The person's own words, when every goal the model wrote was too long for the center. */
function ownGoal(direction: string): string {
	const text = direction.replace(/\s+/g, ' ').trim();
	return text.length > 0 && text.length <= GOAL_MAX ? text[0]!.toUpperCase() + text.slice(1) : '';
}

/** Goal and eight pillars, with the actions still empty. */
export async function proposePillars(
	answers: ChartAnswers,
	onPartial: (draft: ChartData) => void = () => {}
): Promise<{ chart: ChartData | null; raw: string }> {
	resumeCoach();
	onProgress(coachLoaded() ? 'Naming the pillars.' : 'Waking up.');
	const head = await namePillars(answers);
	if (!head) return { chart: null, raw: '' };
	const draft = emptyChart();
	draft.goal = head.goal;
	draft.pillars = head.pillars;
	onPartial(structuredClone(draft));
	return { chart: draft, raw: JSON.stringify(draft) };
}

/** Eight actions on each pillar of a chart that already has its goal and pillars. */
export async function fillDraftActions(
	draft: ChartData,
	answers: ChartAnswers,
	onPartial: (draft: ChartData) => void = () => {}
): Promise<ChartData> {
	resumeCoach();
	const person = chartAnswerFacts(answers);
	for (let pillarIndex = 0; pillarIndex < 8; pillarIndex++) {
		const actions = await fillActions(draft, pillarIndex, 8, person);
		draft.actions[pillarIndex] = Array.from({ length: 8 }, (_, index) => actions?.[index] ?? '');
		onPartial(structuredClone(draft));
	}
	return draft;
}

/** Goal and pillars first, then eight actions per pillar. Each step reports the chart so far. */
export async function proposeChart(
	answers: ChartAnswers,
	onPartial: (draft: ChartData) => void = () => {}
): Promise<{ chart: ChartData | null; raw: string }> {
	const sketched = await proposePillars(answers, onPartial);
	if (!sketched.chart) return sketched;
	const chart = await fillDraftActions(sketched.chart, answers, onPartial);
	return { chart, raw: JSON.stringify(chart) };
}
