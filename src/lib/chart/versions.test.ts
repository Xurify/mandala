import { describe, expect, it } from 'vitest';
import { emptyChart } from './model.ts';
import { overflow, QUIET_MS, VERSIONS_PER_CHART, placeVersion, type Version } from './versions.ts';

const now = 1_800_000_000_000;
const chart = (goal: string) => ({ ...emptyChart(), goal });
const version = (id: number, at: number, why: Version['why'] = 'synced', chartId = 'chart_a', goal = `Goal ${id}`): Version => ({ id, chartId, at, why, data: chart(goal) });

describe('placeVersion', () => {
	it('keeps the first copy of a chart', () => {
		expect(placeVersion([version(1, now, 'synced', 'chart_b')], { chartId: 'chart_a', at: now, why: 'synced', data: chart('A') })).toBe('keep');
	});

	it('skips a copy the same as the last one, or gives the last one the more telling reason', () => {
		const last = version(1, now - 3_600_000);
		expect(placeVersion([last], { chartId: 'chart_a', at: now, why: 'synced', data: structuredClone(last.data) })).toBe('skip');
		expect(placeVersion([last], { chartId: 'chart_a', at: now, why: 'yours', data: structuredClone(last.data) })).toEqual({ relabel: 1 });
	});

	it('keeps one copy per quiet stretch of changes from another device', () => {
		const last = version(1, now - QUIET_MS / 2);
		expect(placeVersion([last], { chartId: 'chart_a', at: now, why: 'synced', data: chart('New') })).toBe('skip');
		expect(placeVersion([version(1, now - QUIET_MS - 1)], { chartId: 'chart_a', at: now, why: 'synced', data: chart('New') })).toBe('keep');
	});

	it('always keeps words that gave way, a chart deleted elsewhere, and a chart before going back', () => {
		const last = version(1, now - 1000);
		for (const why of ['theirs', 'yours', 'deleted', 'restored'] as const) {
			expect(placeVersion([last], { chartId: 'chart_a', at: now, why, data: chart('New') }), why).toBe('keep');
		}
	});
});

describe('overflow', () => {
	it('drops the oldest past the limit for each chart, and anything over 30 days', () => {
		const many = Array.from({ length: VERSIONS_PER_CHART + 2 }, (_, index) => version(index + 1, now - index * 1000));
		const old = version(100, now - 31 * 86_400_000, 'synced', 'chart_b');
		const kept = version(101, now, 'synced', 'chart_b');
		expect(overflow([...many, old, kept], now).sort((a, b) => a - b)).toEqual([VERSIONS_PER_CHART + 1, VERSIONS_PER_CHART + 2, 100]);
	});
});
