import { describe, expect, it } from 'vitest';
import { emptyChart } from './model.ts';
import { getPreset } from './presets/index.ts';
import { actionsFor, actionsUntouched, ringFor, startPage } from './start.ts';

const fitness = getPreset('fitness')!;
const music = getPreset('music')!;

describe('starting from the center', () => {
	it('carries on at the goal, then the ring, then the pillar with actions', () => {
		const data = emptyChart();
		expect(startPage(data)).toEqual({ page: 'goal', pillar: null });
		data.goal = 'Run a half marathon';
		expect(startPage(data)).toEqual({ page: 'pillars', pillar: null });
		data.pillars[2] = 'Long runs';
		expect(startPage(data)).toEqual({ page: 'pillars', pillar: null });
		data.actions[2]![0] = 'Run 16 km on Sunday';
		expect(startPage(data)).toEqual({ page: 'actions', pillar: 2 });
	});

	it('ignores actions under a pillar with no name', () => {
		const data = emptyChart();
		data.goal = 'Run a half marathon';
		data.pillars[1] = 'Easy miles';
		data.actions[0]![0] = 'Left over';
		expect(startPage(data)).toEqual({ page: 'pillars', pillar: null });
	});

	it('lends the borrowed preset its ring, and follows a change of mind', () => {
		const data = emptyChart();
		expect(ringFor(data, undefined)).toBeNull();
		const ring = ringFor(data, fitness)!;
		expect(ring).toEqual([...fitness.pillars]);
		data.pillars = ring;
		expect(ringFor(data, fitness)).toBeNull();
		expect(ringFor(data, music)).toEqual([...music.pillars]);
		expect(ringFor(data, undefined)).toEqual(Array(8).fill(''));
	});

	it('never writes over a ring the person changed', () => {
		const data = emptyChart();
		data.pillars = [...fitness.pillars];
		data.pillars[3] = 'Hill repeats';
		expect(ringFor(data, music)).toBeNull();
		expect(ringFor(data, undefined)).toBeNull();
		const own = emptyChart();
		own.pillars[0] = 'Sleep';
		expect(ringFor(own, fitness)).toBeNull();
	});

	it('lends a pillar its actions only while it keeps the preset name and is empty', () => {
		const data = emptyChart();
		data.pillars = [...fitness.pillars];
		expect(actionsFor(data, fitness, 2)).toEqual([...fitness.actions[2]!]);
		expect(actionsFor(data, undefined, 2)).toBeNull();
		data.pillars[2] = 'Long runs on Sunday';
		expect(actionsFor(data, fitness, 2)).toBeNull();
		data.actions[1]![4] = 'My own line';
		expect(actionsFor(data, fitness, 1)).toBeNull();
	});

	it('knows when lent actions are still as they came', () => {
		const data = emptyChart();
		data.pillars = [...fitness.pillars];
		data.actions[0] = [...fitness.actions[0]!];
		expect(actionsUntouched(data, fitness, 0)).toBe(true);
		data.actions[0]![5] = 'Changed';
		expect(actionsUntouched(data, fitness, 0)).toBe(false);
		expect(actionsUntouched(data, undefined, 0)).toBe(false);
	});
});
