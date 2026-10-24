import { describe, expect, it } from 'vitest';
import { isId, newId, timeOf } from './id.ts';

describe('newId', () => {
	it('names what it is for, then 26 characters', () => {
		const id = newId('action');
		expect(id).toMatch(/^action_[0-7][0-9a-hjkmnp-tv-z]{25}$/);
		expect(isId('action', id)).toBe(true);
		expect(isId('chart', id)).toBe(false);
		expect(isId('action', 'a0_0')).toBe(false);
	});

	it('sorts by when it was made', () => {
		const ids = [3, 1, 2].map((at) => newId('chart', Date.UTC(2026, 9, at)));
		expect([...ids].sort()).toEqual([ids[1], ids[2], ids[0]]);
	});

	it('does not repeat', () => {
		const ids = Array.from({ length: 2000 }, () => newId('tool', 0));
		expect(new Set(ids).size).toBe(2000);
	});

	it('holds a UUIDv7, so it can sit in a UUID column', () => {
		const at = Date.UTC(2026, 9, 12, 9, 30);
		let value = 0n;
		for (const char of newId('share', at).slice('share_'.length)) value = value * 32n + BigInt('0123456789abcdefghjkmnpqrstvwxyz'.indexOf(char));
		const hex = value.toString(16).padStart(32, '0');
		expect(Number.parseInt(hex.slice(0, 12), 16)).toBe(at);
		expect(hex[12]).toBe('7');
		expect('89ab').toContain(hex[16]);
	});
});

describe('timeOf', () => {
	it('reads back when the id was made', () => {
		expect(timeOf(newId('action', 1_760_000_000_123))).toBe(1_760_000_000_123);
		expect(timeOf('action_nope')).toBeNull();
	});
});
