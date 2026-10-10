import { localProvider } from './provider.ts';
import { leaked, save, secs } from './common.ts';
import * as coach from '../../src/lib/chart/coach.browser.ts';
import { holdoutDataset } from '../../src/lib/chart/coach-holdout.ts';
import { holdoutChartMetrics } from '../../src/lib/chart/coach-score.ts';

const [name, count = '12'] = process.argv.slice(2);
const local = await localProvider(name!);
coach.useProvider(local.provider);
const picks = holdoutDataset.filter((_, index) => index % 4 === 0).slice(0, Number(count));
const rows = [];
for (const setup of picks) {
	coach.resumeCoach();
	const callsBefore = local.calls.length;
	const started = performance.now();
	const result = await coach.proposeChart(setup);
	const chart = result.chart;
	const metrics = chart ? holdoutChartMetrics(chart, setup.constraint) : { filled: 0, faults: 1, copies: 0, constraint: false };
	const lines = chart ? [...chart.pillars, ...chart.actions.flat()].filter(Boolean) : [];
	const calls = local.calls.slice(callsBefore);
	const row = {
		direction: setup.direction,
		...metrics,
		pillars: chart ? chart.pillars.filter(Boolean).length : 0,
		leaked: lines.filter(leaked),
		calls: calls.length,
		overflow: calls.filter((call) => call.overflow).length,
		seconds: secs(performance.now() - started),
		chart
	};
	rows.push(row);
	console.log(`${name} ${row.direction}: ${row.filled}/64 pillars ${row.pillars} faults ${row.faults} leaked ${row.leaked.length} constraint ${row.constraint} calls ${row.calls} ${row.seconds}s`);
	save(`holdout-${name}.json`, rows);
}
await local.dispose();
