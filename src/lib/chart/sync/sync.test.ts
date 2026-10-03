import { describe, expect, it } from 'vitest';
import { emptyChart, type ChartData } from '../model.ts';
import { overlayLocalEdits } from './sync.ts';

function chartWith(goal: string, pillar0 = ''): ChartData {
	const data = emptyChart();
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
		// The device's edit wins on cells it touched…
		expect(merged.goal).toBe('Locally edited goal');
		expect(merged.pillars[2]).toBe('New action');
		// …and the server's newer work survives everywhere else.
		expect(merged.pillars[3]).toBe('New over there');
		expect(merged.pillars[1]).toBe('Untouched');
	});

	it('lets the device win when both sides edited the same cell', () => {
		const base = chartWith('Base', '');
		const edited = chartWith('Device edit', '');
		const server = chartWith('Server edit', '');

		expect(overlayLocalEdits(base, edited, server).goal).toBe('Device edit');
	});

	it('applies locally added and removed meta, day logs, and week notes', () => {
		const base = emptyChart();
		base.meta = { a0_1: { kind: 'routine', done: false } };
		base.days = { '2026-10-01': { focus: ['a0_1'], checked: [] } };

		const edited = structuredClone(base);
		edited.meta!['a0_2'] = { kind: 'milestone', done: true };
		delete edited.days!['2026-10-01'];
		edited.weeks = { '2026-09-28': { note: 'Wrote a note', swapped: [] } };

		const server = emptyChart();
		server.meta = { a3_0: { kind: 'milestone', done: true } };
		server.days = { '2026-10-02': { focus: ['a3_0'], checked: [] } };

		const merged = overlayLocalEdits(base, edited, server);
		expect(merged.meta?.['a0_2']).toEqual({ kind: 'milestone', done: true });
		expect(merged.meta?.['a3_0']).toEqual({ kind: 'milestone', done: true });
		expect(merged.days?.['2026-10-01']).toBeUndefined();
		expect(merged.days?.['2026-10-02']).toEqual({ focus: ['a3_0'], checked: [] });
		expect(merged.weeks?.['2026-09-28']?.note).toBe('Wrote a note');
	});

	it('does not mutate the server copy it was given', () => {
		const base = chartWith('Base', '');
		const edited = chartWith('Device edit', '');
		const server = chartWith('Server copy', '');

		const merged = overlayLocalEdits(base, edited, server);
		expect(merged).not.toBe(server);
		expect(server.goal).toBe('Server copy');
	});
});
