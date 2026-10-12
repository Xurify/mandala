import { describe, expect, it } from 'vitest';
import { dayTitle, doneOn, openedOn, firstDoneMonth, lastDoneDay, monthLine, monthOf, shiftMonth, type Goal } from './calendar.ts';
import { A, slotted } from './fixtures.ts';
import { emptyChart, type ChartData } from './model.ts';

function chart(): ChartData {
	const data = slotted(emptyChart());
	data.goal = 'Speak Slovak';
	data.pillars[0] = 'Listening';
	data.pillars[2] = 'Speaking';
	data.actions[0] = ['Play audio at breakfast', 'Shadow a clip', '', '', '', '', '', ''];
	data.actions[2] = ['Say one new sentence', '', '', '', '', '', '', ''];
	data.days = {
		'2026-10-09': { focus: [A.a0_0, A.a2_0], checked: [A.a2_0, A.a0_0, A.a0_1], at: { [A.a2_0]: '19:10', [A.a0_0]: '07:30', [A.a0_1]: '12:00' } },
		'2026-10-10': { focus: [A.a0_1], checked: [] },
		'2026-09-28': { focus: [A.a0_0], checked: [A.a0_0] }
	};
	data.meta = { [A.a0_1]: { kind: 'milestone', done: true, doneAt: '2026-10-09' } };
	return data;
}

const mine = (): Goal[] => [{ id: 'slovak', title: 'Speak Slovak', data: chart() }];

function running(): ChartData {
	const data = slotted(emptyChart());
	data.goal = 'Run a half marathon';
	data.actions[1]![0] = 'Run 5 km';
	data.days = { '2026-10-09': { focus: [], checked: [A.a1_0], at: { [A.a1_0]: '06:40' } } };
	return data;
}

function saving(): ChartData {
	const data = slotted(emptyChart());
	data.goal = 'Save for a trip';
	data.actions[3]![0] = 'Move 50 to savings';
	return data;
}

describe('openedOn', () => {
	it('lists the tools opened that day, in pillar order', () => {
		const data = chart();
		const tool = (id: string, opened: string[]) => ({ id, url: `https://example.com/${id}`, title: id, kind: 'repeat' as const, opened });
		data.tools = { p2: [tool('talk', ['2026-10-09'])], p0: [tool('clip', ['2026-10-08', '2026-10-09']), tool('song', ['2026-10-08'])] };
		expect(openedOn(data, '2026-10-09').map((entry) => [entry.pillarIndex, entry.tool.id])).toEqual([
			[0, 'clip'],
			[2, 'talk']
		]);
		expect(openedOn(data, '2026-10-10')).toEqual([]);
		expect(openedOn(chart(), '2026-10-09')).toEqual([]);
	});
});

describe('doneOn', () => {
	it('lists what was finished in the order it happened, and says which closed a milestone', () => {
		const done = doneOn(chart(), '2026-10-09');
		expect(done.map((entry) => entry.id)).toEqual([A.a0_0, A.a0_1, A.a2_0]);
		expect(done[0]).toMatchObject({ text: 'Play audio at breakfast', pillarIndex: 0, at: '07:30', milestone: false });
		expect(done[1]).toMatchObject({ text: 'Shadow a clip', milestone: true });
		expect(doneOn(chart(), '2026-10-10')).toEqual([]);
	});
});

describe('monthOf', () => {
	const now = new Date(2026, 9, 10, 12);

	it('lays the month out Monday first, padded, and counts what was done in it', () => {
		const month = monthOf(mine(), 2026, 9, now);
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
		expect(month.finishedDays).toBe(1);
		expect(month.finishedCount).toBe(3);
	});

	it('says the month in one line', () => {
		expect(monthLine(monthOf(mine(), 2026, 9, now))).toBe('3 things finished on 1 day.');
		expect(monthLine(monthOf(mine(), 2026, 7, now))).toBe('Nothing finished this month yet.');
	});

	it('names each pillar a day touched once, lowest first', () => {
		const month = monthOf(mine(), 2026, 9, now);
		expect(month.weeks[1]![4]!.pillars).toEqual([0, 2]);
		expect(month.weeks[1]![5]!.pillars).toEqual([]);
	});

	it('opens a month on its latest day with something finished', () => {
		expect(lastDoneDay(monthOf(mine(), 2026, 9, now))).toBe('2026-10-09');
		expect(lastDoneDay(monthOf(mine(), 2026, 8, now))).toBe('2026-09-28');
		expect(lastDoneDay(monthOf(mine(), 2026, 7, now))).toBeNull();
	});
});

describe('moving between months', () => {
	it('shifts across a year end, and knows the first month with anything done', () => {
		expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
		expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
		expect(firstDoneMonth(mine())).toEqual({ year: 2026, month: 8 });
		expect(firstDoneMonth([{ id: 'blank', title: 'Untitled', data: emptyChart() }])).toBeNull();
		expect(dayTitle('2026-10-10')).toBe('Saturday, October 10');
	});
});

describe('across goals', () => {
	const now = new Date(2026, 9, 10, 12);
	const goals = (): Goal[] => [
		{ id: 'slovak', title: 'Speak Slovak', data: chart() },
		{ id: 'run', title: 'Run a half marathon', data: running() },
		{ id: 'save', title: 'Save for a trip', data: saving() },
		{ id: 'blank', title: 'Untitled', data: emptyChart() }
	];

	it('puts every goal on the same days, and says which goals moved', () => {
		const month = monthOf(goals(), 2026, 9, now);
		const ninth = month.weeks[1]![4]!;
		expect(ninth.goals).toEqual(['slovak', 'run']);
		expect(ninth.done.map((entry) => [entry.goal, entry.id, entry.at])).toEqual([
			['slovak', A.a0_0, '07:30'],
			['slovak', A.a0_1, '12:00'],
			['slovak', A.a2_0, '19:10'],
			['run', A.a1_0, '06:40']
		]);
		expect(month.moved).toEqual(['slovak', 'run']);
		expect(month.quiet).toEqual(['save']);
		expect(monthLine(month)).toBe('4 things finished across 2 goals.');
	});

	it('starts at the first month any goal finished something', () => {
		const later = running();
		later.days = { '2026-11-02': { focus: [], checked: [A.a1_0] } };
		expect(firstDoneMonth([{ id: 'run', title: 'Run', data: later }, ...mine()])).toEqual({ year: 2026, month: 8 });
	});
});
