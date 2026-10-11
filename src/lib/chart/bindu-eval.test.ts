import { describe, expect, it } from 'vitest';
import { lineSet } from './bindu-eval.ts';
import { lineFault } from './helper.ts';

// A floor, not a target. Raise it when the rules get better; a change that drops below fails.
const CATCH_FLOOR = 0.9;

describe('review eval set', () => {
	it(`catches at least ${CATCH_FLOOR * 100}% of weak lines and flags no good one`, () => {
		const weak = lineSet.filter(([, pass]) => !pass);
		const missed = weak.filter(([text]) => !lineFault(text, { max: 48, kind: 'action' })).map(([text]) => text);
		const flagged = lineSet.filter(([text, pass]) => pass && lineFault(text, { max: 48, kind: 'action' })).map(([text]) => text);
		expect(1 - missed.length / weak.length, `missed: ${missed.join('; ')}`).toBeGreaterThanOrEqual(CATCH_FLOOR);
		expect(flagged, 'good lines flagged').toEqual([]);
	});
});
