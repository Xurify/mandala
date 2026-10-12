import { describe, expect, it } from 'vitest';
import { besideLane, boardOf, dealFirst, doneByWeek, findCard, finish, finishedOn, historyOf, laneOf, moveCard, placed, reopen, tomorrowOf, wholeIndex, type Change } from './board.ts';
import { doneOn } from './calendar.ts';
import { cloneChart } from './library.ts';
import { emptyChart, setMeta, type ActionMeta, type ChartData } from './model.ts';

const TODAY = '2026-10-11';

function chart(): ChartData {
	const data = emptyChart();
	data.actions[0] = ['Run 3 km', 'Stretch', '', '', '', '', '', ''];
	data.actions[2] = ['Book a race', '', 'Buy shoes', '', '', '', '', ''];
	data.actions[7]![7] = 'Sleep by 11';
	return data;
}

function apply(data: ChartData, change: Change | null): ChartData {
	expect(change).not.toBeNull();
	for (const [key, patch] of Object.entries(change!.meta)) setMeta(data, key, patch);
	data.days = { ...data.days, ...change!.days };
	return data;
}

const keys = (data: ChartData) => {
	const board = boardOf(data, TODAY);
	return { open: board.open.map((card) => card.key), todo: board.todo.map((card) => card.key), doing: board.doing.map((card) => card.key), done: board.done.map((card) => card.key) };
};

describe('boardOf', () => {
	it('puts every written action in Open, in the chart order, and skips empty cells', () => {
		expect(keys(chart())).toEqual({ open: ['a0_0', 'a0_1', 'a2_0', 'a2_2', 'a7_7'], todo: [], doing: [], done: [] });
	});

	it('reads lanes and ranks from meta, and puts a done one in Done whatever its lane', () => {
		const data = chart();
		data.meta = {
			a2_2: { kind: 'milestone', lane: 'todo', rank: 1 },
			a0_1: { kind: 'routine', lane: 'todo', rank: 0 },
			a7_7: { kind: 'milestone', lane: 'doing', rank: 0, done: true, doneAt: '2026-10-09' },
			a2_0: { kind: 'milestone', done: true, doneAt: '2026-10-10' }
		};
		expect(keys(data)).toEqual({ open: ['a0_0'], todo: ['a0_1', 'a2_2'], doing: [], done: ['a2_0', 'a7_7'] });
	});

	it('keeps a routine out of Done even when it carries a done flag', () => {
		expect(laneOf({ kind: 'routine', done: true })).toBe('open');
		expect(laneOf({ kind: 'routine', done: true, lane: 'doing' })).toBe('doing');
	});

	it('orders cards without a rank after ranked ones, in chart order', () => {
		const data = chart();
		data.meta = { a7_7: { kind: 'milestone', lane: 'todo', rank: 0 }, a0_0: { kind: 'milestone', lane: 'todo' }, a2_0: { kind: 'milestone', lane: 'todo' } };
		expect(keys(data).todo).toEqual(['a7_7', 'a0_0', 'a2_0']);
	});
});

describe('moveCard', () => {
	it('moves a card into To do and numbers the list from 0', () => {
		const data = chart();
		apply(data, moveCard(data, 'a2_2', 'todo', 0, TODAY));
		apply(data, moveCard(data, 'a0_0', 'todo', 0, TODAY));
		apply(data, moveCard(data, 'a7_7', 'todo', 1, TODAY));
		expect(keys(data).todo).toEqual(['a0_0', 'a7_7', 'a2_2']);
		expect(['a0_0', 'a7_7', 'a2_2'].map((key) => data.meta?.[key]?.rank)).toEqual([0, 1, 2]);
	});

	it('reorders within a lane and leaves untouched cards out of the patch', () => {
		const data = chart();
		data.meta = {
			a0_0: { kind: 'milestone', lane: 'doing', rank: 0 },
			a2_0: { kind: 'milestone', lane: 'doing', rank: 1 },
			a7_7: { kind: 'milestone', lane: 'doing', rank: 2 }
		};
		const change = moveCard(data, 'a7_7', 'doing', 1, TODAY);
		expect(Object.keys(change!.meta).sort()).toEqual(['a2_0', 'a7_7']);
		expect(change!.days).toEqual({});
		apply(data, change);
		expect(keys(data).doing).toEqual(['a0_0', 'a7_7', 'a2_0']);
		expect(moveCard(data, 'a0_0', 'doing', 0, TODAY)).toEqual({ meta: {}, days: {} });
	});

	it('marks a card done with today and ticks today, so Today and the calendar show it', () => {
		const data = chart();
		apply(data, moveCard(data, 'a0_0', 'doing', 0, TODAY));
		apply(data, moveCard(data, 'a0_0', 'done', 0, TODAY, 1000, '09:30'));
		expect(data.meta?.a0_0).toMatchObject({ kind: 'milestone', done: true, doneAt: TODAY });
		expect(keys(data).done).toEqual(['a0_0']);
		expect(data.days?.[TODAY]).toMatchObject({ checked: ['a0_0'], at: { a0_0: '09:30' } });
		expect(doneOn(data, TODAY)).toEqual([{ key: 'a0_0', text: 'Run 3 km', pillarIndex: 0, at: '09:30', milestone: true }]);
	});

	it('puts the card moved last first among those done the same day', () => {
		const data = chart();
		data.meta = { a2_0: { kind: 'milestone', done: true, doneAt: TODAY }, a0_1: { kind: 'milestone', done: true, doneAt: '2026-10-10' } };
		apply(data, moveCard(data, 'a7_7', 'done', 0, TODAY, 1000));
		apply(data, moveCard(data, 'a0_0', 'done', 0, TODAY, 2000));
		expect(keys(data).done).toEqual(['a0_0', 'a7_7', 'a2_0', 'a0_1']);
		expect(placed(boardOf(data), 'a2_2', 'done', 3, TODAY).done.map((card) => card.key)).toEqual(['a2_2', 'a0_0', 'a7_7', 'a2_0', 'a0_1']);
	});

	it('reopens a done card when it leaves Done, and takes it off the day it was done', () => {
		const data = chart();
		data.meta = { a2_0: { kind: 'milestone', done: true, doneAt: '2026-10-01' } };
		data.days = { '2026-10-01': { focus: [], checked: ['a2_0'], at: { a2_0: '18:00' } } };
		apply(data, moveCard(data, 'a2_0', 'doing', 0, TODAY));
		expect(data.meta.a2_0).toMatchObject({ done: false, doneAt: undefined, lane: 'doing', rank: 0 });
		expect(data.days['2026-10-01']).toEqual({ focus: [], checked: [], at: undefined });
		expect(doneOn(data, '2026-10-01')).toEqual([]);
		apply(data, moveCard(data, 'a2_0', 'done', 0, TODAY));
		apply(data, moveCard(data, 'a2_0', 'open', 0, TODAY));
		expect(laneOf(data.meta.a2_0)).toBe('open');
		expect(data.meta.a2_0?.done).toBe(false);
	});

	it('refuses Done for a routine, and anything for a key that is not on the board', () => {
		const data = chart();
		data.meta = { a0_1: { kind: 'routine' } };
		expect(moveCard(data, 'a0_1', 'done', 0, TODAY)).toBeNull();
		expect(moveCard(data, 'a0_1', 'doing', 0, TODAY)).not.toBeNull();
		expect(moveCard(data, 'a5_5', 'todo', 0, TODAY)).toBeNull();
	});

	it('keeps its lanes through a save and a load', () => {
		const data = chart();
		apply(data, moveCard(data, 'a2_2', 'doing', 0, TODAY));
		apply(data, moveCard(data, 'a0_0', 'done', 0, TODAY));
		expect(keys(cloneChart(data))).toEqual(keys(data));
	});

	it('clamps an index past the end', () => {
		const data = chart();
		apply(data, moveCard(data, 'a0_0', 'todo', 99, TODAY));
		apply(data, moveCard(data, 'a2_0', 'todo', 99, TODAY));
		expect(keys(data).todo).toEqual(['a0_0', 'a2_0']);
	});
});

describe('placed', () => {
	it('previews Open in chart order and Done newest first, whatever the index', () => {
		const data = chart();
		data.meta = {
			a0_0: { kind: 'milestone', lane: 'todo', rank: 0 },
			a2_0: { kind: 'milestone', done: true, doneAt: '2026-10-02' }
		};
		const board = boardOf(data);
		expect(placed(board, 'a0_0', 'open', 3, TODAY).open.map((card) => card.key)).toEqual(['a0_0', 'a0_1', 'a2_2', 'a7_7']);
		const done = placed(board, 'a7_7', 'done', 1, TODAY).done;
		expect(done.map((card) => card.key)).toEqual(['a7_7', 'a2_0']);
		expect(done[0]?.doneAt).toBe(TODAY);
		expect(board.open.map((card) => card.key)).toEqual(['a0_1', 'a2_2', 'a7_7']);
	});
});

describe('besideLane', () => {
	it('steps to the next list, and skips Done for a routine', () => {
		const data = chart();
		data.meta = { a0_1: { kind: 'routine', lane: 'doing', rank: 0 } };
		const board = boardOf(data);
		const routine = findCard(board, 'a0_1')!.card;
		expect(besideLane(routine, 'doing', 1)).toBeNull();
		expect(besideLane(routine, 'doing', -1)).toBe('todo');
		expect(besideLane(routine, 'todo', 1)).toBe('doing');
		const plain = findCard(board, 'a2_0')!.card;
		expect(besideLane(plain, 'open', 1)).toBe('todo');
		expect(besideLane(plain, 'doing', 1)).toBe('done');
		expect(besideLane(plain, 'open', -1)).toBeNull();
	});
});

describe('wholeIndex', () => {
	it('maps a place among the shown cards back to the whole list', () => {
		const rest = boardOf(chart()).open;
		const pillarTwo = (card: { pillarIndex: number }) => card.pillarIndex === 2;
		expect(wholeIndex(rest, pillarTwo, 0)).toBe(2);
		expect(wholeIndex(rest, pillarTwo, 1)).toBe(3);
		expect(wholeIndex(rest, pillarTwo, 2)).toBe(4);
		expect(wholeIndex(rest, () => false, 0)).toBe(5);
		expect(wholeIndex([], () => true, 3)).toBe(0);
	});
});

describe('dealFirst', () => {
	it('puts pinned first, then Doing and To do in their order, and leaves the rest in chart order', () => {
		const meta: Record<string, ActionMeta> = {
			a: { kind: 'milestone', lane: 'todo', rank: 0 },
			b: { kind: 'milestone', lane: 'doing', rank: 1 },
			c: { kind: 'routine', pinned: true },
			d: { kind: 'milestone', lane: 'doing', rank: 0 }
		};
		const order = ['x', 'a', 'b', 'y', 'c', 'd'].sort((left, right) => dealFirst(meta[left], meta[right]));
		expect(order).toEqual(['c', 'd', 'b', 'a', 'x', 'y']);
	});
});

describe('doneByWeek', () => {
	it('splits Done at Monday', () => {
		const data = chart();
		data.meta = {
			a0_0: { kind: 'milestone', done: true, doneAt: '2026-10-05' },
			a2_0: { kind: 'milestone', done: true, doneAt: '2026-10-04' },
			a7_7: { kind: 'milestone', done: true }
		};
		const split = doneByWeek(boardOf(data).done, new Date(2026, 9, 11, 12));
		expect(split.week.map((card) => card.key)).toEqual(['a0_0']);
		expect(split.earlier.map((card) => card.key)).toEqual(['a2_0', 'a7_7']);
	});
});

describe('Today and the board', () => {
	it("shows today's picks in Doing wherever they were filed, and leaves a finished one in Done", () => {
		const data = chart();
		data.meta = { a2_2: { kind: 'milestone', lane: 'todo', rank: 0 }, a0_1: { kind: 'routine' }, a7_7: { kind: 'milestone', done: true, doneAt: '2026-10-02' } };
		data.days = { [TODAY]: { focus: ['a2_0', 'a2_2', 'a7_7'], checked: ['a0_1'] } };
		const board = boardOf(data, TODAY);
		expect(board.doing.map((card) => card.key)).toEqual(['a2_0', 'a2_2']);
		expect(board.done.map((card) => [card.key, card.doneAt])).toEqual([['a7_7', '2026-10-02']]);
		expect(board.open.map((card) => card.key)).toEqual(['a0_0', 'a0_1']);
		expect(laneOf(data.meta.a2_2)).toBe('todo');
	});

	it('finishes from Today the way Done does, and reopens the same way', () => {
		const data = chart();
		data.days = { [TODAY]: { focus: ['a2_0'], checked: [] } };
		apply(data, finish(data, 'a2_0', TODAY, '07:10', 5));
		expect(finishedOn(data, 'a2_0', TODAY)).toBe(true);
		expect(findCard(boardOf(data, TODAY), 'a2_0')?.lane).toBe('done');
		expect(data.meta?.a2_0).toMatchObject({ kind: 'milestone', done: true, doneAt: TODAY, rank: 5 });
		expect(doneOn(data, TODAY).map((entry) => [entry.key, entry.at])).toEqual([['a2_0', '07:10']]);
		apply(data, reopen(data, 'a2_0', TODAY));
		expect(finishedOn(data, 'a2_0', TODAY)).toBe(false);
		expect(findCard(boardOf(data, TODAY), 'a2_0')?.lane).toBe('doing');
		expect(doneOn(data, TODAY)).toEqual([]);
	});

	it('ticks a routine for the day only, and keeps it out of Done', () => {
		const data = chart();
		data.meta = { a0_1: { kind: 'routine', lane: 'doing', rank: 0 } };
		const change = finish(data, 'a0_1', TODAY, '06:00');
		expect(change.meta).toEqual({});
		apply(data, change);
		expect(finishedOn(data, 'a0_1', TODAY)).toBe(true);
		expect(findCard(boardOf(data, TODAY), 'a0_1')?.lane).toBe('doing');
		apply(data, reopen(data, 'a0_1', TODAY));
		expect(data.days?.[TODAY]?.checked).toEqual([]);
	});

	it("takes a card off today's picks when it goes back to To do or Open", () => {
		const data = chart();
		data.days = { [TODAY]: { focus: ['a0_0', 'a2_0'], checked: [] } };
		apply(data, moveCard(data, 'a0_0', 'todo', 0, TODAY));
		expect(data.days?.[TODAY]).toMatchObject({ focus: ['a2_0'], dropped: ['a0_0'] });
		apply(data, moveCard(data, 'a2_0', 'open', 0, TODAY));
		expect(data.days?.[TODAY]?.focus).toEqual([]);
		expect(keys(data)).toMatchObject({ todo: ['a0_0'], doing: [] });
	});

	it("files a pick in Doing once it is moved on the board, so it stays there after today", () => {
		const data = chart();
		data.days = { [TODAY]: { focus: ['a7_7'], checked: [] } };
		data.meta = { a2_2: { kind: 'milestone', lane: 'doing', rank: 0 } };
		apply(data, moveCard(data, 'a2_2', 'doing', 1, TODAY));
		expect(data.meta?.a7_7).toMatchObject({ lane: 'doing', rank: 0 });
		expect(boardOf(data, '2026-10-12').doing.map((card) => card.key)).toEqual(['a7_7', 'a2_2']);
	});

	it("shows tomorrow's plan in To do, and takes a card off it when it goes back to Open", () => {
		const data = chart();
		const tomorrow = tomorrowOf(TODAY);
		expect(tomorrow).toBe('2026-10-12');
		data.meta = { a2_2: { kind: 'milestone', lane: 'doing', rank: 0 } };
		data.days = { [tomorrow]: { focus: ['a0_0', 'a2_2'], checked: [] } };
		expect(keys(data)).toMatchObject({ todo: ['a0_0'], doing: ['a2_2'] });
		apply(data, moveCard(data, 'a0_0', 'open', 0, TODAY));
		expect(data.days?.[tomorrow]?.focus).toEqual(['a2_2']);
		expect(keys(data).todo).toEqual([]);
		expect(boardOf(data, tomorrow).doing.map((card) => card.key)).toEqual(['a2_2']);
	});
});

describe('historyOf', () => {
	it('reads one moment a day from the logs, newest first', () => {
		const data = chart();
		data.meta = { a0_1: { kind: 'routine' } };
		data.days = {
			'2026-10-05': { focus: ['a0_0'], checked: [], dropped: ['a0_0'] },
			'2026-10-07': { focus: ['a0_0'], checked: [] },
			'2026-10-09': { focus: ['a0_0'], checked: ['a0_0', 'a0_1'], at: { a0_0: '18:30' } },
			'2026-10-10': { focus: [], checked: ['a0_1'] }
		};
		expect(historyOf(data, 'a0_0')).toEqual([
			{ dateKey: '2026-10-09', what: 'finished', at: '18:30' },
			{ dateKey: '2026-10-07', what: 'picked' },
			{ dateKey: '2026-10-05', what: 'dropped' }
		]);
		expect(historyOf(data, 'a0_1', 1)).toEqual([{ dateKey: '2026-10-10', what: 'ticked', at: undefined }]);
		expect(historyOf(data, 'a7_7')).toEqual([]);
	});
});
