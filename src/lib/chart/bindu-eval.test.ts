import { describe, expect, it } from 'vitest';
import { lineSet, routingSet, secondRoutingSet, unseenRoutingSet } from './bindu-eval.ts';
import { exampleChart } from './example.ts';
import { clarifyOf, lineFault, routeOf, type HelperRoute } from './helper.ts';
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
const SECOND_FLOOR = 0.9;
// The unseen set measures phrasing nobody tuned for. Asking with the right option counts as half a win:
// one tap, not a wrong answer.
const UNSEEN_FLOOR = 0.45;
const UNSEEN_OR_ASKED_FLOOR = 0.6;
const CATCH_FLOOR = 0.9;
/** Routes that start work without asking. An open question must not land on one. */
const JOBS: readonly HelperRoute[] = ['today', 'week', 'review', 'fill', 'draft', 'cancel'];

function score(set: readonly (readonly [string, HelperRoute])[], data: ChartData) {
	const misses: string[] = [];
	let right = 0;
	let asked = 0;
	for (const [text, want] of set) {
		const got = routeOf(text, data);
		if (got === want) right++;
		else if (got === 'clarify' && clarifyOf(text)?.chips.some((chip) => chip.act.kind === 'reading' && chip.act.route === want)) asked++;
		else misses.push(`${text} → ${got}, want ${want}`);
	}
	return { right: right / set.length, rightOrAsked: (right + asked) / set.length, misses: misses.join('\n') };
}

describe('Bindu eval sets', () => {
	it(`routes at least ${ROUTING_FLOOR * 100}% of the routing set`, () => {
		const data = halfFull();
		const misses = routingSet.filter(([text, want]) => routeOf(text, data) !== want).map(([text, want]) => `${text} → ${routeOf(text, data)}, want ${want}`);
		expect(misses.length / routingSet.length, misses.join('\n')).toBeLessThanOrEqual(1 - ROUTING_FLOOR);
	});

	it(`routes at least ${SECOND_FLOOR * 100}% of the second set`, () => {
		const { right, misses } = score(secondRoutingSet, exampleChart());
		expect(right, misses).toBeGreaterThanOrEqual(SECOND_FLOOR);
	});

	it(`routes at least ${UNSEEN_FLOOR * 100}% of the unseen set, ${UNSEEN_OR_ASKED_FLOOR * 100}% with right asks`, () => {
		const { right, rightOrAsked, misses } = score(unseenRoutingSet, exampleChart());
		expect(right, misses).toBeGreaterThanOrEqual(UNSEEN_FLOOR);
		expect(rightOrAsked, misses).toBeGreaterThanOrEqual(UNSEEN_OR_ASKED_FLOOR);
	});

	it('sends no open question to a job', () => {
		const data = exampleChart();
		const wrong = [...routingSet, ...secondRoutingSet, ...unseenRoutingSet]
			.filter(([text, want]) => want === 'model' && JOBS.includes(routeOf(text, data)))
			.map(([text]) => `${text} → ${routeOf(text, data)}`);
		// Terse enough to read either way. Pinned so a new one fails, and so does fixing this one.
		expect(wrong).toEqual(['give me three things → today']);
	});

	it(`catches at least ${CATCH_FLOOR * 100}% of weak lines and flags no good one`, () => {
		const weak = lineSet.filter(([, pass]) => !pass);
		const missed = weak.filter(([text]) => !lineFault(text, { max: 48, kind: 'action' })).map(([text]) => text);
		const flagged = lineSet.filter(([text, pass]) => pass && lineFault(text, { max: 48, kind: 'action' })).map(([text]) => text);
		expect(1 - missed.length / weak.length, `missed: ${missed.join('; ')}`).toBeGreaterThanOrEqual(CATCH_FLOOR);
		expect(flagged, 'good lines flagged').toEqual([]);
	});
});
