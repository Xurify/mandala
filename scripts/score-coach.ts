import { coachFixtures } from '../src/lib/chart/coach-fixtures.ts';
import { holdoutDataset } from '../src/lib/chart/coach-holdout.ts';
import { scoreReply, summarizeScores } from '../src/lib/chart/coach-score.ts';

const summary = summarizeScores(coachFixtures.map((fixture) => fixture.reply));
console.log(`Fixtures: ${summary.total}`);
console.log(`Parsed: ${summary.parsed}/${summary.total}`);
console.log(`Parsed with method issues: ${summary.withIssues}/${summary.parsed}`);
console.log(`Holdout dataset, unscored: ${holdoutDataset.length}`);

for (const fixture of coachFixtures) {
	const score = scoreReply(fixture.reply);
	const detail = score.parsed ? score.issues.map((issue) => issue.code).join(', ') || 'clean' : 'unparsed';
	console.log(`- ${fixture.name}: ${detail}`);
}
