import type { CoachRequest, CoachResponse } from './coach-protocol.ts';
import { ACTION_MAX, PILLAR_MAX, type CoachBrief } from './draft.ts';
import {
	askMessages,
	factsFor,
	factsFromChart,
	fillActionsMessages,
	fillPillarsMessages,
	goalAndPillars,
	keptLines,
	lineFault,
	oneLine,
	pillarsMessages,
	rewriteMessages,
	type ChatMessage,
	type HelperFinding,
	type LineReject
} from './helper.ts';
import { COACH_MODEL_ID } from './coach-model.ts';
import { emptyChart, type ChartData } from './model.ts';

export const COACH_CANDIDATES = [
	{ id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 1.5B', thinking: false },
	{ id: 'Qwen3-1.7B-q4f16_1-MLC', label: 'Qwen3 1.7B', thinking: false },
	{ id: 'Qwen3-4B-q4f16_1-MLC', label: 'Qwen3 4B', thinking: false },
	{ id: 'Qwen3-4B-q4f16_1-MLC', label: 'Qwen3 4B, thinking', thinking: true }
] as const;

const RETRY_TEMPERATURES = [0.2, 0.6, 0.9];

export type CoachProgress = { text: string; ratio: number | null };

const listeners = new Set<(update: CoachProgress) => void>();
const pending = new Map<number, { resolve: (text: string) => void; reject: (error: Error) => void }>();
let worker: Worker | null = null;
let ready = false;
let loading: Promise<void> | null = null;
let seq = 1;
let lastStats = '';
let activeModel = COACH_MODEL_ID;
let thinking = false;

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

function connect(): Worker {
	if (worker) return worker;
	worker = new Worker(new URL('./coach.worker.ts', import.meta.url), { type: 'module' });
	worker.onmessage = (event: MessageEvent<CoachResponse>) => {
		const message = event.data;
		if (message.type === 'progress') {
			onProgress(typeof message.text === 'string' ? message.text : '', message.ratio ?? null);
			return;
		}
		const waiting = pending.get(message.id);
		if (!waiting) return;
		pending.delete(message.id);
		if (message.type === 'done') {
			if (message.stats) lastStats = message.stats;
			waiting.resolve(message.text);
		} else waiting.reject(new Error(message.text));
	};
	return worker;
}

function request(
	body: Omit<Extract<CoachRequest, { type: 'load' }>, 'id'> | Omit<Extract<CoachRequest, { type: 'complete' }>, 'id'>
): Promise<string> {
	const target = connect();
	const id = seq++;
	return new Promise((resolve, reject) => {
		pending.set(id, { resolve, reject });
		target.postMessage({ ...body, id } as CoachRequest);
	});
}

export function coachLoaded(): boolean {
	return ready;
}

/** Last prefill and decode speed the worker reported. */
export function coachStats(): string {
	return lastStats;
}

export function coachModel(): string {
	return activeModel;
}

/** Loads `model` in the worker. Bindu keeps the default. The lab passes a candidate. */
export function loadCoach(model = activeModel): Promise<void> {
	if (ready && model === activeModel) return Promise.resolve();
	const requested = model;
	if (requested !== activeModel) {
		ready = false;
		loading = null;
		activeModel = requested;
	}
	loading ??= request({ type: 'load', model: requested })
		.then(() => {
			if (activeModel !== requested) return;
			ready = true;
			onProgress('Coach is ready.');
		})
		.catch((error: unknown) => {
			loading = null;
			throw error;
		});
	return loading;
}

export async function selectCoachModel(model: string, enableThinking = false): Promise<void> {
	thinking = enableThinking;
	await loadCoach(model);
}

export async function interruptCoach(): Promise<void> {
	worker?.postMessage({ type: 'interrupt' } satisfies CoachRequest);
}

async function complete(messages: ChatMessage[], options: { maxTokens?: number; temperature?: number } = {}): Promise<string> {
	await loadCoach(activeModel);
	const maxTokens = options.maxTokens ?? 512;
	return request({
		type: 'complete',
		model: activeModel,
		messages,
		maxTokens: thinking ? Math.min(4096, Math.max(maxTokens * 8, 512)) : maxTokens,
		temperature: options.temperature ?? 0.2,
		thinking
	});
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
		const round = keptLines(raw, need, { max, kind, pillar, siblings: [...siblings, ...kept] });
		kept.push(...round.kept);
		rejected = round.rejected;
	}
	return kept.length > 0 ? kept : null;
}

export async function fillPillars(data: ChartData, count: number, facts = ''): Promise<string[] | null> {
	onProgress('Naming pillars.');
	const person = [facts.trim(), factsFromChart(data)].filter(Boolean).join('\n');
	const named = data.pillars.map((pillar) => pillar.trim()).filter(Boolean);
	return writeLines(count, PILLAR_MAX, 'pillar', '', named, (need, rejected) => fillPillarsMessages(data, need, person, rejected));
}

export async function fillActions(data: ChartData, pillarIndex: number, count: number, facts = ''): Promise<string[] | null> {
	const pillar = (data.pillars[pillarIndex] ?? '').trim();
	onProgress(`Writing actions for ${pillar}.`);
	const person = [facts.trim(), factsFromChart(data, pillarIndex)].filter(Boolean).join('\n');
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
	const facts = factsFromChart(data, kind === 'action' ? pillarIndex : undefined);
	const original = finding.text.toLowerCase();
	for (let attempt = 0; attempt < 2; attempt++) {
		const line = oneLine(await complete(rewriteMessages(data, finding, facts, attempt === 1), { maxTokens: 40, temperature: 0.2 }), max);
		if (!line) continue;
		const fault = lineFault(line, { max, kind, pillar, siblings: [finding.text] });
		if (!fault && !line.toLowerCase().includes(original) && !ECHO.test(line)) return line;
	}
	return null;
}

export async function answer(data: ChartData, question: string): Promise<string> {
	onProgress('Thinking.');
	return (await complete(askMessages(data, question), { maxTokens: 120, temperature: 0.6 })).trim();
}

/** Goal and pillars first, then eight actions per pillar. Each step reports the chart so far. */
export async function proposeChart(
	brief: CoachBrief,
	onPartial: (draft: ChartData) => void = () => {}
): Promise<{ chart: ChartData | null; raw: string }> {
	onProgress(ready ? 'Naming the pillars.' : 'Waking up.');
	const person = factsFor(brief);
	const head = await retrying(() => complete(pillarsMessages(brief), { maxTokens: 200, temperature: 0.2 }), goalAndPillars);
	if (!head) return { chart: null, raw: '' };
	const draft = emptyChart();
	draft.goal = head.goal;
	draft.pillars = head.pillars;
	onPartial(structuredClone(draft));
	for (let pillarIndex = 0; pillarIndex < 8; pillarIndex++) {
		const actions = await fillActions(draft, pillarIndex, 8, person);
		draft.actions[pillarIndex] = Array.from({ length: 8 }, (_, index) => actions?.[index] ?? '');
		onPartial(structuredClone(draft));
	}
	return { chart: draft, raw: JSON.stringify(draft) };
}
