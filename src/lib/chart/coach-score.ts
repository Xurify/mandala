import { parseDraftText } from './draft.ts';
import { norm, reviewChart, type HelperFinding } from './helper.ts';
import type { ChartData } from './model.ts';

export type CoachIssue = { code: 'unparsed' } | { code: HelperFinding['code']; text: string };

/** A chart's faults, by the same rules the review uses. One judge for the app, the lab, and the holdout. */
export function scoreChart(chart: ChartData): CoachIssue[] {
	return reviewChart(chart, Infinity).map((finding) => ({ code: finding.code, text: finding.text }));
}

export function scoreReply(raw: string): { parsed: boolean; issues: CoachIssue[] } {
	const chart = parseDraftText(raw);
	if (!chart) return { parsed: false, issues: [{ code: 'unparsed' }] };
	return { parsed: true, issues: scoreChart(chart) };
}

const CONSTRAINT_SKIP = new Set(['a', 'an', 'the', 'and', 'or', 'no', 'not']);

function constraintWords(constraint: string): string[] {
	return norm(constraint)
		.split(' ')
		.filter((token) => token.length >= 3 && !CONSTRAINT_SKIP.has(token));
}

/** Filled action cells, checker misses, and whether a constraint word landed as its own word. */
export function holdoutChartMetrics(chart: ChartData, constraint = ''): {
	filled: number;
	faults: number;
	copies: number;
	constraint: boolean;
} {
	const issues = scoreChart(chart);
	const filled = chart.actions.flat().filter((action) => action.trim() !== '').length;
	const wanted = constraintWords(constraint);
	const written = new Set(
		norm([chart.goal, ...chart.pillars, ...chart.actions.flat()].join(' '))
			.split(' ')
			.filter((token) => token !== '')
	);
	return {
		filled,
		faults: issues.length,
		copies: issues.filter((issue) => issue.code === 'repeated').length,
		constraint: wanted.length > 0 && wanted.some((token) => written.has(token))
	};
}

export function summarizeScores(raws: readonly string[]): {
	total: number;
	parsed: number;
	withIssues: number;
} {
	let parsed = 0;
	let withIssues = 0;
	for (const raw of raws) {
		const score = scoreReply(raw);
		if (!score.parsed) continue;
		parsed += 1;
		if (score.issues.length > 0) withIssues += 1;
	}
	return { total: raws.length, parsed, withIssues };
}
