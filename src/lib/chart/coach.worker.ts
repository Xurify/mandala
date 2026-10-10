/// <reference lib="webworker" />
import { CreateMLCEngine, prebuiltAppConfig, type MLCEngine } from '@mlc-ai/web-llm';
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
			// Cache.add rejects Hugging Face's redirected shard responses as a network error.
			appConfig: { ...prebuiltAppConfig, cacheBackend: 'indexeddb' },
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
	tail = tail.then(() => handle(request)).catch(() => {});
};

async function handle(request: Exclude<CoachRequest, { type: 'interrupt' }>): Promise<void> {
	try {
		if (request.type === 'load') {
			await load(request.model);
			post({ type: 'done', id: request.id, text: '' });
			return;
		}
		const model = await load(request.model);
		await model.resetChat();
		const completion = await model.chat.completions.create({
			messages: request.messages,
			temperature: request.temperature,
			max_tokens: request.maxTokens,
			stream: false,
			extra_body: request.model.includes('Qwen3') ? { enable_thinking: false } : undefined
		});
		const content = completion.choices[0]?.message?.content;
		post({
			type: 'done',
			id: request.id,
			text: replyText(content)
		});
	} catch (error) {
		post({ type: 'error', id: request.id, text: error instanceof Error ? error.message : 'The coach stopped.' });
	}
}
