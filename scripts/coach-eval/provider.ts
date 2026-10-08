import { getLlama, LlamaChatSession, QwenChatWrapper, type ChatHistoryItem, type LlamaModel, type LlamaContext } from 'node-llama-cpp';
import type { CoachProvider, CompleteOptions } from '../../src/lib/chart/coach-provider.ts';
import { replyText } from '../../src/lib/chart/coach-provider.ts';
import type { ChatMessage } from '../../src/lib/chart/helper.ts';

export const MODELS: Record<string, string> = {
	'qwen3-0.6b': 'Qwen3-0.6B-Q4_K_M.gguf',
	'qwen3-1.7b': 'Qwen3-1.7B-Q4_K_M.gguf',
	'qwen3-4b': 'Qwen3-4B-Q4_K_M.gguf',
	'gemma-3-4b': 'gemma-3-4b-it-Q4_K_M.gguf'
};
/** GGUF files, from Hugging Face (unsloth/<name>-GGUF). Override with COACH_MODELS. */
const DIR = process.env.COACH_MODELS ?? new URL('../../local/models/', import.meta.url).pathname;

/** The browser runs every model with a 4096-token window. */
export const WINDOW = 4096;

export type CallLog = { promptTokens: number; outTokens: number; ms: number; overflow: boolean };

const llama = await getLlama({ gpu: false });

/**
 * A CoachProvider over llama.cpp on the CPU. `builtin` sampling mimics a web page on Chrome's
 * Prompt API: the requested temperature is ignored and the browser's defaults apply.
 */
export async function localProvider(name: string, options: { sampling?: 'requested' | 'builtin' } = {}) {
	const model: LlamaModel = await llama.loadModel({ modelPath: DIR + (MODELS[name] ?? `${name}.gguf`) });
	const context: LlamaContext = await model.createContext({ contextSize: WINDOW, threads: 4 });
	const sequence = context.getSequence();
	const qwen = name.startsWith('qwen');
	const calls: CallLog[] = [];

	function history(messages: readonly ChatMessage[]): ChatHistoryItem[] {
		return messages.map((message) =>
			message.role === 'system'
				? { type: 'system', text: message.content }
				: message.role === 'user'
					? { type: 'user', text: message.content }
					: { type: 'model', response: [message.content] }
		);
	}

	async function complete(_model: string, messages: ChatMessage[], opts: CompleteOptions): Promise<string> {
		const last = messages[messages.length - 1]!;
		const before = messages.slice(0, -1);
		const promptTokens =
			model.tokenize(messages.map((message) => message.content).join('\n')).length + 6 * messages.length;
		const overflow = promptTokens + opts.maxTokens > WINDOW;
		await sequence.clearHistory();
		const session = new LlamaChatSession({
			contextSequence: sequence,
			autoDisposeSequence: false,
			...(qwen ? { chatWrapper: new QwenChatWrapper({ thoughts: 'discourage' }) } : {})
		});
		session.setChatHistory(history(before));
		const started = performance.now();
		let out = '';
		const sampling =
			options.sampling === 'builtin'
				? { temperature: 1, topK: 3 }
				: { temperature: opts.temperature, topP: qwen ? 0.95 : undefined };
		try {
			out = await session.prompt(last.content, { maxTokens: opts.maxTokens, ...sampling });
		} finally {
			session.dispose({ disposeSequence: false });
		}
		calls.push({ promptTokens, outTokens: model.tokenize(out).length, ms: performance.now() - started, overflow });
		return replyText(out);
	}

	const provider: CoachProvider = {
		id: 'webllm',
		load: async () => {},
		loaded: () => true,
		complete,
		interrupt: () => {},
		stats: () => name
	};
	return {
		provider,
		calls,
		tokens: (text: string) => model.tokenize(text).length,
		raw: { model, sequence, llama },
		async dispose() {
			await context.dispose();
			await model.dispose();
		}
	};
}
