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
	reflectionWeekOf,
	weekHadTicks,
	yearActivity,
	yearStats,
	completedBy,
	idAt,
	getByKey,
	keyOf,
	slotOf,
	wholeness,
	wordsOf,
	withNewIds,
	type ChartData
} from './model.ts';
import { isId } from './id.ts';
import { buildChart, getPreset } from './presets/index.ts';
import { A, slotted } from './fixtures.ts';

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
	it('returns null for junk, and for a chart from a newer version', () => {
		expect(parseChart('nope')).toBeNull();
		expect(parseChart('{}')).toBeNull();
		expect(parseChart(JSON.stringify({ ...emptyChart(), version: 99 }))).toBeNull();
		expect(parseChart(JSON.stringify(emptyChart()))?.version).toBe(1);
	});

	it('round-trips a valid chart', () => {
		const data = slotted(emptyChart());
		data.goal = 'Ship it';
		data.pillars[0] = 'Focus';
		data.actions[0]![0] = 'Write tests';
		const parsed = parseChart(JSON.stringify(data));
		expect(parsed).toEqual(data);
	});

	it('preserves metadata, days, and reflections across round-trips', () => {
		const data = slotted(emptyChart());
		data.goal = 'Learn Russian';
		data.meta = {
			[A.a0_0]: { kind: 'routine', pinned: true, note: 'https://readline.app' }
		};
		data.days = {
			'2026-09-30': { focus: [A.a0_0], checked: [A.a0_0] }
		};
		data.weeks = {
			'2026-09-28': { note: 'Great week' }
		};
		const parsed = parseChart(JSON.stringify(data));
		expect(parsed?.meta).toEqual(data.meta);
		expect(parsed?.days).toEqual(data.days);
		expect(parsed?.weeks).toEqual(data.weeks);
	});
});

describe('search and fill', () => {
	it('counts filled cells', () => {
		const data = slotted(emptyChart());
		expect(filledCount(data)).toBe(0);
		data.goal = 'Run';
		data.pillars[0] = 'Training';
		expect(filledCount(data)).toBe(2);
	});

	it('searches text', () => {
		const data = slotted(emptyChart());
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
		const data = slotted(emptyChart());
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
		const data = slotted(emptyChart());
		expect(exportFilename(data)).toBe('mandala-chart.json');

		data.goal = 'Run a half marathon in under 2 hours!';
		expect(exportFilename(data)).toBe('mandala-run-a-half-marathon-in-under-2-00.json');
	});
});

describe('progressMilestones', () => {
	it('calculates milestones for empty chart', () => {
		const data = slotted(emptyChart());
		const milestones = progressMilestones(data);
		expect(milestones.goalSet).toBe(false);
		expect(milestones.pillarsCount).toBe(0);
		expect(milestones.actionsCount).toBe(0);
		expect(milestones.completedPillarsCount).toBe(0);
		expect(milestones.pillarActionCounts).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
	});

	it('calculates milestones for partial and complete chart', () => {
		const data = slotted(emptyChart());
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
		const wednesday = new Date('2026-09-30T12:00:00Z');
		expect(weekStartKey(wednesday)).toBe('2026-09-28');

		const sunday = new Date('2026-10-04T12:00:00Z');
		expect(weekStartKey(sunday)).toBe('2026-09-28');
	});

	it('manages action metadata correctly', () => {
		const chartData = slotted(emptyChart());
		expect(getMeta(chartData, A.a0_0)).toBeUndefined();

		setMeta(chartData, A.a0_0, { kind: 'routine', pinned: true });
		expect(getMeta(chartData, A.a0_0)).toEqual({ kind: 'routine', pinned: true });

		setMeta(chartData, A.a0_0, { note: 'https://youtube.com' });
		expect(getMeta(chartData, A.a0_0)).toEqual({
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
		const chartData = slotted(emptyChart());
		expect(getDayLog(chartData, '2026-09-30')).toEqual({ focus: [], checked: [] });
		expect(getWeekReflection(chartData, '2026-09-28')).toEqual({ note: '' });
	});

	it('computes pillar activity over the last 7 days', () => {
		const chartData = slotted(emptyChart());
		const today = todayKey();
		chartData.days = {
			[today]: {
				focus: [A.a0_0, A.a2_1],
				checked: [A.a0_0]
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
		const chartData = slotted(emptyChart());
		chartData.days = {
			'2026-01-02': { focus: [A.a0_0], checked: [A.a0_0, A.a1_0] },
			'2025-12-31': { focus: [A.a2_0], checked: [] }
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
		const chartData = slotted(emptyChart());
		chartData.days = {
			'2026-03-01': { focus: [A.a0_0], checked: [A.a0_0] },
			'2026-03-02': { focus: [A.a0_0], checked: [] },
			'2026-03-04': { focus: [], checked: [A.a1_0] }
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

describe('completedBy', () => {
	function full(): ChartData {
		const data = slotted(emptyChart());
		data.goal = 'Run a half marathon';
		data.pillars = data.pillars.map((_, index) => `Pillar ${index + 1}`);
		data.actions = data.actions.map((row, pillarIndex) => row.map((_, index) => `Action ${pillarIndex}.${index}`));
		return data;
	}

	it('sees a pillar become whole only when it is named and has all eight actions', () => {
		const data = full();
		data.actions[2]![7] = '';
		const before = wholeness(data);
		expect(before.pillars[2]).toBe(false);
		expect(before.chart).toBe(false);
		data.actions[2]![7] = 'The last one';
		expect(completedBy(before, wholeness(data))).toEqual({ pillars: [2], chart: true });
	});

	it('does not count a pillar with every action but no name', () => {
		const data = full();
		data.pillars[4] = ' ';
		expect(wholeness(data).pillars[4]).toBe(false);
		const before = wholeness(data);
		data.pillars[4] = 'Sleep';
		expect(completedBy(before, wholeness(data))).toEqual({ pillars: [4], chart: true });
	});

	it('says nothing when a line is edited on a pillar that was already whole', () => {
		const data = full();
		const before = wholeness(data);
		data.actions[0]![0] = 'Something else';
		expect(completedBy(before, wholeness(data))).toEqual({ pillars: [], chart: false });
	});

	it('needs the goal for the chart to be whole', () => {
		const data = full();
		data.goal = '';
		expect(wholeness(data)).toMatchObject({ chart: false });
		expect(wholeness(data).pillars.every(Boolean)).toBe(true);
	});
});

describe('reflectionWeekOf', () => {
	// 2026-10-10 is a Saturday; the week starts Monday 2026-10-05.
	it('offers this week once its offer time has passed, and last week before that', () => {
		const sundayEvening = { day: 0, hour: 18 };
		expect(reflectionWeekOf(sundayEvening, new Date(2026, 9, 10, 12))).toBe('2026-09-28');
		expect(reflectionWeekOf(sundayEvening, new Date(2026, 9, 11, 17, 59))).toBe('2026-09-28');
		expect(reflectionWeekOf(sundayEvening, new Date(2026, 9, 11, 18))).toBe('2026-10-05');
		expect(reflectionWeekOf(sundayEvening, new Date(2026, 9, 12, 9))).toBe('2026-10-05');
		expect(reflectionWeekOf({ day: 5, hour: 17 }, new Date(2026, 9, 9, 17, 30))).toBe('2026-10-05');
		expect(reflectionWeekOf({ day: 5, hour: 17 }, new Date(2026, 9, 9, 16, 30))).toBe('2026-09-28');
	});

	it('knows whether a week had a tick', () => {
		const data = slotted(emptyChart());
		data.days = { '2026-10-07': { focus: [A.a0_0], checked: [A.a0_0] }, '2026-10-12': { focus: [A.a0_0], checked: [] } };
		expect(weekHadTicks(data, '2026-10-05')).toBe(true);
		expect(weekHadTicks(data, '2026-10-12')).toBe(false);
	});
});

describe('action ids', () => {
	it('gives every cell of a new chart its own id', () => {
		const ids = emptyChart().actionIds.flat();
		expect(ids).toHaveLength(64);
		expect(new Set(ids).size).toBe(64);
		expect(ids.every((id) => isId('action', id))).toBe(true);
	});

	it("gives ids to a chat app's reply, and replaces a missing or repeated one", () => {
		const reply = { goal: 'Run', pillars: Array(8).fill(''), actions: Array.from({ length: 8 }, () => Array(8).fill('')) };
		const parsed = parseChart(JSON.stringify(reply))!;
		expect(new Set(parsed.actionIds.flat()).size).toBe(64);
		const data = slotted(emptyChart());
		data.actionIds[0]![1] = A.a0_0;
		const repaired = parseChart(JSON.stringify(data))!;
		expect(repaired.actionIds[0]![0]).toBe(A.a0_0);
		expect(repaired.actionIds[0]![1]).not.toBe(A.a0_0);
	});

	it('keeps meta keyed by an action id, and nothing else', () => {
		const data = slotted(emptyChart());
		const parsed = parseChart(JSON.stringify({ ...data, meta: { [A.a0_0]: { kind: 'routine' }, a0_1: { kind: 'routine' } } }))!;
		expect(parsed.meta).toEqual({ [A.a0_0]: { kind: 'routine' } });
	});

	it('finds an action by its id, and reads and writes it as a cell would', () => {
		const data = slotted(emptyChart());
		data.actions[3]![5] = 'Stretch';
		expect(slotOf(data, A.a3_5)).toEqual({ pillarIndex: 3, slot: 5 });
		expect(keyOf(data, A.a3_5)).toBe('a3_5');
		expect(getByKey(data, A.a3_5)).toBe('Stretch');
		setByKey(data, A.a3_5, 'Stretch for ten minutes');
		expect(data.actions[3]![5]).toBe('Stretch for ten minutes');
		expect(idAt(data, 3, 5)).toBe(A.a3_5);
	});

	it('keeps the id while the words change, and gives a cleared line a new one', () => {
		const data = slotted(emptyChart());
		setByKey(data, 'a0_0', 'Run 3 km');
		setByKey(data, 'a0_0', 'Run 5 km');
		expect(idAt(data, 0, 0)).toBe(A.a0_0);
		setByKey(data, 'a0_0', '');
		setByKey(data, 'a0_0', 'Learn chords');
		expect(idAt(data, 0, 0)).not.toBe(A.a0_0);
		expect(data.cleared).toBeUndefined();
	});

	it('remembers a cleared line that was ticked, and brings it back when its words return', () => {
		const data = slotted(emptyChart());
		data.actions[2]![4] = 'Book a race';
		data.meta = { [A.a2_4]: { kind: 'milestone', done: true, doneAt: '2026-10-01' } };
		data.days = { '2026-10-01': { focus: [], checked: [A.a2_4] } };
		setByKey(data, 'a2_4', '');
		expect(data.cleared).toEqual({ [A.a2_4]: { text: 'Book a race', pillar: 2, slot: 4 } });
		expect(slotOf(data, A.a2_4)).toBeNull();
		expect(wordsOf(data, A.a2_4)).toBe('Book a race');
		expect(pillarActivityLast7(data)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);

		setByKey(data, 'a2_4', 'Book a race');
		expect(idAt(data, 2, 4)).toBe(A.a2_4);
		expect(data.cleared).toBeUndefined();
		expect(getMeta(data, A.a2_4)?.done).toBe(true);
	});

	it('does not bring a line back over one that has a life of its own', () => {
		const data = slotted(emptyChart());
		data.actions[1]![0] = 'Read a page';
		data.days = { '2026-10-01': { focus: [], checked: [A.a1_0] } };
		setByKey(data, 'a1_0', '');
		setByKey(data, 'a1_0', 'Write a page');
		const fresh = idAt(data, 1, 0);
		data.meta = { [fresh]: { kind: 'routine' } };
		setByKey(data, 'a1_0', 'Read a page');
		expect(idAt(data, 1, 0)).toBe(fresh);
	});

	it('gives a copy new ids, and moves everything that points at one', () => {
		const data = slotted(emptyChart());
		data.actions[0]![0] = 'Run';
		data.meta = { [A.a0_0]: { kind: 'routine' } };
		data.days = { '2026-10-01': { focus: [A.a0_0], checked: [A.a0_0], at: { [A.a0_0]: '07:00' }, shown: [`stuck:${A.a0_0}`] } };
		data.tools = { p0: [{ id: 'tool_1', url: 'https://example.com', title: 'Example', kind: 'repeat', action: A.a0_0 }] };
		data.cleared = { [`action_${'0'.repeat(24)}99`]: { text: 'Old', pillar: 0, slot: 1 } } as ChartData['cleared'];
		const copy = withNewIds(data);
		const id = idAt(copy, 0, 0);
		expect(id).not.toBe(A.a0_0);
		expect(new Set(copy.actionIds.flat()).size).toBe(64);
		expect(copy.actionIds.flat()).not.toContain(A.a1_1);
		expect(copy.meta).toEqual({ [id]: { kind: 'routine' } });
		expect(copy.days?.['2026-10-01']).toMatchObject({ focus: [id], checked: [id], at: { [id]: '07:00' }, shown: [`stuck:${id}`] });
		expect(copy.tools?.p0?.[0]?.action).toBe(id);
		expect(Object.keys(copy.cleared ?? {})).toHaveLength(1);
		expect(JSON.stringify(copy)).not.toContain(A.a0_0);
		expect(data.meta[A.a0_0]).toEqual({ kind: 'routine' });
	});
});
