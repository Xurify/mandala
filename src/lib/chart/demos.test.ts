import { describe, expect, it } from 'vitest';
import { DEMOS, demoSetup, isDemoId } from './demos.ts';
import { parseDraftText } from './draft.ts';
import { fillEdits, greetingInsight, reviewChart, suggestToday, weekInReview } from './helper.ts';
import { nearKnown, nextTool } from './tools.ts';
import { completedBy, getByKey, wholeness } from './model.ts';

const now = new Date(2026, 9, 10, 12);

describe('demos', () => {
	it('sets up every demo on the list, and knows its ids', () => {
		for (const demo of DEMOS) {
			expect(isDemoId(demo.id)).toBe(true);
			expect(() => demoSetup(demo.id, now)).not.toThrow();
		}
		expect(isDemoId('nope')).toBe(false);
	});

	it('leaves one cell for the chart moment, with the cursor in it', () => {
		const setup = demoSetup('complete', now);
		const data = setup.data!;
		expect(getByKey(data, setup.focus!)).toBe('');
		const before = wholeness(data);
		expect(data.actions.flat().filter((action) => !action.trim())).toHaveLength(1);
		data.actions[7]![7] = 'Done';
		expect(completedBy(before, wholeness(data))).toEqual({ pillars: [7], chart: true });
	});

	it('finishes a pillar without finishing the chart', () => {
		const setup = demoSetup('pillar', now);
		const data = setup.data!;
		const before = wholeness(data);
		data.actions[2]![5] = 'Done';
		expect(completedBy(before, wholeness(data))).toEqual({ pillars: [2], chart: false });
	});

	it('gives the reflection a closed milestone and a quiet pillar', () => {
		const review = weekInReview(demoSetup('reflection', now).data!, now);
		expect(review.closed.length).toBeGreaterThan(0);
		expect(review.quiet.length).toBeGreaterThan(0);
		expect(review.ticks).toBeGreaterThan(5);
	});

	it('gives Bindu something to say, something to review, and gaps a reply fills', () => {
		expect(greetingInsight(demoSetup('bindu-week', now).data!, now)).not.toBeNull();
		expect(reviewChart(demoSetup('bindu-review', now).data!).length).toBeGreaterThanOrEqual(4);
		const fill = DEMOS.find((demo) => demo.id === 'bindu-fill')!;
		const edits = fillEdits(demoSetup('bindu-fill', now).data!, parseDraftText(fill.reply!())!);
		expect(edits.length).toBe(1 + 8 + 5);
		const fresh = DEMOS.find((demo) => demo.id === 'bindu-new')!;
		expect(parseDraftText(fresh.reply!())?.pillars).toHaveLength(8);
	});

	it('puts real links on shelves, one near known, and a routine to hand them out', () => {
		const data = demoSetup('tools', now).data!;
		expect(nextTool(data, 'a1_0', now)).not.toBeNull();
		expect(nearKnown(data, now).map((entry) => entry.tool.id)).toEqual(['t-words']);
		expect(suggestToday(data, now).some((pick) => pick.tool)).toBe(true);
	});
});
