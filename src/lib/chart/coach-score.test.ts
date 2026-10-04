import { describe, expect, it } from 'vitest';
import { coachFixtures } from './coach-fixtures.ts';
import { holdoutDataset } from './coach-holdout.ts';
import { holdoutChartMetrics, nearCopy, scoreChart, scoreReply, summarizeScores } from './coach-score.ts';
import { parseDraftText } from './draft.ts';

describe('scoreChart', () => {
	it('accepts a chart that can be ticked', () => {
		const chart = parseDraftText(coachFixtures[0]?.reply ?? '');
		expect(chart).not.toBeNull();
		expect(scoreChart(chart!)).toEqual([]);
	});

	it('names untickable, uncontrolled, restated, and repeated cells', () => {
		const chart = parseDraftText(coachFixtures[2]?.reply ?? '');
		expect(chart).not.toBeNull();
		const codes = scoreChart(chart!).map((issue) => issue.code);
		expect(codes).toContain('uncontrolled');
		expect(codes).toContain('untickable');
		expect(codes).toContain('restated');
		expect(codes).toContain('repeated');
	});
});

describe('nearCopy', () => {
	it('treats a brace and the same brace as one action', () => {
		expect(nearCopy('Knee brace', 'Apply a knee brace')).toBe(true);
		expect(nearCopy('Shoes by the door', 'On the calendar every Sunday')).toBe(false);
	});

	it('counts that copy on the chart report', () => {
		const chart = parseDraftText(coachFixtures[0]?.reply ?? '');
		expect(chart).not.toBeNull();
		chart!.actions[0]![0] = 'Knee brace';
		chart!.actions[1]![0] = 'Apply a knee brace';
		const report = holdoutChartMetrics(chart!, 'a bad knee');
		expect(report.copies).toBeGreaterThan(0);
		expect(report.constraint).toBe(true);
	});

	it('counts a constraint only when the word stands alone', () => {
		const chart = parseDraftText(coachFixtures[0]?.reply ?? '');
		expect(chart).not.toBeNull();
		expect(holdoutChartMetrics(chart!, 'No car').constraint).toBe(false);
		expect(holdoutChartMetrics(chart!, '').constraint).toBe(false);
		chart!.goal = 'A weekly workout';
		expect(holdoutChartMetrics(chart!, 'No weekend work').constraint).toBe(false);
	});
});

describe('scoreReply', () => {
	it('rejects a reply with no chart', () => {
		expect(scoreReply('no json here').parsed).toBe(false);
	});
});

describe('coach baseline', () => {
	it('scores the fixture replies and keeps the holdout off to the side', () => {
		const summary = summarizeScores(coachFixtures.map((fixture) => fixture.reply));
		expect(summary).toEqual({ total: 3, parsed: 2, withIssues: 1 });
		expect(holdoutDataset).toHaveLength(50);
		const directions = new Set(holdoutDataset.map((answers) => answers.direction));
		expect(directions.size).toBe(50);
	});
});
