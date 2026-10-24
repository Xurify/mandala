import { describe, expect, it } from 'vitest';
import { A, slotted } from '../fixtures.ts';
import { emptyChart, idAt, setByKey, type ChartData } from '../model.ts';
import { clashesOf, overlayDay, overlayLocalEdits, putWords } from './sync.ts';

function chartWith(goal: string, pillar0 = ''): ChartData {
	const data = slotted(emptyChart());
	data.goal = goal;
	data.pillars[0] = pillar0;
	return data;
}

describe('overlayLocalEdits', () => {
	it('keeps the server copy when the device changed nothing', () => {
		const base = chartWith('Server goal', 'Health');
		const edited = structuredClone(base);
		const server = chartWith('Edited on the other device', 'Health');
		server.pillars[1] = 'New there';

		const merged = overlayLocalEdits(base, edited, server);
		expect(merged.goal).toBe('Edited on the other device');
		expect(merged.pillars[1]).toBe('New there');
	});

	it('applies only the cells this device edited onto the server copy', () => {
		const base = chartWith('Old goal', 'Health');
		base.pillars[1] = 'Untouched';
		const edited = structuredClone(base);
		edited.goal = 'Locally edited goal';
		edited.pillars[2] = 'New action';

		const server = chartWith('Server edited the goal too', 'Health');
		server.pillars[1] = 'Untouched';
		server.pillars[3] = 'New over there';

		const merged = overlayLocalEdits(base, edited, server);
		expect(merged.goal).toBe('Locally edited goal');
		expect(merged.pillars[2]).toBe('New action');
		expect(merged.pillars[3]).toBe('New over there');
		expect(merged.pillars[1]).toBe('Untouched');
	});

	it('moves site icons by host: this device adds and removes, the server keeps the rest', () => {
		const png = 'data:image/png;base64,iVBORw0KGgo=';
		const base = chartWith('Goal');
		base.icons = { 'old.example': png };
		const edited = structuredClone(base);
		edited.icons = { 'readline.app': png };
		const server = chartWith('Goal');
		server.icons = { 'old.example': png, 'there.example': png };

		expect(overlayLocalEdits(base, edited, server).icons).toEqual({ 'there.example': png, 'readline.app': png });
	});

	it('lets the device win when both sides edited the same cell', () => {
		const base = chartWith('Base', '');
		const edited = chartWith('Device edit', '');
		const server = chartWith('Server edit', '');

		expect(overlayLocalEdits(base, edited, server).goal).toBe('Device edit');
	});

	it('applies locally added and removed meta, day logs, and week notes', () => {
		const base = slotted(emptyChart());
		base.meta = { [A.a0_1]: { kind: 'routine', done: false } };
		base.days = { '2026-10-01': { focus: [A.a0_1], checked: [] } };

		const edited = structuredClone(base);
		edited.meta![A.a0_2] = { kind: 'milestone', done: true };
		delete edited.days!['2026-10-01'];
		edited.weeks = { '2026-09-28': { note: 'Wrote a note' } };

		const server = slotted(emptyChart());
		server.meta = { [A.a3_0]: { kind: 'milestone', done: true } };
		server.days = { '2026-10-02': { focus: [A.a3_0], checked: [] } };

		const merged = overlayLocalEdits(base, edited, server);
		expect(merged.meta?.[A.a0_2]).toEqual({ kind: 'milestone', done: true });
		expect(merged.meta?.[A.a3_0]).toEqual({ kind: 'milestone', done: true });
		expect(merged.days?.['2026-10-01']).toBeUndefined();
		expect(merged.days?.['2026-10-02']).toEqual({ focus: [A.a3_0], checked: [] });
		expect(merged.weeks?.['2026-09-28']?.note).toBe('Wrote a note');
	});

	it('carries a brief this device added', () => {
		const base = slotted(emptyChart());
		const edited = structuredClone(base);
		edited.brief = { timeline: 'October' };
		const server = chartWith('Newer there');
		server.brief = { timeline: 'March' };

		expect(overlayLocalEdits(base, edited, server).brief).toEqual({ timeline: 'October' });
		expect(overlayLocalEdits(base, structuredClone(base), server).brief).toEqual({ timeline: 'March' });
	});

	it('carries a clock this device started or stopped', () => {
		const base = emptyChart();
		const started = structuredClone(base);
		started.timer = { action: A.a0_0, since: 1_000 };
		const server = chartWith('Newer there');
		expect(overlayLocalEdits(base, started, server).timer).toEqual({ action: A.a0_0, since: 1_000 });

		const running = structuredClone(server);
		running.timer = { action: A.a0_0, since: 1_000 };
		const stopped = structuredClone(running);
		delete stopped.timer;
		expect(overlayLocalEdits(running, stopped, running).timer).toBeUndefined();
	});

	it('does not mutate the server copy it was given', () => {
		const base = chartWith('Base', '');
		const edited = chartWith('Device edit', '');
		const server = chartWith('Server copy', '');

		const merged = overlayLocalEdits(base, edited, server);
		expect(merged).not.toBe(server);
		expect(server.goal).toBe('Server copy');
	});

	it('carries a line cleared on this device, and leaves the tick the other device made on the old one', () => {
		const base = chartWith('Run', 'Training');
		base.actions[0]![0] = 'Run 3 km';
		const edited = structuredClone(base);
		setByKey(edited, 'a0_0', '');
		setByKey(edited, 'a0_0', 'Swim 1 km');
		const server = structuredClone(base);
		server.days = { '2026-10-02': { focus: [], checked: [A.a0_0] } };

		const merged = overlayLocalEdits(base, edited, server);
		expect(merged.actions[0]![0]).toBe('Swim 1 km');
		expect(idAt(merged, 0, 0)).toBe(idAt(edited, 0, 0));
		expect(idAt(merged, 0, 0)).not.toBe(A.a0_0);
		expect(merged.days?.['2026-10-02']?.checked).toEqual([A.a0_0]);
	});
});

describe('overlayDay', () => {
	it('keeps a tick from each device on the same day', () => {
		const base = { focus: [A.a0_0, A.a1_0], checked: [] };
		const phone = { focus: [A.a0_0, A.a1_0], checked: [A.a0_0], at: { [A.a0_0]: '07:10' } };
		const laptop = { focus: [A.a0_0, A.a1_0], checked: [A.a1_0], at: { [A.a1_0]: '09:30' } };
		const merged = overlayDay(base, phone, laptop);
		expect(merged.checked).toEqual([A.a1_0, A.a0_0]);
		expect(merged.at).toEqual({ [A.a1_0]: '09:30', [A.a0_0]: '07:10' });
	});

	it('takes off what this device took off, and leaves what the other added', () => {
		const base = { focus: [A.a0_0, A.a1_0], checked: [A.a0_0], at: { [A.a0_0]: '07:10' } };
		const edited = { focus: [A.a1_0], checked: [], dropped: [A.a0_0] };
		const server = { focus: [A.a0_0, A.a1_0, A.a2_0], checked: [A.a0_0], at: { [A.a0_0]: '07:10' }, wrote: [A.a3_0] };
		const merged = overlayDay(base, edited, server);
		expect(merged.focus).toEqual([A.a1_0, A.a2_0]);
		expect(merged.checked).toEqual([]);
		expect(merged.at).toBeUndefined();
		expect(merged.dropped).toEqual([A.a0_0]);
		expect(merged.wrote).toEqual([A.a3_0]);
	});

	it('keeps sessions logged on both devices, once each', () => {
		const one = { action: A.a0_0, at: '07:00', minutes: 20 };
		const two = { action: A.a1_0, at: '18:00', minutes: 30 };
		const base = { focus: [], checked: [], sessions: [one] };
		const merged = overlayDay(base, { focus: [], checked: [], sessions: [one, two] }, { focus: [], checked: [], sessions: [one, { ...one, at: '12:00' }] });
		expect(merged.sessions).toEqual([one, { ...one, at: '12:00' }, two]);
	});

	it('is the device\'s day when the server has none', () => {
		const edited = { focus: [A.a0_0], checked: [A.a0_0], started: true };
		expect(overlayDay(undefined, edited, undefined)).toEqual(edited);
	});

	it('merges days inside overlayLocalEdits', () => {
		const base = chartWith('Goal');
		base.days = { '2026-10-21': { focus: [A.a0_0, A.a1_0], checked: [] } };
		const edited = structuredClone(base);
		edited.days!['2026-10-21']!.checked = [A.a0_0];
		const server = structuredClone(base);
		server.days!['2026-10-21']!.checked = [A.a1_0];
		expect(overlayLocalEdits(base, edited, server).days?.['2026-10-21']?.checked).toEqual([A.a1_0, A.a0_0]);
	});
});

describe('overlayLocalEdits removals', () => {
	it('removes what this device removed, even when its whole group is gone', () => {
		const base = chartWith('Goal');
		base.weeks = { '2026-10-19': { note: 'Old note' } };
		base.days = { '2026-10-21': { focus: [A.a0_0], checked: [] } };
		const edited = structuredClone(base);
		delete edited.weeks;
		delete edited.days!['2026-10-21'];
		const merged = overlayLocalEdits(base, edited, structuredClone(base));
		expect(merged.weeks?.['2026-10-19']).toBeUndefined();
		expect(merged.days && '2026-10-21' in merged.days).toBe(false);
	});
});

describe('overlayLocalEdits, field by field', () => {
	it('keeps an action pinned on one device and moved on the board on the other', () => {
		const base = chartWith('Goal');
		base.meta = { [A.a0_0]: { kind: 'milestone' } };
		const edited = structuredClone(base);
		edited.meta![A.a0_0] = { kind: 'milestone', pinned: true };
		const server = structuredClone(base);
		server.meta![A.a0_0] = { kind: 'milestone', lane: 'doing', rank: 0 };
		expect(overlayLocalEdits(base, edited, server).meta?.[A.a0_0]).toEqual({ kind: 'milestone', lane: 'doing', rank: 0, pinned: true });
	});

	it('takes a field off when this device took it off', () => {
		const base = chartWith('Goal');
		base.meta = { [A.a0_0]: { kind: 'milestone', pinned: true } };
		const edited = structuredClone(base);
		edited.meta![A.a0_0] = { kind: 'milestone' };
		expect(overlayLocalEdits(base, edited, structuredClone(base)).meta?.[A.a0_0]).toEqual({ kind: 'milestone' });
	});

	it('merges a shelf by link: added here, renamed there, opened on both', () => {
		const tool = { id: 'tool_a', url: 'https://example.com/a', title: 'A', kind: 'repeat' as const, opened: ['2026-10-01'] };
		const base = chartWith('Goal');
		base.tools = { p0: [tool] };
		const edited = structuredClone(base);
		edited.tools!.p0 = [{ ...tool, opened: ['2026-10-01', '2026-10-20'] }, { id: 'tool_b', url: 'https://example.com/b', title: 'B', kind: 'once' }];
		const server = structuredClone(base);
		server.tools!.p0 = [{ ...tool, title: 'Renamed', opened: ['2026-10-01', '2026-10-21'] }];
		expect(overlayLocalEdits(base, edited, server).tools?.p0).toEqual([
			{ ...tool, title: 'Renamed', opened: ['2026-10-01', '2026-10-20', '2026-10-21'] },
			{ id: 'tool_b', url: 'https://example.com/b', title: 'B', kind: 'once' }
		]);
	});

	it('moves a link to another shelf', () => {
		const tool = { id: 'tool_a', url: 'https://example.com/a', title: 'A', kind: 'repeat' as const };
		const base = chartWith('Goal');
		base.tools = { p0: [tool] };
		const edited = structuredClone(base);
		edited.tools = { p3: [tool] };
		expect(overlayLocalEdits(base, edited, structuredClone(base)).tools).toEqual({ p3: [tool] });
	});

	it('keeps a passive weight changed here', () => {
		const base = chartWith('Goal');
		const edited = structuredClone(base);
		edited.passiveWeight = 1;
		expect(overlayLocalEdits(base, edited, structuredClone(base)).passiveWeight).toBe(1);
	});
});

describe('clashesOf', () => {
	it('finds an action note and a week note both devices rewrote, and puts the other words back', () => {
		const base = chartWith('Goal');
		base.meta = { [A.a0_0]: { kind: 'milestone', note: 'Old' } };
		base.weeks = { '2026-10-19': { note: 'Week' } };
		const here = structuredClone(base);
		here.meta![A.a0_0]!.note = 'Mine';
		here.weeks!['2026-10-19']!.note = 'My week';
		const there = structuredClone(base);
		there.meta![A.a0_0]!.note = 'Theirs';
		there.weeks!['2026-10-19']!.note = 'Their week';
		const clashes = clashesOf(base, here, there);
		expect(clashes).toEqual([
			{ ref: `note:${A.a0_0}`, mine: 'Mine', theirs: 'Theirs' },
			{ ref: 'week:2026-10-19', mine: 'My week', theirs: 'Their week' }
		]);
		for (const clash of clashes) putWords(here, clash.ref, clash.theirs);
		expect(here.meta![A.a0_0]!.note).toBe('Theirs');
		expect(here.weeks!['2026-10-19']!.note).toBe('Their week');
	});

	it('finds nothing when only one side changed a note', () => {
		const base = chartWith('Goal');
		base.meta = { [A.a0_0]: { kind: 'milestone', note: 'Old' } };
		const here = structuredClone(base);
		here.meta![A.a0_0]!.note = 'Mine';
		expect(clashesOf(base, here, structuredClone(base))).toEqual([]);
	});
});
