import { writeFileSync, mkdirSync } from 'node:fs';
import { exampleChart } from '../../src/lib/chart/example.ts';
import { dateKeyOffset, type ChartData } from '../../src/lib/chart/model.ts';
import { norm, nearCopy } from '../../src/lib/chart/helper.ts';

export const OUT = process.env.COACH_EVAL_OUT ?? new URL('../../local/coach-eval/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
export function save(file: string, data: unknown): void {
	writeFileSync(OUT + file, JSON.stringify(data, null, 1));
}

/** The worked example in the writer prompt, marked as someone else's. */
export const PROMPT_EXAMPLE = [
	'Listen to Spanish for 15 minutes',
	'Play Spanish audio for 15 minutes at breakfast',
	'Shadow a two-minute clip after lunch',
	'Watch one show on Friday',
	'Note three phrases from the clip'
];
export function leaked(line: string): boolean {
	return PROMPT_EXAMPLE.some((example) => norm(example) === norm(line) || nearCopy(example, line));
}

/** The lab's "Full, with a week" chart. */
export function sampleChart(): ChartData {
	const data = exampleChart();
	data.days = {
		[dateKeyOffset(-1)]: { focus: ['a0_0', 'a1_0', 'a2_0'], checked: ['a0_0', 'a1_0'], started: true },
		[dateKeyOffset(-2)]: { focus: ['a0_1', 'a3_0', 'a1_2'], checked: ['a3_0'], started: true }
	};
	data.meta = { a4_1: { kind: 'milestone', pinned: true } };
	return data;
}

export function secs(ms: number): number {
	return Math.round(ms / 100) / 10;
}
