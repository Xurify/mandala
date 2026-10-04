/// <reference lib="webworker" />
import { CreateMLCEngine, type MLCEngine, type CompletionUsage } from '@mlc-ai/web-llm';
import type { CoachRequest, CoachResponse } from './coach-protocol.ts';

const scope = self as unknown as DedicatedWorkerGlobalScope;
let engine: MLCEngine | null = null;
let loadedId = '';
let loading: Promise<MLCEngine> | null = null;

function post(message: CoachResponse): void {
	scope.postMessage(message);
}

function progressText(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function replyText(value: unknown): string {
	const text = typeof value === 'string' ? value : '';
	return text.replace(/<think>[\s\S]*?<\/think>\s*/gi, '').trim();
}

function usageStats(usage: CompletionUsage | undefined): string | undefined {
	if (!usage) return undefined;
	const prefill = Math.round(usage.extra.prefill_tokens_per_s);
	const decode = Math.round(usage.extra.decode_tokens_per_s);
	return `prefill ${prefill} tok/s, decode ${decode} tok/s`;
}

function load(model: string): Promise<MLCEngine> {
	if (engine && loadedId === model) return Promise.resolve(engine);
	loading ??= (async () => {
		if (engine) {
			await engine.unload();
			engine = null;
			loadedId = '';
		}
		const created = await CreateMLCEngine(model, {
			initProgressCallback: (report) =>
				post({ type: 'progress', text: progressText(report.text), ratio: report.progress })
		});
		post({ type: 'progress', text: 'Warming up.' });
		await created.chat.completions.create({
			messages: [{ role: 'user', content: 'Hi' }],
			max_tokens: 1,
			extra_body: model.includes('Qwen3') ? { enable_thinking: false } : undefined
		});
		engine = created;
		loadedId = model;
		return created;
	})().finally(() => {
		loading = null;
	});
	return loading;
}

let tail: Promise<void> = Promise.resolve();

scope.onmessage = (event: MessageEvent<CoachRequest>) => {
	const request = event.data;
	tail = tail.then(() => handle(request)).catch(() => {});
};

async function handle(request: CoachRequest): Promise<void> {
	try {
		if (request.type === 'interrupt') {
			engine?.interruptGenerate();
			return;
		}
		if (request.type === 'load') {
			await load(request.model);
			post({ type: 'done', id: request.id, text: '' });
			return;
		}
		const model = await load(request.model);
		await model.resetChat();
		const thinking = request.thinking === true && request.model.includes('Qwen3');
		const completion = await model.chat.completions.create({
			messages: request.messages,
			temperature: request.temperature,
			max_tokens: request.maxTokens,
			stream: false,
			extra_body: request.model.includes('Qwen3') ? { enable_thinking: thinking } : undefined
		});
		const content = completion.choices[0]?.message?.content;
		post({
			type: 'done',
			id: request.id,
			text: replyText(content),
			stats: usageStats(completion.usage)
		});
	} catch (error) {
		if (request.type === 'interrupt') return;
		post({ type: 'error', id: request.id, text: error instanceof Error ? error.message : 'The coach stopped.' });
	}
}
