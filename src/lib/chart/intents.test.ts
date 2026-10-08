import { describe, expect, it } from 'vitest';
import { chatKind, guessIntent, intentWords, readIntent } from './intents.ts';

describe('intent words', () => {
	it('folds shorthand and drops filler', () => {
		expect(intentWords('gimme 3 things to do rn')).toEqual(intentWords('give three things now'));
		expect(intentWords('can u sketch out my week')).toEqual(['sketch', 'out', 'week']);
	});

	it('stems so planning and plan meet', () => {
		expect(intentWords('planning')).toEqual(intentWords('plan'));
		expect(intentWords('pillars')).toEqual(intentWords('pillar'));
	});

	it('does not read "evening" as the filler "even"', () => {
		expect(guessIntent('Should I run in the morning or evening?')).toEqual({ kind: 'none' });
	});
});

describe('guessIntent', () => {
	it('routes a close paraphrase', () => {
		expect(guessIntent('can u sketch out my week')).toEqual({ kind: 'route', route: 'week' });
		expect(guessIntent('roast my chart')).toEqual({ kind: 'route', route: 'review' });
		expect(guessIntent('gimme 3 things to do rn')).toEqual({ kind: 'route', route: 'today' });
	});

	it('asks when a reading is likely but not sure', () => {
		expect(guessIntent('help me plan the coming week')).toEqual({ kind: 'clarify', routes: ['week'] });
	});

	it('leaves open questions to the model', () => {
		for (const text of ['how do I stop procrastinating', "what's a good warm up before a long run?", 'write me a poem']) {
			expect(guessIntent(text), text).toEqual({ kind: 'none' });
		}
	});

	it('scores best first', () => {
		const scores = readIntent('plan my week').map((reading) => reading.score);
		expect(scores).toEqual([...scores].sort((a, b) => b - a));
	});
});

describe('chatKind', () => {
	it('tells a hello from a comeback from a thanks', () => {
		expect(chatKind('yo')).toBe('hello');
		expect(chatKind('sorry I disappeared for a week')).toBe('missed');
		expect(chatKind('ok cool')).toBe('thanks');
	});
});
