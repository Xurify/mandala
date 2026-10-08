import { CoachStopped } from './coach-protocol.ts';
import { ACTION_MAX, PILLAR_MAX, type ChartAnswers } from './draft.ts';
import {
	EXAMPLE_LINES,
	REWRITE_EXAMPLES,
	askMessages,
	chartAnswerFacts,
	chartBriefFacts,
	chartContextFacts,
	fillActionsMessages,
	fillPillarsMessages,
	goalAndPillars,
	keptLines,
	lineFault,
	oneLine,
	pillarsMessages,
	plainReply,
	rewriteMessages,
	type ChatMessage,
	type HelperFinding,
	type LineReject
} from './helper.ts';
import { BUILTIN_MODEL, COACH_CANDIDATES, COACH_MODEL_ID, COACH_WEIGHT_DOWNLOAD } from './coach-model.ts';
import { chooseEngine, type CoachProvider, type ProviderChoice, type ProviderId } from './coach-provider.ts';
import { builtinState, createBuiltinProvider } from './coach-builtin.ts';
import { createWebLLMProvider, type WebLLMProvider } from './coach-webllm.ts';

export { COACH_CANDIDATES };
import { emptyChart, type ChartData } from './model.ts';

const RETRY_TEMPERATURES = [0.2, 0.6, 0.9];

export type CoachProgress = { text: string; ratio: number | null };

const listeners = new Set<(update: CoachProgress) => void>();
let stopped = false;

function onProgress(text: string, ratio: number | null = null): void {
	const update = { text, ratio };
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
let builtin: CoachProvider | null = null;
let webgpu: Promise<boolean> | null = null;
/** Set when the built-in model failed once, so this session stops offering it. */
let builtinBroken = false;
let prefer: ProviderChoice = 'auto';
/** The lab's model, in place of `COACH_MODEL_ID`. */
let pinned: { model: string; thinking: boolean } | null = null;
/** What `needFor` decided, so the job runs on what the person agreed to. */
let chosen: { provider: ProviderId; model: string } | null = null;
let active: CoachProvider | null = null;

function webllmProvider(): WebLLMProvider {
	webllm ??= createWebLLMProvider(onProgress);
	return webllm;
}

function builtinProvider(): CoachProvider {
	builtin ??= createBuiltinProvider(onProgress);
	return builtin;
}

function providerOf(id: ProviderId): CoachProvider {
	return id === 'builtin' ? builtinProvider() : webllmProvider();
}

/** A job's provider and model, and what it still has to download. `download` is null when nothing is fetched. */
export type CoachNeed = { provider: ProviderId; model: string; download: string | null };

/** What a model job would run on, or null when nothing can run here. */
export async function needFor(): Promise<CoachNeed | null> {
	webgpu ??= detectWebGPU();
	const engine = chooseEngine(builtinBroken ? 'unavailable' : await builtinState(), await webgpu, prefer);
	if (!engine) return null;
	if (engine.provider === 'builtin') {
		chosen = { provider: 'builtin', model: BUILTIN_MODEL };
		// The browser decides its model's size, so the card names none.
		return { ...chosen, download: engine.download && !builtinProvider().loaded() ? '' : null };
	}
	const model = pinned?.model ?? COACH_MODEL_ID;
	chosen = { provider: 'webllm', model };
	return { ...chosen, download: webllmProvider().loaded(model) ? null : COACH_WEIGHT_DOWNLOAD };
}

/** A provider from outside the app, such as `scripts/coach-eval` running models on the CPU. Bindu never sets it. */
let injected: CoachProvider | null = null;

export function useProvider(provider: CoachProvider | null): void {
	injected = provider;
	active = provider;
}

async function runner(): Promise<{ provider: CoachProvider; model: string }> {
	if (injected) return { provider: injected, model: pinned?.model ?? COACH_MODEL_ID };
	const decided = chosen ?? (await needFor());
	if (!decided) throw new Error('Nothing can run a model in this browser.');
	const model = decided.provider === 'webllm' ? (pinned?.model ?? decided.model) : decided.model;
	return { provider: providerOf(decided.provider), model };
}

export function coachLoaded(): boolean {
	return active?.loaded() ?? false;
}

/** Last prefill and decode speed, or where the model runs. */
export function coachStats(): string {
	return active?.stats() ?? '';
}

/** What is loaded, or about to be, for the lab. */
export function coachModel(): string {
	if (active ? active.id === 'builtin' : prefer === 'builtin') return 'Built into the browser';
	return webllm?.current() || pinned?.model || COACH_MODEL_ID;
}

export function coachProvider(): ProviderId | null {
	return active?.id ?? null;
}

/** Loads the model. The lab gets its pinned model. */
export async function loadCoach(): Promise<void> {
	const { provider, model } = await runner();
	active = provider;
	try {
		await provider.load(model);
	} catch (error) {
		if (provider.id === 'builtin') builtinBroken = true;
		throw error;
	}
	onProgress('Coach is ready.');
}

/** The lab's model pick. */
export async function selectCoachModel(model: string, enableThinking = false): Promise<void> {
	pinned = { model, thinking: enableThinking };
	await loadCoach();
}

/** The lab's provider pick. `auto` is what Bindu does. */
export function selectProvider(choice: ProviderChoice): void {
	prefer = choice;
	active = null;
	chosen = null;
}

export { builtinState };

export function resumeCoach(): void {
	stopped = false;
}

export async function interruptCoach(): Promise<void> {
	stopped = true;
	webllm?.interrupt();
	builtin?.interrupt();
}

async function complete(messages: ChatMessage[], options: { maxTokens?: number; temperature?: number } = {}): Promise<string> {
	if (stopped) throw new CoachStopped();
	const { provider, model } = await runner();
	if (!provider.loaded(model)) await loadCoach();
	active = provider;
	if (stopped) throw new CoachStopped();
	const thinking = provider.id === 'webllm' && pinned?.thinking === true;
	const maxTokens = options.maxTokens ?? 512;
	const text = await provider.complete(model, messages, {
		maxTokens: thinking ? Math.min(4096, Math.max(maxTokens * 8, 512)) : maxTokens,
		temperature: options.temperature ?? 0.2,
		thinking
	});
	if (stopped) throw new CoachStopped();
	return text;
}

const ECHO = /\b(tick|rewrite|reminder|cell)\b/i;

async function retrying<T>(run: () => Promise<string>, parse: (raw: string) => T | null): Promise<T | null> {
	for (let attempt = 0; attempt < 2; attempt++) {
		const parsed = parse(await run());
		if (parsed) return parsed;
	}
	return null;
}

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
	onProgress(`Writing actions for ${pillar}.`);
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
		const fault = lineFault(line, { max, kind, pillar, siblings: [finding.text, ...REWRITE_EXAMPLES, ...EXAMPLE_LINES] });
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

/** Goal and eight pillars, with the actions still empty. */
export async function proposePillars(
	answers: ChartAnswers,
	onPartial: (draft: ChartData) => void = () => {}
): Promise<{ chart: ChartData | null; raw: string }> {
	resumeCoach();
	onProgress(coachLoaded() ? 'Naming the pillars.' : 'Waking up.');
	const head = await retrying(() => complete(pillarsMessages(answers), { maxTokens: 200, temperature: 0.2 }), goalAndPillars);
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
