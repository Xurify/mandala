import type { ChatMessage } from './helper.ts';

/** `webllm` runs downloaded weights on WebGPU in a worker. `builtin` is the browser's own model (Chrome's Prompt API). */
export type ProviderId = 'webllm' | 'builtin';
export type ProviderChoice = ProviderId | 'auto';

/** What `LanguageModel.availability()` reports. */
export type BuiltinState = 'unavailable' | 'downloadable' | 'downloading' | 'available';

export type CompleteOptions = { maxTokens: number; temperature: number; thinking: boolean };

export type ProgressListener = (text: string, ratio: number | null) => void;

/** One way to run a model on this device. Model ids are web-llm's. The built-in provider has one model and ignores them. */
export interface CoachProvider {
	readonly id: ProviderId;
	load(model: string): Promise<void>;
	/** With no model, whether anything is loaded. */
	loaded(model?: string): boolean;
	complete(model: string, messages: ChatMessage[], options: CompleteOptions): Promise<string>;
	interrupt(): void;
	/** Last speed or source line, for the lab. */
	stats(): string;
}

export type Engine = { provider: 'builtin'; download: boolean } | { provider: 'webllm' } | null;

/**
 * Which provider runs a job. A built-in model that is already there costs nothing, so it goes first.
 * Then web-llm on WebGPU. A built-in model the browser still has to fetch comes last, for browsers
 * without WebGPU. `prefer` is the lab's override.
 */
export function chooseEngine(builtin: BuiltinState, webgpu: boolean, prefer: ProviderChoice = 'auto'): Engine {
	const builtinEngine: Engine = builtin === 'unavailable' ? null : { provider: 'builtin', download: builtin !== 'available' };
	const webllmEngine: Engine = webgpu ? { provider: 'webllm' } : null;
	if (prefer === 'builtin') return builtinEngine;
	if (prefer === 'webllm') return webllmEngine;
	if (builtin === 'available') return builtinEngine;
	return webllmEngine ?? builtinEngine;
}

export type BuiltinMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/**
 * The Prompt API takes the conversation up front and the new message separately, with one system
 * message that must come first. System lines anywhere in `messages` are folded into it.
 */
export function builtinPrompt(messages: readonly ChatMessage[]): { initial: BuiltinMessage[]; prompt: string } {
	const system = messages
		.filter((message) => message.role === 'system')
		.map((message) => message.content.trim())
		.filter(Boolean)
		.join('\n\n');
	const turns = messages.filter((message) => message.role !== 'system');
	const last = turns[turns.length - 1];
	const prompt = last?.role === 'user' ? last.content : '';
	const history = (last?.role === 'user' ? turns.slice(0, -1) : turns).map((message) => ({ role: message.role, content: message.content }));
	return { initial: [...(system ? [{ role: 'system' as const, content: system }] : []), ...history], prompt };
}

/** Thinking blocks never reach the chart. */
export function replyText(value: unknown): string {
	const text = typeof value === 'string' ? value : '';
	return text.replace(/<think>[\s\S]*?<\/think>\s*/gi, '').trim();
}
