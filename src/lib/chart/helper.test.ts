import { describe, expect, it } from 'vitest';
import { emptyChartAnswers } from './draft.ts';
import {
	aimOf,
	askMessages,
	chartAnswersFromText,
	chipsFor,
	truncateAtWordBoundary,
	describeCoachProgress,
	chartAnswerFacts,
	extraChips,
	fillActionsMessages,
	fillPlan,
	goalAndPillars,
	helpChips,
	intentOf,
	isCancellation,
	isCardRejection,
	isHelpRequest,
	isPillarActionRequest,
	keptLines,
	lineFault,
	offerChips,
	oneLine,
	pillarMentioned,
	pillarsMessages,
	replyLines,
	rewriteMessages,
	reviewChart,
	suggestToday,
	suggestWeek
} from './helper.ts';
import { dateKeyOf, emptyChart, type ChartData } from './model.ts';

function sample(): ChartData {
	const data = emptyChart();
	data.goal = 'Finish a half marathon this October';
	data.pillars = ['Easy runs', 'Speed', 'Long run', 'Strength', 'Sleep', 'Food', 'Shoes', 'Calendar'];
	data.actions = data.pillars.map((pillar) =>
		Array.from({ length: 8 }, (_, index) => `${pillar} step ${index + 1}`)
	);
	return data;
}

describe('chartAnswersFromText', () => {
	it('keeps the direction and skips a bare go', () => {
		const answers = chartAnswersFromText('  Run a half marathon ', 'go');
		expect(answers.direction).toBe('Run a half marathon');
		expect(answers.situation).toBe('');
	});

	it('pulls a timeline out of the extra answer', () => {
		const answers = chartAnswersFromText('Run', 'By October 2026, I run twice a week now');
		expect(answers.timeline).toBe('October 2026');
		expect(answers.situation).toContain('twice a week');
	});

	it('does not read "in a job" as a timeline', () => {
		expect(chartAnswersFromText('Write', 'I am stuck in a job I dislike').timeline).toBe('');
	});
});

describe('intentOf', () => {
	it('routes plain requests', () => {
		expect(intentOf("Pick today's three")).toBe('today');
		expect(intentOf('Plan this week')).toBe('week');
		expect(intentOf('Review my chart')).toBe('review');
		expect(intentOf('Fill the blanks')).toBe('fill');
		expect(intentOf('Start a new chart')).toBe('draft');
		expect(intentOf('Why does a pillar need eight actions?')).toBe('ask');
	});

	it('spots a pasted chart', () => {
		const data = sample();
		expect(intentOf(JSON.stringify({ goal: data.goal, pillars: data.pillars, actions: data.actions }))).toBe('chart');
	});

	it('does not hijack conversational questions containing keywords', () => {
		expect(intentOf('Why did you pick this for today?')).toBe('ask');
		expect(intentOf('How do I review a chart?')).toBe('ask');
		expect(intentOf('What if a pillar is weak?')).toBe('ask');
		expect(intentOf('How should I plan my week?')).toBe('ask');
		expect(intentOf('I was sick last week')).toBe('ask');
	});

	it('routes cancellation commands to cancel', () => {
		expect(intentOf('cancel')).toBe('cancel');
		expect(intentOf('stop')).toBe('cancel');
		expect(intentOf('nevermind')).toBe('cancel');
		expect(intentOf('never mind')).toBe('cancel');
		expect(intentOf('abort')).toBe('cancel');
		expect(intentOf('How do I cancel?')).toBe('ask');
		expect(intentOf('Why did you stop?')).toBe('ask');
	});
});

describe('isCancellation and isCardRejection', () => {
	it('identifies cancellation phrases', () => {
		expect(isCancellation('cancel')).toBe(true);
		expect(isCancellation('cancel this')).toBe(true);
		expect(isCancellation('stop')).toBe(true);
		expect(isCancellation('nevermind')).toBe(true);
		expect(isCancellation('never mind')).toBe(true);
		expect(isCancellation('abort')).toBe(true);
		expect(isCancellation('forget it')).toBe(true);
		expect(isCancellation('no thanks')).toBe(true);
		expect(isCancellation('cancelling my plan next week')).toBe(false);
	});

	it('identifies card rejection phrases', () => {
		expect(isCardRejection('skip')).toBe(true);
		expect(isCardRejection('no')).toBe(true);
		expect(isCardRejection('nope')).toBe(true);
		expect(isCardRejection('not now')).toBe(true);
		expect(isCardRejection('not this one')).toBe(true);
		expect(isCardRejection('leave it')).toBe(true);
		expect(isCardRejection('leave them')).toBe(true);
		expect(isCardRejection('discard')).toBe(true);
		expect(isCardRejection('cancel')).toBe(true);
	});
});

describe('fillPlan', () => {
	it('names pillars before actions', () => {
		const data = sample();
		data.pillars[2] = '';
		expect(fillPlan(data)).toEqual({ kind: 'pillars', empty: [2] });
	});

	it('prefers the selected pillar', () => {
		const data = sample();
		data.actions[1]![3] = '';
		data.actions[5]![0] = '';
		expect(fillPlan(data, 5)).toEqual({ kind: 'actions', pillarIndex: 5, empty: [0] });
		expect(fillPlan(data)).toEqual({ kind: 'actions', pillarIndex: 1, empty: [3] });
	});

	it('needs a goal and has nothing to do on a full chart', () => {
		expect(fillPlan(emptyChart())).toBeNull();
		expect(fillPlan(sample())).toBeNull();
	});
});

describe('replyLines and oneLine', () => {
	it('reads numbered lines and drops repeats', () => {
		expect(replyLines('1. Run 5k\n2. run 5k\n3. Stretch\n4. Sleep at ten', 3, 48)).toEqual(['Run 5k', 'Stretch', 'Sleep at ten']);
		expect(replyLines('1. Only one', 2, 48)).toBeNull();
	});

	it('takes the first clean line and refuses one that is too long', () => {
		expect(oneLine('Rewrite: "Ask one question in each class."', 48)).toBe('Ask one question in each class');
		expect(oneLine('Track expenses using an app to stay aware of every purchase this month', 48)).toBeNull();
	});

	it('drops a long line instead of cutting it', () => {
		expect(replyLines('1. Track expenses using an app to stay aware of spending\n2. Note each coffee', 1, 48)).toEqual(['Note each coffee']);
	});
});

describe('facts, faults, and the prompts', () => {
	it('keeps the person on later calls and skips empty fields', () => {
		const answers = chartAnswersFromText('Run a half', 'By October 2026, bad knee, I run twice a week');
		const facts = chartAnswerFacts(answers);
		expect(facts).toContain('October 2026');
		expect(facts).toContain('bad knee');
		expect(facts).not.toContain('Focus');
	});

	it('rejects a long line, a result, and an echo of the pillar', () => {
		expect(lineFault('Track expenses using an app to stay aware of spending', { max: 48, kind: 'action' })?.code).toBe('long');
		expect(lineFault('Get 1 million views', { max: 48, kind: 'action' })?.code).toBe('uncontrolled');
		expect(lineFault('Easy runs', { max: 48, kind: 'action', pillar: 'Easy runs' })?.code).toBe('restated');
		expect(lineFault('Shoes by the door', { max: 48, kind: 'action', pillar: 'Easy runs' })).toBeNull();
	});

	it('keeps the good lines and names the bad ones', () => {
		const round = keptLines('1. Shoes by the door\n2. Work hard\n3. Easy runs\n4. Shoes by the door', 4, { max: 48, kind: 'action', pillar: 'Easy runs' });
		expect(round.kept).toEqual(['Shoes by the door']);
		expect(round.rejected.map((item) => item.reason)).toEqual([
			'This cannot be marked done. Write the session, not the wish.',
			'This repeats the pillar. Write what makes it happen.',
			'Same afternoon as another action on the chart.'
		]);
	});

	it('puts the person and a worked example into the action prompt', () => {
		const data = sample();
		const messages = fillActionsMessages(data, 0, 3, 'About this person:\n- Constraint: A bad knee');
		const joined = messages.map((message) => message.content).join('\n');
		expect(joined).toContain('A bad knee');
		expect(joined).toContain('Play Spanish audio for 15 minutes at breakfast');
		expect(joined).not.toContain('at most');
	});

	it('asks for a behaviour and does not hand the failure back', () => {
		const data = sample();
		const messages = rewriteMessages(data, { key: 'a0_0', text: 'Work hard', reason: 'This cannot be marked done. Write the session, not the wish.', code: 'untickable' });
		const joined = messages.map((message) => message.content).join('\n');
		expect(joined).toContain('Block 25 minutes after lunch');
		expect(joined).not.toContain('Hard to tick');
		expect(joined).not.toContain('Problem:');
	});

	it('refuses a goal that does not fit the cell', () => {
		const pillars = ['Easy runs', 'Speed', 'Long run', 'Strength', 'Sleep', 'Food', 'Shoes', 'Calendar'];
		expect(goalAndPillars(JSON.stringify({ goal: 'x'.repeat(81), pillars }))).toBeNull();
	});
});

describe('truncateAtWordBoundary and goalAndPillars', () => {
	it('never cuts mid-word', () => {
		expect(truncateAtWordBoundary('Track expenses using an app to stay aware of spending', 48)).toBe('Track expenses using an app to stay aware of');
		expect(truncateAtWordBoundary('Short one.', 48)).toBe('Short one');
	});

	it('reads the head of a draft and needs eight distinct pillars', () => {
		const pillars = ['Easy runs', 'Speed', 'Long run', 'Strength', 'Sleep', 'Food', 'Shoes', 'Calendar'];
		expect(goalAndPillars(JSON.stringify({ goal: 'Finish a half', pillars }))).toEqual({ goal: 'Finish a half', pillars });
		expect(goalAndPillars(JSON.stringify({ goal: 'Finish a half', pillars: [...pillars.slice(0, 7), 'speed'] }))).toBeNull();
		expect(goalAndPillars('no json here')).toBeNull();
	});
});

describe('reviewChart', () => {
	it('flags cells that fail the tests', () => {
		const data = sample();
		data.actions[0]![0] = 'Work hard';
		data.actions[0]![1] = 'Easy runs';
		data.actions[0]![2] = 'Get 1 million views';
		data.actions[0]![3] = 'Hydrate';
		data.actions[0]![4] = 'Easy runs step 6';
		const codes = reviewChart(data, 10).map((finding) => [finding.key, finding.code]);
		expect(codes).toEqual([
			['a0_0', 'untickable'],
			['a0_1', 'restated'],
			['a0_2', 'uncontrolled'],
			['a0_3', 'vague'],
			['a0_5', 'repeated']
		]);
	});

	it('is quiet on a clean chart', () => {
		expect(reviewChart(sample())).toEqual([]);
	});

	it('flags a near copy on another pillar and keeps distinct actions', () => {
		const copied = sample();
		copied.actions[0]![0] = 'Knee brace';
		copied.actions[1]![0] = 'Apply a knee brace';
		expect(reviewChart(copied, 10).some((finding) => finding.key === 'a1_0' && finding.code === 'repeated')).toBe(true);

		const distinct = sample();
		distinct.actions[0]![0] = 'Shoes by the door';
		distinct.actions[0]![1] = 'On the calendar every Sunday';
		expect(reviewChart(distinct).some((finding) => finding.code === 'repeated')).toBe(false);
	});
});

describe('suggestWeek and suggestToday', () => {
	it('spreads the week across pillars, quietest first', () => {
		const data = sample();
		const today = dateKeyOf(new Date());
		data.days = { [today]: { focus: ['a0_0'], checked: ['a0_0'] } };
		const picks = suggestWeek(data, 6);
		expect(picks).toHaveLength(6);
		expect(new Set(picks.map((pick) => pick.pillarIndex)).size).toBe(6);
		expect(picks.some((pick) => pick.pillarIndex === 0)).toBe(false);
	});

	it('skips routines and finished milestones', () => {
		const data = sample();
		data.meta = { a1_0: { kind: 'routine' }, a2_0: { kind: 'milestone', done: true } };
		const keys = suggestWeek(data, 8).map((pick) => pick.key);
		expect(keys).not.toContain('a1_0');
		expect(keys).not.toContain('a2_0');
	});

	it('puts pinned actions first today and avoids what is already checked', () => {
		const data = sample();
		const now = new Date();
		data.meta = { a4_2: { kind: 'milestone', pinned: true } };
		data.days = { [dateKeyOf(now)]: { focus: [], checked: ['a0_0'] } };
		const picks = suggestToday(data, now);
		expect(picks).toHaveLength(3);
		expect(picks[0]?.key).toBe('a4_2');
		expect(picks[0]?.why).toBe('Pinned for this week.');
		expect(picks.map((pick) => pick.key)).not.toContain('a0_0');
		expect(new Set(picks.map((pick) => pick.pillarIndex)).size).toBe(3);
	});
});

describe('describeCoachProgress', () => {
	it('turns a fetch report into a fill', () => {
		expect(
			describeCoachProgress('Fetching param cache[2/8]: 359MB fetched. 36% completed, 12 secs elapsed. It can take a while when we first visit this page to populate the cache. Later refreshes will become faster.', 0.364)
		).toEqual({ label: 'Downloading.', downloadFillRatio: 0.364, detail: '359 MB' });
	});

	it('reads the percent from the text when no ratio arrives', () => {
		expect(describeCoachProgress('Loading model from cache[1/8]: 120MB loaded. 15% completed, 2 secs elapsed.')).toEqual({
			label: 'Loading',
			downloadFillRatio: 0.15,
			detail: '120 MB'
		});
	});

	it('ignores a progress report that is not text', () => {
		expect(describeCoachProgress({ text: 'Loading.' } as unknown as string).label).toBe('');
	});

	it('keeps ordinary status lines as they are', () => {
		expect(describeCoachProgress('Thinking.')).toEqual({ label: 'Thinking.', downloadFillRatio: null, detail: '' });
		expect(describeCoachProgress('Start to fetch params', 0)).toEqual({ label: 'Starting the download.', downloadFillRatio: 0, detail: '' });
		expect(describeCoachProgress('Loading GPU shader modules[3/40]: 7% completed, 4 secs elapsed.', 0.075)).toEqual({
			label: 'Getting ready.',
			downloadFillRatio: 0.075,
			detail: ''
		});
	});
});

function chipJob(chip: { act: { kind: string; job?: string } }): string {
	return chip.act.kind === 'job' ? (chip.act.job ?? '') : chip.act.kind;
}

describe('chipsFor', () => {
	it('offers a start on an empty chart and the whole set on a full one', () => {
		expect(chipsFor(emptyChart()).map(chipJob)).toEqual(['draft']);
		expect(chipsFor(sample()).map(chipJob)).toEqual(['review', 'week', 'today', 'draft']);
	});
});

describe('aimOf', () => {
	it('takes a new direction out of a hesitant line', () => {
		expect(aimOf('I want to learn Slovak, but I am not sure how', sample())).toBe('learn Slovak');
	});

	it('recognizes various phrasing for new directions', () => {
		expect(aimOf("I'm thinking of learning Slovak", sample())).toBe('learning Slovak');
		expect(aimOf('Thinking about learning Slovak', sample())).toBe('learning Slovak');
		expect(aimOf("Let's go with Slovak", sample())).toBe('Slovak');
		expect(aimOf('My goal is to learn Slovak', sample())).toBe('learn Slovak');
	});

	it('leaves comparison and indecision for conversational exploration', () => {
		expect(aimOf("I am thinking of learning Slovak and/or Russian, but I'm not sure which goal to pick", sample())).toBeNull();
		expect(aimOf('Should I learn Slovak or Russian?', sample())).toBeNull();
		expect(aimOf('Not sure whether to pick Slovak or Russian', sample())).toBeNull();
	});

	it('leaves a question about the chart, and a bare ask for help', () => {
		expect(aimOf('Why does a pillar need eight actions?', sample())).toBeNull();
		expect(isHelpRequest('Can you help me?')).toBe(true);
		expect(aimOf('Can you help me?', sample())).toBeNull();
	});

	it('does not repeat the current goal', () => {
		expect(aimOf('I want to finish a half marathon this October', sample())).toBeNull();
	});
});

describe('isPillarActionRequest', () => {
	it('identifies explicit action requests vs conversational questions', () => {
		expect(isPillarActionRequest('Fill Sleep')).toBe(true);
		expect(isPillarActionRequest('Suggest actions for Easy runs')).toBe(true);
		expect(isPillarActionRequest('Work on Strength')).toBe(true);
		expect(isPillarActionRequest('How do I practice the long run?')).toBe(false);
		expect(isPillarActionRequest('How much sleep do you recommend?')).toBe(false);
	});
});

describe('pillarMentioned', () => {
	it('finds a pillar named in the question', () => {
		expect(pillarMentioned('How do I practice the long run?', sample())).toBe(2);
	});
});

describe('turn chips', () => {
	it('offers sketch or stay, help on a full chart, and go after a sketch', () => {
		expect(offerChips().map((chip) => chip.label)).toEqual(['Sketch the new one', 'Stay on this chart']);
		expect(helpChips().map(chipJob)).toEqual(['today', 'review']);
		expect(extraChips(true).map((chip) => chip.label)).toEqual(['Write the actions', 'Rename the pillars']);
		expect(extraChips(false).map((chip) => chip.label)).toEqual(['Write the actions']);
	});
});

describe('cell prompts', () => {
	it('asks for a sentence, not a word count', () => {
		const pillars = pillarsMessages(emptyChartAnswers())
			.map((message) => message.content)
			.join('\n')
			.toLowerCase();
		const actions = fillActionsMessages(sample(), 0, 2)
			.map((message) => message.content)
			.join('\n')
			.toLowerCase();
		expect(pillars).not.toContain('two to four');
		expect(pillars).not.toContain('three to seven');
		expect(pillars).toContain('verb');
		expect(actions).not.toContain('three to seven');
		expect(actions).toContain('listen to spanish for 15 minutes');
		expect(askMessages(sample(), 'hello').map((message) => message.content).join('\n').toLowerCase()).not.toContain('fill the blanks');
	});

	it('includes reference context and multi-turn history in askMessages', () => {
		const history = [
			{ role: 'user' as const, content: 'What is Slovak?' },
			{ role: 'assistant' as const, content: 'A Slavic language.' }
		];
		const messages = askMessages(sample(), 'Should I learn it?', history);
		expect(messages[0]?.role).toBe('system');
		expect(messages[0]?.content).toContain('Mandala Method');
		expect(messages[0]?.content).toContain('Current chart');
		expect(messages[1]).toEqual(history[0]);
		expect(messages[2]).toEqual(history[1]);
		expect(messages[3]?.content).toBe('Should I learn it?');
	});
});
