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
		selectedPillar: () => null,
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
		expect(helper.chips.map((chip) => chip.label)).toEqual(['Plan this week', 'Just answer']);
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
