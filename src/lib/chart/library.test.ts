import { describe, expect, it } from 'vitest';
import { emptyChart, exportJson, filledCount, parseChart } from './model.ts';
import { buildChart, getPreset } from './presets/index.ts';
import {
	cloneChart,
	daysUntilPurge,
	deleteFromLibrary,
	emptyLibrary,
	flushActive,
	forgetManyFromLibrary,
	deletedClock,
	deletedDayLabel,
	formatAgo,
	formatDaysLeft,
	formatUpdated,
	migrateFromV1,
	newRecord,
	parseLibrary,
	purgeDeleted,
	reconcile,
	restoreManyFromLibrary,
	summarize,
	titleOf,
	TRASH_DAYS,
	TRASH_MS,
	UNTITLED,
	type DeletedRecord
} from './library.ts';

describe('titleOf', () => {
	it('uses the goal, or Untitled', () => {
		const data = emptyChart();
		expect(titleOf(data)).toBe(UNTITLED);
		data.goal = '  Learn Slovak  ';
		expect(titleOf(data)).toBe('Learn Slovak');
	});
});

describe('formatUpdated', () => {
	const now = new Date(2026, 9, 2, 22, 57).getTime();

	it('uses a clock for today and yesterday, then a short date', () => {
		expect(formatUpdated(now, now)).toBe('Updated 10:57 pm');
		expect(formatUpdated(new Date(2026, 9, 2, 0, 1).getTime(), now)).toBe('Updated 12:01 am');
		expect(formatUpdated(new Date(2026, 9, 1, 23, 59).getTime(), now)).toBe(
			'Updated yesterday at 11:59 pm'
		);
		expect(formatUpdated(new Date(2026, 8, 15, 12).getTime(), now)).toBe('Updated Sep 15');
		expect(formatUpdated(new Date(2025, 11, 31, 12).getTime(), now)).toBe('Updated Dec 31, 2025');
	});
});

describe('trash list labels', () => {
	const now = new Date(2026, 9, 2, 22, 57).getTime();

	it('splits the day from the clock', () => {
		expect(deletedDayLabel(now, now)).toBe('Today');
		expect(deletedClock(now)).toBe('10:57 pm');
		expect(deletedDayLabel(new Date(2026, 9, 1, 23, 59).getTime(), now)).toBe('Yesterday');
		expect(deletedClock(new Date(2026, 9, 1, 23, 59).getTime())).toBe('11:59 pm');
		expect(deletedDayLabel(new Date(2026, 8, 15, 15, 4).getTime(), now)).toBe('Sep 15');
		expect(deletedDayLabel(new Date(2025, 11, 31, 12).getTime(), now)).toBe('Dec 31, 2025');
	});

	it('gives rows a relative time today and a clock before that', () => {
		expect(formatAgo(now, now)).toBe('Just now');
		expect(formatAgo(now + 5_000, now)).toBe('Just now');
		expect(formatAgo(now - 59_000, now)).toBe('Just now');
		expect(formatAgo(now - 4 * 60_000, now)).toBe('4 min ago');
		expect(formatAgo(now - 59 * 60_000, now)).toBe('59 min ago');
		expect(formatAgo(new Date(2026, 9, 2, 19, 50).getTime(), now)).toBe('3 h ago');
		expect(formatAgo(new Date(2026, 9, 1, 23, 59).getTime(), now)).toBe('11:59 pm');
	});

	it('shortens the hold when a row is about to expire', () => {
		expect(formatDaysLeft(1)).toBe('1 day left');
		expect(formatDaysLeft(0)).toBe('1 day left');
		expect(formatDaysLeft(6)).toBe('6 days left');
	});
});

describe('parseLibrary', () => {
	it('returns null for junk', () => {
		expect(parseLibrary('nope')).toBeNull();
		expect(parseLibrary('{}')).toBeNull();
		expect(parseLibrary('{"activeId":"x","charts":[]}')).toBeNull();
	});

	it('round-trips a valid library', () => {
		const library = emptyLibrary();
		library.charts[0]!.data.goal = 'Ship it';
		const parsed = parseLibrary(JSON.stringify(library));
		expect(parsed?.activeId).toBe(library.activeId);
		expect(parsed?.charts).toHaveLength(1);
		expect(parsed?.charts[0]?.data.goal).toBe('Ship it');
	});

	it('falls back to the first chart if activeId is missing', () => {
		const library = emptyLibrary();
		const raw = JSON.stringify({
			activeId: 'missing',
			charts: library.charts
		});
		const parsed = parseLibrary(raw);
		expect(parsed?.activeId).toBe(library.charts[0]?.id);
	});
});

describe('migrateFromV1', () => {
	it('wraps a v1 chart JSON', () => {
		const fitness = buildChart(getPreset('fitness')!);
		const library = migrateFromV1(exportJson(fitness));
		expect(library.charts).toHaveLength(1);
		expect(library.charts[0]?.data.goal).toBe(fitness.goal);
		expect(filledCount(library.charts[0]!.data)).toBe(73);
		expect(library.activeId).toBe(library.charts[0]?.id);
	});

	it('uses an empty chart when v1 is missing or junk', () => {
		expect(titleOf(migrateFromV1(null).charts[0]!.data)).toBe(UNTITLED);
		expect(titleOf(migrateFromV1('nope').charts[0]!.data)).toBe(UNTITLED);
	});
});

describe('clone isolation', () => {
	it('does not share data between records', () => {
		const first = newRecord(emptyChart());
		first.data.goal = 'Slovak';
		const second = newRecord(first.data);
		second.data.goal = 'Russian';
		expect(first.data.goal).toBe('Slovak');
		expect(second.data.goal).toBe('Russian');

		const clone = cloneChart(first.data);
		clone.goal = 'changed';
		expect(first.data.goal).toBe('Slovak');
	});

	it('flushActive copies live data into the active record only', () => {
		const a = newRecord(emptyChart());
		const b = newRecord(emptyChart());
		b.data.goal = 'Keep me';
		const live = emptyChart();
		live.goal = 'Active now';
		const next = flushActive([a, b], a.id, live);
		expect(next[0]?.data.goal).toBe('Active now');
		expect(next[1]?.data.goal).toBe('Keep me');
		live.goal = 'mutated';
		expect(next[0]?.data.goal).toBe('Active now');
	});

	it('flushActive keeps the time when nothing changed', () => {
		const a = newRecord(emptyChart(), 1);
		a.data.goal = 'Same';
		const live = cloneChart(a.data);
		expect(flushActive([a], a.id, live, 99)[0]).toBe(a);
		live.goal = 'Edited';
		expect(flushActive([a], a.id, live, 99)[0]?.updatedAt).toBe(99);
	});
});

describe('summarize', () => {
	it('pins the active chart and uses live data for its title', () => {
		const a = newRecord(emptyChart(), 1);
		const b = newRecord(emptyChart(), 2);
		a.data.goal = 'Old';
		b.data.goal = 'Other';
		const live = emptyChart();
		live.goal = 'Live title';
		const rows = summarize([a, b], a.id, live);
		expect(rows[0]?.id).toBe(a.id);
		expect(rows[0]?.title).toBe('Live title');
		expect(rows[0]?.active).toBe(true);
		expect(rows[1]?.title).toBe('Other');
	});
});

describe('parseChart round trip', () => {
	it('parses exported chart JSON back through parseChart', () => {
		const rec = newRecord(buildChart(getPreset('money')!));
		expect(parseChart(exportJson(rec.data))).toEqual(rec.data);
	});
});

function deletedRecord(goal: string, deletedAt: number): DeletedRecord {
	const record = newRecord(emptyChart(), deletedAt);
	record.data.goal = goal;
	return { ...record, deletedAt };
}

describe('recently deleted', () => {
	const now = new Date(2026, 9, 3, 12).getTime();

	it('reads a library saved before deleted charts existed', () => {
		const library = emptyLibrary();
		const raw = JSON.stringify({ activeId: library.activeId, charts: library.charts });
		expect(parseLibrary(raw)?.deleted).toEqual([]);
	});

	it('keeps a deleted chart for 30 days, then drops it', () => {
		const fresh = deletedRecord('Keep', now - TRASH_MS + 1);
		const expired = deletedRecord('Drop', now - TRASH_MS);
		expect(purgeDeleted([fresh, expired], now).map((item) => item.id)).toEqual([fresh.id]);
		expect(daysUntilPurge(fresh.deletedAt, now)).toBe(1);
		expect(daysUntilPurge(now, now)).toBe(TRASH_DAYS);
	});

	it('moves the last chart to recently deleted and leaves a blank chart', () => {
		const library = emptyLibrary();
		library.charts[0]!.data.goal = 'Only one';
		const next = deleteFromLibrary(library, library.charts[0]!.id, now);
		expect(next?.charts).toHaveLength(1);
		expect(next?.charts[0]?.data.goal).toBe('');
		expect(next?.activeId).not.toBe(library.activeId);
		expect(next?.deleted).toHaveLength(1);
		expect(next?.deleted[0]?.data.goal).toBe('Only one');
		expect(next?.deleted[0]?.deletedAt).toBe(now);
	});

	it('opens the next chart down the list after deleting the open one, or the one above at the end', () => {
		const [newest, middle, oldest] = [newRecord(emptyChart(), 3), newRecord(emptyChart(), 2), newRecord(emptyChart(), 1)];
		const library = { activeId: middle.id, charts: [oldest, newest, middle], deleted: [] };
		expect(deleteFromLibrary(library, middle.id, now)?.activeId).toBe(oldest.id);
		expect(deleteFromLibrary({ ...library, activeId: oldest.id }, oldest.id, now)?.activeId).toBe(middle.id);
		expect(deleteFromLibrary({ ...library, activeId: newest.id }, middle.id, now)?.activeId).toBe(newest.id);
	});

	it('restores a deleted chart as the active one', () => {
		const library = emptyLibrary();
		const removed = deleteFromLibrary(library, library.activeId, now);
		expect(removed).not.toBeNull();
		const restored = restoreManyFromLibrary(removed!, [removed!.deleted[0]!.id], now + 1000);
		expect(restored?.activeId).toBe(removed!.deleted[0]?.id);
		expect(restored?.deleted).toEqual([]);
		expect(restored?.charts).toHaveLength(2);
	});

	it('restores several charts and opens the newest', () => {
		const library = emptyLibrary();
		library.deleted = [
			deletedRecord('Older', now - 5_000),
			deletedRecord('Newer', now - 1_000),
			deletedRecord('Stay', now)
		];
		const ids = library.deleted.slice(0, 2).map((row) => row.id);
		const restored = restoreManyFromLibrary(library, ids, now + 1000);
		expect(restored?.deleted.map((row) => row.data.goal)).toEqual(['Stay']);
		expect(restored?.charts.map((row) => row.data.goal)).toContain('Older');
		expect(restored?.charts.map((row) => row.data.goal)).toContain('Newer');
		expect(restored?.activeId).toBe(library.deleted[1]?.id);
		expect(restoreManyFromLibrary(library, ['missing'], now)).toBeNull();
	});

	it('removes several deleted charts and leaves the rest', () => {
		const library = emptyLibrary();
		library.deleted = [
			deletedRecord('One', now),
			deletedRecord('Two', now - 1_000),
			deletedRecord('Keep', now - 2_000)
		];
		const ids = library.deleted.slice(0, 2).map((row) => row.id);
		const forgotten = forgetManyFromLibrary(library, ids);
		expect(forgotten?.deleted.map((row) => row.data.goal)).toEqual(['Keep']);
		expect(forgetManyFromLibrary(library, ['missing'])).toBeNull();
	});

	it('removes a deleted chart before the hold ends', () => {
		const library = emptyLibrary();
		const removed = deleteFromLibrary(library, library.activeId, now)!;
		const forgotten = forgetManyFromLibrary(removed, [removed.deleted[0]!.id]);
		expect(forgotten?.deleted).toEqual([]);
		expect(restoreManyFromLibrary(forgotten!, [removed.deleted[0]!.id], now)).toBeNull();
	});

	it('skips a broken deleted row and ignores one that is still live', () => {
		const library = emptyLibrary();
		const raw = JSON.stringify({
			activeId: library.activeId,
			charts: library.charts,
			deleted: [{ id: 'bad' }, { ...deletedRecord('Gone', now), id: library.activeId }]
		});
		expect(parseLibrary(raw)?.deleted).toEqual([]);
	});
});

describe('reconcile', () => {
	const at = new Date(2026, 9, 10, 12).getTime();
	const chart = (goal: string) => {
		const data = emptyChart();
		data.goal = goal;
		return data;
	};
	const record = (id: string, goal: string, updatedAt: number) => ({ id, updatedAt, data: chart(goal) });

	it('takes in charts another tab added, and keeps the one open here', () => {
		const local = { activeId: 'a', charts: [record('a', 'Mine', at)], deleted: [] };
		const stored = { activeId: 'c', charts: [record('a', 'Mine', at), record('b', 'Theirs', at + 1), record('c', 'Newer', at + 2)], deleted: [] };
		const merged = reconcile(local, stored);
		expect(merged.charts.map((item) => item.id)).toEqual(['a', 'b', 'c']);
		expect(merged.activeId).toBe('a');
	});

	it('keeps the lines being written here over an older copy in storage, and takes a newer edit of another chart', () => {
		const local = { activeId: 'a', charts: [record('a', 'Mine, edited', at + 5), record('b', 'Old', at)], deleted: [] };
		const stored = { activeId: 'a', charts: [record('a', 'Mine', at), record('b', 'Edited there', at + 3)], deleted: [] };
		const merged = reconcile(local, stored, 'a');
		expect(merged.charts.find((item) => item.id === 'a')?.data.goal).toBe('Mine, edited');
		expect(merged.charts.find((item) => item.id === 'b')?.data.goal).toBe('Edited there');
	});

	it('follows a deletion made after the last edit, and a restore made after a deletion', () => {
		const gone = (id: string, goal: string, updatedAt: number, deletedAt: number): DeletedRecord => ({ id, updatedAt, deletedAt, data: chart(goal) });
		const local = { activeId: 'a', charts: [record('a', 'A', at), record('b', 'B', at)], deleted: [gone('c', 'C', at, at + 1)] };
		const stored = { activeId: 'b', charts: [record('b', 'B', at), record('c', 'C', at + 4)], deleted: [gone('a', 'A', at, at + 2)] };
		const merged = reconcile(local, stored);
		expect(merged.charts.map((item) => item.id).sort()).toEqual(['b', 'c']);
		expect(merged.deleted.map((item) => item.id)).toEqual(['a']);
		expect(merged.activeId).toBe('b');
	});

	it('leaves a blank chart open when every chart is gone', () => {
		const gone = (id: string, deletedAt: number): DeletedRecord => ({ id, updatedAt: at, deletedAt, data: chart(id) });
		const local = { activeId: 'a', charts: [record('a', 'A', at)], deleted: [gone('b', at + 1)] };
		const stored = { activeId: 'b', charts: [record('b', 'B', at)], deleted: [gone('a', at + 1)] };
		const merged = reconcile(local, stored);
		expect(merged.charts).toHaveLength(1);
		expect(merged.charts[0]!.data.goal).toBe('');
		expect(merged.activeId).toBe(merged.charts[0]!.id);
		expect(merged.deleted.map((item) => item.id).sort()).toEqual(['a', 'b']);
	});
});
