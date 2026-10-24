import { beforeEach, describe, expect, it } from 'vitest';
import { chart } from './chart.svelte.ts';
import { A, slotted } from './fixtures.ts';
import { emptyChart, todayKey } from './model.ts';
import { buildChart, getPreset } from './presets/index.ts';

beforeEach(() => {
	chart.data = slotted(emptyChart());
});

describe('chart day log', () => {
	it('logs picks taken off by hand, not ones Bindu replaced', () => {
		chart.setFocus('2026-10-05', [A.a0_0, A.a1_0, A.a2_0]);
		chart.setFocus('2026-10-05', [A.a0_0, A.a1_0]);
		expect(chart.data.days?.['2026-10-05']?.dropped).toEqual([A.a2_0]);
		chart.setFocus('2026-10-05', [A.a0_0, A.a1_0, A.a2_0]);
		expect(chart.data.days?.['2026-10-05']?.dropped).toBeUndefined();
		chart.setFocus('2026-10-05', [A.a3_0, A.a4_0, A.a5_0], true);
		expect(chart.data.days?.['2026-10-05']?.dropped).toBeUndefined();
	});

	it('keeps the time of a tick and clears it when the action reopens', () => {
		chart.data.actions[0]![0] = 'Book a race';
		chart.finish(A.a0_0);
		expect(chart.todayLog.at?.[A.a0_0]).toMatch(/^\d\d:\d\d$/);
		expect(chart.data.meta?.[A.a0_0]).toMatchObject({ done: true, doneAt: todayKey() });
		chart.reopen(A.a0_0);
		expect(chart.todayLog.at).toBeUndefined();
		expect(chart.data.meta?.[A.a0_0]?.done).toBe(false);
	});

	it('records declined suggestions and shown insights once each', () => {
		chart.declineToday([A.a0_0, A.a1_0]);
		chart.declineToday([A.a0_0]);
		chart.noteShown(`stuck:${A.a3_0}`);
		chart.noteShown(`stuck:${A.a3_0}`);
		const log = chart.data.days?.[todayKey()];
		expect(log?.declined).toEqual([A.a0_0, A.a1_0]);
		expect(log?.shown).toEqual([`stuck:${A.a3_0}`]);
	});

	it('notes a line written or reworded once a day, and not a cleared one', () => {
		chart.setText('a0_0', 'Book');
		chart.setText('a0_0', 'Book a race');
		chart.setText('a0_0', 'Book a race ');
		chart.setText('a1_0', '');
		chart.setText('g', 'Run a half marathon');
		expect(chart.todayLog.wrote).toEqual([A.a0_0]);
	});
});

describe('chart board', () => {
	it('moves a card through the lists and refuses Done for a routine', () => {
		chart.data.actions[0]![0] = 'Book a race';
		chart.data.actions[0]![1] = 'Run 3 km';
		chart.setActionMeta(A.a0_1, { kind: 'routine' });
		expect(chart.moveCard(A.a0_0, 'doing', 0)).toBe(true);
		expect(chart.data.meta?.[A.a0_0]).toMatchObject({ lane: 'doing', rank: 0 });
		expect(chart.moveCard(A.a0_0, 'done', 0)).toBe(true);
		expect(chart.data.meta?.[A.a0_0]).toMatchObject({ kind: 'milestone', done: true, doneAt: todayKey() });
		expect(chart.todayLog.checked).toEqual([A.a0_0]);
		chart.toggleDone(A.a0_0);
		expect(chart.todayLog.checked).toEqual([]);
		expect(chart.moveCard(A.a0_1, 'done', 0)).toBe(false);
		expect(chart.data.meta?.[A.a0_1]?.done).toBeUndefined();
	});
});

describe('chart shelves', () => {
	it('turns a pillar to its shelf, and back to its actions when a door names a cell', () => {
		chart.viewMode = 'split';
		chart.openShelf(2);
		expect(chart.face).toBe('shelf');
		chart.selectPillar(5);
		expect(chart.face).toBe('shelf');
		chart.jumpToKey(A.a5_1);
		expect(chart.face).toBe('actions');
		expect(chart.focusedKey).toBe('a5_1');
		chart.clearFocusedKey();
	});

	it('takes tools off in one slip, and its undo puts each back where it was', () => {
		chart.data = emptyChart();
		const [firstClip, secondClip, thirdClip] = ['SZaaZpKLTFE', 'wzMrFFcC1BU', 'dQw4w9WgXcQ'].map((videoId, index) => chart.addTool(1, `https://youtu.be/${videoId}`, `Clip ${index + 1}`));
		const site = chart.addTool(4, 'https://example.com/', 'Site');
		chart.removeTools([
			{ pillarIndex: 1, id: firstClip!.id },
			{ pillarIndex: 1, id: thirdClip!.id },
			{ pillarIndex: 4, id: site.id }
		]);
		expect(chart.data.tools?.p1?.map((tool) => tool.id)).toEqual([secondClip!.id]);
		expect(chart.data.tools?.p4).toBeUndefined();
		expect(chart.slips.at(-1)).toMatchObject({ kicker: 'Off the shelf', subject: '3 links' });
		chart.undoSlip();
		expect(chart.data.tools?.p1?.map((tool) => tool.id)).toEqual([firstClip!.id, secondClip!.id, thirdClip!.id]);
		expect(chart.data.tools?.p4?.map((tool) => tool.id)).toEqual([site.id]);
	});

	it('moves a tool to another shelf, and lets the routines there hand it out', () => {
		chart.data = slotted(emptyChart());
		const clip = chart.addTool(1, 'https://youtu.be/SZaaZpKLTFE', 'Clip');
		chart.updateTool(1, clip.id, { action: A.a1_0, kind: 'once' });
		chart.moveTools([{ pillarIndex: 1, id: clip.id }], 6);
		expect(chart.data.tools?.p1).toBeUndefined();
		expect(chart.data.tools?.p6).toEqual([{ id: clip.id, url: clip.url, title: 'Clip', kind: 'once' }]);
	});
});

describe('chart time', () => {
	const MINUTE = 60_000;

	const ids = () => ({ a0_0: chart.data.actionIds[0]![0]!, a3_2: chart.data.actionIds[3]![2]! });
	const logged = () => Object.values(chart.data.days ?? {}).flatMap((day) => day.sessions ?? []).map((session) => session.minutes);

	beforeEach(() => {
		chart.data = emptyChart();
		chart.data.actions[0]![0] = 'Scales before work';
		chart.data.actions[3]![2] = 'Run the set once';
		chart.timerEnd = null;
		chart.loggingTime = null;
	});

	it('logs the stopwatch when it is stopped, and leaves the tick alone', () => {
		chart.startTimer(ids().a0_0);
		chart.data.timer!.since -= 12 * MINUTE;
		chart.stopTimer();
		expect(chart.timer).toBeNull();
		const day = Object.values(chart.data.days ?? {})[0];
		expect(day?.sessions).toEqual([expect.objectContaining({ action: ids().a0_0, minutes: 12 })]);
		expect(day?.checked).toEqual([]);
		expect(chart.timerEnd).toMatchObject({ kind: 'stopped', action: ids().a0_0, minutes: 12 });
	});

	it('logs the one running when another starts', () => {
		chart.startTimer(ids().a0_0);
		chart.data.timer!.since -= 5 * MINUTE;
		chart.startTimer(ids().a3_2, 25);
		expect(chart.timer).toMatchObject({ action: ids().a3_2, length: 25 });
		expect(logged()).toEqual([5]);
	});

	it('finishes a block at its length, and a break without logging', () => {
		chart.startTimer(ids().a3_2, 25);
		expect(chart.finishTimer()).toBeNull();
		chart.data.timer!.since -= 40 * MINUTE;
		expect(chart.finishTimer()).toMatchObject({ kind: 'block', minutes: 25 });
		chart.startBreak(5);
		chart.data.timer!.since -= 6 * MINUTE;
		expect(chart.finishTimer()).toMatchObject({ kind: 'break' });
		expect(logged()).toEqual([25]);
	});

	it('asks how long instead of logging a stopwatch left on for hours', () => {
		chart.startTimer(ids().a0_0);
		chart.data.timer!.since -= 9 * 60 * MINUTE;
		chart.stopTimer();
		expect(chart.timer).not.toBeNull();
		expect(chart.loggingTime?.forgotten).toBeDefined();
		chart.logTime(ids().a0_0, 40);
		expect(chart.timer).toBeNull();
		expect(logged()).toEqual([40]);
	});

	it('stops the stopwatch on an action taken off today, and keeps its minutes', () => {
		const today = todayKey();
		chart.setFocus(today, [ids().a0_0, ids().a3_2]);
		chart.startTimer(ids().a0_0);
		chart.data.timer!.since -= 7 * MINUTE;
		expect(chart.setFocus(today, [ids().a0_0])).toBeNull();
		expect(chart.timer).not.toBeNull();
		chart.setFocus('2099-01-01', [ids().a0_0]);
		chart.setFocus('2099-01-01', []);
		expect(chart.timer).not.toBeNull();
		expect(chart.setFocus(today, [ids().a3_2])).toBe('Logged 7 min on Scales before work.');
		expect(chart.timer).toBeNull();
		expect(logged()).toEqual([7]);
	});

	it('leaves a stopwatch alone when its action was never on today, and drops one left on for hours', () => {
		const today = todayKey();
		chart.startTimer(ids().a0_0);
		chart.setFocus(today, [ids().a3_2]);
		expect(chart.timer).not.toBeNull();
		chart.setFocus(today, [ids().a0_0]);
		chart.data.timer!.since -= 9 * 60 * MINUTE;
		expect(chart.setFocus(today, [])).toBe('The stopwatch on Scales before work ran for hours, so it was not logged.');
		expect(chart.timer).toBeNull();
		expect(logged()).toEqual([]);
	});

	it("stops the stopwatch when its card moves off today's list on the board", () => {
		chart.data.actionIds = slotted(emptyChart()).actionIds;
		chart.setFocus(todayKey(), [A.a0_0, A.a3_2]);
		chart.startTimer(A.a0_0);
		chart.data.timer!.since -= 4 * MINUTE;
		chart.moveCard(A.a3_2, 'todo', 0);
		expect(chart.timer).not.toBeNull();
		chart.moveCard(A.a0_0, 'todo', 0);
		expect(chart.timer).toBeNull();
		expect(logged()).toEqual([4]);
	});

	it('logs nothing for under a minute', () => {
		chart.startTimer(ids().a0_0);
		chart.data.timer!.since -= 50_000;
		chart.stopTimer();
		expect(logged()).toEqual([]);
		expect(chart.timerEnd).toMatchObject({ kind: 'stopped', minutes: 0 });
	});

	it('takes logged time off, one session or a whole day, and puts it back on undo', () => {
		chart.logTime(ids().a3_2, 45);
		chart.logTime(ids().a3_2, 20);
		chart.logTime(ids().a0_0, 15);
		const day = todayKey();
		const twenty = chart.data.days![day]!.sessions!.find((session) => session.minutes === 20)!;
		chart.removeTime(day, ids().a3_2, twenty);
		expect(chart.data.days![day]!.sessions!.map((session) => session.minutes)).toEqual([45, 15]);
		expect(chart.slips.at(-1)?.kicker).toBe('Removed');
		chart.undoSlip();
		expect(chart.data.days![day]!.sessions!.map((session) => session.minutes).sort()).toEqual([15, 20, 45]);
		chart.removeTime(day, ids().a3_2);
		expect(chart.data.days![day]!.sessions!.map((session) => session.action)).toEqual([ids().a0_0]);
		chart.removeTime(day, ids().a0_0);
		expect(chart.data.days![day]!.sessions).toBeUndefined();
	});

	it('adds time spent away from the app', () => {
		chart.logTime(ids().a3_2, 45, 'tool_1');
		expect(chart.data.days?.[todayKey()]?.sessions).toEqual([expect.objectContaining({ action: ids().a3_2, minutes: 45, link: 'tool_1' })]);
	});
});

describe('chart copies', () => {
	it('copies a chart fresh: the words and setup come, the history stays behind', () => {
		chart.data = emptyChart();
		chart.data.goal = 'Read more';
		chart.data.actions[0]![0] = 'Read 10 pages at lunch';
		const action = chart.data.actionIds[0]![0]!;
		chart.setActionMeta(action, { kind: 'routine', note: 'Page 40' });
		chart.logTime(action, 20);
		chart.duplicateChart(true);
		const copy = chart.data.actionIds[0]![0]!;
		expect(copy).not.toBe(action);
		expect(chart.data.actions[0]![0]).toBe('Read 10 pages at lunch');
		expect(chart.data.meta?.[copy]).toEqual({ kind: 'routine', note: 'Page 40' });
		expect(chart.data.days).toBeUndefined();
		expect(chart.slips.at(-1)?.kicker).toBe('Duplicated');
	});

	it('names the copy, and leaves the chart it came from as it was', () => {
		chart.data = emptyChart();
		chart.data.goal = 'Reach B1 in Slovak';
		const from = chart.charts.find((item) => item.active)!.id;
		chart.duplicateChart(true, 'Reach B1 in Estonian');
		expect(chart.data.goal).toBe('Reach B1 in Estonian');
		expect(chart.charts.find((item) => item.id === from)?.title).toBe('Reach B1 in Slovak');
	});
});

describe('starting from the center', () => {
	it('follows the chart it began on, and ends when a whole chart arrives', () => {
		chart.openStartSheet('fitness');
		expect(chart.inStartSheet).toBe(true);
		expect(chart.borrowedPreset).toBe('fitness');
		chart.setText('g', 'Run a half marathon');
		chart.newChart();
		expect(chart.inStartSheet).toBe(false);
		expect(chart.borrowedPreset).toBeNull();
		chart.openStartSheet(null);
		chart.importChart(buildChart(getPreset('music')!));
		expect(chart.inStartSheet).toBe(false);
	});

	it('ends only for the chart that is starting', () => {
		chart.openStartSheet(null);
		chart.closeStartSheet();
		expect(chart.inStartSheet).toBe(false);
	});
});
