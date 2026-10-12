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

describe('chart time', () => {
	const MINUTE = 60_000;

	beforeEach(() => {
		chart.data = emptyChart();
		chart.data.actions[0]![0] = 'Scales before work';
		chart.data.actions[3]![2] = 'Run the set once';
		chart.timerEnd = null;
		chart.loggingTime = null;
	});

	it('logs the stopwatch when it is stopped, and leaves the tick alone', () => {
		chart.startTimer('a0_0');
		chart.data.timer!.since -= 12 * MINUTE;
		chart.stopTimer();
		expect(chart.timer).toBeNull();
		const day = Object.values(chart.data.days ?? {})[0];
		expect(day?.sessions).toEqual([expect.objectContaining({ key: 'a0_0', minutes: 12 })]);
		expect(day?.checked).toEqual([]);
		expect(chart.timerEnd).toMatchObject({ kind: 'stopped', key: 'a0_0', minutes: 12 });
	});

	it('logs the one running when another starts', () => {
		chart.startTimer('a0_0');
		chart.data.timer!.since -= 5 * MINUTE;
		chart.startTimer('a3_2', 25);
		expect(chart.timer).toMatchObject({ key: 'a3_2', length: 25 });
		expect(chart.data.days?.[todayKey()]?.sessions?.map((session) => session.minutes)).toEqual([5]);
	});

	it('finishes a block at its length, and a break without logging', () => {
		chart.startTimer('a3_2', 25);
		expect(chart.finishTimer()).toBeNull();
		chart.data.timer!.since -= 40 * MINUTE;
		expect(chart.finishTimer()).toMatchObject({ kind: 'block', minutes: 25 });
		chart.startBreak(5);
		chart.data.timer!.since -= 6 * MINUTE;
		expect(chart.finishTimer()).toMatchObject({ kind: 'break' });
		expect(chart.data.days?.[todayKey()]?.sessions?.map((session) => session.minutes)).toEqual([25]);
	});

	it('asks how long instead of logging a stopwatch left on for hours', () => {
		chart.startTimer('a0_0');
		chart.data.timer!.since -= 9 * 60 * MINUTE;
		chart.stopTimer();
		expect(chart.timer).not.toBeNull();
		expect(chart.loggingTime?.forgotten).toBeDefined();
		chart.logTime('a0_0', 40);
		expect(chart.timer).toBeNull();
		const sessions = Object.values(chart.data.days ?? {}).flatMap((day) => day.sessions ?? []);
		expect(sessions.map((session) => session.minutes)).toEqual([40]);
	});

	it('logs nothing for under a minute', () => {
		chart.startTimer('a0_0');
		chart.data.timer!.since -= 50_000;
		chart.stopTimer();
		expect(chart.data.days?.[todayKey()]?.sessions).toBeUndefined();
		expect(chart.timerEnd).toMatchObject({ kind: 'stopped', minutes: 0 });
	});

	it('takes logged time off, one session or a whole day, and puts it back on undo', () => {
		chart.logTime('a3_2', 45);
		chart.logTime('a3_2', 20);
		chart.logTime('a0_0', 15);
		const day = todayKey();
		const twenty = chart.data.days![day]!.sessions!.find((session) => session.minutes === 20)!;
		chart.removeTime(day, 'a3_2', twenty);
		expect(chart.data.days![day]!.sessions!.map((session) => session.minutes)).toEqual([45, 15]);
		expect(chart.slips.at(-1)?.kicker).toBe('Removed');
		chart.undoSlip();
		expect(chart.data.days![day]!.sessions!.map((session) => session.minutes).sort()).toEqual([15, 20, 45]);
		chart.removeTime(day, 'a3_2');
		expect(chart.data.days![day]!.sessions!.map((session) => session.key)).toEqual(['a0_0']);
		chart.removeTime(day, 'a0_0');
		expect(chart.data.days![day]!.sessions).toBeUndefined();
	});

	it('adds time spent away from the app', () => {
		chart.logTime('a3_2', 45);
		expect(chart.data.days?.[todayKey()]?.sessions).toEqual([expect.objectContaining({ key: 'a3_2', minutes: 45 })]);
	});
});
