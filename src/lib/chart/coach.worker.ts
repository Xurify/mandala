/// <reference lib="webworker" />
import { CreateMLCEngine, type MLCEngine } from '@mlc-ai/web-llm';
import type { CoachRequest, CoachResponse } from './coach-protocol.ts';

const scope = self as unknown as DedicatedWorkerGlobalScope;
let engine: MLCEngine | null = null;
let loading: Promise<MLCEngine> | null = null;

function post(message: CoachResponse): void {
	scope.postMessage(message);
}

function load(model: string): Promise<MLCEngine> {
	if (engine) return Promise.resolve(engine);
	loading ??= (async () => {
		const created = await CreateMLCEngine(model, {
			initProgressCallback: (report) => post({ type: 'progress', text: report.text, ratio: report.progress })
		});
		post({ type: 'progress', text: 'Warming up.' });
		await created.chat.completions.create({ messages: [{ role: 'user', content: 'Hi' }], max_tokens: 1 });
		engine = created;
		return created;
	})().catch((error: unknown) => {
		loading = null;
		throw error;
	});
	return loading;
}

scope.onmessage = async (event: MessageEvent<CoachRequest>) => {
	const request = event.data;
	if (request.type === 'interrupt') {
		await engine?.interruptGenerate();
		return;
	}
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
			stream: false
		});
		const content = completion.choices[0]?.message?.content;
		post({ type: 'done', id: request.id, text: typeof content === 'string' ? content : '', stats: await model.runtimeStatsText() });
	} catch (error) {
		post({ type: 'error', id: request.id, text: error instanceof Error ? error.message : 'The coach stopped.' });
	}
};
