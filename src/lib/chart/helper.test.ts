import { describe, expect, it } from 'vitest';
import { emptyChartAnswers } from './draft.ts';
import {
	aimOf,
	pillarHead,
	routeOf,
	clarifyOf,
	draftButton,
	sameDriver,
	actionGaps,
	editWords,
	groupEdits,
	aimParts,
	EXAMPLE_LINES,
	followUpQuestion,
	splitGoal,
	isMissingCard,
	isRetry,
	plainReply,
	askMessages,
	chartBriefFacts,
	chartContext,
	chatReply,
	conversationHistory,
	greetingFor,
	insightsFor,
	methodAnswer,
	pickHistory,
	unseenInsights,
	helpReply,
	progressReport,
	type HelperMessage,
	chartAnswersFromText,
	chipsFor,
	describeCoachProgress,
	chartAnswerFacts,
	extraChips,
	fillActionsMessages,
	fillPlan,
	helpChips,
	intentOf,
	isCancellation,
	isCardRejection,
	isHelpRequest,
	isPillarActionRequest,
	isWaitingStatus,
	keptLines,
	lineFault,
	moodFor,
	offerChips,
	oneLine,
	pillarMentioned,
	pillarsMessages,
	rewriteMessages,
	reviewChart,
	suggestToday,
	suggestWeek
} from './helper.ts';
import { dateKeyOf, emptyChart, parseChart, weekStartKey, type ChartData } from './model.ts';
import { exampleChart } from './example.ts';
import { buildChart, PRESETS } from './presets/index.ts';

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

describe('oneLine', () => {
	it('takes the first clean line and refuses one that is too long', () => {
		expect(oneLine('Rewrite: "Ask one question in each class."', 48)).toBe('Ask one question in each class');
		expect(oneLine('Track expenses using an app to stay aware of every purchase this month', 48)).toBeNull();
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
		expect(joined).toContain('Test the tank water on Sunday morning');
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

	it('keeps the pillars when the goal does not fit the cell, and sends the goal back', () => {
		const pillars = ['Easy runs', 'Speed', 'Hills', 'Strength', 'Sleep', 'Food', 'Shoes', 'Calendar'];
		const head = pillarHead(JSON.stringify({ goal: 'x'.repeat(81), pillars }))!;
		expect(head.goal).toBe('');
		expect(head.pillars).toEqual(pillars);
		expect(head.rejected).toEqual([{ text: 'x'.repeat(81), reason: 'A goal over 80 characters. Say it in fewer words.' }]);
	});
});

describe('pillarHead', () => {
	it('reads the head of a draft and needs eight distinct pillars', () => {
		const pillars = ['Easy runs', 'Speed', 'Long run', 'Strength', 'Sleep', 'Food', 'Shoes', 'Calendar'];
		expect(pillarHead(JSON.stringify({ goal: 'Finish a half', pillars }))).toEqual({ goal: 'Finish a half', pillars, rejected: [] });
		expect(pillarHead(JSON.stringify({ goal: 'Finish a half', pillars: [...pillars.slice(0, 7), 'speed'] }))?.pillars).toHaveLength(7);
		expect(pillarHead('no json here')).toBeNull();
	});

	it('sends a long pillar back instead of clipping it', () => {
		const pillars = [
			'Easy runs',
			'Speed intervals on track',
			'Long run',
			'Strength and conditioning session',
			'Sleep',
			'Food',
			'Shoes',
			'Calendar'
		];
		expect(pillarHead(JSON.stringify({ goal: 'Finish a half', pillars }))?.pillars).toHaveLength(7);
		expect(pillarHead(JSON.stringify({ goal: 'Finish a half', pillars }))?.rejected.map((item) => item.text)).toEqual(['Strength and conditioning session']);
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
		expect(describeCoachProgress('Downloading the built-in model.', 0.4)).toEqual({ label: 'Downloading.', downloadFillRatio: 0.4, detail: '' });
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

	it('finds short 2 and 3 letter pillars without false positives on stop words', () => {
		const data = sample();
		data.pillars[0] = 'Gym';
		data.pillars[1] = 'UI';
		expect(pillarMentioned('Can you suggest actions for Gym?', data)).toBe(0);
		expect(pillarMentioned('How can I improve the UI?', data)).toBe(1);
		expect(pillarMentioned('How do I run in the morning?', data)).toBeNull();
	});
});

describe('turn chips', () => {
	it('offers sketch or stay, help on a full chart, and go after a sketch', () => {
		expect(offerChips().map((chip) => chip.label)).toEqual(['Sketch the new one', 'Stay on this chart']);
		expect(helpChips().map(chipJob)).toEqual(['today', 'review']);
		expect(extraChips(true)).toEqual([]);
		expect(extraChips(false).map((chip) => chip.label)).toEqual(['Write the actions']);
		expect(extraChips(true, 'I am A1 and reading is hard').map((chip) => chip.label)).toEqual([
			'15 minutes a day',
			'30 minutes a day',
			'An hour a day',
			'No date'
		]);
	});
});

describe('cell prompts', () => {
	it('asks for a heading per pillar and a sentence per action, with no long word range', () => {
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
		expect(pillars).toContain('short heading');
		expect(actions).toContain('a verb and the thing it applies to');
		expect(actions).not.toContain('three to seven');
		expect(actions).toContain('keep the aquarium clean');
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

describe('isWaitingStatus', () => {
	it('matches download, loading, cache, shader, warm up, and waking up', () => {
		expect(isWaitingStatus('Starting the download.')).toBe(true);
		expect(isWaitingStatus('Downloading.')).toBe(true);
		expect(isWaitingStatus('Loading model from cache')).toBe(true);
		expect(isWaitingStatus('Getting ready.')).toBe(true);
		expect(isWaitingStatus('Warming up.')).toBe(true);
		expect(isWaitingStatus('Waking up.')).toBe(true);
	});

	it('returns false for thinking, ready, empty, and null', () => {
		expect(isWaitingStatus('Thinking.')).toBe(false);
		expect(isWaitingStatus('Ready, on this device.')).toBe(false);
		expect(isWaitingStatus('')).toBe(false);
		expect(isWaitingStatus(null)).toBe(false);
		expect(isWaitingStatus(undefined)).toBe(false);
	});
});

describe('moodFor priority list', () => {
	it('selects waiting when busy and status is waiting', () => {
		expect(
			moodFor({
				busy: true,
				status: 'Downloading.',
				cheer: true,
				sorry: true,
				card: 'findings',
				listening: true,
				step: 'direction'
			})
		).toBe('waiting');
	});

	it('selects thinking when busy and not waiting', () => {
		expect(
			moodFor({
				busy: true,
				status: 'Thinking.',
				cheer: true,
				sorry: true,
				card: 'findings',
				listening: true,
				step: 'direction'
			})
		).toBe('thinking');
	});

	it('selects happy when cheer is active and not busy', () => {
		expect(
			moodFor({
				cheer: true,
				sorry: true,
				card: 'findings',
				listening: true,
				step: 'direction'
			})
		).toBe('happy');
	});

	it('selects sorry on failure or stop', () => {
		expect(
			moodFor({
				sorry: true,
				card: 'findings',
				listening: true,
				step: 'direction'
			})
		).toBe('sorry');
	});

	it('selects puzzled when a findings card is open', () => {
		expect(
			moodFor({
				card: 'findings',
				listening: true,
				step: 'direction'
			})
		).toBe('puzzled');
	});

	it('selects listening when message box is focused, beating offering and curious', () => {
		expect(
			moodFor({
				card: 'picks',
				listening: true,
				step: 'direction'
			})
		).toBe('listening');
		expect(
			moodFor({
				card: 'chart',
				listening: true
			})
		).toBe('listening');
		expect(
			moodFor({
				step: 'extra',
				listening: true
			})
		).toBe('listening');
		expect(
			moodFor({
				listening: true
			})
		).toBe('listening');
	});

	it('selects offering when a non-findings card is open', () => {
		expect(moodFor({ card: 'chart', step: 'direction' })).toBe('offering');
		expect(moodFor({ card: 'cells', step: 'offer' })).toBe('offering');
		expect(moodFor({ card: 'picks' })).toBe('offering');
		expect(moodFor({ card: 'download' })).toBe('offering');
		expect(moodFor({ card: 'prompt' })).toBe('offering');
	});

	it('selects curious when waiting for goal, extra, or sketch choice', () => {
		expect(moodFor({ step: 'direction' })).toBe('curious');
		expect(moodFor({ step: 'extra' })).toBe('curious');
		expect(moodFor({ step: 'offer' })).toBe('curious');
	});

	it('defaults to idle', () => {
		expect(moodFor()).toBe('idle');
		expect(moodFor({ step: 'idle' })).toBe('idle');
		expect(moodFor({ card: null, step: 'idle' })).toBe('idle');
	});
});

describe('everyday messages', () => {
	// Where a message should land without the model. Keep adding the ones people actually type.
	const routes: [string, ReturnType<typeof intentOf>][] = [
		['What should I do today?', 'today'],
		['what should I work on today', 'today'],
		['pick 3 for today', 'today'],
		["give me today's actions", 'today'],
		['Can you pick my three?', 'today'],
		['plan my week', 'week'],
		['what should I focus on this week?', 'week'],
		['weekly plan', 'week'],
		['is my chart any good?', 'review'],
		['review', 'review'],
		['check my actions', 'review'],
		["what's wrong with my chart?", 'review'],
		['fill the empty ones', 'fill'],
		['fill in my chart', 'fill'],
		['help me finish my chart', 'fill'],
		['Could you fill in the rest?', 'fill'],
		['how am I doing?', 'progress'],
		["how's my progress", 'progress'],
		['which pillar have I been ignoring?', 'progress'],
		['progress', 'progress'],
		['start over', 'draft'],
		['new goal', 'draft'],
		['thanks', 'chat'],
		['hi Bindu', 'chat'],
		['I missed three days', 'chat'],
		['How should I plan my week?', 'ask'],
		["what's a pillar?", 'ask'],
		['I want to run a marathon', 'ask']
	];

	it.each(routes)('routes "%s" to %s', (text, intent) => {
		expect(intentOf(text)).toBe(intent);
	});

	it('does not read finishing this chart as a new goal', () => {
		expect(aimOf('help me finish my chart', sample())).toBeNull();
		expect(aimOf('I want to run a marathon', sample())).toBe('run a marathon');
	});

	it('treats feeling stuck as a request for help', () => {
		expect(isHelpRequest("I'm feeling stuck")).toBe(true);
		expect(isHelpRequest('Where do I start?')).toBe(true);
	});
});

describe('chatReply and helpReply', () => {
	it('answers thanks and hello without the model', () => {
		expect(chatReply('thanks', sample(), 0).text).toBe('Any time.');
		expect(chatReply('thanks', sample(), 1).text).toBe('Glad it helped.');
		expect(chatReply('hello', emptyChart()).text).toContain("I'm Bindu");
	});

	it('meets a missed day with the next step', () => {
		const reply = chatReply('I missed three days', sample());
		expect(reply.nextStep).toBe(true);
		expect(reply.text).toContain('not about you');
	});

	it('points help at the next move on this chart', () => {
		expect(helpReply(emptyChart())).toContain('goal');
		const data = sample();
		data.pillars[7] = '';
		expect(helpReply(data)).toBe('The chart needs one more pillar. I can suggest them.');
	});
});

describe('lineFault, open-ended lines', () => {
	const weak = [
		'Eat healthier',
		'Read more books',
		'Exercise regularly',
		'Sleep better',
		'Drink more water',
		'Be a better listener',
		'Stay motivated',
		'Improve my Spanish',
		'Have a positive mindset',
		'Lose 10 kg',
		'Get promoted',
		'Get fit',
		'Win the race',
		'Become fluent',
		'Make 1000 sales'
	];
	const fine = [
		'Run 30 minutes on Tuesday',
		'Read 20 pages before bed',
		'Drink more water at lunch',
		'Be in bed by 10:30',
		'Stay off the phone after 9',
		'Ask one question when stuck',
		'Book the driving test',
		'Learn three chords'
	];

	it.each(weak)('flags "%s"', (text) => {
		expect(lineFault(text, { max: 48, kind: 'action' })).not.toBeNull();
	});

	it.each(fine)('passes "%s"', (text) => {
		expect(lineFault(text, { max: 48, kind: 'action' })).toBeNull();
	});

	it('flags nothing in the presets', () => {
		for (const preset of PRESETS) expect(reviewChart(buildChart(preset), 99)).toEqual([]);
	});

	it('flags the example chart lines that cannot be ticked', () => {
		const texts = reviewChart(exampleChart(), 99).map((finding) => finding.text);
		expect(texts).toContain('Be present');
		expect(texts).toContain('Listen more');
	});
});

describe('progressReport', () => {
	const now = new Date(2026, 9, 5, 12);
	const day = (offset: number) => dateKeyOf(new Date(2026, 9, 5 + offset, 12));

	it('starts the log when nothing is ticked', () => {
		expect(progressReport(sample(), now)).toContain('Nothing ticked yet.');
		expect(progressReport(emptyChart(), now)).toContain('no goal');
	});

	it('counts ticks, quiet pillars, streak, and milestones from the log', () => {
		const data = sample();
		data.days = {
			[day(0)]: { focus: ['a0_0', 'a1_0'], checked: ['a0_0', 'a1_0'] },
			[day(-1)]: { focus: ['a2_0'], checked: ['a2_0'] },
			[day(-2)]: { focus: ['a3_0', 'a4_0', 'a5_0'], checked: ['a3_0'] }
		};
		data.meta = { a6_0: { kind: 'milestone', done: true } };
		const report = progressReport(data, now);
		expect(report).toContain('4 ticks in the last 7 days, from 4 pillars.');
		expect(report).toContain('4 pillars sat out this week, Sleep and Food among them.');
		expect(report).toContain('3 days in a row.');
		expect(report).toContain('1 milestone done.');
	});
});

describe('model context', () => {
	it('keeps greetings out of history and describes cards in one line', () => {
		const messages: HelperMessage[] = [
			{ id: 1, from: 'helper', text: 'Hi again.', aside: true },
			{ id: 2, from: 'you', text: 'Plan this week' },
			{
				id: 3,
				from: 'helper',
				text: 'Two for this week.',
				card: {
					kind: 'picks',
					scope: 'week',
					picks: [
						{ key: 'a0_0', text: 'Run 30 minutes Tuesday', pillarIndex: 0, why: '' },
						{ key: 'a1_0', text: '8 strides after Thursday', pillarIndex: 1, why: '' }
					]
				},
				state: 'skipped'
			}
		];
		const history = conversationHistory(messages);
		expect(history).toHaveLength(2);
		expect(history[1]!.content).toBe(
			'Two for this week. [Picks for the week: Run 30 minutes Tuesday; 8 strides after Thursday. They skipped it.]'
		);
	});

	it("adds one pillar's actions, today's picks, and the brief", () => {
		const data = sample();
		const now = new Date(2026, 9, 5, 12);
		data.days = { [dateKeyOf(now)]: { focus: ['a0_0', 'a1_0'], checked: ['a0_0'] } };
		data.brief = { constraint: 'A bad knee', timeline: 'October' };
		const context = chartContext(data, 2, now);
		expect(context).toContain(`Actions in Long run: ${data.actions[2]![0]}`);
		expect(context).toContain(`Today's picks: ${data.actions[0]![0]} (done); ${data.actions[1]![0]}`);
		expect(context).toContain('- Constraint: A bad knee');
		expect(chartBriefFacts(data)).toBe('About this person:\n- Timeline: October\n- Constraint: A bad knee');
	});

	it('finds the pillar a question names', () => {
		const messages = askMessages(sample(), 'What is weak in Strength?');
		expect(messages[0]!.content).toContain('Actions in Strength:');
	});

	it('keeps the brief through save and load, and drops junk', () => {
		const data = sample();
		data.brief = { situation: 'Runs twice a week', focus: '  ' };
		expect(parseChart(JSON.stringify(data))?.brief).toEqual({ situation: 'Runs twice a week' });
		expect(parseChart(JSON.stringify({ ...data, brief: 'nope' }))?.brief).toBeUndefined();
	});
});

describe('picks', () => {
	const now = new Date(2026, 9, 5, 12);
	const day = (offset: number, base = now) => dateKeyOf(new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset, 12));

	it('holds still within a day and changes across days on a fresh chart', () => {
		const data = sample();
		const keys = (date: Date) => suggestToday(data, date).map((pick) => pick.key).join();
		expect(keys(now)).toBe(keys(new Date(2026, 9, 5, 20)));
		const days = new Set(Array.from({ length: 6 }, (_, offset) => keys(new Date(2026, 9, 5 + offset, 12))));
		expect(days.size).toBeGreaterThan(1);
		expect([...days].every((value) => value.startsWith('a0_0,a1_0,a2_0'))).toBe(false);
	});

	it('does not count a pick without a tick as done', () => {
		const data = sample();
		data.days = {
			[day(-1)]: { focus: ['a0_0'], checked: [] },
			[day(-2)]: { focus: [], checked: Array.from({ length: 7 }, (_, index) => `a${index + 1}_0`) }
		};
		expect(pickHistory(data, now).pillarSinceTick[0]).toBeNull();
		const picks = suggestToday(data, now);
		expect(picks[0]?.pillarIndex).toBe(0);
		expect(picks[0]?.why).toBe('Nothing ticked in Easy runs yet.');
	});

	it('keeps a recent action going and says why', () => {
		const data = sample();
		data.days = { [day(-1)]: { focus: ['a3_2'], checked: ['a3_2'] }, [day(-3)]: { focus: ['a3_2'], checked: ['a3_2'] } };
		const pick = suggestToday(data, now).find((entry) => entry.key === 'a3_2');
		expect(pick?.why).toBe('Done 2 times this week. Keep it going.');
	});

	it('leaves out what was declined, dropped, or picked three times without a tick', () => {
		const data = sample();
		data.days = {
			[day(0)]: { focus: [], checked: [], declined: ['a0_0', 'a1_0'], dropped: ['a2_0'] },
			[day(-1)]: { focus: ['a3_0'], checked: [] },
			[day(-2)]: { focus: ['a3_0'], checked: [] },
			[day(-3)]: { focus: ['a3_0'], checked: [] }
		};
		const keys = suggestWeek(data, 64, now).map((pick) => pick.key);
		for (const key of ['a0_0', 'a1_0', 'a2_0', 'a3_0']) expect(keys).not.toContain(key);
		expect(suggestToday(data, now, 3, new Set(['a4_0'])).map((pick) => pick.key)).not.toContain('a4_0');
	});

	it('keeps one per pillar after some are declined', () => {
		const data = sample();
		data.days = { [day(0)]: { focus: [], checked: [], declined: ['a0_0', 'a1_0', 'a2_0', 'a3_0', 'a4_0'] } };
		const picks = suggestToday(data, now);
		expect(new Set(picks.map((pick) => pick.pillarIndex)).size).toBe(3);
	});

	it('names the same quiet pillar in the greeting and the picks', () => {
		const data = sample();
		data.days = { [day(-1)]: { focus: ['a0_0', 'a1_0'], checked: ['a0_0', 'a1_0'] } };
		const quiet = insightsFor(data, now).find((insight) => insight.id === 'quiet')!;
		const pick = suggestToday(data, now).find((entry) => entry.why.startsWith('Nothing ticked in'))!;
		expect(quiet.text).toBe(pick.why);
	});

	it('still puts pins first', () => {
		const data = sample();
		data.meta = { a6_3: { kind: 'milestone', pinned: true } };
		expect(suggestToday(data, now)[0]).toMatchObject({ key: 'a6_3', why: 'Pinned for this week.' });
	});
});

describe('insightsFor', () => {
	const now = new Date(2026, 9, 5, 12);
	const day = (offset: number) => dateKeyOf(new Date(2026, 9, 5 + offset, 12));

	it('says nothing before the first tick', () => {
		const data = sample();
		data.days = { [day(0)]: { focus: ['a0_0'], checked: [] } };
		expect(insightsFor(data, now)).toEqual([]);
	});

	it('notices a stuck pick and names the action', () => {
		const data = sample();
		data.days = {
			[day(-1)]: { focus: ['a3_0', 'a1_1'], checked: ['a1_1'] },
			[day(-2)]: { focus: ['a3_0'], checked: [] },
			[day(-4)]: { focus: ['a3_0'], checked: [] }
		};
		const stuck = insightsFor(data, now).find((insight) => insight.id === 'stuck');
		expect(stuck?.key).toBe('a3_0');
		expect(stuck?.text).toBe('You picked \u201cStrength step 1\u201d 3 times and haven\'t ticked it. A smaller version might go.');
	});

	it('greets a comeback and today\'s finished list', () => {
		const data = sample();
		data.days = { [day(-9)]: { focus: ['a0_0'], checked: ['a0_0'] }, [day(0)]: { focus: ['a1_0', 'a2_0'], checked: ['a1_0', 'a2_0'] } };
		const ids = insightsFor(data, now).map((insight) => insight.id);
		expect(ids.slice(0, 2)).toEqual(['today', 'comeback']);
		expect(insightsFor(data, now)[1]?.text).toBe('First tick in 9 days. Good to see you.');
	});

	it('reads the time of day from tick times', () => {
		const data = sample();
		data.days = {
			[day(-1)]: { focus: [], checked: ['a0_0', 'a1_0', 'a2_0'], at: { a0_0: '07:10', a1_0: '08:30', a2_0: '21:00' } },
			[day(-2)]: { focus: [], checked: ['a3_0', 'a4_0'], at: { a3_0: '09:00', a4_0: '10:45' } }
		};
		expect(insightsFor(data, now).some((insight) => insight.text === 'Most of your ticks land before noon.')).toBe(true);
	});

	it('notices an action taken off the list twice', () => {
		const data = sample();
		data.days = {
			[day(-1)]: { focus: ['a1_0'], checked: ['a1_0'], dropped: ['a5_5'] },
			[day(-3)]: { focus: [], checked: [], dropped: ['a5_5'] }
		};
		expect(insightsFor(data, now).find((insight) => insight.id === 'dropped')?.text).toBe('\u201cFood step 6\u201d came off the list twice this week.');
	});

	it('leads the greeting with a strong insight', () => {
		const data = sample();
		data.days = { [day(-9)]: { focus: ['a0_0'], checked: ['a0_0'] }, [day(0)]: { focus: ['a1_0'], checked: ['a1_0'] } };
		expect(greetingFor(data, now)).toBe("Hi again. Today's pick is done.");
	});
});

describe('more insights', () => {
	const now = new Date(2026, 9, 7, 12);
	const day = (offset: number) => dateKeyOf(new Date(2026, 9, 7 + offset, 12));

	it("says last week's note back once the new week starts", () => {
		const data = sample();
		data.days = { [day(-1)]: { focus: [], checked: ['a0_0'] } };
		data.weeks = { [weekStartKey(new Date(2026, 8, 30))]: { note: 'Too tired after work.', swapped: [] } };
		const words = insightsFor(data, now).find((insight) => insight.id === 'words');
		expect(words?.text).toBe('Last week you wrote: \u201cToo tired after work.\u201d Still true?');
		data.weeks[weekStartKey(now)] = { note: 'Better.', swapped: [] };
		expect(insightsFor(data, now).some((insight) => insight.id === 'words')).toBe(false);
	});

	it('compares follow-through across pillars once there are enough picks', () => {
		const data = sample();
		data.days = {};
		for (let offset = 1; offset <= 6; offset++) {
			data.days[day(-offset)] = { focus: ['a0_0', 'a1_0'], checked: offset <= 5 ? ['a0_0'] : ['a0_0', 'a1_0'] };
		}
		expect(insightsFor(data, now).find((insight) => insight.id === 'follow')?.text).toBe(
			'You finish Easy runs picks 6 of 6 times. Speed, 1 of 6.'
		);
	});

	it('suggests retiring a routine that became a habit', () => {
		const data = sample();
		data.meta = { a4_0: { kind: 'routine' } };
		data.days = {};
		for (let offset = 0; offset < 11; offset++) data.days[day(-offset)] = { focus: [], checked: ['a4_0'] };
		const retire = insightsFor(data, now).find((insight) => insight.id === 'retire');
		expect(retire?.key).toBe('a4_0');
		expect(retire?.text).toContain('is ticked on 11 of the last 14 days');
	});

	it('holds back an insight shown in the last three days', () => {
		const data = sample();
		data.days = {
			[day(-1)]: { focus: ['a3_0'], checked: ['a1_1'] },
			[day(-2)]: { focus: ['a3_0'], checked: [] },
			[day(-3)]: { focus: ['a3_0'], checked: [] }
		};
		expect(unseenInsights(data, now).some((insight) => insight.id === 'stuck')).toBe(true);
		data.days[day(-2)]!.shown = ['stuck:a3_0'];
		expect(unseenInsights(data, now).some((insight) => insight.id === 'stuck')).toBe(false);
		expect(insightsFor(data, now).some((insight) => insight.id === 'stuck')).toBe(true);
	});
});

describe('methodAnswer', () => {
	it('answers common method questions in writing', () => {
		expect(methodAnswer('Why 64?')?.text).toContain('Eight pillars with eight actions');
		expect(methodAnswer('how many actions should I do a day?')?.job).toBe('today');
		expect(methodAnswer('Should I run in the morning?')).toBeNull();
	});
});

describe('isRetry, isMissingCard, plainReply', () => {
	it('reads a retry', () => {
		for (const text of ['Try again', 'try again please', 'again', 'redo', 'redo the pillars', 'different pillars', 'another one']) expect(isRetry(text)).toBe(true);
		for (const text of ['Try again next week with Sunday runs', 'By March', 'go']) expect(isRetry(text)).toBe(false);
	});

	it('reads a missing card', () => {
		for (const text of ["I don't see the chart", 'i dont see it', 'where is the chart?', 'where did the actions go', "I can't find the draft", 'the chart disappeared']) {
			expect(isMissingCard(text)).toBe(true);
		}
		for (const text of ['show me my progress', 'where do I start?', 'I see it now, thanks', 'how do I see my week', 'where is it', 'show me how to use it']) {
			expect(isMissingCard(text)).toBe(false);
		}
	});

	it('strips markdown the panel would show as is', () => {
		expect(plainReply('**Study Slovak Daily:** (8 Actions) * **Practice Grammar:** (8 Actions)')).toBe('Study Slovak Daily: (8 Actions) Practice Grammar: (8 Actions)');
		expect(plainReply('## Plan\n- Walk after dinner\n- Read one page')).toBe('Plan\nWalk after dinner\nRead one page');
		expect(plainReply('Pick 2 - not 3 - today.')).toBe('Pick 2 - not 3 - today.');
	});
});

const SLOVAK =
	'I want to learn Slovak. I am currently about a A1 maybe A2, but I have an insane lack of vocabulary and I am shit at reading as well as bad with having conversation';

describe('a new goal with more said', () => {
	it('keeps the goal line short and everything else for the plan', () => {
		const parts = aimParts(SLOVAK, sample());
		expect(parts?.aim).toBe('learn Slovak');
		expect(parts?.said).toMatch(/^I am currently about a A1 maybe A2, but I have an insane lack of vocabulary .* conversation$/);
		expect(aimOf(SLOVAK, sample())).toBe('learn Slovak');
	});

	it('splits a typed goal the same way', () => {
		expect(splitGoal('Run a half marathon by October. My knee is bad.')).toEqual({ goal: 'Run a half marathon by October', said: 'My knee is bad.' });
		expect(splitGoal('Learn Slovak, but I only have evenings')).toEqual({ goal: 'Learn Slovak', said: 'I only have evenings' });
		expect(splitGoal('Learn Slovak')).toEqual({ goal: 'Learn Slovak', said: '' });
	});

	it('puts what was said into the answers, and the follow-up answer after it', () => {
		const answers = chartAnswersFromText('learn Slovak', '30 minutes a day', 'Reading is hard.');
		expect(answers.direction).toBe('learn Slovak');
		expect(answers.situation).toBe('Reading is hard. 30 minutes a day');
		expect(chartAnswersFromText('learn Slovak', 'No date', 'Reading is hard.').situation).toBe('Reading is hard.');
		expect(chartAnswersFromText('learn Slovak', 'go').situation).toBe('');
	});

	it('asks only for what is missing', () => {
		expect(followUpQuestion('')).toMatch(/^Anything that would change the plan/);
		expect(followUpQuestion('I am A1 and reading is hard')).toBe('How much time can you give it a day, and is there a date?');
		expect(followUpQuestion('I have 20 minutes a day')).toBe('Is there a date you want this by?');
		expect(followUpQuestion('I want it by March')).toBe('How much time can you give it a day?');
		expect(followUpQuestion('20 minutes a day, by March')).toBeNull();
	});
});

describe('pillars', () => {
	it('asks for a goal past the stated level, a pillar per weak spot, skills over tools', () => {
		const system = pillarsMessages(emptyChartAnswers())[0]!.content;
		expect(system).toMatch(/one step past where they stand now/);
		expect(system).toMatch(/each of those gets its own pillar/);
		expect(system).toMatch(/no apps, videos, podcasts or tests as pillars/);
		expect(system).toMatch(/does not repeat it/);
	});

	it('rejects a line that copies the worked example', () => {
		for (const line of EXAMPLE_LINES) expect(lineFault(line, { max: 48, kind: 'action', siblings: [...EXAMPLE_LINES] })?.code).toBe('repeated');
		expect(fillActionsMessages(sample(), 0, 8).map((message) => message.content).join('\n')).not.toMatch(/Spanish/);
	});
});

describe('filling the whole chart', () => {
	function gappy(): ChartData {
		const data = sample();
		data.actions[0] = data.actions[0]!.map((action, index) => (index < 6 ? action : ''));
		data.actions[3] = data.actions[3]!.map(() => '');
		data.actions[7] = data.actions[7]!.map((action, index) => (index === 0 ? '' : action));
		return data;
	}

	it('plans every pillar with gaps when asked for all, one pillar otherwise', () => {
		const data = gappy();
		expect(actionGaps(data).map((row) => row.pillarIndex)).toEqual([0, 3, 7]);
		expect(fillPlan(data, null, true)).toEqual({
			kind: 'all',
			rows: [
				{ pillarIndex: 0, empty: [6, 7] },
				{ pillarIndex: 3, empty: [0, 1, 2, 3, 4, 5, 6, 7] },
				{ pillarIndex: 7, empty: [0] }
			]
		});
		expect(fillPlan(data)).toEqual({ kind: 'actions', pillarIndex: 0, empty: [6, 7] });
		const one = sample();
		one.actions[2]![4] = '';
		expect(fillPlan(one, null, true)).toEqual({ kind: 'actions', pillarIndex: 2, empty: [4] });
	});

	it('offers to fill all pillars beside the first one', () => {
		const labels = chipsFor(gappy()).map((chip) => chip.label);
		expect(labels.slice(0, 2)).toEqual(['Fill all 3 pillars', `Fill ${sample().pillars[0]}`]);
		expect(chipsFor(gappy()).find((chip) => chip.label === 'Fill all 3 pillars')?.act).toEqual({ kind: 'job', job: 'fill', all: true });
	});

	it('routes the ways people ask for it to fill', () => {
		for (const text of ['Write all the actions', 'Fill the whole chart', 'write the actions', 'fill in the actions', 'fill it', 'fill everything', 'fill the rest']) {
			expect(routeOf(text, sample())).toBe('fill');
		}
		for (const text of ['write me a poem', 'What should I write first?']) expect(routeOf(text, sample())).toBe('model');
		// Reads as "how does this work". Not a fill either way.
		expect(routeOf('fill me in on how this works', sample())).toBe('clarify');
	});

	it('says what keeping a draft does to the chart in view', () => {
		expect(draftButton(emptyChart())).toBe('Start this chart');
		expect(draftButton(sample())).toBe('Open as a new chart');
	});

	it('names the pillar being written in the status', () => {
		const status = describeCoachProgress('Writing actions for Sleep.', null, { index: 4, name: 'Sleep' });
		expect(status.pillar).toEqual({ index: 4, name: 'Sleep' });
		expect(describeCoachProgress('Thinking.').pillar).toBeUndefined();
	});

	it('asks about close readings by name, and offers to just answer', () => {
		const unsure = clarifyOf('how did my week go and what next');
		expect(unsure?.question).toBe('Should I show your progress or plan this week?');
		expect(unsure?.chips.map((chip) => chip.label)).toEqual(['Show my progress', 'Plan this week', 'Just answer']);
		expect(clarifyOf('write me a poem')).toBeNull();
	});
});

describe('the cells card', () => {
	const data = sample();
	const name = (k: number) => data.pillars[k]!;

	it('names each pillar once, in the order the lines came', () => {
		const groups = groupEdits(data, [
			{ key: 'a3_0', before: '', after: 'One' },
			{ key: 'a3_1', before: '', after: 'Two' },
			{ key: 'a5_0', before: '', after: 'Three' },
			{ key: 'p2', before: '', after: 'A pillar' }
		]);
		expect(groups.map((group) => [group.label, group.pillarIndex, group.edits.length])).toEqual([
			[name(3), 3, 2],
			[name(5), 5, 1],
			['Pillars', null, 1]
		]);
	});

	it('says what the button does, and what happened, in the chart words', () => {
		const adds = Array.from({ length: 8 }, (_, index) => ({ key: `a1_${index}`, before: '', after: `Line ${index}` }));
		expect(editWords(data, adds)).toEqual({ button: 'Add to chart', done: `Added 8 actions to ${name(1)}.` });
		expect(editWords(data, [...adds, { key: 'a2_0', before: '', after: 'More' }]).done).toBe('Added 9 actions.');
		expect(editWords(data, [{ key: 'p4', before: '', after: 'Sleep' }])).toEqual({ button: 'Add to chart', done: 'Added 1 pillar.' });
		expect(editWords(data, [{ key: 'a0_0', before: 'Eat better', after: 'Cook dinner on Sunday' }])).toEqual({ button: 'Replace it', done: 'Replaced 1 action.' });
		expect(editWords(data, adds.map((edit) => ({ ...edit, before: 'Old' }))).button).toBe('Replace them');
		expect(editWords(data, [{ key: 'p0', before: 'Old', after: 'New' }, { key: 'a0_0', before: 'Old', after: 'New' }]).done).toBe('Replaced 1 pillar and 1 action.');
	});
});

describe('asking for a review again', () => {
	it('routes the ways people ask to review what is in front of them', () => {
		for (const text of ['review it again', 'review this draft', 'check it again', 'review again', 'check the draft', 'please review it']) {
			expect(routeOf(text, sample())).toBe('review');
		}
		for (const text of ['review the week with me', 'check in with me tomorrow']) expect(routeOf(text, sample())).not.toBe('review');
	});
});

describe('lines cut short', () => {
	it('flags a line that ends mid-phrase', () => {
		for (const line of ['Learn words for the', 'Practice with your', 'Review notes and', 'Read a']) {
			expect(lineFault(line, { max: 32, kind: 'pillar' })?.code).toBe('cut');
		}
		for (const line of ['Walk to work', 'Check in with Mom on Sunday', 'Follow through', 'List 3 skills someone would pay for', 'Listen once without subtitles, then with']) {
			expect(lineFault(line, { max: 48, kind: 'action' })?.code ?? null).not.toBe('cut');
		}
	});

	it('keeps cut and long pillars out, each with its reason', () => {
		const head = pillarHead(
			JSON.stringify({
				goal: 'Learn Slovak',
				pillars: ['Track progress with the', 'Practice speaking with language partners', 'Learn Slovak words daily', 'Read Slovak texts', 'Speak Slovak daily', 'Write Slovak notes', 'Hear Slovak radio', 'Use a Slovak tutor weekly on Sundays']
			})
		)!;
		expect(head.pillars).not.toContain('Track progress with the');
		expect(head.rejected).toEqual([
			{ text: 'Track progress with the', reason: 'This fits any goal. Name what drives this one.' },
			{ text: 'Practice speaking with language partners', reason: 'Over 32 characters. Say it in fewer words.' },
			{ text: 'Use a Slovak tutor weekly on Sundays', reason: 'Over 32 characters. Say it in fewer words.' }
		]);
		expect(head.pillars).toHaveLength(5);
	});

	it('sends back a pillar that names a tool or has no end, with the reason', () => {
		const head = pillarHead(
			JSON.stringify({
				goal: 'Hold a conversation in Slovak',
				pillars: ['Listen to Slovak podcasts daily', 'Focus on common phrases', 'Practice daily vocabulary recall', 'Read simple Slovak texts', 'Speak with a tutor weekly', 'Write a short diary entry', 'Shadow audio after lunch', 'Learn ten phrases a week']
			})
		)!;
		expect(head.rejected).toEqual([
			{ text: 'Listen to Slovak podcasts daily', reason: 'This names a tool. Name the habit it serves.' },
			{ text: 'Focus on common phrases', reason: 'This has no end. Name the part of the goal it works on.' }
		]);
		expect(head.pillars).toHaveLength(6);
	});

	it('sends back a second heading for the same driver, and a catch-all', () => {
		const head = pillarHead(
			JSON.stringify({
				goal: 'Hold a conversation in Slovak',
				pillars: ['Vocabulary', 'Reading practice', 'Conversation practice', 'Reading comprehension', 'Daily listening', 'Grammar', 'Consistency habit', 'Pronunciation', 'Writing']
			})
		)!;
		expect(head.rejected).toEqual([
			{ text: 'Reading comprehension', reason: 'Same driver as "Reading practice". Name a different one.' },
			{ text: 'Consistency habit', reason: 'This fits any goal. Name what drives this one.' }
		]);
		expect(head.pillars).toEqual(['Vocabulary', 'Reading practice', 'Conversation practice', 'Daily listening', 'Grammar', 'Pronunciation', 'Writing']);
		expect(sameDriver('Daily listening', ['Daily reading'])).toBeNull();
		expect(lineFault('Plan the week with the', { max: 32, kind: 'pillar' })?.code).toBe('cut');
	});

	it('passes every preset pillar', () => {
		const flagged = PRESETS.flatMap((preset) => buildChart(preset).pillars.filter((pillar) => lineFault(pillar, { max: 32, kind: 'pillar' })));
		expect(flagged).toEqual([]);
	});
});
