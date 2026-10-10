import { describe, expect, it, vi } from 'vitest';
import { HelperStore, type HelperTarget } from './helper.svelte.ts';
import { dateKeyOf, emptyChart, setByKey, setMeta, type ChartData } from './model.ts';

function chartData(goal: string): ChartData {
	const data = emptyChart();
	data.goal = goal;
	data.pillars = ['Easy runs', 'Speed', 'Long run', 'Strength', 'Sleep', 'Food', 'Shoes', 'Calendar'];
	data.actions = data.pillars.map((pillar) => Array.from({ length: 8 }, (_, index) => `${pillar} step ${index + 1}`));
	return data;
}

/** A sandbox like the lab's: two charts, a switch, and a record of what Bindu asked for. */
function sandbox() {
	const charts: Record<string, ChartData> = { one: chartData('Run a half marathon'), two: chartData('Learn Spanish') };
	const calls = { declined: [] as string[][], shown: [] as string[], today: [] as string[][] };
	let active = 'one';
	const target: HelperTarget = {
		data: () => charts[active]!,
		applyDraft: (next) => {
			charts.three = next;
			active = 'three';
			return true;
		},
		setCells: (edits) => {
			for (const edit of edits) setByKey(charts[active]!, edit.key, edit.after);
		},
		setToday: (keys) => calls.today.push(keys),
		pinWeek: (keys) => {
			for (const key of keys) setMeta(charts[active]!, key, { pinned: true });
		},
		showCell: () => {},
		decline: (keys) => calls.declined.push(keys),
		noteShown: (signature) => {
			calls.shown.push(signature);
			const data = charts[active]!;
			const key = dateKeyOf(new Date());
			data.days ??= {};
			const log = data.days[key] ?? { focus: [], checked: [] };
			data.days[key] = { ...log, shown: [...(log.shown ?? []), signature] };
		},
		setBrief: (brief) => {
			charts[active]!.brief = brief;
		},
		chartId: () => active
	};
	const helper = new HelperStore(target);
	return {
		helper,
		charts,
		calls,
		switchTo(id: string) {
			active = id;
			helper.follow(id);
		}
	};
}

const texts = (helper: HelperStore) => helper.messages.map((message) => message.text);

describe('HelperStore conversations', () => {
	it('keeps one conversation per chart', async () => {
		const { helper, switchTo } = sandbox();
		helper.show();
		await helper.send('how am I doing?');
		const first = texts(helper);
		switchTo('two');
		expect(texts(helper)).toHaveLength(1);
		expect(texts(helper)[0]).toContain('Hi again');
		switchTo('one');
		expect(texts(helper)).toEqual(first);
	});

	it('takes the conversation along when a draft opens as a new chart', () => {
		const { helper } = sandbox();
		helper.show();
		helper.messages = [...helper.messages, { id: 99, from: 'helper', text: 'Here is a first chart.', card: { kind: 'chart', data: chartData('Cook dinner') }, state: 'open' }];
		helper.use(99);
		const before = texts(helper);
		helper.follow('three');
		expect(texts(helper)).toEqual(before);
	});
});

describe('HelperStore picks', () => {
	it('swaps one pick and records it as declined today', async () => {
		const { helper, calls } = sandbox();
		await helper.send("Pick today's three");
		const card = helper.messages.at(-1)!;
		const before = card.card?.kind === 'picks' ? card.card.picks.map((pick) => pick.key) : [];
		helper.swap(card.id, before[0]!);
		const after = helper.messages.find((entry) => entry.id === card.id)!.card;
		const keys = after?.kind === 'picks' ? after.picks.map((pick) => pick.key) : [];
		expect(keys).toHaveLength(3);
		expect(keys).not.toContain(before[0]);
		expect(keys.slice(1)).toEqual(before.slice(1));
		expect(calls.declined).toEqual([[before[0]]]);
	});

	it('declines the three on Not now, but not a week plan', async () => {
		const { helper, calls } = sandbox();
		await helper.send('plan my week');
		helper.skip(helper.messages.at(-1)!.id);
		const week = helper.messages.at(-1)!;
		expect(week.state).toBe('skipped');
		expect(calls.declined).toEqual([]);
		await helper.send("Pick today's three");
		const today = helper.messages.at(-1)!;
		helper.skip(today.id);
		expect(calls.declined).toHaveLength(1);
		expect(calls.declined[0]).toHaveLength(3);
	});

	it('does not repeat the card button as a chip', async () => {
		const { helper } = sandbox();
		await helper.send("Pick today's three");
		const jobs = helper.chips.flatMap((chip) => (chip.act.kind === 'job' ? [chip.act.job] : []));
		expect(jobs).not.toContain('today');
		expect(jobs).toContain('week');
	});
});

describe('HelperStore memory and answers', () => {
	it('shows what it kept and forgets a line', async () => {
		const { helper, charts } = sandbox();
		charts.one!.brief = { timeline: 'October', constraint: 'A bad knee' };
		await helper.send('what do you know about me?');
		expect(helper.messages.at(-1)?.card?.kind).toBe('facts');
		helper.forget('constraint');
		expect(charts.one!.brief).toEqual({ timeline: 'October' });
	});

	it('answers a method question without the model', async () => {
		const { helper } = sandbox();
		await helper.send("what's a pillar?");
		expect(texts(helper).at(-1)).toContain('one of the eight things');
		expect(helper.chips.length).toBeGreaterThan(0);
	});

	it('reads a paraphrase it was not written for', async () => {
		const { helper } = sandbox();
		await helper.send('can u sketch out my week');
		expect(helper.messages.at(-1)?.card?.kind).toBe('picks');
		await helper.send('sorry I disappeared for a week');
		expect(texts(helper).at(-1)).toMatch(/^A missed day/);
	});

	it('asks when unsure, then does what the chip names with the first message', async () => {
		const { helper } = sandbox();
		await helper.send('help me plan the coming week');
		expect(texts(helper).at(-1)).toBe('Should I plan this week?');
		expect(helper.chips.map((chip) => chip.label)).toEqual(['Plan this week', 'Ask a chat app']);
		helper.choose(helper.chips[0]!);
		await vi.waitFor(() => expect(helper.messages.at(-1)?.card).toMatchObject({ kind: 'picks', scope: 'week' }));
		expect(helper.chips.some((chip) => chip.act.kind === 'reading')).toBe(false);
	});

	it('greets with an insight once, then not again the same day', () => {
		const { helper, charts, calls } = sandbox();
		const today = dateKeyOf(new Date());
		charts.one!.days = { [today]: { focus: ['a0_0'], checked: ['a0_0'] } };
		helper.show();
		expect(texts(helper)[0]).toBe("Hi again. Today's pick is done.");
		expect(calls.shown).toEqual(['today:']);
		helper.reset();
		expect(texts(helper)[0]).not.toContain("Today's pick is done");
	});
});

describe('HelperStore hands writing to a chat app', () => {
	const reply = (goal: string, prefix = 'Line') =>
		JSON.stringify({
			goal,
			pillars: Array.from({ length: 8 }, (_, index) => `Pillar ${index + 1}`),
			actions: Array.from({ length: 8 }, (_, pillar) => Array.from({ length: 8 }, (_, index) => `${prefix} ${pillar}.${index}`))
		});
	const lastCard = (helper: HelperStore) => helper.messages.at(-1)?.card;

	it('asks two questions, then gives a prompt that carries the answers', () => {
		const { helper } = sandbox();
		helper.show('draft');
		helper.send('Run a half marathon');
		expect(helper.step).toBe('extra');
		helper.send('By October, and I run twice a week');
		const card = lastCard(helper);
		expect(card?.kind).toBe('prompt');
		expect(card?.kind === 'prompt' && card.text).toContain('- Direction: Run a half marathon');
		expect(card?.kind === 'prompt' && card.text).toContain('October');
		expect(helper.step).toBe('idle');
	});

	it('turns the pasted reply into a draft that keeps the answers', () => {
		const { helper, charts } = sandbox();
		helper.show('draft');
		helper.send('Learn Spanish');
		helper.send('skip');
		helper.send(reply('Hold a conversation in Spanish'));
		expect(helper.messages.at(-2)?.text).toBe('A pasted reply.');
		const card = lastCard(helper);
		expect(card?.kind === 'chart' && card.data.brief?.timeline).toBeUndefined();
		helper.use(helper.messages.at(-1)!.id);
		expect(charts.three?.goal).toBe('Hold a conversation in Spanish');
	});

	it('fills only the empty cells from a reply to the fill prompt', () => {
		const { helper, charts } = sandbox();
		charts.one!.actions[2]![5] = '';
		charts.one!.actions[2]![6] = '';
		helper.show('fill');
		expect(lastCard(helper)?.kind).toBe('prompt');
		const filled = JSON.parse(reply(charts.one!.goal, 'New'));
		helper.send(JSON.stringify(filled));
		const card = lastCard(helper);
		expect(card?.kind === 'cells' && card.edits.map((edit) => edit.key)).toEqual(['a2_5', 'a2_6']);
		helper.use(helper.messages.at(-1)!.id);
		expect(charts.one!.actions[2]![5]).toBe('New 2.5');
		expect(charts.one!.actions[0]![0]).toBe('Easy runs step 1');
	});

	it('hands an open question to a chat app with the chart', () => {
		const { helper } = sandbox();
		helper.send('How do I stay motivated when it rains?');
		const card = lastCard(helper);
		expect(card?.kind === 'prompt' && card.text).toContain('My question: How do I stay motivated when it rains?');
		expect(card?.kind === 'prompt' && card.text).toContain('Run a half marathon');
	});

	it('offers to start a chart for a goal named in passing, and asks the follow-up first', () => {
		const { helper } = sandbox();
		helper.send('I want to learn Slovak, I am A1 and reading is hard');
		expect(helper.chips.map((chip) => chip.label)).toEqual(['Start a chart for it', 'Stay on this chart']);
		helper.choose(helper.chips[0]!);
		expect(helper.step).toBe('extra');
		helper.send('30 minutes a day');
		expect(lastCard(helper)?.kind).toBe('prompt');
	});

	it('starts the draft straight away when the chart has no goal yet', () => {
		const { helper, charts } = sandbox();
		charts.one = chartData('');
		helper.send('I want to learn Slovak, I am A1 and reading is hard');
		expect(helper.chips.map((chip) => chip.label)).not.toContain('Stay on this chart');
		expect(helper.step).toBe('extra');
	});

	it('reviews without offering to rewrite: each line opens for the person to fix', () => {
		const { helper, charts } = sandbox();
		charts.one!.actions[0]![0] = 'Work hard';
		helper.send('review my chart');
		const card = lastCard(helper);
		expect(card?.kind).toBe('findings');
		helper.use(helper.messages.at(-1)!.id);
		expect(helper.messages.at(-1)?.state).toBe('open');
	});
});

