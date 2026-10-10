import { describe, expect, it } from 'vitest';
import { dayTitle, doneOn, firstDoneMonth, monthLine, monthOf, shiftMonth } from './calendar.ts';
import { emptyChart, type ChartData } from './model.ts';

function chart(): ChartData {
	const data = emptyChart();
	data.goal = 'Speak Slovak';
	data.pillars[0] = 'Listening';
	data.pillars[2] = 'Speaking';
	data.actions[0] = ['Play audio at breakfast', 'Shadow a clip', '', '', '', '', '', ''];
	data.actions[2] = ['Say one new sentence', '', '', '', '', '', '', ''];
	data.days = {
		'2026-10-09': { focus: ['a0_0', 'a2_0'], checked: ['a2_0', 'a0_0'], at: { a2_0: '19:10', a0_0: '07:30' } },
		'2026-10-10': { focus: ['a0_1'], checked: [] },
		'2026-09-28': { focus: ['a0_0'], checked: ['a0_0'] }
	};
	data.meta = { a0_1: { kind: 'milestone', done: true, doneAt: '2026-10-09' } };
	return data;
}

describe('doneOn', () => {
	it('lists the ticks in the order they happened, then the milestones closed that day', () => {
		const done = doneOn(chart(), '2026-10-09');
		expect(done.map((entry) => entry.key)).toEqual(['a0_0', 'a2_0', 'a0_1']);
		expect(done[0]).toMatchObject({ text: 'Play audio at breakfast', pillarIndex: 0, at: '07:30', milestone: false });
		expect(done[2]).toMatchObject({ text: 'Shadow a clip', milestone: true });
		expect(doneOn(chart(), '2026-10-10')).toEqual([]);
	});
});

describe('monthOf', () => {
	const now = new Date(2026, 9, 10, 12);

	it('lays the month out Monday first, padded, and counts what was done in it', () => {
		const month = monthOf(chart(), 2026, 9, now);
		expect(month.title).toBe('October 2026');
		expect(month.weeks).toHaveLength(5);
		expect(month.weeks[0]!.map((day) => day.day)).toEqual([28, 29, 30, 1, 2, 3, 4]);
		expect(month.weeks[0]![0]).toMatchObject({ key: '2026-09-28', inMonth: false });
		expect(month.weeks[0]![0]!.done).toHaveLength(1);
		expect(month.weeks[4]![6]).toMatchObject({ key: '2026-11-01', inMonth: false });
		const ninth = month.weeks[1]![4]!;
		expect(ninth).toMatchObject({ key: '2026-10-09', today: false, future: false });
		expect(ninth.done).toHaveLength(3);
		expect(month.weeks[1]![5]).toMatchObject({ key: '2026-10-10', today: true });
		expect(month.weeks[1]![6]).toMatchObject({ key: '2026-10-11', future: true });
		// September's tick is not October's.
		expect(month.days).toBe(1);
		expect(month.ticks).toBe(3);
	});

	it('says the month in one line', () => {
		expect(monthLine(monthOf(chart(), 2026, 9, now))).toBe('3 things finished on 1 day.');
		expect(monthLine(monthOf(chart(), 2026, 7, now))).toBe('Nothing finished this month yet.');
	});
});

describe('moving between months', () => {
	it('shifts across a year end, and knows the first month with anything done', () => {
		expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
		expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
		expect(firstDoneMonth(chart())).toEqual({ year: 2026, month: 8 });
		expect(firstDoneMonth(emptyChart())).toBeNull();
		expect(dayTitle('2026-10-10')).toBe('Saturday, October 10');
	});
});
