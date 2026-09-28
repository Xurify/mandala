import { describe, expect, it } from 'vitest';
import { chartFromDraft, draftPrompt, parseDraftText } from './draft.ts';

const sample = {
	goal: 'Run a half marathon in under 2:00 by October',
	pillars: [
		'Training plan',
		'Speed',
		'Endurance',
		'Recovery',
		'Nutrition',
		'Gear',
		'Mindset',
		'Schedule'
	],
	actions: Array.from({ length: 8 }, (_, pillar) =>
		Array.from({ length: 8 }, (_, action) => `Do pillar ${pillar} step ${action}`)
	)
};

describe('chartFromDraft', () => {
	it('builds a full chart from a complete draft', () => {
		const chart = chartFromDraft(sample);
		expect(chart?.goal).toBe(sample.goal);
		expect(chart?.pillars).toHaveLength(8);
		expect(chart?.actions[3]).toHaveLength(8);
		expect(chart?.ink).toEqual({});
	});

	it('rejects a short action row', () => {
		const broken = {
			...sample,
			actions: sample.actions.map((row, index) => (index === 2 ? row.slice(0, 7) : row))
		};
		expect(chartFromDraft(broken)).toBeNull();
	});
});

describe('parseDraftText', () => {
	it('reads JSON wrapped in a fence', () => {
		const chart = parseDraftText('```json\n' + JSON.stringify(sample) + '\n```');
		expect(chart?.pillars[0]).toBe('Training plan');
	});
});

describe('draftPrompt', () => {
	it('leaves the blanks for the chat, and keeps each aim as its own pillar', () => {
		const prompt = draftPrompt();
		expect(prompt).toContain('- Direction:');
		expect(prompt).toContain('- Body:');
		expect(prompt).toContain('own pillar');
		expect(prompt).toContain('work hard');
		expect(prompt).toContain("[Don't]");
		expect(prompt).toContain('nice-to-have');
		expect(prompt).toContain('study 5 hours a week');
		expect(prompt).toContain('10 million views');
		expect(prompt).toContain('Ask more questions');
		expect(prompt).toContain('"pillars"');
		expect(prompt).not.toContain('not given');
	});
});
