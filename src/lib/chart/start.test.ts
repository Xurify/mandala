import { describe, expect, it } from 'vitest';
import { emptyChart } from './model.ts';
import { getPreset } from './presets/index.ts';
import { actionsFor, actionsUntouched, blocksWritten, lenderOf, nextPillar, ringFor, startPage } from './start.ts';

const fitness = getPreset('fitness')!;
const music = getPreset('music')!;

describe('starting from the center', () => {
	it('carries on at the goal, the ring, a half-written block, then the outer ring', () => {
		const data = emptyChart();
		expect(startPage(data)).toEqual({ page: 'goal', pillar: null });
		data.goal = 'Run a half marathon';
		expect(startPage(data)).toEqual({ page: 'pillars', pillar: null });
		data.pillars[2] = 'Long runs';
		data.pillars[5] = 'Recovery';
		expect(startPage(data)).toEqual({ page: 'pillars', pillar: null });
		data.actions[5]![0] = 'Sleep by 10:30';
		expect(startPage(data)).toEqual({ page: 'actions', pillar: 5 });
		data.actions[5] = data.actions[5]!.map((_, i) => `Line ${i}`);
		expect(startPage(data)).toEqual({ page: 'pick', pillar: null });
	});

	it('ignores actions under a pillar with no name', () => {
		const data = emptyChart();
		data.goal = 'Run a half marathon';
		data.pillars[1] = 'Easy miles';
		data.actions[0]![0] = 'Left over';
		expect(startPage(data)).toEqual({ page: 'pillars', pillar: null });
	});

	it('goes round to the next block with an empty line, and counts whole ones', () => {
		const data = emptyChart();
		data.pillars = [...fitness.pillars];
		data.actions[0] = [...fitness.actions[0]!];
		data.actions[3] = [...fitness.actions[3]!];
		data.pillars[6] = '';
		expect(blocksWritten(data)).toBe(2);
		expect(nextPillar(data, -1)).toBe(1);
		expect(nextPillar(data, 5)).toBe(7);
		expect(nextPillar(data, 7)).toBe(1);
		for (const k of [1, 2, 4, 5, 7]) data.actions[k] = [...fitness.actions[k]!];
		expect(blocksWritten(data)).toBe(7);
		expect(nextPillar(data, 7)).toBeNull();
	});

	it('finds the preset a chart borrowed from, even after a few renames', () => {
		const data = emptyChart();
		expect(lenderOf(data)).toBeNull();
		data.pillars = [...music.pillars];
		data.pillars[0] = 'My own';
		expect(lenderOf(data)).toBe('music');
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
