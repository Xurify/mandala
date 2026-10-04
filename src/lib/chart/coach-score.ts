import { parseDraftText } from './draft.ts';
import type { ChartData } from './model.ts';

export type CoachIssue =
	| { code: 'unparsed' }
	| { code: 'untickable'; text: string }
	| { code: 'uncontrolled'; text: string }
	| { code: 'restated'; pillar: string; action: string }
	| { code: 'repeated'; text: string };

export const UNTICKABLE =
	/\b(do better|ask more|more questions|work hard|be successful|stay positive|try harder|get better|be more|be better)\b/i;
export const UNCONTROLLED = /\b(\d[\d,.]*\s*(million|billion)\s+views|followers|go viral|get famous|get rich)\b/i;

export function norm(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const COPY_STOP = new Set([
	'a', 'an', 'the', 'after', 'before', 'every', 'my', 'and', 'or', 'to', 'of', 'on', 'for', 'with', 'in', 'at', 'by', 'from',
	'apply', 'use', 'wear', 'do', 'keep', 'get'
]);

function contentTokens(value: string): string[] {
	return norm(value)
		.split(' ')
		.filter((token) => token !== '' && !COPY_STOP.has(token))
		.map((token) => (token.length > 3 && token.endsWith('s') ? token.slice(0, -1) : token));
}

/** True when two cells are the same action with different filler words. */
export function nearCopy(left: string, right: string): boolean {
	const a = contentTokens(left);
	const b = contentTokens(right);
	if (a.length < 2 || a.length !== b.length) return false;
	const bag = new Map<string, number>();
	for (const token of a) bag.set(token, (bag.get(token) ?? 0) + 1);
	for (const token of b) {
		const count = bag.get(token) ?? 0;
		if (count === 0) return false;
		bag.set(token, count - 1);
	}
	return true;
}

export function restated(pillar: string, action: string): boolean {
	const base = norm(pillar);
	const cell = norm(action);
	if (!base || !cell) return false;
	if (cell === base) return true;
	const stripped = cell.replace(/^(do|practice|work on|keep doing|focus on)\s+/, '');
	return stripped !== cell && stripped === base;
}

function cells(chart: ChartData): string[] {
	return [...chart.pillars, ...chart.actions.flat()];
}

export function scoreChart(chart: ChartData): CoachIssue[] {
	const issues: CoachIssue[] = [];
	for (const text of cells(chart)) {
		if (UNTICKABLE.test(text)) issues.push({ code: 'untickable', text });
		if (UNCONTROLLED.test(text)) issues.push({ code: 'uncontrolled', text });
	}
	const seen: string[] = [];
	for (let index = 0; index < chart.pillars.length; index++) {
		const pillar = chart.pillars[index] ?? '';
		const actions = chart.actions[index] ?? [];
		for (const action of actions) {
			if (!action.trim()) continue;
			if (restated(pillar, action)) issues.push({ code: 'restated', pillar, action });
			if (seen.some((prior) => norm(prior) === norm(action) || nearCopy(prior, action))) {
				issues.push({ code: 'repeated', text: action });
			}
			seen.push(action);
		}
	}
	return issues;
}

export function scoreReply(raw: string): { parsed: boolean; issues: CoachIssue[] } {
	const chart = parseDraftText(raw);
	if (!chart) return { parsed: false, issues: [{ code: 'unparsed' }] };
	return { parsed: true, issues: scoreChart(chart) };
}

/** Filled action cells, checker misses, and whether a constraint word landed. */
export function chartReport(chart: ChartData, constraint = ''): {
	filled: number;
	faults: number;
	copies: number;
	constraint: boolean;
} {
	const issues = scoreChart(chart);
	const filled = chart.actions.flat().filter((action) => action.trim() !== '').length;
	const tokens = norm(constraint).split(' ').filter((token) => token.length >= 4);
	const blob = norm([chart.goal, ...chart.pillars, ...chart.actions.flat()].join(' '));
	return {
		filled,
		faults: issues.length,
		copies: issues.filter((issue) => issue.code === 'repeated').length,
		constraint: tokens.length === 0 || tokens.some((token) => blob.includes(token))
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
