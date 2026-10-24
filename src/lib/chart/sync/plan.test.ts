import { describe, expect, it } from 'vitest';
import { A, slotted } from '../fixtures.ts';
import { emptyChart, type ChartData } from '../model.ts';
import type { ChartLibrary } from '../library.ts';
import { localChart, planChart, planSync, type Bases, type SyncedChart } from './plan.ts';

function chart(goal: string, extra: (data: ChartData) => void = () => {}): ChartData {
	const data = slotted(emptyChart());
	data.goal = goal;
	extra(data);
	return data;
}

function synced(id: string, data: ChartData, at = 1, deletedAt?: number): SyncedChart {
	return { id, updatedAt: at, ...(deletedAt === undefined ? {} : { deletedAt }), data };
}

function library(charts: SyncedChart[], activeId = charts[0]?.id ?? ''): ChartLibrary {
	return {
		activeId,
		charts: charts.filter((each) => each.deletedAt === undefined).map(({ id, updatedAt, data }) => ({ id, updatedAt, data })),
		deleted: charts.filter((each) => each.deletedAt !== undefined).map(({ id, updatedAt, deletedAt, data }) => ({ id, updatedAt, deletedAt: deletedAt!, data }))
	};
}

describe('planChart', () => {
	const run = synced('chart_run', chart('Run a half marathon'));

	it('sends a chart the server has not seen', () => {
		expect(planChart(run, undefined, undefined)).toEqual({ push: { id: 'chart_run', chart: run, expected: null } });
	});

	it('keeps an empty chart that was never synced to this device', () => {
		expect(planChart(synced('chart_blank', chart('')), undefined, undefined)).toEqual({});
	});

	it('does nothing when neither side moved', () => {
		expect(planChart(run, { at: 5, chart: run }, undefined)).toEqual({});
		expect(planChart(run, { at: 5, chart: run }, { id: run.id, at: 5, chart: run })).toEqual({});
	});

	it('sends an edit made here over the version it started from', () => {
		const edited = synced(run.id, chart('Run a full marathon'), 2);
		expect(planChart(edited, { at: 5, chart: run }, undefined).push).toEqual({ id: run.id, chart: edited, expected: 5 });
	});

	it('takes an edit made on the other device', () => {
		const there = synced(run.id, chart('Run a full marathon'), 2);
		expect(planChart(run, { at: 5, chart: run }, { id: run.id, at: 9, chart: there })).toEqual({ next: there, base: { at: 9, chart: there } });
	});

	it('takes a chart it has never seen', () => {
		expect(planChart(null, undefined, { id: run.id, at: 9, chart: run })).toEqual({ next: run, base: { at: 9, chart: run } });
	});

	it('puts edits from both devices together and sends the result', () => {
		const here = synced(run.id, chart('Run a full marathon'), 3);
		const there = synced(run.id, chart('Run a half marathon', (data) => (data.pillars[0] = 'Long runs')), 4);
		const plan = planChart(here, { at: 5, chart: run }, { id: run.id, at: 9, chart: there });
		expect(plan.next?.data.goal).toBe('Run a full marathon');
		expect(plan.next?.data.pillars[0]).toBe('Long runs');
		expect(plan.next?.updatedAt).toBe(4);
		expect(plan.push).toEqual({ id: run.id, chart: plan.next, expected: 9 });
		expect(plan.base).toEqual({ at: 9, chart: there });
	});

	it('moves a chart to recently deleted on both devices, and back', () => {
		const binned = { ...run, deletedAt: 7 };
		expect(planChart(binned, { at: 5, chart: run }, undefined).push?.chart).toEqual(binned);
		expect(planChart(run, { at: 5, chart: run }, { id: run.id, at: 9, chart: binned }).next).toEqual(binned);
		expect(planChart(binned, { at: 5, chart: binned }, { id: run.id, at: 9, chart: run }).next).toEqual(run);
	});

	it('keeps an edit there when the chart was deleted here', () => {
		const binned = { ...run, deletedAt: 7 };
		const there = synced(run.id, chart('Run a half marathon', (data) => (data.pillars[0] = 'Long runs')), 4);
		const plan = planChart(binned, { at: 5, chart: run }, { id: run.id, at: 9, chart: there });
		expect(plan.next?.deletedAt).toBe(7);
		expect(plan.next?.data.pillars[0]).toBe('Long runs');
	});

	it('lets deleting for good win over an edit, on either side', () => {
		const there = synced(run.id, chart('Run a full marathon'), 4);
		expect(planChart(null, { at: 5, chart: run }, undefined).push).toEqual({ id: run.id, chart: null, expected: 5 });
		expect(planChart(null, { at: 5, chart: run }, { id: run.id, at: 9, chart: there }).push).toEqual({ id: run.id, chart: null, expected: 9 });
		const edited = synced(run.id, chart('Run a full marathon'), 3);
		expect(planChart(edited, { at: 5, chart: run }, { id: run.id, at: 9, chart: null })).toEqual({ next: null, base: { at: 9, chart: null }, lost: edited });
	});

	it('takes a chart deleted for good off again when a stale copy brings it back', () => {
		expect(planChart(run, { at: 9, chart: null }, undefined)).toEqual({ next: null });
		expect(planChart(null, { at: 9, chart: null }, undefined)).toEqual({});
	});
});

describe('planSync', () => {
	it('keeps both devices\' ticks on the same day', () => {
		const day = '2026-10-21';
		const start = chart('Run', (data) => {
			data.actions[0]![0] = 'Easy 5k';
			data.actions[1]![0] = 'Hills';
			data.days = { [day]: { focus: [A.a0_0, A.a1_0], checked: [] } };
		});
		const base = synced('chart_run', start);
		const here = structuredClone(base);
		here.data.days![day]!.checked = [A.a0_0];
		const there = structuredClone(base);
		there.data.days![day]!.checked = [A.a1_0];
		const plan = planSync(library([here]), { chart_run: { at: 5, chart: base } }, [{ id: 'chart_run', at: 9, chart: there }]);
		expect(plan.library.charts[0]!.data.days![day]!.checked).toEqual([A.a1_0, A.a0_0]);
		expect(plan.push).toHaveLength(1);
		expect(plan.changed).toEqual(['chart_run']);
	});

	it('adds charts from the other device and sends this one\'s, keeping the open chart', () => {
		const mine = synced('chart_mine', chart('Learn Slovak'));
		const theirs = synced('chart_theirs', chart('Learn Estonian'));
		const plan = planSync(library([mine]), {}, [{ id: 'chart_theirs', at: 9, chart: theirs }]);
		expect(plan.library.activeId).toBe('chart_mine');
		expect(plan.library.charts.map((record) => record.id).sort()).toEqual(['chart_mine', 'chart_theirs']);
		expect(plan.push.map((each) => each.id)).toEqual(['chart_mine']);
		expect(plan.bases.chart_theirs).toEqual({ at: 9, chart: theirs });
	});

	it('opens another chart when the open one was deleted on the other device', () => {
		const open = synced('chart_open', chart('Open'), 1);
		const other = synced('chart_other', chart('Other'), 2);
		const bases: Bases = { chart_open: { at: 5, chart: open }, chart_other: { at: 5, chart: other } };
		const plan = planSync(library([open, other], 'chart_open'), bases, [{ id: 'chart_open', at: 9, chart: { ...open, deletedAt: 8 } }]);
		expect(plan.library.activeId).toBe('chart_other');
		expect(plan.library.deleted.map((record) => record.id)).toEqual(['chart_open']);
	});

	it('leaves a blank chart behind when every chart was deleted for good elsewhere', () => {
		const only = synced('chart_only', chart('Only'));
		const plan = planSync(library([only]), { chart_only: { at: 5, chart: only } }, [{ id: 'chart_only', at: 9, chart: null }]);
		expect(plan.library.charts).toHaveLength(1);
		expect(plan.library.charts[0]!.data.goal).toBe('');
		expect(plan.push).toEqual([]);
	});

	it('reads a chart out of the library as it travels', () => {
		const lib = library([synced('chart_a', chart('A'), 3), synced('chart_b', chart('B'), 4, 6)]);
		expect(localChart(lib, 'chart_a')?.deletedAt).toBeUndefined();
		expect(localChart(lib, 'chart_b')?.deletedAt).toBe(6);
		expect(localChart(lib, 'chart_c')).toBeNull();
	});
});

describe('what the person may want back', () => {
	const start = synced('chart_run', chart('Run a half marathon', (data) => (data.actions[0]![0] = 'Easy 5k')));

	it('names a line both devices rewrote, keeping this device\'s words when they are newer', () => {
		const here = synced('chart_run', chart('Run a half marathon', (data) => (data.actions[0]![0] = 'Easy 6k')), 4);
		const there = synced('chart_run', chart('Run a half marathon', (data) => (data.actions[0]![0] = 'Easy 4k')), 3);
		const plan = planChart(here, { at: 5, chart: start }, { id: 'chart_run', at: 9, chart: there });
		expect(plan.next?.data.actions[0]![0]).toBe('Easy 6k');
		expect(plan.clashes).toEqual([{ ref: A.a0_0, mine: 'Easy 6k', theirs: 'Easy 4k', kept: 'mine' }]);
		expect(plan.outvoted).toEqual(there);
	});

	it('names nothing when the devices changed different lines', () => {
		const here = synced('chart_run', chart('Run a half marathon', (data) => (data.actions[0]![0] = 'Easy 6k')), 2);
		const there = synced('chart_run', chart('Run a full marathon', (data) => (data.actions[0]![0] = 'Easy 5k')), 3);
		expect(planChart(here, { at: 5, chart: start }, { id: 'chart_run', at: 9, chart: there }).clashes).toBeUndefined();
	});

	it('hands back a chart edited here that the other device deleted for good', () => {
		const here = synced('chart_run', chart('Run a full marathon'), 2);
		expect(planChart(here, { at: 5, chart: start }, { id: 'chart_run', at: 9, chart: null })).toEqual({ next: null, base: { at: 9, chart: null }, lost: here });
		expect(planChart(start, { at: 5, chart: start }, { id: 'chart_run', at: 9, chart: null }).lost).toBeUndefined();
	});
});

describe('the newer words win a clash', () => {
	const start = synced('chart_run', chart('Run', (data) => (data.actions[0]![0] = 'Easy 5k')));

	it('keeps the other device\'s words when they were written later, whichever device syncs second', () => {
		const here = synced('chart_run', chart('Run', (data) => (data.actions[0]![0] = 'Easy 6k')), 100);
		const there = synced('chart_run', chart('Run', (data) => (data.actions[0]![0] = 'Easy 4k')), 200);
		const plan = planChart(here, { at: 5, chart: start }, { id: 'chart_run', at: 9, chart: there });
		expect(plan.next?.data.actions[0]![0]).toBe('Easy 4k');
		expect(plan.clashes).toEqual([{ ref: A.a0_0, mine: 'Easy 6k', theirs: 'Easy 4k', kept: 'theirs' }]);
		expect(plan.outvoted).toEqual(here);
		expect(plan.push).toBeUndefined();
	});

	it('keeps the other device\'s words on the clash and still sends this device\'s other edits', () => {
		const here = synced('chart_run', chart('Run far', (data) => (data.actions[0]![0] = 'Easy 6k')), 100);
		const there = synced('chart_run', chart('Run', (data) => (data.actions[0]![0] = 'Easy 4k')), 200);
		const plan = planChart(here, { at: 5, chart: start }, { id: 'chart_run', at: 9, chart: there });
		expect(plan.next?.data.goal).toBe('Run far');
		expect(plan.next?.data.actions[0]![0]).toBe('Easy 4k');
		expect(plan.push?.chart?.data.actions[0]![0]).toBe('Easy 4k');
	});
});
