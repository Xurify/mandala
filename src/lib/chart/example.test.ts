import { describe, expect, it } from 'vitest';
import { ACTION_MAX, GOAL_MAX, PILLAR_MAX } from './draft.ts';
import { example, exampleChart } from './example.ts';
import { filledCount, getByKey, info } from './model.ts';

describe('example chart', () => {
	it('fills every cell of the organized-life sample', () => {
		const chart = exampleChart();
		expect(chart.goal).toBe('more organized life');
		expect(filledCount(chart)).toBe(73);
		expect(chart.pillars).toEqual([...example.pillars]);

		const labels = [chart.goal, ...chart.pillars, ...chart.actions.flat()];
		expect(labels.every((label) => label === label.trim() && label.length > 0)).toBe(true);
		expect(chart.goal.length).toBeLessThanOrEqual(GOAL_MAX);
		expect(chart.pillars.every((pillar) => pillar.length <= PILLAR_MAX)).toBe(true);
		expect(chart.actions.flat().every((action) => action.length <= ACTION_MAX)).toBe(true);
		expect(new Set(chart.actions.flat().map((action) => action.toLowerCase())).size).toBe(64);

		chart.goal = 'changed';
		expect(exampleChart().goal).toBe(example.goal);
	});

	it('copies each theme into the center of its outer block', () => {
		const chart = exampleChart();
		for (let block = 0; block < 9; block++) {
			if (block === 4) continue;
			const cell = info(block, 4);
			expect(cell.type).toBe('pillar');
			if (cell.type !== 'pillar') continue;
			expect(getByKey(chart, `p${cell.k}`)).toBe(example.pillars[cell.k]);
		}
	});
});
