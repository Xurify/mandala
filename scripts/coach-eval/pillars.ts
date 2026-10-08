import { localProvider } from './provider.ts';
import { save } from './common.ts';
import * as coach from '../../src/lib/chart/coach.browser.ts';
import { aimParts, chartAnswersFromText, lineFault, sameDriver } from '../../src/lib/chart/helper.ts';
import { exampleChart } from '../../src/lib/chart/example.ts';
import { holdoutDataset } from '../../src/lib/chart/coach-holdout.ts';
import { PILLAR_MAX } from '../../src/lib/chart/draft.ts';

// The pillar step alone: how many calls it takes, and what review would still flag.
const SLOVAK =
	'I want to learn Slovak. I am currently about a A1 maybe A2, but I have an insane lack of vocabulary and I am shit at reading as well as bad with having conversation';

const [name = 'qwen3-4b'] = process.argv.slice(2);
const local = await localProvider(name);
coach.useProvider(local.provider);
const parts = aimParts(SLOVAK, exampleChart())!;
const briefs = [
	chartAnswersFromText(parts.aim, 'An hour a day', parts.said),
	chartAnswersFromText(parts.aim, '', parts.said),
	...holdoutDataset.filter((_, index) => index % 3 === 0).slice(0, 8)
];
const rows = [];
for (const answers of briefs) {
	coach.resumeCoach();
	const before = local.calls.length;
	const result = await coach.proposePillars(answers);
	const pillars = result.chart?.pillars ?? [];
	const flagged = pillars.flatMap((pillar, index) => {
		const earlier = pillars.slice(0, index);
		const code = lineFault(pillar, { max: PILLAR_MAX, kind: 'pillar', siblings: earlier })?.code ?? (sameDriver(pillar, earlier) ? 'same driver' : null);
		return code ? [`${code}: ${pillar}`] : [];
	});
	const row = { direction: answers.direction, failed: !result.chart, calls: local.calls.length - before, flagged, pillars };
	rows.push(row);
	console.log(`${row.direction.slice(0, 26).padEnd(26)} calls ${row.calls} ${row.failed ? 'FAILED' : `flagged ${flagged.length}`} | ${pillars.join(' | ')}`);
}
const calls = rows.reduce((sum, row) => sum + row.calls, 0);
console.log(`${rows.length} briefs, ${rows.filter((row) => row.failed).length} failed, ${calls} calls, ${rows.flatMap((row) => row.flagged).length} flagged`);
save(`pillars-${name}.json`, rows);
await local.dispose();
