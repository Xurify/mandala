import type { Client, InStatement } from '@libsql/client';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export type Limit = { name: string; max: number; per: number };

/**
 * A device polls every 45 seconds and writes a chart two seconds after an edit, so a person with a few tabs
 * and devices stays far under the room limits. The address limits are wider: a phone network can put many
 * people behind one address. Each counts in fixed windows, kept in the database because serverless
 * instances share nothing else.
 */
export const LIMITS = {
	reads: { name: 'read', max: 600, per: MINUTE },
	roomReads: { name: 'room-read', max: 120, per: MINUTE },
	writes: { name: 'write', max: 600, per: MINUTE },
	roomWrites: { name: 'room-write', max: 120, per: MINUTE },
	bytes: { name: 'bytes', max: 200_000_000, per: HOUR },
	newRooms: { name: 'new-room', max: 50, per: DAY }
} satisfies Record<string, Limit>;

export const LIMIT_SCHEMA = `CREATE TABLE IF NOT EXISTS sync_limits (
	bucket TEXT PRIMARY KEY,
	until INTEGER NOT NULL,
	used INTEGER NOT NULL
)`;

export type Charge = { limit: Limit; who: string; amount?: number };

function charge({ limit, who, amount = 1 }: Charge, now: number): InStatement {
	const until = Math.floor(now / limit.per) * limit.per + limit.per;
	return {
		// SQLite reads every SET expression against the row as it was, so both see the old window.
		sql: `INSERT INTO sync_limits (bucket, until, used) VALUES (?, ?, ?)
			ON CONFLICT (bucket) DO UPDATE SET
				used = CASE WHEN sync_limits.until <= ? THEN excluded.used ELSE sync_limits.used + excluded.used END,
				until = CASE WHEN sync_limits.until <= ? THEN excluded.until ELSE sync_limits.until END
			RETURNING used, until`,
		args: [`${limit.name}:${who}`, until, amount, now, now]
	};
}

/**
 * Counts each charge in one round trip. Returns the seconds to wait when any is over its limit, or null.
 * Now and then it also clears windows that ended a day ago.
 */
export async function spend(client: Client, charges: readonly Charge[], now = Date.now(), sweep = Math.random() < 0.01): Promise<number | null> {
	const statements = charges.map((each) => charge(each, now));
	if (sweep) statements.push({ sql: 'DELETE FROM sync_limits WHERE until < ?', args: [now - DAY] });
	const results = await client.batch(statements, 'write');
	let wait: number | null = null;
	charges.forEach((each, index) => {
		const row = results[index]?.rows[0];
		if (!row || Number(row.used) <= each.limit.max) return;
		const seconds = Math.max(1, Math.ceil((Number(row.until) - now) / 1000));
		wait = Math.max(wait ?? 0, seconds);
	});
	return wait;
}

/** Who is asking, without keeping their address: a hash of it, only ever stored inside a window that ends. */
export async function clientOf(address: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`mandala-limit:${address}`));
	return Array.from(new Uint8Array(digest).subarray(0, 16), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
