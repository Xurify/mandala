import { beforeEach, describe, expect, it } from 'vitest';
import { chart } from './chart.svelte.ts';
import { emptyChart, todayKey } from './model.ts';
import { buildChart, getPreset } from './presets/index.ts';

beforeEach(() => {
	chart.data = emptyChart();
});

describe('chart day log', () => {
	it('logs picks taken off by hand, not ones Bindu replaced', () => {
		chart.setFocus('2026-10-05', ['a0_0', 'a1_0', 'a2_0']);
		chart.setFocus('2026-10-05', ['a0_0', 'a1_0']);
		expect(chart.data.days?.['2026-10-05']?.dropped).toEqual(['a2_0']);
		chart.setFocus('2026-10-05', ['a0_0', 'a1_0', 'a2_0']);
		expect(chart.data.days?.['2026-10-05']?.dropped).toBeUndefined();
		chart.setFocus('2026-10-05', ['a3_0', 'a4_0', 'a5_0'], true);
		expect(chart.data.days?.['2026-10-05']?.dropped).toBeUndefined();
	});

	it('keeps the time of a tick and clears it on untick', () => {
		chart.toggleChecked('2026-10-05', 'a0_0');
		expect(chart.data.days?.['2026-10-05']?.at?.a0_0).toMatch(/^\d\d:\d\d$/);
		chart.toggleChecked('2026-10-05', 'a0_0');
		expect(chart.data.days?.['2026-10-05']?.at).toBeUndefined();
	});

	it('records declined suggestions and shown insights once each', () => {
		chart.declineToday(['a0_0', 'a1_0']);
		chart.declineToday(['a0_0']);
		chart.noteShown('stuck:a3_0');
		chart.noteShown('stuck:a3_0');
		const log = chart.data.days?.[todayKey()];
		expect(log?.declined).toEqual(['a0_0', 'a1_0']);
		expect(log?.shown).toEqual(['stuck:a3_0']);
	});

	it('drops an empty brief', () => {
		chart.setBrief({ timeline: 'October' });
		expect(chart.data.brief).toEqual({ timeline: 'October' });
		chart.setBrief({ timeline: '  ' });
		expect(chart.data.brief).toBeUndefined();
	});
});

describe('chart shelves', () => {
	it('turns a pillar to its shelf, and back to its actions when a door names a cell', () => {
		chart.viewMode = 'split';
		chart.openShelf(2);
		expect(chart.face).toBe('shelf');
		chart.selectPillar(5);
		expect(chart.face).toBe('shelf');
		chart.jumpToKey('a5_1');
		expect(chart.face).toBe('actions');
		expect(chart.focusedKey).toBe('a5_1');
		chart.clearFocusedKey();
	});

	it('puts a removed tool back where it was when the slip is undone', () => {
		const first = chart.addTool(1, 'https://youtu.be/SZaaZpKLTFE', 'First');
		chart.addTool(1, 'https://youtu.be/wzMrFFcC1BU', 'Second');
		chart.removeTool(1, first.id);
		expect(chart.data.tools?.p1?.map((tool) => tool.title)).toEqual(['Second']);
		expect(chart.slips.at(-1)?.kicker).toBe('Off the shelf');
		chart.undoSlip();
		expect(chart.data.tools?.p1?.map((tool) => tool.title)).toEqual(['First', 'Second']);
	});
});

describe('starting from the center', () => {
	it('follows the chart it began on, and ends when a whole chart arrives', () => {
		chart.beginStart('fitness');
		expect(chart.starting).toBe(true);
		expect(chart.startPreset).toBe('fitness');
		chart.setText('g', 'Run a half marathon');
		chart.newChart();
		expect(chart.starting).toBe(false);
		expect(chart.startPreset).toBeNull();
		chart.beginStart(null);
		chart.importChart(buildChart(getPreset('music')!));
		expect(chart.starting).toBe(false);
	});

	it('ends only for the chart that is starting', () => {
		chart.beginStart(null);
		chart.endStart();
		expect(chart.starting).toBe(false);
	});
});
