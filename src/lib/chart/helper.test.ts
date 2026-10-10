import { describe, expect, it } from 'vitest';
import {
	actionGaps,
	askPrompt,
	doorsFor,
	draftButton,
	editWords,
	fillEdits,
	gapsOf,
	groupEdits,
	insightsFor,
	lineFault,
	moodFor,
	nextMove,
	noteFor,
	pickHistory,
	progressOf,
	reviewChart,
	suggestToday,
	suggestWeek,
	unseenInsights,
	weekStrip
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

describe('facts, faults, and the prompts', () => {
	it('rejects a long line, a result, and an echo of the pillar', () => {
		expect(lineFault('Track expenses using an app to stay aware of spending', { max: 48, kind: 'action' })?.code).toBe('long');
		expect(lineFault('Get 1 million views', { max: 48, kind: 'action' })?.code).toBe('uncontrolled');
		expect(lineFault('Easy runs', { max: 48, kind: 'action', pillar: 'Easy runs' })?.code).toBe('restated');
		expect(lineFault('Shoes by the door', { max: 48, kind: 'action', pillar: 'Easy runs' })).toBeNull();
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

function chipJob(chip: { act: { kind: string; job?: string } }): string {
	return chip.act.kind === 'job' ? (chip.act.job ?? '') : chip.act.kind;
}

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

describe('model context', () => {
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

	it('leads the note with a strong insight', () => {
		const data = sample();
		data.days = { [day(-9)]: { focus: ['a0_0'], checked: ['a0_0'] }, [day(0)]: { focus: ['a1_0'], checked: ['a1_0'] } };
		expect(noteFor(data, now).text).toBe("Today's pick is done.");
		expect(noteFor(data, now, null).text).not.toBe("Today's pick is done.");
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

const SLOVAK =
	'I want to learn Slovak. I am currently about a A1 maybe A2, but I have an insane lack of vocabulary and I am shit at reading as well as bad with having conversation';

describe('filling the whole chart', () => {
	function gappy(): ChartData {
		const data = sample();
		data.actions[0] = data.actions[0]!.map((action, index) => (index < 6 ? action : ''));
		data.actions[3] = data.actions[3]!.map(() => '');
		data.actions[7] = data.actions[7]!.map((action, index) => (index === 0 ? '' : action));
		return data;
	}

	it('counts what is still empty, pillars first', () => {
		const data = gappy();
		expect(actionGaps(data).map((row) => row.pillarIndex)).toEqual([0, 3, 7]);
		expect(gapsOf(data)).toEqual({
			pillars: [],
			actions: [
				{ pillarIndex: 0, empty: [6, 7] },
				{ pillarIndex: 3, empty: [0, 1, 2, 3, 4, 5, 6, 7] },
				{ pillarIndex: 7, empty: [0] }
			],
			total: 11
		});
		data.pillars[5] = '';
		expect(gapsOf(data).pillars).toEqual([5]);
		expect(gapsOf(sample()).total).toBe(0);
		expect(gapsOf(emptyChart()).total).toBe(0);
	});

	it('takes only the empty cells from a completed chart, never a written one', () => {
		const current = gappy();
		const reply = structuredClone(current);
		reply.actions = reply.actions.map((row, pillarIndex) => row.map((action, index) => action || `New ${pillarIndex}.${index}`));
		reply.actions[0]![0] = 'Rewritten, and ignored';
		const edits = fillEdits(current, reply);
		expect(edits.length).toBe(current.actions.flat().filter((action) => !action.trim()).length);
		expect(edits.every((edit) => edit.before === '' && edit.after.startsWith('New '))).toBe(true);
	});

	it('says what keeping a draft does to the chart in view', () => {
		expect(draftButton(emptyChart())).toBe('Start this chart');
		expect(draftButton(sample())).toBe('Open as a new chart');
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

describe('lines cut short', () => {
	it('flags a line that ends mid-phrase', () => {
		for (const line of ['Learn words for the', 'Practice with your', 'Review notes and', 'Read a']) {
			expect(lineFault(line, { max: 32, kind: 'pillar' })?.code).toBe('cut');
		}
		for (const line of ['Walk to work', 'Check in with Mom on Sunday', 'Follow through', 'List 3 skills someone would pay for', 'Listen once without subtitles, then with']) {
			expect(lineFault(line, { max: 48, kind: 'action' })?.code ?? null).not.toBe('cut');
		}
	});

	it('passes every preset pillar', () => {
		const flagged = PRESETS.flatMap((preset) => buildChart(preset).pillars.filter((pillar) => lineFault(pillar, { max: 32, kind: 'pillar' })));
		expect(flagged).toEqual([]);
	});
});

describe('moodFor', () => {
	it('puts a landed moment first, then a puzzle, then listening, then picks, then waiting', () => {
		expect(moodFor({ cheer: true, puzzled: true, listening: true })).toBe('happy');
		expect(moodFor({ puzzled: true, listening: true })).toBe('puzzled');
		expect(moodFor({ listening: true, offering: true })).toBe('listening');
		expect(moodFor({ offering: true, waiting: true })).toBe('offering');
		expect(moodFor({ waiting: true })).toBe('curious');
		expect(moodFor()).toBe('idle');
	});
});

describe('the home page', () => {
	const now = new Date(2026, 9, 7, 12);

	it('asks for a goal on an empty chart, and leads with starting one', () => {
		expect(noteFor(emptyChart(), now).text).toContain('one goal');
		expect(nextMove(emptyChart(), now)).toMatchObject({ page: 'write', mode: 'new', label: 'Start a chart' });
		expect(doorsFor(emptyChart(), now)).toEqual([]);
	});

	it('names what is missing, and leads with filling it', () => {
		const data = sample();
		data.actions[4] = data.actions[4]!.map((action, index) => (index < 5 ? action : ''));
		expect(noteFor(data, now, null).text).toBe('Sleep still has 3 empty actions.');
		expect(nextMove(data, now)).toMatchObject({ page: 'write', mode: 'fill' });
		data.pillars[2] = '';
		expect(noteFor(data, now, null).text).toBe('\u201cFinish a half marathon this October\u201d still needs one more pillar.');
	});

	it("leads a full chart with today's three, then with how it is going once today is set", () => {
		const data = sample();
		expect(nextMove(data, now).page).toBe('today');
		expect(doorsFor(data, now).map((door) => door.page)).toEqual(['week', 'progress', 'review', 'write']);
		data.days = { [dateKeyOf(now)]: { focus: ['a0_0', 'a1_0'], checked: ['a0_0'] } };
		expect(nextMove(data, now).page).toBe('progress');
		expect(noteFor(data, now, null).text).toBe('1 of 2 done today. One at a time.');
		expect(doorsFor(data, now).find((door) => door.page === 'today')?.detail).toBe('1 of 2 done today');
	});

	it('says on each door what it would find', () => {
		const data = sample();
		data.actions[0]![0] = 'Be healthier';
		const doors = doorsFor(data, now);
		expect(doors.find((door) => door.page === 'review')?.detail).toBe('One line to tighten');
		expect(doors.find((door) => door.page === 'week')?.detail).toBe('6 actions, one per pillar');
		expect(doors.find((door) => door.page === 'progress')?.detail).toBe('Nothing ticked yet');
	});
});

describe('how it is going', () => {
	const now = new Date(2026, 9, 7, 12);
	const day = (offset: number) => dateKeyOf(new Date(2026, 9, 7 + offset, 12));

	it('lays the last 7 days out oldest first, a pillar per tick', () => {
		const data = sample();
		data.days = { [day(0)]: { focus: [], checked: ['a3_1', 'a0_2', 'g'] }, [day(-6)]: { focus: [], checked: ['a7_0'] }, [day(-7)]: { focus: [], checked: ['a1_1'] } };
		const strip = weekStrip(data, now);
		expect(strip).toHaveLength(7);
		expect(strip[6]).toMatchObject({ key: day(0), today: true, ticks: [0, 3] });
		expect(strip[0]).toMatchObject({ key: day(-6), ticks: [7] });
		expect(strip.map((entry) => entry.label).join('')).toBe('TFSSMTW');
	});

	it('counts ticks, pillars and the streak from the log', () => {
		const data = sample();
		data.days = { [day(0)]: { focus: [], checked: ['a0_0', 'a1_0'] }, [day(-1)]: { focus: [], checked: ['a1_1'] }, [day(-2)]: { focus: [], checked: ['a2_0'] } };
		const progress = progressOf(data, now);
		expect(progress).toMatchObject({ ticks: 4, pillars: [0, 1, 2], streak: 3, everTicked: true, written: 64 });
		expect(progress.quiet).toEqual([3, 4, 5, 6, 7]);
		expect(progressOf(sample(), now).everTicked).toBe(false);
	});
});

describe('askPrompt', () => {
	it('carries the chart, and the question when there is one', () => {
		expect(askPrompt(sample(), 'Is Speed the right pillar?')).toContain('My question: Is Speed the right pillar?');
		expect(askPrompt(sample())).toContain('wait for my question');
		expect(askPrompt(sample())).toContain('Pillar 2: Speed');
	});
});

