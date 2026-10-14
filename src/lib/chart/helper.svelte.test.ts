import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Connection, ProviderReply } from './provider.ts';
import { HelperStore, type HelperTarget } from './helper.svelte.ts';
import { A, slotted } from './fixtures.ts';
import { dateKeyOf, emptyChart, setByKey, setMeta, type ActionId, type ChartData } from './model.ts';

const provider = vi.hoisted(() => ({
	saved: null as Connection | null,
	prompts: [] as string[],
	next: [] as ((signal?: AbortSignal) => Promise<ProviderReply>)[]
}));

vi.mock('./provider.ts', () => ({
	loadConnection: () => provider.saved,
	saveConnection: (connection: Connection | null) => (provider.saved = connection),
	sendPrompt: (_connection: Connection, prompt: string, signal?: AbortSignal) => {
		provider.prompts.push(prompt);
		return provider.next.shift()!(signal);
	}
}));

beforeEach(() => {
	provider.saved = null;
	provider.prompts = [];
	provider.next = [];
});

const gemini: Connection = { provider: 'gemini', key: 'AIza-test' };

function chartData(goal: string): ChartData {
	const data = slotted(emptyChart());
	data.goal = goal;
	data.pillars = ['Easy runs', 'Speed', 'Long run', 'Strength', 'Sleep', 'Food', 'Shoes', 'Calendar'];
	data.actions = data.pillars.map((pillar) => Array.from({ length: 8 }, (_, index) => `${pillar} step ${index + 1}`));
	return data;
}

function sandbox() {
	const charts: Record<string, ChartData> = { one: chartData('Run a half marathon'), two: chartData('Learn Spanish') };
	const calls = { declined: [] as ActionId[][], shown: [] as string[], today: [] as ActionId[][] };
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

function reply(data: ChartData, extra: Record<string, unknown> = {}): string {
	return 'Here it is:\n```json\n' + JSON.stringify({ goal: data.goal, pillars: data.pillars, actions: data.actions, ...extra }) + '\n```';
}

describe('HelperStore pages', () => {
	it('opens on the home page and holds the insight it opened with', () => {
		const { helper, charts, calls } = sandbox();
		const today = dateKeyOf(new Date());
		const yesterday = dateKeyOf(new Date(Date.now() - 86_400_000));
		charts.one!.days = { [yesterday]: { focus: [A.a0_0], checked: [A.a0_0] }, [today]: { focus: [A.a1_0], checked: [A.a1_0] } };
		helper.show();
		expect(helper.page).toBe('home');
		expect(helper.lead?.id).toBe('today');
		expect(calls.shown).toHaveLength(1);
		expect(helper.lead?.id).toBe('today');
	});

	it('turns to a page and back, and remembers the direction', () => {
		const { helper } = sandbox();
		helper.show();
		helper.go('progress');
		expect(helper.page).toBe('progress');
		expect(helper.direction).toBe(1);
		expect(helper.mood).toBe('idle');
		helper.back();
		expect(helper.page).toBe('home');
		expect(helper.direction).toBe(-1);
	});

	it('reopens where it was left, so the reply box is waiting', () => {
		const { helper } = sandbox();
		helper.show('write', 'fill');
		helper.markCopied();
		helper.hide();
		helper.show();
		expect(helper.page).toBe('write');
		expect(helper.mood).toBe('curious');
	});

	it('starts over on the home page when the chart changes', () => {
		const { helper, switchTo } = sandbox();
		helper.show('today');
		switchTo('two');
		expect(helper.page).toBe('home');
		expect(helper.picks).toBeNull();
	});
});

describe('HelperStore picks', () => {
	it("deals today's three from different pillars, and puts them on today", () => {
		const { helper, calls } = sandbox();
		helper.show('today');
		const picks = helper.picks!.picks;
		expect(picks).toHaveLength(3);
		expect(new Set(picks.map((pick) => pick.pillarIndex)).size).toBe(3);
		expect(helper.mood).toBe('offering');
		helper.commit();
		expect(calls.today).toEqual([picks.map((pick) => pick.id)]);
		expect(helper.moment?.title).toBe('Today is set');
		expect(helper.moment?.pillars).toEqual(picks.map((pick) => pick.pillarIndex));
		expect(helper.mood).toBe('happy');
		helper.finish();
		expect(helper.open).toBe(false);
		expect(helper.page).toBe('home');
		expect(helper.moment).toBeNull();
	});

	it('swaps one pick for another from an unused pillar, and turns the old one down for today', () => {
		const { helper, calls } = sandbox();
		helper.show('today');
		const [first, ...rest] = helper.picks!.picks;
		helper.swap(first!.id);
		const now = helper.picks!.picks;
		expect(now).toHaveLength(3);
		expect(now.map((pick) => pick.id)).not.toContain(first!.id);
		expect(now.slice(1)).toEqual(rest);
		expect(new Set(now.map((pick) => pick.pillarIndex)).size).toBe(3);
		expect(calls.declined).toEqual([[first!.id]]);
	});

	it('turns down all of today with Not now, and goes home', () => {
		const { helper, calls } = sandbox();
		helper.show('today');
		const keys = helper.picks!.picks.map((pick) => pick.id);
		helper.decline();
		expect(calls.declined).toEqual([keys]);
		expect(helper.page).toBe('home');
	});

	it('pins the week', () => {
		const { helper, charts } = sandbox();
		helper.show('week');
		const keys = helper.picks!.picks.map((pick) => pick.id);
		expect(keys.length).toBeGreaterThanOrEqual(5);
		helper.commit();
		expect(keys.every((key) => charts.one!.meta?.[key]?.pinned)).toBe(true);
		expect(helper.moment?.title).toBe(`${keys.length} pinned for this week`);
	});
});

describe('HelperStore hands writing to a chat app', () => {
	it('picks the prompt that fits: a new chart, the gaps, or a question', () => {
		const { helper, charts } = sandbox();
		helper.show('write');
		expect(helper.mode).toBe('ask');
		charts.one!.actions[2]![5] = '';
		helper.back();
		helper.go('write');
		expect(helper.mode).toBe('fill');
		expect(helper.prompt()).toContain('word for word');
		charts.one = emptyChart();
		helper.back();
		helper.go('write');
		expect(helper.mode).toBe('new');
		helper.goal = 'Learn Slovak';
		expect(helper.prompt()).toContain('My goal: Learn Slovak');
		helper.question = 'Which pillar first?';
		expect(helper.prompt('ask')).toContain('My question: Which pillar first?');
	});

	it('reads a reply for this chart as lines for its empty cells, and keeps only those', () => {
		const { helper, charts } = sandbox();
		const filledIn = structuredClone(charts.one!);
		charts.one!.actions[2]![5] = '';
		charts.one!.actions[3]![0] = '';
		filledIn.actions[2]![5] = 'New 2.5';
		filledIn.actions[3]![0] = 'New 3.0';
		filledIn.actions[0]![0] = 'Rewritten, and ignored';
		helper.show('write', 'fill');
		helper.reply = reply(filledIn);
		expect(helper.outcome).toEqual({
			kind: 'cells',
			edits: [
				{ key: 'a2_5', before: '', after: 'New 2.5' },
				{ key: 'a3_0', before: '', after: 'New 3.0' }
			]
		});
		helper.applyReply();
		expect(charts.one!.actions[2]![5]).toBe('New 2.5');
		expect(charts.one!.actions[0]![0]).toBe('Easy runs step 1');
		expect(helper.moment?.title).toBe('Every line is written');
		expect(helper.moment?.pillars).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
		expect(helper.reply).toBe('');
	});

	it('says so when a reply adds nothing, or is not a chart', () => {
		const { helper, charts } = sandbox();
		helper.show('write');
		helper.reply = reply(charts.one!);
		expect(helper.outcome).toEqual({ kind: 'nothing' });
		helper.reply = 'Sure! What is your goal?';
		expect(helper.outcome).toEqual({ kind: 'unread' });
	});

	it('opens a reply for another goal as a new chart, with what the person said', () => {
		const { helper, charts } = sandbox();
		helper.show('write', 'new');
		const other = structuredClone(charts.two!);
		helper.reply = reply(other, { brief: { timeline: 'By June', situation: 'A2' } });
		expect(helper.outcome?.kind).toBe('chart');
		helper.applyReply();
		expect(charts.three?.goal).toBe('Learn Spanish');
		expect(charts.three?.brief).toEqual({ timeline: 'By June', situation: 'A2' });
		expect(helper.moment?.title).toBe('Your chart is ready');
	});

	it('catches a reply pasted anywhere in the panel', () => {
		const { helper, charts } = sandbox();
		helper.show();
		expect(helper.receive('just some words')).toBe(false);
		expect(helper.page).toBe('home');
		expect(helper.receive(reply(charts.two!))).toBe(true);
		expect(helper.page).toBe('write');
		expect(helper.mode).toBe('new');
		expect(helper.outcome?.kind).toBe('chart');
	});
});

describe('HelperStore with an AI provider', () => {
	it('keeps the connection on the device, and forgets it on request', () => {
		const { helper } = sandbox();
		helper.connect(gemini);
		expect(helper.connection).toEqual(gemini);
		helper.connect(null);
		expect(helper.connection).toBeNull();
	});

	it('sends the prompt a chat app would get, and reads the reply as if it were pasted', async () => {
		const { helper, charts } = sandbox();
		const full = structuredClone(charts.one!);
		charts.one!.actions[2]![5] = '';
		helper.connect(gemini);
		helper.show('write', 'fill');
		provider.next.push(async () => ({ ok: true, text: reply(full) }));
		const sent = helper.send();
		expect(helper.sending).toBe('fill');
		expect(helper.mood).toBe('curious');
		await sent;
		expect(provider.prompts[0]).toContain('Fill every empty string');
		expect(helper.sending).toBeNull();
		expect(helper.outcome).toMatchObject({ kind: 'cells', edits: [{ key: 'a2_5', before: '' }] });
		expect(helper.repliedBy).toBe('provider');
		helper.reply = reply(full).replace('Here it is', 'Pasted');
		expect(helper.repliedBy).toBe('paste');
	});

	it('writes a new chart without asking questions first', async () => {
		const { helper } = sandbox();
		helper.connect(gemini);
		helper.show('write', 'new');
		helper.goal = 'Learn Spanish';
		provider.next.push(async () => ({ ok: true, text: reply(chartData('Speak Spanish at work')) }));
		await helper.send();
		expect(provider.prompts[0]).toContain('Do not ask me anything');
		expect(helper.outcome?.kind).toBe('chart');
	});

	it('shows an answer for a question, and says why a request failed', async () => {
		const { helper } = sandbox();
		helper.connect(gemini);
		helper.show('write', 'ask');
		helper.question = 'Which pillar first?';
		provider.next.push(async () => ({ ok: true, text: 'Start with Sleep.' }));
		await helper.send();
		expect(helper.askAnswer).toBe('Start with Sleep.');
		expect(helper.reply).toBe('');
		provider.next.push(async () => ({ ok: false, reason: 'Gemini is busy, or this key hit its limit. Try again in a minute.' }));
		await helper.send();
		expect(helper.sendError).toContain('Gemini is busy');
		expect(helper.askAnswer).toBe('');
	});

	it('drops a reply that comes back after Stop', async () => {
		const { helper, charts } = sandbox();
		helper.connect(gemini);
		helper.show('write', 'review');
		let finish: (value: ProviderReply) => void = () => {};
		provider.next.push(() => new Promise((resolve) => (finish = resolve)));
		const sent = helper.send();
		helper.cancel();
		expect(helper.sending).toBeNull();
		finish({ ok: true, text: reply(charts.one!) });
		await sent;
		expect(helper.reply).toBe('');
		expect(helper.sendError).toBe('');
	});
});
