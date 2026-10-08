import { describe, expect, it } from 'vitest';
import { builtinState, createBuiltinProvider, type LanguageModelApi, type LanguageModelCreateOptions } from './coach-builtin.ts';

type Fake = {
	api: LanguageModelApi;
	created: LanguageModelCreateOptions[];
	prompts: string[];
	destroyed: number;
	progress: [string, number | null][];
};

/** A stand-in for Chrome's `LanguageModel`. Each prompt streams `chunks`, one per read. */
function fake(options: { chunks?: string[]; params?: boolean; state?: string; hang?: boolean } = {}): Fake {
	const record: Fake = { api: null as unknown as LanguageModelApi, created: [], prompts: [], destroyed: 0, progress: [] };
	record.api = {
		availability: async () => (options.state ?? 'available') as never,
		params: options.params ? async () => ({ defaultTopK: 3, maxTopK: 8, defaultTemperature: 1, maxTemperature: 2 }) : undefined,
		async create(createOptions = {}) {
			record.created.push(createOptions);
			createOptions.monitor?.({ addEventListener: (_type, listener) => listener({ loaded: 0.5 }) });
			return {
				destroy: () => {
					record.destroyed++;
				},
				promptStreaming(input, promptOptions) {
					record.prompts.push(input);
					const chunks = [...(options.chunks ?? ['Walk ', 'after dinner'])];
					return new ReadableStream<string>({
						pull(controller) {
							if (options.hang && chunks.length === 0) {
								return new Promise((_resolve, reject) =>
									promptOptions?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
								);
							}
							const next = chunks.shift();
							if (next === undefined) controller.close();
							else controller.enqueue(next);
						}
					});
				}
			};
		}
	};
	return record;
}

const options = { maxTokens: 40, temperature: 0.6, thinking: false };

describe('builtinState', () => {
	it('reads unavailable when the browser has no API or the call fails', async () => {
		expect(await builtinState(null)).toBe('unavailable');
		const broken = fake();
		broken.api.availability = async () => {
			throw new Error('nope');
		};
		expect(await builtinState(broken.api)).toBe('unavailable');
		expect(await builtinState(fake({ state: 'downloadable' }).api)).toBe('downloadable');
		expect(await builtinState(fake({ state: 'something new' }).api)).toBe('unavailable');
	});
});

describe('createBuiltinProvider', () => {
	it('loads once, reporting the download, and throws when the browser has no model', async () => {
		const record = fake();
		const provider = createBuiltinProvider((text, ratio) => record.progress.push([text, ratio]), record.api);
		expect(provider.loaded()).toBe(false);
		await provider.load('built-in');
		await provider.load('built-in');
		expect(provider.loaded()).toBe(true);
		expect(record.created).toHaveLength(1);
		expect(record.destroyed).toBe(1);
		expect(record.progress).toEqual([['Downloading the built-in model.', 0.5]]);
		await expect(createBuiltinProvider(() => {}, null).load('built-in')).rejects.toThrow(/no built-in model/);
	});

	it('sends the conversation up front and the question as the prompt, then closes the session', async () => {
		const record = fake();
		const provider = createBuiltinProvider(() => {}, record.api);
		const text = await provider.complete(
			'built-in',
			[
				{ role: 'system', content: 'You are Bindu.' },
				{ role: 'user', content: 'Which pillar first?' }
			],
			options
		);
		expect(text).toBe('Walk after dinner');
		const call = record.created[1]!;
		expect(call.initialPrompts).toEqual([{ role: 'system', content: 'You are Bindu.' }]);
		expect(record.prompts).toEqual(['Which pillar first?']);
		expect(call.expectedOutputs).toEqual([{ type: 'text', languages: ['en'] }]);
		expect(record.destroyed).toBe(2);
	});

	it('sets temperature and topK together, or leaves both to the browser', async () => {
		const withParams = fake({ params: true });
		await createBuiltinProvider(() => {}, withParams.api).complete('built-in', [{ role: 'user', content: 'Hi' }], { ...options, temperature: 3 });
		expect(withParams.created[1]).toMatchObject({ temperature: 2, topK: 3 });

		const without = fake();
		await createBuiltinProvider(() => {}, without.api).complete('built-in', [{ role: 'user', content: 'Hi' }], options);
		expect(without.created[1]).not.toHaveProperty('temperature');
		expect(without.created[1]).not.toHaveProperty('topK');
	});

	it('stops reading once the reply passes its token budget', async () => {
		const record = fake({ chunks: ['a'.repeat(30), 'b'.repeat(30), 'c'.repeat(30)] });
		const provider = createBuiltinProvider(() => {}, record.api);
		const text = await provider.complete('built-in', [{ role: 'user', content: 'Hi' }], { ...options, maxTokens: 10 });
		expect(text).toBe(`${'a'.repeat(30)}${'b'.repeat(30)}`);
	});

	it('returns what it has when interrupted', async () => {
		const record = fake({ chunks: ['Walk '], hang: true });
		const provider = createBuiltinProvider(() => {}, record.api);
		await provider.load('built-in');
		const running = provider.complete('built-in', [{ role: 'user', content: 'Hi' }], options);
		await new Promise((resolve) => setTimeout(resolve, 0));
		provider.interrupt();
		expect(await running).toBe('Walk');
	});
});
