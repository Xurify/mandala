import { describe, expect, it } from 'vitest';
import { coachFixtures } from './coach-fixtures.ts';
import { coachHoldout } from './coach-holdout.ts';
import { scoreChart, scoreReply, summarizeScores } from './coach-score.ts';
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

describe('scoreReply', () => {
	it('rejects a reply with no chart', () => {
		expect(scoreReply('no json here').parsed).toBe(false);
	});
});

describe('coach baseline', () => {
	it('scores the fixture replies and keeps the holdout off to the side', () => {
		const summary = summarizeScores(coachFixtures.map((fixture) => fixture.reply));
		expect(summary).toEqual({ total: 3, parsed: 2, withIssues: 1 });
		expect(coachHoldout).toHaveLength(50);
		const directions = new Set(coachHoldout.map((brief) => brief.direction));
		expect(directions.size).toBe(50);
	});
});
