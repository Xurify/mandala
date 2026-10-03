import { describe, expect, it } from 'vitest';
import { emptyChart, exportJson, filledCount, parseChart } from './model.ts';
import { buildChart, getPreset } from './presets/index.ts';
import {
	CHART_CAP,
	cloneChart,
	emptyLibrary,
	flushActive,
	formatUpdated,
	migrateFromV1,
	newRecord,
	parseLibrary,
	summarize,
	titleOf,
	UNTITLED
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

describe('caps', () => {
	it('keeps the documented chart cap', () => {
		expect(CHART_CAP).toBe(12);
	});

	it('parses exported chart JSON back through parseChart', () => {
		const rec = newRecord(buildChart(getPreset('money')!));
		expect(parseChart(exportJson(rec.data))).toEqual(rec.data);
	});
});
