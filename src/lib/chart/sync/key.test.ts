import { describe, expect, it } from 'vitest';
import { newSyncKey, normalizeSyncKey, openText, sealText, syncSecrets } from './key.ts';

describe('sync key', () => {
	it('is five groups of five, and new each time', () => {
		const key = newSyncKey();
		expect(key).toMatch(/^[0-9a-z]{5}(-[0-9a-z]{5}){4}$/);
		expect(newSyncKey()).not.toBe(key);
	});

	it('reads a key typed with spaces, capitals, and look-alike letters', () => {
		const key = newSyncKey();
		const typed = key.toUpperCase().replace(/-/g, ' ').replace(/1/g, 'l').replace(/0/g, 'O');
		expect(normalizeSyncKey(typed)).toBe(key);
		expect(normalizeSyncKey(`  ${key.replace(/-/g, '')} `)).toBe(key);
	});

	it('refuses a key that is too short, too long, or has a letter it never uses', () => {
		const key = newSyncKey();
		expect(normalizeSyncKey(key.slice(0, -1))).toBeNull();
		expect(normalizeSyncKey(`${key}2`)).toBeNull();
		expect(normalizeSyncKey(`u${key.slice(1)}`)).toBeNull();
	});
});

describe('sealing', () => {
	it('gives the same room and a working seal on every device with the key', async () => {
		const key = newSyncKey();
		const phone = await syncSecrets(key);
		const laptop = await syncSecrets(normalizeSyncKey(key.toUpperCase())!);
		expect(phone.room).toMatch(/^[0-9a-f]{64}$/);
		expect(laptop.room).toBe(phone.room);
		const sealed = await sealText(phone.seal, 'chart_1', '{"goal":"Run a half marathon"}');
		expect(sealed).not.toContain('marathon');
		expect(await openText(laptop.seal, 'chart_1', sealed)).toBe('{"goal":"Run a half marathon"}');
	});

	it('keeps another key out, and a row moved under another id', async () => {
		const mine = await syncSecrets(newSyncKey());
		const theirs = await syncSecrets(newSyncKey());
		expect(theirs.room).not.toBe(mine.room);
		const sealed = await sealText(mine.seal, 'chart_1', 'secret');
		await expect(openText(theirs.seal, 'chart_1', sealed)).rejects.toThrow();
		await expect(openText(mine.seal, 'chart_2', sealed)).rejects.toThrow();
	});

	it('packs a long chart small', async () => {
		const { seal } = await syncSecrets(newSyncKey());
		const text = JSON.stringify({ days: Array.from({ length: 400 }, (_, index) => ({ focus: ['action_a', 'action_b'], checked: [], day: index })) });
		const sealed = await sealText(seal, 'chart_1', text);
		expect(sealed.length).toBeLessThan(text.length / 4);
		expect(await openText(seal, 'chart_1', sealed)).toBe(text);
	});
});
