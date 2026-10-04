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
	for (let index = 0; index < chart.pillars.length; index++) {
		const pillar = chart.pillars[index] ?? '';
		const actions = chart.actions[index] ?? [];
		const seen = new Set<string>();
		for (const action of actions) {
			if (restated(pillar, action)) issues.push({ code: 'restated', pillar, action });
			const key = norm(action);
			if (key && seen.has(key)) issues.push({ code: 'repeated', text: action });
			seen.add(key);
		}
	}
	return issues;
}

export function scoreReply(raw: string): { parsed: boolean; issues: CoachIssue[] } {
	const chart = parseDraftText(raw);
	if (!chart) return { parsed: false, issues: [{ code: 'unparsed' }] };
	return { parsed: true, issues: scoreChart(chart) };
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
