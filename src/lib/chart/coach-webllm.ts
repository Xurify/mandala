import type { CoachRequest, CoachResponse } from './coach-protocol.ts';
import type { CoachProvider, CompleteOptions, ProgressListener } from './coach-provider.ts';
import type { ChatMessage } from './helper.ts';

export type WebLLMProvider = CoachProvider & {
	/** The model in memory, or being loaded. */
	current(): string;
};

type Body =
	| Omit<Extract<CoachRequest, { type: 'load' }>, 'id'>
	| Omit<Extract<CoachRequest, { type: 'complete' }>, 'id'>;

/** Downloaded weights on WebGPU, in `coach.worker.ts`. One model is in memory at a time. Loading another unloads it. */
export function createWebLLMProvider(onProgress: ProgressListener): WebLLMProvider {
	const pending = new Map<number, { resolve: (text: string) => void; reject: (error: Error) => void }>();
	let worker: Worker | null = null;
	let seq = 1;
	let ready = '';
	let target = '';
	let lastStats = '';
	let inflight: { model: string; promise: Promise<void> } | null = null;

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

	function request(body: Body): Promise<string> {
		const connected = connect();
		const id = seq++;
		return new Promise((resolve, reject) => {
			pending.set(id, { resolve, reject });
			connected.postMessage({ ...body, id } as CoachRequest);
		});
	}

	function load(model: string): Promise<void> {
		if (ready === model) return Promise.resolve();
		if (inflight?.model === model) return inflight.promise;
		ready = '';
		target = model;
		const earlier = inflight;
		const promise = (async () => {
			await earlier?.promise.catch(() => undefined);
			if (target !== model) throw new Error('Switched model before this load finished.');
			await request({ type: 'load', model });
			if (target !== model) throw new Error('Switched model before this load finished.');
			ready = model;
		})().finally(() => {
			if (inflight?.promise === promise) inflight = null;
		});
		inflight = { model, promise };
		return promise;
	}

	async function complete(model: string, messages: ChatMessage[], options: CompleteOptions): Promise<string> {
		await load(model);
		return request({ type: 'complete', model, messages, ...options });
	}

	return {
		id: 'webllm',
		load,
		loaded: (model) => (model === undefined ? ready !== '' : ready === model),
		complete,
		interrupt() {
			worker?.postMessage({ type: 'interrupt' } satisfies CoachRequest);
		},
		stats: () => lastStats,
		current: () => target
	};
}
