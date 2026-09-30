import { describe, expect, it } from 'vitest';
import {
	blockOfKey,
	cellKey,
	emptyChart,
	exportFilename,
	exportJson,
	exportText,
	filledCount,
	needsRead,
	parseChart,
	parseText,
	progressMilestones,
	searchHits,
	setByKey,
	unreadKeys
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
		data.ink.g = [[10, 20, 50]];
		data.rd.g = 'ink';
		const parsed = parseChart(JSON.stringify(data));
		expect(parsed).toEqual(data);
	});

	it('drops malformed ink entries', () => {
		const data = emptyChart();
		const raw = JSON.stringify({ ...data, ink: { g: 'bad', p0: [[1, 2, 3]] } });
		const parsed = parseChart(raw);
		expect(parsed?.ink.g).toBeUndefined();
		expect(parsed?.ink.p0).toEqual([[1, 2, 3]]);
	});
});

describe('search and fill', () => {
	it('counts filled cells including ink-only', () => {
		const data = emptyChart();
		expect(filledCount(data)).toBe(0);
		data.goal = 'Run';
		data.ink.p0 = [[1, 2, 3]];
		expect(filledCount(data)).toBe(2);
	});

	it('searches text, not unread ink', () => {
		const data = emptyChart();
		data.goal = 'Run a marathon';
		data.ink.p0 = [[1, 2, 3]];
		expect(searchHits(data, 'run')).toEqual(['g']);
		expect(needsRead(data, 'p0')).toBe(true);
		expect(unreadKeys(data)).toEqual(['p0']);
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

	it('marks unread ink', () => {
		const data = emptyChart();
		data.ink.g = [[1, 2, 3]];
		expect(exportText(data)).toContain('(handwriting, not read yet)');
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

	it('ignores unread and unnamed placeholders', () => {
		const text = `
Goal: (handwriting, not read yet)

Pillar 1: (unnamed)
- (handwriting, not read yet)

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
