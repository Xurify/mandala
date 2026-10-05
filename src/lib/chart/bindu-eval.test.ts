import { describe, expect, it } from 'vitest';
import { lineSet, routingSet } from './bindu-eval.ts';
import { lineFault, routeOf } from './helper.ts';
import { emptyChart, type ChartData } from './model.ts';

function halfFull(): ChartData {
	const data = emptyChart();
	data.goal = 'Finish a half marathon';
	data.pillars = ['Easy runs', 'Speed', 'Long run', 'Strength', 'Sleep', 'Food', 'Shoes', 'Calendar'];
	data.actions = data.pillars.map((pillar, pillarIndex) =>
		Array.from({ length: 8 }, (_, index) => (pillarIndex >= 3 && pillarIndex <= 4 && index > 4 ? '' : `${pillar} step ${index + 1}`))
	);
	return data;
}

// Floors, not targets. Raise them when the rules get better; a change that drops below fails.
const ROUTING_FLOOR = 0.95;
const CATCH_FLOOR = 0.9;

describe('Bindu eval sets', () => {
	it(`routes at least ${ROUTING_FLOOR * 100}% of the routing set`, () => {
		const data = halfFull();
		const misses = routingSet.filter(([text, want]) => routeOf(text, data) !== want).map(([text, want]) => `${text} → ${routeOf(text, data)}, want ${want}`);
		expect(misses.length / routingSet.length, misses.join('\n')).toBeLessThanOrEqual(1 - ROUTING_FLOOR);
	});

	it(`catches at least ${CATCH_FLOOR * 100}% of weak lines and flags no good one`, () => {
		const weak = lineSet.filter(([, pass]) => !pass);
		const missed = weak.filter(([text]) => !lineFault(text, { max: 48, kind: 'action' })).map(([text]) => text);
		const flagged = lineSet.filter(([text, pass]) => pass && lineFault(text, { max: 48, kind: 'action' })).map(([text]) => text);
		expect(1 - missed.length / weak.length, `missed: ${missed.join('; ')}`).toBeGreaterThanOrEqual(CATCH_FLOOR);
		expect(flagged, 'good lines flagged').toEqual([]);
	});
});
