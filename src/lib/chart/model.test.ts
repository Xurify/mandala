import { describe, expect, it } from 'vitest';
import {
	blockOfKey,
	cellKey,
	dateKeyOffset,
	emptyChart,
	exportFilename,
	exportJson,
	exportText,
	filledCount,
	getDayLog,
	getMeta,
	isOpenFocus,
	isRoutine,
	getWeekReflection,
	isUrl,
	parseChart,
	parseText,
	pillarActivityLast7,
	progressMilestones,
	searchHits,
	setByKey,
	setMeta,
	todayKey,
	weekStartKey,
	yearActivity,
	yearStats
} from './model.ts';
import { buildChart, getPreset } from './presets/index.ts';

describe('cellKey', () => {
	it('maps the 9x9 layout to goal, pillars, and actions', () => {
		expect(cellKey(4, 4)).toBe('g');
		expect(cellKey(4, 0)).toBe('p0');
		expect(cellKey(0, 4)).toBe('p0');
		expect(cellKey(4, 5)).toBe('p4');
		expect(cellKey(0, 0)).toBe('a0_0');
		expect(cellKey(0, 5)).toBe('a0_4');
		expect(cellKey(5, 1)).toBe('a4_1');
	});

	it('maps keys back to blocks', () => {
		expect(blockOfKey('g')).toBe(4);
		expect(blockOfKey('p0')).toBe(0);
		expect(blockOfKey('p4')).toBe(5);
		expect(blockOfKey('a4_1')).toBe(5);
	});
});

describe('parseChart', () => {
	it('returns null for junk', () => {
		expect(parseChart('nope')).toBeNull();
		expect(parseChart('{}')).toBeNull();
	});

	it('round-trips a valid chart', () => {
		const data = emptyChart();
		data.goal = 'Ship it';
		data.pillars[0] = 'Focus';
		data.actions[0]![0] = 'Write tests';
		const parsed = parseChart(JSON.stringify(data));
		expect(parsed).toEqual(data);
	});

	it('preserves metadata, days, and reflections across round-trips', () => {
		const data = emptyChart();
		data.goal = 'Learn Russian';
		data.meta = {
			a0_0: { kind: 'routine', pinned: true, note: 'https://readline.app' }
		};
		data.days = {
			'2026-09-30': { focus: ['a0_0'], checked: ['a0_0'] }
		};
		data.weeks = {
			'2026-09-28': { note: 'Great week', swapped: [] }
		};
		const parsed = parseChart(JSON.stringify(data));
		expect(parsed?.meta).toEqual(data.meta);
		expect(parsed?.days).toEqual(data.days);
		expect(parsed?.weeks).toEqual(data.weeks);
	});
});

describe('search and fill', () => {
	it('counts filled cells', () => {
		const data = emptyChart();
		expect(filledCount(data)).toBe(0);
		data.goal = 'Run';
		data.pillars[0] = 'Training';
		expect(filledCount(data)).toBe(2);
	});

	it('searches text', () => {
		const data = emptyChart();
		data.goal = 'Run a marathon';
		expect(searchHits(data, 'run')).toEqual(['g']);
	});
});

describe('exportText', () => {
	it('exports the example as indented text', () => {
		const text = exportText(buildChart(getPreset('fitness')!));
		expect(text).toContain('Goal: Run a half marathon');
		expect(text).toContain('Pillar 1: Training plan');
		expect(text).toContain('  - Print a 16-week plan');
		expect(text.match(/^\s+- /gm)?.length).toBe(64);
	});
});

describe('parseText', () => {
	it('returns null for empty or non-chart text', () => {
		expect(parseText('')).toBeNull();
		expect(parseText('   \n  ')).toBeNull();
		expect(parseText('just some random prose with no chart structure')).toBeNull();
	});

	it('round-trips an exported chart text perfectly', () => {
		const originalData = buildChart(getPreset('fitness')!);
		const exported = exportText(originalData);
		const parsed = parseText(exported);
		expect(parsed).not.toBeNull();
		expect(parsed?.goal).toBe(originalData.goal);
		expect(parsed?.pillars).toEqual(originalData.pillars);
		expect(parsed?.actions).toEqual(originalData.actions);
	});

	it('parses markdown headings format', () => {
		const markdown = `
# Launch side project

## Pillar 1: Validation
- Talk to 10 users
- Create sign-up page

## Pillar 2: Prototype
- Write MVP
`;
		const parsed = parseText(markdown);
		expect(parsed).not.toBeNull();
		expect(parsed?.goal).toBe('Launch side project');
		expect(parsed?.pillars[0]).toBe('Validation');
		expect(parsed?.actions[0]?.[0]).toBe('Talk to 10 users');
		expect(parsed?.actions[0]?.[1]).toBe('Create sign-up page');
		expect(parsed?.pillars[1]).toBe('Prototype');
		expect(parsed?.actions[1]?.[0]).toBe('Write MVP');
	});

	it('handles sparse charts and custom pillar indices', () => {
		const text = `
Goal: Master chess

Pillar 1: Tactics
- Puzzle rush daily

Pillar 8: Mindset
- Review lost games
`;
		const parsed = parseText(text);
		expect(parsed).not.toBeNull();
		expect(parsed?.goal).toBe('Master chess');
		expect(parsed?.pillars[0]).toBe('Tactics');
		expect(parsed?.actions[0]?.[0]).toBe('Puzzle rush daily');
		expect(parsed?.pillars[7]).toBe('Mindset');
		expect(parsed?.actions[7]?.[0]).toBe('Review lost games');
		expect(parsed?.pillars[1]).toBe('');
	});

	it('parses JSON data when pasted as text', () => {
		const originalData = buildChart(getPreset('language')!);
		const jsonString = exportJson(originalData);
		const parsed = parseText(jsonString);
		expect(parsed).not.toBeNull();
		expect(parsed?.goal).toBe(originalData.goal);
		expect(parsed?.pillars).toEqual(originalData.pillars);
	});

	it('ignores empty and unnamed placeholders', () => {
		const text = `
Goal: (not set)

Pillar 1: (unnamed)
- (empty)

Pillar 2: Real pillar
- Real action
`;
		const parsed = parseText(text);
		expect(parsed).not.toBeNull();
		expect(parsed?.goal).toBe('');
		expect(parsed?.pillars[0]).toBe('');
		expect(parsed?.actions[0]?.[0]).toBe('');
		expect(parsed?.pillars[1]).toBe('Real pillar');
		expect(parsed?.actions[1]?.[0]).toBe('Real action');
	});
});

describe('setByKey', () => {
	it('caps text at 120 characters', () => {
		const data = emptyChart();
		setByKey(data, 'g', 'x'.repeat(200));
		expect(data.goal.length).toBe(120);
	});
});

describe('exportJson and exportFilename', () => {
	it('exports valid JSON that round-trips with parseChart', () => {
		const data = buildChart(getPreset('fitness')!);
		const json = exportJson(data);
		const roundTripped = parseChart(json);
		expect(roundTripped).toEqual(data);
	});

	it('generates a clean slugified filename based on the goal', () => {
		const data = emptyChart();
		expect(exportFilename(data)).toBe('mandala-chart.json');

		data.goal = 'Run a half marathon in under 2:00!';
		expect(exportFilename(data)).toBe('mandala-run-a-half-marathon-in-under-2-00.json');
	});
});

describe('progressMilestones', () => {
	it('calculates milestones for empty chart', () => {
		const data = emptyChart();
		const milestones = progressMilestones(data);
		expect(milestones.goalSet).toBe(false);
		expect(milestones.pillarsCount).toBe(0);
		expect(milestones.actionsCount).toBe(0);
		expect(milestones.completedPillarsCount).toBe(0);
		expect(milestones.pillarActionCounts).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
	});

	it('calculates milestones for partial and complete chart', () => {
		const data = emptyChart();
		data.goal = 'Reach peak performance';
		data.pillars[0] = 'Nutrition';
		data.actions[0] = [
			'Meal prep',
			'Hydrate',
			'Protein daily',
			'Track calories',
			'Electrolytes',
			'Vitamins',
			'Limit sugar',
			'Sleep routine'
		];
		data.pillars[1] = 'Training';
		data.actions[1]![0] = 'Sprint sessions';

		const milestones = progressMilestones(data);
		expect(milestones.goalSet).toBe(true);
		expect(milestones.pillarsCount).toBe(2);
		expect(milestones.actionsCount).toBe(9);
		expect(milestones.completedPillarsCount).toBe(1);
		expect(milestones.pillarActionCounts[0]).toBe(8);
		expect(milestones.pillarActionCounts[1]).toBe(1);
	});
});

describe('companion helpers', () => {
	it('formats todayKey as YYYY-MM-DD', () => {
		const key = todayKey();
		expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it('computes weekStartKey as Monday', () => {
		// A known Wednesday: 2026-09-30
		const wednesday = new Date('2026-09-30T12:00:00Z');
		expect(weekStartKey(wednesday)).toBe('2026-09-28');

		// A known Sunday: 2026-10-04
		const sunday = new Date('2026-10-04T12:00:00Z');
		expect(weekStartKey(sunday)).toBe('2026-09-28');
	});

	it('manages action metadata correctly', () => {
		const chartData = emptyChart();
		expect(getMeta(chartData, 'a0_0')).toBeUndefined();

		setMeta(chartData, 'a0_0', { kind: 'routine', pinned: true });
		expect(getMeta(chartData, 'a0_0')).toEqual({ kind: 'routine', pinned: true });

		setMeta(chartData, 'a0_0', { note: 'https://youtube.com' });
		expect(getMeta(chartData, 'a0_0')).toEqual({
			kind: 'routine',
			pinned: true,
			note: 'https://youtube.com'
		});
	});

	it('keeps routines off the one-time list and drops finished milestones', () => {
		expect(isRoutine(undefined)).toBe(false);
		expect(isRoutine({ kind: 'routine' })).toBe(true);
		expect(isOpenFocus(undefined)).toBe(true);
		expect(isOpenFocus({ kind: 'milestone' })).toBe(true);
		expect(isOpenFocus({ kind: 'milestone', done: true })).toBe(false);
		expect(isOpenFocus({ kind: 'routine', pinned: true })).toBe(false);
	});

	it('retrieves default day logs and week reflections safely', () => {
		const chartData = emptyChart();
		expect(getDayLog(chartData, '2026-09-30')).toEqual({ focus: [], checked: [] });
		expect(getWeekReflection(chartData, '2026-09-28')).toEqual({ note: '', swapped: [] });
	});

	it('computes pillar activity over the last 7 days', () => {
		const chartData = emptyChart();
		const today = todayKey();
		chartData.days = {
			[today]: {
				focus: ['a0_0', 'a2_1'],
				checked: ['a0_0']
			}
		};
		const activity = pillarActivityLast7(chartData);
		expect(activity[0]).toBe(1);
		expect(activity[2]).toBe(1);
		expect(activity[1]).toBe(0);
	});

	it('offsets date keys by whole days', () => {
		expect(dateKeyOffset(1, new Date(2026, 8, 30))).toBe('2026-10-01');
		expect(dateKeyOffset(-1, new Date(2026, 0, 1))).toBe('2025-12-31');
		expect(dateKeyOffset(0, new Date(2026, 9, 1))).toBe('2026-10-01');
	});

	it('identifies web URLs correctly', () => {
		expect(isUrl('https://youtube.com/watch?v=123')).toBe(true);
		expect(isUrl('http://readline.app')).toBe(true);
		expect(isUrl('chapter 3 to 5')).toBe(false);
		expect(isUrl('')).toBe(false);
	});

	it('summarizes year activity per day', () => {
		const chartData = emptyChart();
		chartData.days = {
			'2026-01-02': { focus: ['a0_0'], checked: ['a0_0', 'a1_0'] },
			'2025-12-31': { focus: ['a2_0'], checked: [] }
		};
		const activity = yearActivity(chartData, 2026);
		expect(activity.size).toBe(1);
		expect(activity.get('2026-01-02')).toEqual({ focusCount: 1, checkedCount: 2 });
		expect(yearActivity(chartData, 2025).get('2025-12-31')).toEqual({
			focusCount: 1,
			checkedCount: 0
		});
	});

	it('computes year stats including best streak', () => {
		const chartData = emptyChart();
		chartData.days = {
			'2026-03-01': { focus: ['a0_0'], checked: ['a0_0'] },
			'2026-03-02': { focus: ['a0_0'], checked: [] },
			'2026-03-04': { focus: [], checked: ['a1_0'] }
		};
		const stats = yearStats(chartData, 2026);
		expect(stats.daysWithFocus).toBe(2);
		expect(stats.checkedActions).toBe(2);
		expect(stats.bestStreak).toBe(2);
	});

	it('handles empty years', () => {
		const stats = yearStats(emptyChart(), 2026);
		expect(stats).toEqual({ daysWithFocus: 0, checkedActions: 0, bestStreak: 0 });
	});
});
