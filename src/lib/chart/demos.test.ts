import { describe, expect, it } from 'vitest';
import { DEMOS, demoSetup, isDemoId } from './demos.ts';
import { parseDraftText } from './draft.ts';
import { fillEdits, greetingInsight, reviewChart, suggestToday, weekInReview } from './helper.ts';
import { nearKnown, nextTool } from './tools.ts';
import { FORGOTTEN_MINUTES, isForgotten, isOver, minutesByPillar, remainingMs } from './timer.ts';
import { completedBy, dateKeyOf, getByKey, idOfKey, keyOf, wholeness } from './model.ts';
import { boardOf, doneByWeek, type Card } from './board.ts';
import { monthOf } from './calendar.ts';
import { getPreset } from './presets/index.ts';
import { countCompletedBlocks, resumeStep, presetActionsToLend } from './start.ts';
import { linesToEdits } from './webmcp.ts';

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

	it('opens a borrowed start on the ring, with actions to lend', () => {
		const setup = demoSetup('borrowed', now);
		expect(setup.startSheet).toEqual({ borrowedPreset: 'fitness' });
		expect(resumeStep(setup.data!)).toEqual({ step: 'pillars', pillar: null });
		expect(presetActionsToLend(setup.data!, getPreset('fitness'), 2)).toHaveLength(8);
	});

	it('leaves blocks to keep building, and a pillar to name', () => {
		const data = demoSetup('building', now).data!;
		expect(countCompletedBlocks(data)).toBe(3);
		expect(data.pillars[6]).toBe('');
		expect(resumeStep(data)).toEqual({ step: 'overview', pillar: null });
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
		expect(nextTool(data, idOfKey(data, 'a1_0')!, now)).not.toBeNull();
		expect(nearKnown(data, now).map((entry) => entry.tool.id)).toEqual(['t-words']);
		expect(suggestToday(data, now).some((pick) => pick.tool)).toBe(true);
	});

	it("sets the board with work in every list, a routine in Doing, and today's picks and tick in step", () => {
		const data = demoSetup('board', now).data!;
		const board = boardOf(data, dateKeyOf(now));
		const cell = (card: Card) => keyOf(data, card.id);
		expect(board.doing.map(cell)).toEqual(['a0_0', 'a5_0', 'a2_1', 'a2_0', 'a4_0']);
		expect(board.doing[0]?.routine).toBe(true);
		expect(board.todo.map(cell)).toEqual(['a5_2', 'a3_1']);
		expect(board.done.slice(0, 2).map((card) => [cell(card), card.doneAt])).toEqual([
			['a0_1', dateKeyOf(now)],
			['a1_6', dateKeyOf(now)]
		]);
		expect(doneByWeek(board.done, now).earlier.length).toBeGreaterThan(0);
		expect(doneByWeek(board.done, now).week.length).toBeGreaterThan(0);
	});

	it('opens the calendar on three goals: two that moved this month and one with nothing yet', () => {
		const setup = demoSetup('calendar', now);
		const goals = [...setup.others!, setup.data!].map((data, index) => ({ id: `g${index}`, title: data.goal, data }));
		const month = monthOf(goals, now.getFullYear(), now.getMonth(), now);
		expect(month.moved).toEqual(['g0', 'g2']);
		expect(month.byGoal.map((row) => row.finished > 0)).toEqual([true, false, true]);
		expect(month.weeks.flat().some((day) => day.goals.length === 2)).toBe(true);
	});

	it('starts each timer where its card says, and gives the week a pillar that leads', () => {
		const clock = demoSetup('time-stopwatch', now).data!.timer!;
		expect(clock.length).toBeUndefined();
		const block = demoSetup('time-block', now).data!.timer!;
		expect(isOver(block, now.getTime())).toBe(false);
		expect(remainingMs(block, now.getTime())).toBe(40_000);
		expect(isForgotten(demoSetup('time-forgot', now).data!.timer!, now.getTime())).toBe(true);
		expect(FORGOTTEN_MINUTES).toBeLessThan(552);
		const minutes = minutesByPillar(demoSetup('time-week', now).data!, now);
		const total = minutes.reduce((sum, value) => sum + value, 0);
		expect(minutes[1]! / total).toBeGreaterThanOrEqual(0.5);
		expect(greetingInsight(demoSetup('time-week', now).data!, now)?.id).toBe('time');
	});

	it('hands Bindu a weak line rewritten and an empty pillar filled, as an agent would', () => {
		const setup = demoSetup('bindu-agent', now);
		const open = setup.open as { agent: { cell: string; text: string }[] };
		expect(reviewChart(setup.data!).map((finding) => finding.key)).toContain('a1_2');
		const { edits, refused } = linesToEdits(setup.data!, open.agent);
		expect(refused).toEqual([]);
		expect(edits).toHaveLength(10);
		expect(edits.filter((edit) => edit.before)).toEqual([{ key: 'a1_2', before: 'Run more', after: 'Add 5 minutes to one easy run each week' }]);
	});
});
