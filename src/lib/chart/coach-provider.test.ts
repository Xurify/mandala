import { describe, expect, it } from 'vitest';
import { builtinPrompt, chooseEngine, replyText } from './coach-provider.ts';

describe('chooseEngine', () => {
	it('prefers the measured model on WebGPU, even when the built-in model is ready', () => {
		expect(chooseEngine('available', true)).toEqual({ provider: 'webllm' });
		expect(chooseEngine('available', false)).toEqual({ provider: 'builtin', download: false });
	});

	it('prefers WebGPU when the built-in model would still have to download', () => {
		expect(chooseEngine('downloadable', true)).toEqual({ provider: 'webllm' });
		expect(chooseEngine('downloading', true)).toEqual({ provider: 'webllm' });
		expect(chooseEngine('unavailable', true)).toEqual({ provider: 'webllm' });
	});

	it('falls back to the built-in download without WebGPU, and to nothing without either', () => {
		expect(chooseEngine('downloadable', false)).toEqual({ provider: 'builtin', download: true });
		expect(chooseEngine('unavailable', false)).toBeNull();
	});

	it('follows the lab override, even when it leaves nothing to run', () => {
		expect(chooseEngine('available', true, 'webllm')).toEqual({ provider: 'webllm' });
		expect(chooseEngine('downloadable', true, 'builtin')).toEqual({ provider: 'builtin', download: true });
		expect(chooseEngine('unavailable', true, 'builtin')).toBeNull();
		expect(chooseEngine('available', false, 'webllm')).toBeNull();
	});
});

describe('builtinPrompt', () => {
	it('puts one system message first, keeps the history, and sends the last user message as the prompt', () => {
		const result = builtinPrompt([
			{ role: 'system', content: 'You are Bindu.' },
			{ role: 'user', content: 'Hi' },
			{ role: 'assistant', content: 'Hello.' },
			{ role: 'system', content: 'Chart: run a half.' },
			{ role: 'user', content: 'Which pillar first?' }
		]);
		expect(result.initial).toEqual([
			{ role: 'system', content: 'You are Bindu.\n\nChart: run a half.' },
			{ role: 'user', content: 'Hi' },
			{ role: 'assistant', content: 'Hello.' }
		]);
		expect(result.prompt).toBe('Which pillar first?');
	});

	it('sends no system message when there is none, and an empty prompt when the last turn is not the user', () => {
		expect(builtinPrompt([{ role: 'user', content: 'Hi' }])).toEqual({ initial: [], prompt: 'Hi' });
		expect(builtinPrompt([{ role: 'assistant', content: 'Hello.' }])).toEqual({
			initial: [{ role: 'assistant', content: 'Hello.' }],
			prompt: ''
		});
	});
});

describe('replyText', () => {
	it('drops thinking blocks and trims', () => {
		expect(replyText('<think>plan</think>\n Walk after dinner ')).toBe('Walk after dinner');
		expect(replyText(undefined)).toBe('');
	});
});
