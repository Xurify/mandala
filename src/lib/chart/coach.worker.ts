/// <reference lib="webworker" />
import { CreateMLCEngine, hasModelInCache, prebuiltAppConfig, type MLCEngine, type CompletionUsage } from '@mlc-ai/web-llm';
import type { CoachRequest, CoachResponse } from './coach-protocol.ts';
import { replyText } from './coach-provider.ts';

const scope = self as unknown as DedicatedWorkerGlobalScope;
let engine: MLCEngine | null = null;
let loadedId = '';
let loading: Promise<MLCEngine> | null = null;
let loadingModel = '';

function post(message: CoachResponse): void {
	scope.postMessage(message);
}

function progressText(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function usageStats(usage: CompletionUsage | undefined): string | undefined {
	if (!usage) return undefined;
	const prefill = Math.round(usage.extra.prefill_tokens_per_s);
	const decode = Math.round(usage.extra.decode_tokens_per_s);
	return `prefill ${prefill} tok/s, decode ${decode} tok/s`;
}

// Cache.add rejects Hugging Face's redirected shard responses as a network error.
const appConfig = { ...prebuiltAppConfig, cacheBackend: 'indexeddb' as const };

let loadToken = 0;

function load(model: string): Promise<MLCEngine> {
	if (!loading && engine && loadedId === model) return Promise.resolve(engine);
	if (loading && loadingModel === model) return loading;

	const token = ++loadToken;
	const earlier = loading;
	loadingModel = model;
	loading = (async () => {
		if (earlier) await earlier.catch(() => undefined);
		if (token !== loadToken) throw new Error('Switched model before this load finished.');
		if (engine && loadedId === model) return engine;
		if (engine) {
			await engine.unload();
			engine = null;
			loadedId = '';
		}
		const created = await CreateMLCEngine(model, {
			appConfig,
			initProgressCallback: (report) =>
				post({ type: 'progress', text: progressText(report.text), ratio: report.progress })
		});
		if (token !== loadToken) {
			await created.unload();
			throw new Error('Switched model before this load finished.');
		}
		post({ type: 'progress', text: 'Warming up.' });
		await created.chat.completions.create({
			messages: [{ role: 'user', content: 'Hi' }],
			max_tokens: 1,
			extra_body: model.includes('Qwen3') ? { enable_thinking: false } : undefined
		});
		if (token !== loadToken) {
			await created.unload();
			throw new Error('Switched model before this load finished.');
		}
		engine = created;
		loadedId = model;
		return created;
	})().finally(() => {
		if (token === loadToken) loading = null;
	});
	return loading;
}

let tail: Promise<void> = Promise.resolve();

scope.onmessage = (event: MessageEvent<CoachRequest>) => {
	const request = event.data;
	if (request.type === 'interrupt') {
		void engine?.interruptGenerate().catch(() => {});
		return;
	}
	// A cache probe must not wait behind a download that is still running.
	if (request.type === 'cached') {
		void handle(request);
		return;
	}
	tail = tail.then(() => handle(request)).catch(() => {});
};

async function handle(request: Exclude<CoachRequest, { type: 'interrupt' }>): Promise<void> {
	try {
		if (request.type === 'cached') {
			const cached = await hasModelInCache(request.model, appConfig).catch(() => false);
			post({ type: 'done', id: request.id, text: cached ? 'yes' : 'no' });
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
		post({ type: 'error', id: request.id, text: error instanceof Error ? error.message : 'The coach stopped.' });
	}
}
