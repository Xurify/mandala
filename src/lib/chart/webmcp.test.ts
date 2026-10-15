import { describe, expect, it } from 'vitest';
import type { Lane } from './board.ts';
import { A, slotted } from './fixtures.ts';
import type { HelperOffer } from './helper.ts';
import { dateKeyOf, emptyChart, weekStartKey, type ActionId, type ActionMeta, type ChartData, type ToolKind } from './model.ts';
import { agentTools, chartForAgent, kindsToChanges, linesToEdits, modelContext, registerAgentTools, type AgentTarget, type AgentTool, type LinkPatch } from './webmcp.ts';

const now = new Date(2026, 9, 14, 9);
const today = dateKeyOf(now);

function chartData(): ChartData {
	const data = slotted(emptyChart());
	data.goal = 'Run a half marathon';
	data.pillars = ['Easy runs', 'Speed', 'Long run', 'Strength', 'Sleep', 'Food', 'Shoes', 'Calendar'];
	data.actions = data.pillars.map((pillar) => Array.from({ length: 8 }, (_, index) => `${pillar} session ${index + 1} on Monday`));
	return data;
}

function sandbox(data = chartData(), binduOn = true) {
	const calls = {
		offers: [] as HelperOffer[],
		finished: [] as ActionId[],
		reopened: [] as ActionId[],
		today: [] as ActionId[][],
		tomorrow: [] as ActionId[][],
		pinned: [] as [ActionId[], boolean][],
		moved: [] as [ActionId, Lane, number][],
		time: [] as ([ActionId, number] | [ActionId, number, string])[],
		timers: [] as ([ActionId, number | undefined] | [ActionId, number | undefined, string])[],
		stopped: 0,
		links: [] as [number, string, string, ToolKind][],
		changed: [] as [number, string, LinkPatch][]
	};
	const target: AgentTarget = {
		data: () => data,
		now: () => now,
		reflectionWeek: () => weekStartKey(now),
		offer: (offer) => (calls.offers.push(offer), binduOn),
		finish: (id) => {
			calls.finished.push(id);
			data.meta = { ...data.meta, [id]: { kind: 'milestone', done: true, doneAt: today } };
		},
		reopen: (id) => calls.reopened.push(id),
		setToday: (ids) => calls.today.push(ids),
		planTomorrow: (ids) => calls.tomorrow.push(ids),
		pin: (ids, pinned) => calls.pinned.push([ids, pinned]),
		moveCard: (id, lane, index) => (calls.moved.push([id, lane, index]), true),
		logTime: (id, minutes, link) => calls.time.push(link ? [id, minutes, link] : [id, minutes]),
		startTimer: (id, minutes, link) => calls.timers.push(link ? [id, minutes, link] : [id, minutes]),
		stopTimer: () => {
			calls.stopped += 1;
			delete data.timer;
		},
		addLink: (pillarIndex, url, title, kind) => calls.links.push([pillarIndex, url, title, kind]),
		updateLink: (pillarIndex, id, patch) => {
			calls.changed.push([pillarIndex, id, patch]);
			const key = `p${pillarIndex}`;
			data.tools = { ...data.tools, [key]: (data.tools?.[key] ?? []).map((tool) => (tool.id === id ? { ...tool, ...patch } : tool)) };
		}
	};
	const tools = agentTools(target);
	const run = async (name: string, input: Record<string, unknown> = {}) => (tools.find((tool) => tool.name === name) as AgentTool).execute(input);
	return { data, calls, tools, target, run };
}

describe('agent tools', () => {
	it('reads only, or proposes, or does what a tap does: nothing shares, syncs, exports or deletes', () => {
		const { tools } = sandbox();
		expect(tools.map((tool) => tool.name)).toEqual([
			'read_chart',
			'review_chart',
			'suggest_today',
			'progress',
			'week_history',
			'read_shelves',
			'propose_lines',
			'propose_chart',
			'propose_kinds',
			'propose_reflection',
			'finish_action',
			'reopen_action',
			'set_today',
			'plan_tomorrow',
			'pin_actions',
			'move_card',
			'log_time',
			'start_timer',
			'stop_timer',
			'add_shelf_link',
			'update_shelf_link'
		]);
		for (const tool of tools.slice(0, 6)) expect(tool.annotations).toEqual({ readOnlyHint: true, untrustedContentHint: true });
		for (const tool of tools.slice(6)) expect(tool.annotations.readOnlyHint).toBeUndefined();
		for (const tool of tools) expect(tool.name).not.toMatch(/share|sync|export|delete|clear/);
	});

	it('reads the chart with cells, ids, and what is done today', () => {
		const { data } = sandbox();
		data.actions[1]![2] = '';
		data.meta = { [A.a0_0]: { kind: 'routine' } };
		data.days = { [today]: { focus: [A.a0_0, A.a1_2], checked: [A.a0_0] } };
		data.tools = { p1: [{ id: 'tool_1', url: 'https://example.com/drills', title: 'Drills', kind: 'repeat' }] };
		data.timer = { action: A.a2_0, since: now.getTime() - 12 * 60_000, length: 25 };
		type Read = {
			pillars: { cell: string; shelf: unknown[]; actions: { cell: string; id: string; text: string; done?: boolean; kind?: string; lane?: string }[] }[];
			today: { picked: string[]; ticked: string[] };
			timer: unknown;
		};
		const read = chartForAgent(data, now) as Read;
		expect(read.pillars[0]!.cell).toBe('p0');
		expect(read.pillars[0]!.actions[0]).toEqual({ cell: 'a0_0', id: A.a0_0, text: 'Easy runs session 1 on Monday', kind: 'routine', lane: 'doing', done: true });
		expect(read.pillars[0]!.actions[1]).toMatchObject({ kind: 'standard', lane: 'open' });
		expect(read.pillars[1]!.actions[2]).toEqual({ cell: 'a1_2', id: A.a1_2, text: '' });
		expect(read.pillars[1]!.shelf).toEqual([{ id: 'tool_1', title: 'Drills', url: 'https://example.com/drills' }]);
		expect(read.today).toEqual({ date: today, picked: [A.a0_0], ticked: [A.a0_0] });
		expect(read.timer).toEqual({ action: A.a2_0, blockMinutes: 25, minutesSoFar: 12 });
	});

	it('turns lines into edits, and refuses the goal, a stranger cell, an empty line, and one past the cell limit', () => {
		const data = chartData();
		data.actions[2]![3] = '';
		const { edits, refused } = linesToEdits(data, [
			{ cell: 'a2_3', text: '  Run 18 km  on Sunday ' },
			{ cell: 'p1', text: 'Speed' },
			{ cell: 'p4', text: 'Bed by 10:30' },
			{ cell: 'g', text: 'Run a marathon' },
			{ cell: 'a9_9', text: 'Nope' },
			{ cell: 'a0_0', text: ' ' },
			{ cell: 'a0_1', text: 'x'.repeat(121) },
			{ cell: 'a0_2', text: 'Laufe jeden Dienstagmorgen vor der Arbeit fünf Kilometer ruhig' }
		]);
		expect(edits).toEqual([
			{ key: 'a2_3', before: '', after: 'Run 18 km on Sunday' },
			{ key: 'p4', before: 'Sleep', after: 'Bed by 10:30' },
			{ key: 'a0_2', before: 'Easy runs session 3 on Monday', after: 'Laufe jeden Dienstagmorgen vor der Arbeit fünf Kilometer ruhig' }
		]);
		expect(refused.map((entry) => entry.cell)).toEqual(['g', 'a9_9', 'a0_0', 'a0_1']);
	});

	it('proposes lines to Bindu without writing them', async () => {
		const { data, calls, run } = sandbox();
		const result = JSON.parse(await run('propose_lines', { lines: [{ cell: 'a0_0', text: 'Run more' }] }));
		expect(result).toMatchObject({ shown: true, refused: [] });
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

	it('says so when Bindu is off, instead of claiming it showed anything', async () => {
		const { run } = sandbox(chartData(), false);
		expect(await run('propose_lines', { lines: [{ cell: 'a0_0', text: 'Run 5 km on Tuesday' }] })).toMatch(/^Not shown: Bindu is turned off/);
		expect(await run('propose_reflection', { note: 'A good week.' })).toMatch(/^Not shown: Bindu is turned off/);
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
		const { calls, run, data } = sandbox();
		expect(await run('set_today', { ids: [A.a0_0, A.a2_1, A.a0_0] })).toBe(
			"Today's focus is now: “Easy runs session 1 on Monday”, “Long run session 2 on Monday”."
		);
		expect(calls.today).toEqual([[A.a0_0, A.a2_1]]);
		expect(await run('log_time', { id: A.a0_0, minutes: 0 })).toMatch(/^Not logged/);
		expect(await run('log_time', { id: A.a0_0, minutes: 25.5 })).toMatch(/^Not logged/);
		expect(await run('log_time', { id: A.a0_0, minutes: 25 })).toMatch(/^Logged 25 min/);
		expect(calls.time).toEqual([[A.a0_0, 25]]);

		data.tools = {
			p1: [{ id: 'tool_1', url: 'https://example.com/drills', title: 'Drills', kind: 'repeat' }]
		};
		expect(await run('log_time', { id: A.a1_0, minutes: 30, link: 'tool_missing' })).toBe('“tool_missing” is not a link on this chart\'s shelves.');
		expect(await run('log_time', { id: A.a0_0, minutes: 30, link: 'tool_1' })).toBe('“Drills” is on Speed\'s shelf, not Easy runs.');
		expect(await run('log_time', { id: A.a1_0, minutes: 30, link: 'tool_1' })).toBe('Logged 30 min on “Speed session 1 on Monday” (Drills).');
		expect(calls.time[1]).toEqual([A.a1_0, 30, 'tool_1']);
	});

	it("suggests today's three, hands the review to the agent with the method, and reports progress as JSON", async () => {
		const { data, run } = sandbox();
		data.actions[0]![0] = 'Mehr laufen';
		data.actions[4]![7] = '';
		const picks = JSON.parse(await run('suggest_today'));
		expect(picks).toHaveLength(3);
		expect(picks[0]).toHaveProperty('why');
		const review = JSON.parse(await run('review_chart'));
		expect(review.method).toContain('[Tests]');
		expect(review.method).not.toContain('Return only this JSON');
		expect(review.pillars[0].actions[0]).toEqual({ cell: 'a0_0', text: 'Mehr laufen' });
		expect(review.pillars[4].actions).toHaveLength(7);
		expect(review.emptyActions).toEqual(['a4_7']);
		expect(JSON.parse(await run('progress'))).toMatchObject({ ticks: 0, actionsWritten: 63 });
	});

	it('plans tomorrow by the same rules as today', async () => {
		const { data, calls, run } = sandbox();
		data.meta = { [A.a0_0]: { kind: 'routine' } };
		data.timer = { action: A.a1_0, since: now.getTime() };
		data.days = { [today]: { focus: [A.a1_0], checked: [] } };
		expect(await run('plan_tomorrow', { ids: [A.a0_0] })).toMatch(/^Tomorrow was not changed/);
		expect(await run('plan_tomorrow', { ids: [A.a2_0, A.a3_0] })).toBe(
			"Tomorrow's focus is now: “Long run session 1 on Monday”, “Strength session 1 on Monday”."
		);
		expect(calls.tomorrow).toEqual([[A.a2_0, A.a3_0]]);
		expect(calls.today).toEqual([]);
	});

	it('pins and unpins, skipping what is already so', async () => {
		const { data, calls, run } = sandbox();
		data.meta = { [A.a0_0]: { kind: 'routine', pinned: true } };
		expect(await run('pin_actions', { ids: [A.a0_0] })).toBe('Every action given is already pinned.');
		expect(await run('pin_actions', { ids: [A.a0_0, A.a1_0] })).toBe('Pinned “Speed session 1 on Monday”.');
		expect(await run('pin_actions', { ids: [A.a0_0], pinned: false })).toBe('Unpinned “Easy runs session 1 on Monday”.');
		expect(await run('pin_actions', { ids: ['nope'] })).toMatch(/^Nothing was pinned/);
		expect(calls.pinned).toEqual([
			[[A.a1_0], true],
			[[A.a0_0], false]
		]);
	});

	it('moves a card to the end of a lane, and never a routine to Done', async () => {
		const { data, calls, run } = sandbox();
		data.meta = { [A.a0_0]: { kind: 'routine' }, [A.a1_0]: { lane: 'todo', rank: 0 } as ActionMeta };
		expect(await run('move_card', { id: A.a0_0, lane: 'done' })).toMatch(/is a routine, so it never goes to Done/);
		expect(await run('move_card', { id: A.a2_0, lane: 'later' })).toMatch(/^Lane must be one of open, todo, doing, done/);
		expect(await run('move_card', { id: A.a2_0, lane: 'todo' })).toBe('Moved “Long run session 1 on Monday” to To do.');
		expect(await run('move_card', { id: A.a3_0, lane: 'todo', index: 0 })).toMatch(/^Moved/);
		expect(calls.moved).toEqual([
			[A.a2_0, 'todo', 1],
			[A.a3_0, 'todo', 0]
		]);
	});

	it('starts a stopwatch or a block, says what it stopped, and stops one', async () => {
		const { data, calls, run } = sandbox();
		expect(await run('stop_timer')).toBe('No timer is running.');
		expect(await run('start_timer', { id: A.a0_0 })).toBe('Started a stopwatch on “Easy runs session 1 on Monday”.');
		expect(await run('start_timer', { id: A.a0_0, minutes: 500 })).toMatch(/^Not started/);
		data.timer = { action: A.a1_0, since: now.getTime() - 9 * 60_000 };
		expect(await run('start_timer', { id: A.a0_0, minutes: 25 })).toBe(
			'Started a 25-minute block on “Easy runs session 1 on Monday”. The timer on “Speed session 1 on Monday” stopped, and its time was logged.'
		);
		expect(calls.timers).toEqual([
			[A.a0_0, undefined],
			[A.a0_0, 25]
		]);
		expect(await run('stop_timer')).toBe('Stopped the timer on “Speed session 1 on Monday”, and logged its time.');
		data.timer = { action: A.a2_0, since: now.getTime() - 20_000 };
		expect(await run('stop_timer')).toBe('Stopped the timer on “Long run session 1 on Monday”. It ran under a minute, so nothing was logged.');
		expect(calls.stopped).toBe(2);
	});

	it("saves a link to a pillar's shelf once, and only a web link", async () => {
		const { data, calls, run } = sandbox();
		data.tools = { p1: [{ id: 'tool_1', url: 'https://example.com/drills', title: 'Drills', kind: 'repeat' }] };
		expect(await run('add_shelf_link', { pillar: 9, url: 'https://example.com' })).toMatch(/^Not saved. Pillar/);
		expect(await run('add_shelf_link', { pillar: 1, url: 'javascript:alert(1)' })).toMatch(/^Not saved. Give an http/);
		expect(await run('add_shelf_link', { pillar: 1, url: 'https://example.com/drills' })).toBe("That link is already on Speed's shelf.");
		expect(await run('add_shelf_link', { pillar: 1, url: ' https://example.com/intervals ', title: ' Interval  guide ', kind: 'once' })).toBe("Saved to Speed's shelf.");
		expect(await run('add_shelf_link', { pillar: 1, url: 'https://example.com/forever', kind: 'always' })).toMatch(/^Not saved. Kind must be/);
		expect(await run('add_shelf_link', { pillar: 2, url: 'https://example.com/dictionary', kind: 'staple' })).toBe("Saved to Long run's shelf.");
		expect(calls.links).toEqual([
			[1, 'https://example.com/intervals', 'Interval guide', 'once'],
			[2, 'https://example.com/dictionary', '', 'staple']
		]);
	});

	it('reads each shelf: kind, known, who hands a link out, and what Today hands out', async () => {
		const { data, run } = sandbox();
		data.meta = { [A.a1_0]: { kind: 'routine' } };
		data.tools = {
			p1: [
				{ id: 'tool_1', url: 'https://example.com/drills', title: 'Drills', kind: 'repeat', opened: [today] },
				{ id: 'tool_2', url: 'https://example.com/pace', title: 'Pace chart', kind: 'staple', action: A.a1_3 },
				{ id: 'tool_3', url: 'https://example.com/old', title: 'Old plan', kind: 'once', known: true }
			],
			p4: [{ id: 'tool_4', url: 'https://example.com/sleep', title: 'Sleep talk', kind: 'repeat' }]
		};
		const shelves = JSON.parse(await run('read_shelves')) as { pillar: number; links: Record<string, unknown>[] }[];
		expect(shelves.map((shelf) => shelf.pillar)).toEqual([1, 4]);
		expect(shelves[0]!.links).toEqual([
			{ id: 'tool_1', title: 'Drills', url: 'https://example.com/drills', kind: 'repeat', handedOutBy: 'any routine', upNextFor: A.a1_0, openedDaysOfLast14: 1 },
			{ id: 'tool_2', title: 'Pace chart', url: 'https://example.com/pace', kind: 'staple', handedOutBy: A.a1_3, upNextFor: A.a1_3, openedDaysOfLast14: 0 },
			{ id: 'tool_3', title: 'Old plan', url: 'https://example.com/old', kind: 'once', known: true, handedOutBy: 'any routine', openedDaysOfLast14: 0 }
		]);
		expect(shelves[1]!.links[0]).toMatchObject({ handedOutBy: null });
	});

	it('changes how a link comes round, and refuses a known staple or an action from another pillar', async () => {
		const { data, calls, run } = sandbox();
		data.tools = { p1: [{ id: 'tool_1', url: 'https://example.com/drills', title: 'Drills', kind: 'repeat', known: true }] };
		expect(await run('update_shelf_link', { id: 'tool_9', kind: 'staple' })).toMatch(/is not a link on this chart/);
		expect(await run('update_shelf_link', { id: 'tool_1', kind: 'forever' })).toMatch(/^Not changed. Kind must be/);
		expect(await run('update_shelf_link', { id: 'tool_1', kind: 'staple', known: true })).toMatch(/is a staple, which stays in rotation/);
		expect(await run('update_shelf_link', { id: 'tool_1', action: A.a2_0 })).toMatch(/is not in Speed/);
		expect(await run('update_shelf_link', { id: 'tool_1', known: true, action: 'any' })).toBe('“Drills” already comes round that way. Nothing changed.');
		expect(calls.changed).toEqual([]);
		expect(await run('update_shelf_link', { id: 'tool_1', known: false, action: A.a1_2 })).toBe(
			"“Drills” on Speed's shelf is now a repeat link, handed out by “Speed session 3 on Monday”."
		);
		expect(await run('update_shelf_link', { id: 'tool_1', kind: 'staple', action: 'any' })).toBe("“Drills” on Speed's shelf is now a staple, handed out by any routine in its pillar.");
		expect(calls.changed).toEqual([
			[1, 'tool_1', { known: undefined, action: A.a1_2 }],
			[1, 'tool_1', { kind: 'staple', action: undefined }]
		]);
	});
});

describe('kinds and the week', () => {
	it('turns kinds into changes, and leaves a finished milestone and a stranger id alone', () => {
		const data = chartData();
		data.meta = { [A.a0_0]: { kind: 'routine' }, [A.a1_0]: { kind: 'milestone', done: true, doneAt: '2026-10-01' } };
		const { changes, refused } = kindsToChanges(data, [
			{ id: A.a0_0, kind: 'routine' },
			{ id: A.a0_1, kind: 'routine' },
			{ id: A.a0_0, kind: 'standard' },
			{ id: A.a1_0, kind: 'routine' },
			{ id: A.a2_0, kind: 'daily' },
			{ id: 'nope', kind: 'routine' }
		]);
		expect(changes).toEqual([
			{ id: A.a0_1, text: 'Easy runs session 2 on Monday', pillarIndex: 0, before: undefined, after: 'routine' },
			{ id: A.a0_0, text: 'Easy runs session 1 on Monday', pillarIndex: 0, before: 'routine', after: undefined }
		]);
		expect(refused.map((entry) => entry.id)).toEqual([A.a1_0, A.a2_0, 'nope']);
	});

	it('proposes kinds and a note for the week to Bindu, and nothing that would not change', async () => {
		const { data, calls, run } = sandbox();
		expect(JSON.parse(await run('propose_kinds', { kinds: [{ id: A.a0_0, kind: 'standard' }] })).shown).toBe(false);
		expect(JSON.parse(await run('propose_kinds', { kinds: [{ id: A.a0_0, kind: 'routine' }] })).shown).toBe(true);
		const week = weekStartKey(now);
		data.weeks = { [week]: { note: 'Keep Tuesdays' } };
		expect(await run('propose_reflection', { note: ' ' })).toMatch(/^Not shown/);
		expect(await run('propose_reflection', { note: 'Keep Tuesdays' })).toMatch(/already the note/);
		expect(await run('propose_reflection', { note: 'Two easy runs held. Next week, add the long run back.' })).toMatch(/^Shown/);
		expect(calls.offers.map((offer) => offer.kind)).toEqual(['kinds', 'note']);
		expect(calls.offers[1]).toEqual({ kind: 'note', weekKey: week, before: 'Keep Tuesdays', after: 'Two easy runs held. Next week, add the long run back.' });
	});

	it('reads a week: ticks by day, milestones finished, minutes per pillar, and its note', async () => {
		const { data, run } = sandbox();
		const week = weekStartKey(now);
		data.days = {
			[week]: { focus: [], checked: [A.a0_0], sessions: [{ action: A.a0_0, at: '07:00', minutes: 30 }] },
			[today]: { focus: [], checked: [A.a1_0], sessions: [{ action: A.a0_1, at: '07:00', minutes: 15 }] },
			'2026-09-01': { focus: [], checked: [A.a3_0] }
		};
		data.meta = { [A.a1_0]: { kind: 'milestone', done: true, doneAt: today } };
		data.weeks = { [week]: { note: 'Tuesdays are good' } };
		const read = JSON.parse(await run('week_history'));
		expect(read).toMatchObject({
			from: week,
			to: today,
			ticksByDay: { [week]: ['Easy runs session 1 on Monday'], [today]: ['Speed session 1 on Monday'] },
			finished: ['Speed session 1 on Monday'],
			minutesByPillar: { 'Easy runs': 45 },
			note: 'Tuesdays are good',
			reflectionDue: true
		});
		expect(JSON.parse(await run('week_history', { weeksAgo: 1 })).ticksByDay).toEqual({});
		expect(await run('week_history', { weeksAgo: 40 })).toMatch(/^weeksAgo must be/);
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
			target.target,
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
