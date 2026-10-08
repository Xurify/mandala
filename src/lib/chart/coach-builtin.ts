import {
	builtinPrompt,
	replyText,
	type BuiltinMessage,
	type BuiltinState,
	type CoachProvider,
	type CompleteOptions,
	type ProgressListener
} from './coach-provider.ts';
import type { ChatMessage } from './helper.ts';

/** The parts of Chrome's Prompt API Bindu uses. The global is `LanguageModel`, and only some browsers have it. */
export type LanguageModelSession = {
	promptStreaming(input: string, options?: { signal?: AbortSignal }): ReadableStream<string>;
	destroy(): void;
};

type DownloadMonitor = { addEventListener(type: 'downloadprogress', listener: (event: { loaded: number }) => void): void };

export type LanguageModelCreateOptions = {
	initialPrompts?: BuiltinMessage[];
	signal?: AbortSignal;
	monitor?: (monitor: DownloadMonitor) => void;
	temperature?: number;
	topK?: number;
	expectedInputs?: { type: 'text'; languages: string[] }[];
	expectedOutputs?: { type: 'text'; languages: string[] }[];
};

export type LanguageModelApi = {
	availability(options?: LanguageModelCreateOptions): Promise<BuiltinState>;
	create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
	/** Present where pages may set sampling. Elsewhere temperature and topK are the browser's. */
	params?(): Promise<{ defaultTopK: number; maxTopK: number; defaultTemperature: number; maxTemperature: number } | null>;
};

// Asking without a language gets a console warning, and a later Chrome may refuse.
const LANGUAGES: Pick<LanguageModelCreateOptions, 'expectedInputs' | 'expectedOutputs'> = {
	expectedInputs: [{ type: 'text', languages: ['en'] }],
	expectedOutputs: [{ type: 'text', languages: ['en'] }]
};

/** About four characters a token. The Prompt API has no output cap, so the stream is cut at this. */
const CHARS_PER_TOKEN = 4;

export function builtinApi(): LanguageModelApi | null {
	const api = (globalThis as { LanguageModel?: LanguageModelApi }).LanguageModel;
	return api && typeof api.availability === 'function' && typeof api.create === 'function' ? api : null;
}

export async function builtinState(api: LanguageModelApi | null = builtinApi()): Promise<BuiltinState> {
	if (!api) return 'unavailable';
	try {
		const state = await api.availability(LANGUAGES);
		return state === 'available' || state === 'downloadable' || state === 'downloading' ? state : 'unavailable';
	} catch {
		return 'unavailable';
	}
}

function isAbort(error: unknown): boolean {
	return error instanceof Error && error.name === 'AbortError';
}

export function createBuiltinProvider(onProgress: ProgressListener, api: LanguageModelApi | null = builtinApi()): CoachProvider {
	let ready = false;
	let loading: Promise<void> | null = null;
	let sampling: Promise<{ temperature: number; topK: number; max: number } | null> | null = null;
	const running = new Set<AbortController>();

	function apiOrThrow(): LanguageModelApi {
		if (!api) throw new Error('This browser has no built-in model.');
		return api;
	}

	function samplingOf(): Promise<{ temperature: number; topK: number; max: number } | null> {
		sampling ??= (async () => {
			const params = await apiOrThrow().params?.().catch(() => null);
			return params ? { temperature: params.defaultTemperature, topK: params.defaultTopK, max: params.maxTemperature } : null;
		})();
		return sampling;
	}

	function load(): Promise<void> {
		if (ready) return Promise.resolve();
		loading ??= (async () => {
			const session = await apiOrThrow().create({
				...LANGUAGES,
				monitor(monitor) {
					monitor.addEventListener('downloadprogress', (event) => onProgress('Downloading the built-in model.', event.loaded));
				}
			});
			session.destroy();
			ready = true;
		})().finally(() => {
			loading = null;
		});
		return loading;
	}

	async function complete(_model: string, messages: ChatMessage[], options: CompleteOptions): Promise<string> {
		await load();
		const { initial, prompt } = builtinPrompt(messages);
		const params = await samplingOf();
		const controller = new AbortController();
		running.add(controller);
		let text = '';
		let session: LanguageModelSession | null = null;
		try {
			session = await apiOrThrow().create({
				...LANGUAGES,
				initialPrompts: initial,
				signal: controller.signal,
				// Both or neither: the API throws on one without the other.
				...(params ? { temperature: Math.min(options.temperature, params.max), topK: params.topK } : {})
			});
			const budget = options.maxTokens * CHARS_PER_TOKEN;
			const reader = session.promptStreaming(prompt, { signal: controller.signal }).getReader();
			while (text.length <= budget) {
				const { value, done } = await reader.read();
				if (done) break;
				text += value;
			}
			if (text.length > budget) await reader.cancel().catch(() => {});
		} catch (error) {
			if (!isAbort(error)) throw error;
		} finally {
			running.delete(controller);
			session?.destroy();
		}
		return replyText(text);
	}

	return {
		id: 'builtin',
		load,
		loaded: () => ready,
		complete,
		interrupt() {
			for (const controller of running) controller.abort();
		}
	};
}
