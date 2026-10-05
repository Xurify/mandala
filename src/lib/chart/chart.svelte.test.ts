import { beforeEach, describe, expect, it } from 'vitest';
import { chart } from './chart.svelte.ts';
import { emptyChart, todayKey } from './model.ts';

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
