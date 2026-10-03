import { describe, expect, it } from 'vitest';
import { emptyChart, exportJson, filledCount, parseChart } from './model.ts';
import { buildChart, getPreset } from './presets/index.ts';
import {
	cloneChart,
	daysUntilPurge,
	deleteFromLibrary,
	emptyLibrary,
	flushActive,
	forgetFromLibrary,
	formatDeletesIn,
	formatUpdated,
	migrateFromV1,
	newRecord,
	parseLibrary,
	purgeDeleted,
	restoreFromLibrary,
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
		expect(formatDeletesIn(1)).toBe('Deletes in 1 day');
		expect(formatDeletesIn(12)).toBe('Deletes in 12 days');
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

	it('restores a deleted chart as the active one', () => {
		const library = emptyLibrary();
		const removed = deleteFromLibrary(library, library.activeId, now);
		expect(removed).not.toBeNull();
		const restored = restoreFromLibrary(removed!, removed!.deleted[0]!.id, now + 1000);
		expect(restored?.activeId).toBe(removed!.deleted[0]?.id);
		expect(restored?.deleted).toEqual([]);
		expect(restored?.charts).toHaveLength(2);
	});

	it('removes a deleted chart before the hold ends', () => {
		const library = emptyLibrary();
		const removed = deleteFromLibrary(library, library.activeId, now)!;
		const forgotten = forgetFromLibrary(removed, removed.deleted[0]!.id);
		expect(forgotten?.deleted).toEqual([]);
		expect(restoreFromLibrary(forgotten!, removed.deleted[0]!.id, now)).toBeNull();
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
