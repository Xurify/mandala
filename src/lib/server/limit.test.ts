import { createClient } from '@libsql/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { clientOf, LIMIT_SCHEMA, spend, type Limit } from './limit.ts';

const three: Limit = { name: 'test', max: 3, per: 60_000 };
const other: Limit = { name: 'other', max: 1, per: 60_000 };
const start = 1_800_000_000_000;

let client = createClient({ url: ':memory:' });

beforeEach(async () => {
	client = createClient({ url: ':memory:' });
	await client.execute(LIMIT_SCHEMA);
});

describe('spend', () => {
	it('lets the first ones through and says how long to wait after', async () => {
		for (let count = 0; count < 3; count++) expect(await spend(client, [{ limit: three, who: 'a' }], start)).toBeNull();
		expect(await spend(client, [{ limit: three, who: 'a' }], start + 15_000)).toBe(45);
	});

	it('counts each client on its own', async () => {
		for (let count = 0; count < 3; count++) await spend(client, [{ limit: three, who: 'a' }], start);
		expect(await spend(client, [{ limit: three, who: 'b' }], start)).toBeNull();
	});

	it('starts over in the next window', async () => {
		for (let count = 0; count < 4; count++) await spend(client, [{ limit: three, who: 'a' }], start);
		expect(await spend(client, [{ limit: three, who: 'a' }], start + 60_000)).toBeNull();
	});

	it('counts an amount, such as bytes', async () => {
		expect(await spend(client, [{ limit: three, who: 'a', amount: 3 }], start)).toBeNull();
		expect(await spend(client, [{ limit: three, who: 'a', amount: 1 }], start)).not.toBeNull();
	});

	it('waits for the longest of several limits', async () => {
		const hour: Limit = { name: 'hour', max: 1, per: 3_600_000 };
		await spend(client, [{ limit: other, who: 'a' }, { limit: hour, who: 'a' }], start);
		expect(await spend(client, [{ limit: other, who: 'a' }, { limit: hour, who: 'a' }], start)).toBe(3600);
	});

	it('clears windows that ended a day ago', async () => {
		await spend(client, [{ limit: three, who: 'a' }], start);
		await spend(client, [{ limit: three, who: 'b' }], start + 2 * 86_400_000, true);
		const rows = await client.execute('SELECT bucket FROM sync_limits');
		expect(rows.rows.map((row) => row.bucket)).toEqual(['test:b']);
	});
});

describe('clientOf', () => {
	it('is the same for an address, different for another, and never the address', async () => {
		const one = await clientOf('203.0.113.7');
		expect(await clientOf('203.0.113.7')).toBe(one);
		expect(await clientOf('203.0.113.8')).not.toBe(one);
		expect(one).not.toContain('203');
		expect(one).toMatch(/^[0-9a-f]{32}$/);
	});
});
