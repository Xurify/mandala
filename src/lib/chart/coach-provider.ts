import type { ChatMessage } from './helper.ts';

export type CompleteOptions = { maxTokens: number; temperature: number };

export type ProgressListener = (text: string, ratio: number | null) => void;

/** One way to run a model: web-llm on WebGPU in the app, llama.cpp on the CPU in `scripts/coach-eval`. */
export interface CoachProvider {
	readonly id: string;
	load(model: string): Promise<void>;
	/** With no model, whether anything is loaded. */
	loaded(model?: string): boolean;
	complete(model: string, messages: ChatMessage[], options: CompleteOptions): Promise<string>;
	interrupt(): void;
}

/** Thinking blocks never reach the chart. */
export function replyText(value: unknown): string {
	const text = typeof value === 'string' ? value : '';
	return text.replace(/<think>[\s\S]*?<\/think>\s*/gi, '').trim();
}
