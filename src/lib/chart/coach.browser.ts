import { briefToUserMessage, draftSystemPrompt, eightActions, parseDraftText, partialDraft, type CoachBrief } from './draft.ts';
import type { ChartData } from './model.ts';
import type { MLCEngine } from '@mlc-ai/web-llm';

export const COACH_MODEL_ID = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';

const RETRY =
	'The last chart was incomplete. Return a new JSON object only. pillars has 8 strings. actions has 8 arrays, and each array has 8 strings. Do not copy a short example.';

let engine: MLCEngine | null = null;
let loading: Promise<MLCEngine> | null = null;
let onProgress: (text: string) => void = () => {};

export function watchCoachProgress(listener: (text: string) => void): () => void {
	onProgress = listener;
	return () => {
		if (onProgress === listener) onProgress = () => {};
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

export async function loadCoach(): Promise<MLCEngine> {
	if (engine) {
		onProgress('Coach is ready.');
		return engine;
	}
	if (!loading) {
		loading = (async () => {
			const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
			const created = await CreateMLCEngine(COACH_MODEL_ID, {
				initProgressCallback: (report) => onProgress(report.text)
			});
			engine = created;
			return created;
		})().catch((error: unknown) => {
			loading = null;
			throw error;
		});
	}
	return loading;
}

export async function interruptCoach(): Promise<void> {
	if (!engine) return;
	try {
		await engine.interruptGenerate();
	} catch {
		// A finished run has nothing to stop.
	}
}

async function complete(model: MLCEngine, messages: { role: 'system' | 'user' | 'assistant'; content: string }[]): Promise<string> {
	await model.resetChat();
	const completion = await model.chat.completions.create({
		messages,
		temperature: 0.2,
		max_tokens: 2048,
		stream: false
	});
	const content = completion.choices[0]?.message?.content;
	return typeof content === 'string' ? content : '';
}

async function actionsForPillar(model: MLCEngine, brief: CoachBrief, goal: string, pillar: string): Promise<string[] | null> {
	onProgress(`Writing actions for ${pillar}.`);
	const raw = await complete(model, [
		{
			role: 'system',
			content:
				'You write Mandala actions. Each one can be scheduled and ticked, and it is something this person can do. Return exactly 8 lines, numbered 1. to 8. No other text.'
		},
		{
			role: 'user',
			content: `${briefToUserMessage(brief)}\nGoal: ${goal}\nPillar: ${pillar}\nEight facilitators of this pillar. Do not restate the pillar.`
		}
	]);
	return eightActions(raw);
}

async function completeChart(model: MLCEngine, brief: CoachBrief, raw: string): Promise<{ chart: ChartData | null; raw: string }> {
	const parsed = parseDraftText(raw);
	if (parsed) return { chart: parsed, raw };
	const partial = partialDraft(raw);
	if (!partial) return { chart: null, raw };
	const actions = partial.actions.map((row) => row.slice(0, 8));
	for (let index = 0; index < partial.pillars.length; index++) {
		if ((actions[index]?.length ?? 0) >= 8) continue;
		const pillar = partial.pillars[index] ?? '';
		const filled = await actionsForPillar(model, brief, partial.goal, pillar);
		if (!filled) return { chart: null, raw };
		actions[index] = filled;
	}
	const assembled = JSON.stringify({ goal: partial.goal, pillars: partial.pillars, actions });
	return { chart: parseDraftText(assembled), raw: assembled };
}

export async function proposeChart(brief: CoachBrief): Promise<{ chart: ChartData | null; raw: string }> {
	onProgress('Loading the coach.');
	const model = await loadCoach();
	onProgress('Writing the chart.');
	const user = briefToUserMessage(brief);
	const system = draftSystemPrompt();
	const first = await complete(model, [
		{ role: 'system', content: system },
		{ role: 'user', content: user }
	]);
	const ready = await completeChart(model, brief, first);
	if (ready.chart) return ready;
	onProgress('Asking again for the chart.');
	const second = await complete(model, [
		{ role: 'system', content: system },
		{ role: 'user', content: `${user}\n${RETRY}` }
	]);
	const retried = await completeChart(model, brief, second);
	return retried.chart ? retried : { chart: null, raw: second };
}
