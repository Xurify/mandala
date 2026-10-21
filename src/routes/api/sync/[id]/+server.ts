import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { roomOf, rowAt, unavailable, versionOf } from '$lib/server/sync';

export const prerender = false;

const ID_RE = /^chart_[0-9a-z]{26}$/;
const MAX_CHARS = 2_000_000;
const MAX_ROWS = 1000;

/**
 * Writes one sealed chart, or null for one deleted for good. Only over the version the device read
 * (`if-match`), or only where there is no row yet (`if-none-match: *`). When another device wrote first,
 * 412 carries the row as it is now, so the device can merge without asking again.
 */
export const PUT: RequestHandler = async ({ params, request }) => {
	const down = await unavailable();
	if (down) return down;
	const room = await roomOf(request);
	if (!room) return json({ error: 'missing room' }, { status: 400 });
	const id = params.id ?? '';
	if (!ID_RE.test(id)) return json({ error: 'bad id' }, { status: 400 });

	let data: unknown;
	try {
		data = ((await request.json()) as { data?: unknown }).data;
	} catch {
		return json({ error: 'bad body' }, { status: 400 });
	}
	if (data !== null && typeof data !== 'string') return json({ error: 'bad data' }, { status: 400 });
	if (typeof data === 'string' && data.length > MAX_CHARS) return json({ error: 'chart too large' }, { status: 413 });

	const ifMatch = request.headers.get('if-match');
	const createOnly = request.headers.get('if-none-match') === '*';
	const expected = ifMatch ? versionOf(ifMatch) : null;
	if (expected === null && !createOnly) return json({ error: 'needs if-match or if-none-match' }, { status: 428 });

	const moved = async () => json({ error: 'moved', row: await rowAt(room, id) }, { status: 412 });
	if (createOnly) {
		const count = await db().execute({ sql: 'SELECT COUNT(*) AS n FROM sync_rows WHERE room = ?', args: [room] });
		if (Number(count.rows[0]?.n ?? 0) >= MAX_ROWS) return json({ error: 'too many charts' }, { status: 413 });
		const at = Date.now();
		const written = await db().execute({
			sql: 'INSERT INTO sync_rows (room, id, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (room, id) DO NOTHING',
			args: [room, id, data, at]
		});
		return written.rowsAffected === 0 ? moved() : json({ at });
	}
	// Strictly later than the version it replaces, so two writes in one millisecond never share one.
	const at = Math.max(Date.now(), expected! + 1);
	const written = await db().execute({
		sql: 'UPDATE sync_rows SET data = ?, updated_at = ? WHERE room = ? AND id = ? AND updated_at = ?',
		args: [data, at, room, id, expected]
	});
	return written.rowsAffected === 0 ? moved() : json({ at });
};
