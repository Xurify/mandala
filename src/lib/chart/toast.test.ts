import { describe, expect, it } from 'vitest';
import { batchSubject, burstToast, nextSlipBurst, placeSlip, SLIP_MS, SLIP_UNDO_MS, type SlipBurst } from './toast.ts';

function step(previous: SlipBurst | null, key: string, subject: string, amount = 1, mixedBatch = false) {
	return nextSlipBurst(previous, key, subject, amount, mixedBatch);
}

describe('toast burst', () => {
	it('names one chart', () => {
		const burst = step(null, 'Deleted', 'More organized life');
		expect(burst).toEqual({
			key: 'Deleted',
			subject: 'More organized life',
			count: 1,
			mixed: false
		});
		expect(burstToast(burst.key, burst.subject, burst.count, burst.mixed)).toBe(
			'Deleted “More organized life”.'
		);
		expect(burstToast('Cleared', '  ', 1)).toBe('Cleared “Untitled”.');
	});

	it('counts repeats of the same chart while the slip is up', () => {
		let burst = step(null, 'Duplicated', 'More organized life');
		burst = step(burst, 'Duplicated', 'More organized life');
		burst = step(burst, 'Duplicated', 'More organized life');
		burst = step(burst, 'Duplicated', 'More organized life');
		expect(burst.count).toBe(4);
		expect(burst.subject).toBe('More organized life');
		expect(burstToast(burst.key, burst.subject, burst.count, burst.mixed)).toBe(
			'Duplicated “More organized life” ×4.'
		);
	});

	it('a batch lands on its count', () => {
		const burst = step(null, 'Removed', 'More organized life', 4);
		expect(burst.count).toBe(4);
		expect(burstToast(burst.key, burst.subject, burst.count)).toBe(
			'Removed “More organized life” ×4.'
		);
	});

	it('adds a later batch onto the open slip', () => {
		const open = step(null, 'Deleted', 'More organized life', 2);
		const burst = step(open, 'Deleted', 'More organized life', 3);
		expect(burst.count).toBe(5);
		expect(burst.mixed).toBe(false);
	});

	it('drops the single name when the charts differ', () => {
		let burst = step(null, 'Deleted', 'More organized life');
		burst = step(burst, 'Deleted', 'Health');
		expect(burst.count).toBe(2);
		expect(burst.mixed).toBe(true);
		expect(burst.subject).toBe('Charts');
		expect(burstToast(burst.key, burst.subject, burst.count, burst.mixed)).toBe('Deleted 2 charts.');
	});

	it('a mixed batch starts as charts', () => {
		const titles = batchSubject(['Health', 'Money', 'Health']);
		const burst = step(null, 'Restored', titles.subject, 3, titles.mixed);
		expect(titles.mixed).toBe(true);
		expect(burst.subject).toBe('Charts');
		expect(burstToast(burst.key, burst.subject, burst.count, burst.mixed)).toBe('Restored 3 charts.');
	});

	it('a different action starts over', () => {
		const open = step(null, 'Deleted', 'More organized life', 4);
		const burst = step(open, 'Copied as text.', 'Copied as text.');
		expect(burst.count).toBe(1);
		expect(burst.key).toBe('Copied as text.');
	});

	it('counts a repeated sentence', () => {
		let burst = step(null, 'Copied as text.', 'Copied as text.');
		burst = step(burst, 'Copied as text.', 'Copied as text.');
		expect(burst.count).toBe(2);
	});

	it('one shared title is not mixed', () => {
		expect(batchSubject(['Health', 'Health'])).toEqual({ subject: 'Health', mixed: false });
		expect(batchSubject(['  '])).toEqual({ subject: 'Untitled', mixed: false });
	});
});

describe('toast slip', () => {
	const now = 1_000;

	it('a new action replaces the showing one', () => {
		const first = placeSlip([], now, 1, { key: 'Deleted', kicker: 'Deleted', subject: 'More organized life' });
		const placed = placeSlip(first.pile, now + 1_000, first.nextId, {
			key: 'Duplicated',
			kicker: 'Duplicated',
			subject: 'More organized life'
		});
		expect(placed.pile.map((slip) => slip.kicker)).toEqual(['Duplicated']);
		expect(placed.pile[0]?.until).toBe(now + 1_000 + SLIP_MS);
	});

	it('a repeat merges and restarts the clock', () => {
		const first = placeSlip([], now, 1, { key: 'Duplicated', kicker: 'Duplicated', subject: 'Life' });
		const placed = placeSlip(first.pile, now + 800, first.nextId, {
			key: 'Duplicated',
			kicker: 'Duplicated',
			subject: 'Life'
		});
		expect(placed.pile).toHaveLength(1);
		expect(placed.pile[0]?.count).toBe(2);
		expect(placed.pile[0]?.until).toBe(now + 800 + SLIP_MS);
	});

	it('repeated deletes collect every id to undo and stay up longer', () => {
		const first = placeSlip([], now, 1, { key: 'Deleted', kicker: 'Deleted', subject: 'Life', undo: ['a'] });
		expect(first.pile[0]?.until).toBe(now + SLIP_UNDO_MS);
		const placed = placeSlip(first.pile, now + 500, first.nextId, {
			key: 'Deleted',
			kicker: 'Deleted',
			subject: 'Life',
			undo: ['b']
		});
		expect(placed.pile[0]?.undo).toEqual(['a', 'b']);
		expect(placed.pile[0]?.count).toBe(2);
	});

	it('a plain note has nothing to undo', () => {
		const placed = placeSlip([], now, 1, { key: 'Copied', kicker: '', subject: 'Copied' });
		expect(placed.pile[0]?.undo).toEqual([]);
	});

	it('drops a slip whose time is up', () => {
		const first = placeSlip([], now, 1, { key: 'Deleted', kicker: 'Deleted', subject: 'Life' });
		const placed = placeSlip(first.pile, now + SLIP_MS, first.nextId, {
			key: 'Duplicated',
			kicker: 'Duplicated',
			subject: 'Life'
		});
		expect(placed.pile.map((slip) => slip.kicker)).toEqual(['Duplicated']);
	});
});
