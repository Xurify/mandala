import { describe, expect, it } from 'vitest';
import { A, slotted } from './fixtures.ts';
import type { HelperOffer } from './helper.ts';
import { dateKeyOf, emptyChart, type ActionId, type ChartData } from './model.ts';
import { agentTools, chartForAgent, linesToEdits, modelContext, registerAgentTools, type AgentTool } from './webmcp.ts';

const now = new Date(2026, 9, 14, 9);
const today = dateKeyOf(now);

function chartData(): ChartData {
	const data = slotted(emptyChart());
	data.goal = 'Run a half marathon';
	data.pillars = ['Easy runs', 'Speed', 'Long run', 'Strength', 'Sleep', 'Food', 'Shoes', 'Calendar'];
	data.actions = data.pillars.map((pillar) => Array.from({ length: 8 }, (_, index) => `${pillar} session ${index + 1} on Monday`));
	return data;
}

function sandbox(data = chartData()) {
	const calls = { offers: [] as HelperOffer[], finished: [] as ActionId[], reopened: [] as ActionId[], today: [] as ActionId[][], time: [] as [ActionId, number][] };
	const tools = agentTools({
		data: () => data,
		now: () => now,
		offer: (offer) => calls.offers.push(offer),
		finish: (id) => {
			calls.finished.push(id);
			data.meta = { ...data.meta, [id]: { kind: 'milestone', done: true, doneAt: today } };
		},
		reopen: (id) => calls.reopened.push(id),
		setToday: (ids) => calls.today.push(ids),
		logTime: (id, minutes) => calls.time.push([id, minutes])
	});
	const run = async (name: string, input: Record<string, unknown> = {}) => (tools.find((tool) => tool.name === name) as AgentTool).execute(input);
	return { data, calls, tools, run };
}

describe('agent tools', () => {
	it('reads only, or proposes, or does what a tap does: nothing shares, syncs, exports or deletes', () => {
		const { tools } = sandbox();
		expect(tools.map((tool) => tool.name)).toEqual([
			'read_chart',
			'review_chart',
			'suggest_today',
			'progress',
			'propose_lines',
			'propose_chart',
			'finish_action',
			'reopen_action',
			'set_today',
			'log_time'
		]);
		for (const tool of tools.slice(0, 4)) expect(tool.annotations).toEqual({ readOnlyHint: true, untrustedContentHint: true });
		for (const tool of tools) expect(tool.name).not.toMatch(/share|sync|export|delete|clear/);
	});

	it('reads the chart with cells, ids, and what is done today', () => {
		const { data } = sandbox();
		data.actions[1]![2] = '';
		data.meta = { [A.a0_0]: { kind: 'routine' } };
		data.days = { [today]: { focus: [A.a0_0, A.a1_2], checked: [A.a0_0] } };
		const read = chartForAgent(data, now) as { pillars: { cell: string; actions: { cell: string; id: string; text: string; done?: boolean; kind?: string }[] }[]; today: { picked: string[]; ticked: string[] } };
		expect(read.pillars[0]!.cell).toBe('p0');
		expect(read.pillars[0]!.actions[0]).toEqual({ cell: 'a0_0', id: A.a0_0, text: 'Easy runs session 1 on Monday', kind: 'routine', done: true });
		expect(read.pillars[1]!.actions[2]).toEqual({ cell: 'a1_2', id: A.a1_2, text: '' });
		expect(read.today).toEqual({ date: today, picked: [A.a0_0], ticked: [A.a0_0] });
	});

	it('turns lines into edits, and refuses the goal, a stranger cell, an empty line, and a long one', () => {
		const data = chartData();
		data.actions[2]![3] = '';
		const { edits, refused } = linesToEdits(data, [
			{ cell: 'a2_3', text: '  Run 18 km  on Sunday ' },
			{ cell: 'p1', text: 'Speed' },
			{ cell: 'p4', text: 'Bed by 10:30' },
			{ cell: 'g', text: 'Run a marathon' },
			{ cell: 'a9_9', text: 'Nope' },
			{ cell: 'a0_0', text: ' ' },
			{ cell: 'a0_1', text: 'x'.repeat(49) }
		]);
		expect(edits).toEqual([
			{ key: 'a2_3', before: '', after: 'Run 18 km on Sunday' },
			{ key: 'p4', before: 'Sleep', after: 'Bed by 10:30' }
		]);
		expect(refused.map((entry) => entry.cell)).toEqual(['g', 'a9_9', 'a0_0', 'a0_1']);
	});

	it('proposes lines to Bindu without writing them, with notes on weak ones', async () => {
		const { data, calls, run } = sandbox();
		const result = JSON.parse(await run('propose_lines', { lines: [{ cell: 'a0_0', text: 'Run more' }] }));
		expect(result.shown).toBe(true);
		expect(result.notes[0]).toMatchObject({ cell: 'a0_0' });
		expect(calls.offers).toEqual([{ kind: 'cells', edits: [{ key: 'a0_0', before: 'Easy runs session 1 on Monday', after: 'Run more' }] }]);
		expect(data.actions[0]![0]).toBe('Easy runs session 1 on Monday');
	});

	it('shows nothing when no line changes, and sends a chart with no goal to propose_chart', async () => {
		const { calls, run } = sandbox();
		expect(JSON.parse(await run('propose_lines', { lines: [{ cell: 'p0', text: 'Easy runs' }] })).shown).toBe(false);
		expect(await run('propose_lines', { lines: 'nope' })).toMatch(/Nothing new/);
		const blank = sandbox(slotted(emptyChart()));
		expect(await blank.run('propose_lines', { lines: [{ cell: 'p0', text: 'Easy runs' }] })).toMatch(/propose_chart/);
		expect(calls.offers).toHaveLength(0);
	});

	it('proposes a whole chart only when it is whole', async () => {
		const { calls, run } = sandbox();
		const whole = chartData();
		const input = { goal: 'Learn the cello', pillars: whole.pillars, actions: whole.actions, brief: { timeline: 'By June' } };
		expect(await run('propose_chart', { ...input, pillars: whole.pillars.slice(0, 7) })).toMatch(/^Not shown/);
		expect(await run('propose_chart', input)).toMatch(/^Shown/);
		const offer = calls.offers[0]!;
		expect(offer.kind === 'chart' && offer.data.goal).toBe('Learn the cello');
		expect(offer.kind === 'chart' && offer.data.brief).toEqual({ timeline: 'By June' });
	});

	it('finishes and reopens by id, and says when there is nothing to do', async () => {
		const { calls, run } = sandbox();
		expect(await run('finish_action', { id: 'a0_0' })).toMatch(/not an action id/);
		expect(await run('finish_action', { id: A.a0_0 })).toBe('Finished “Easy runs session 1 on Monday”.');
		expect(await run('finish_action', { id: A.a0_0 })).toMatch(/already done/);
		expect(await run('reopen_action', { id: A.a0_1 })).toMatch(/nothing to reopen/);
		expect(await run('reopen_action', { id: A.a0_0 })).toMatch(/^Reopened/);
		expect(calls).toMatchObject({ finished: [A.a0_0], reopened: [A.a0_0] });
	});

	it('refuses an id for an empty line', async () => {
		const { data, calls, run } = sandbox();
		data.actions[3]![3] = '';
		expect(await run('finish_action', { id: A.a3_3 })).toMatch(/not a written action/);
		expect(await run('set_today', { ids: [A.a0_0, A.a3_3] })).toMatch(/^Today was not changed/);
		expect(calls.finished).toHaveLength(0);
		expect(calls.today).toHaveLength(0);
	});

	it('says a routine is on Today already, and refuses a line finished on another day', async () => {
		const { data, calls, run } = sandbox();
		data.meta = { [A.a0_0]: { kind: 'routine' }, [A.a1_0]: { kind: 'milestone', done: true, doneAt: '2026-10-01' } };
		expect(await run('set_today', { ids: [A.a0_0] })).toMatch(/^Today was not changed\. “Easy runs session 1 on Monday” is a routine/);
		expect(await run('set_today', { ids: [A.a1_0, A.a2_0] })).toBe('Today was not changed. “Speed session 1 on Monday” was finished on another day.');
		expect(await run('set_today', { ids: [A.a0_0, A.a2_0] })).toBe(
			"Today's focus is now: “Long run session 1 on Monday”. “Easy runs session 1 on Monday” is a routine, on Today every day as a habit."
		);
		expect(calls.today).toEqual([[A.a2_0]]);
	});

	it('says when taking an action off today stopped its stopwatch', async () => {
		const { data, run } = sandbox();
		data.timer = { action: A.a3_0, since: now.getTime() - 60_000 };
		expect(await run('set_today', { ids: [A.a2_0] })).not.toMatch(/stopwatch/);
		data.days = { [today]: { focus: [A.a3_0], checked: [] } };
		expect(await run('set_today', { ids: [A.a3_0] })).not.toMatch(/stopwatch/);
		expect(await run('set_today', { ids: [A.a2_0] })).toMatch(/The stopwatch on “Strength session 1 on Monday” stopped/);
	});

	it('sets today without repeats, and logs whole minutes', async () => {
		const { calls, run } = sandbox();
		expect(await run('set_today', { ids: [A.a0_0, A.a2_1, A.a0_0] })).toBe(
			"Today's focus is now: “Easy runs session 1 on Monday”, “Long run session 2 on Monday”."
		);
		expect(calls.today).toEqual([[A.a0_0, A.a2_1]]);
		expect(await run('log_time', { id: A.a0_0, minutes: 0 })).toMatch(/^Not logged/);
		expect(await run('log_time', { id: A.a0_0, minutes: 25.5 })).toMatch(/^Not logged/);
		expect(await run('log_time', { id: A.a0_0, minutes: 25 })).toMatch(/^Logged 25 min/);
		expect(calls.time).toEqual([[A.a0_0, 25]]);
	});

	it("suggests today's three, finds weak lines, and reports progress as JSON", async () => {
		const { data, run } = sandbox();
		data.actions[0]![0] = 'Be healthier';
		data.actions[4]![7] = '';
		const picks = JSON.parse(await run('suggest_today'));
		expect(picks).toHaveLength(3);
		expect(picks[0]).toHaveProperty('why');
		const review = JSON.parse(await run('review_chart'));
		expect(review.weak[0]).toMatchObject({ cell: 'a0_0', text: 'Be healthier' });
		expect(review.emptyActions).toEqual(['a4_7']);
		expect(JSON.parse(await run('progress'))).toMatchObject({ ticks: 0, actionsWritten: 63 });
	});
});

describe('registering with the browser', () => {
	it('finds the model context on document first, then navigator, and nowhere else', () => {
		const registerTool = () => {};
		expect(modelContext({ document: { modelContext: { registerTool } } })).not.toBeNull();
		expect(modelContext({ navigator: { modelContext: { registerTool } } })).not.toBeNull();
		expect(modelContext({ document: {}, navigator: {} })).toBeNull();
		expect(modelContext({ document: { modelContext: {} } })).toBeNull();
	});

	it('registers every tool with the signal, and survives a browser that refuses one', () => {
		const signal = new AbortController().signal;
		const seen: string[] = [];
		const target = sandbox();
		const registered = registerAgentTools(
			{ data: () => target.data, now: () => now, offer: () => {}, finish: () => {}, reopen: () => {}, setToday: () => {}, logTime: () => {} },
			signal,
			{
				registerTool: (tool, options) => {
					expect(options?.signal).toBe(signal);
					seen.push(tool.name);
					if (tool.name === 'progress') throw new Error('nope');
					return Promise.reject(new Error('later'));
				}
			}
		);
		expect(registered).toBe(true);
		expect(seen).toHaveLength(target.tools.length);
		expect(registerAgentTools(target as never, signal, null)).toBe(false);
	});
});
