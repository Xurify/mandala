import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { clientOf, LIMITS } from '$lib/server/limit';
import { limited, roomOf, rowAt, unavailable, versionOf } from '$lib/server/sync';

export const prerender = false;

const ID_RE = /^chart_[0-9a-z]{26}$/;
const MAX_CHARS = 2_000_000;
const MAX_ROWS = 1000;
const MAX_ROOM_CHARS = 50_000_000;

/**
 * Writes one sealed chart, or null for one deleted for good. Only over the version the device read
 * (`x-sync-version: "<at>"`), or only where there is no row yet (`x-sync-version: new`). When another device
 * wrote first, 412 carries the row as it is now, so the device can merge without asking again. The condition
 * is not in if-match / if-none-match: the edge answers those itself (a 304 for `if-none-match: *`).
 */
export const PUT: RequestHandler = async ({ params, request, getClientAddress }) => {
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

	const version = request.headers.get('x-sync-version') ?? '';
	const createOnly = version === 'new';
	const expected = createOnly ? null : versionOf(version);
	if (expected === null && !createOnly) return json({ error: 'needs x-sync-version' }, { status: 428 });

	const who = await clientOf(getClientAddress());
	const size = typeof data === 'string' ? data.length : 0;
	const busy = await limited([
		{ limit: LIMITS.writes, who },
		{ limit: LIMITS.roomWrites, who: room },
		{ limit: LIMITS.bytes, who, amount: size }
	]);
	if (busy) return busy;

	const moved = async () => json({ error: 'moved', row: await rowAt(room, id) }, { status: 412 });
	if (createOnly) {
		const usage = await db().execute({ sql: 'SELECT COUNT(*) AS n, COALESCE(SUM(size), 0) AS chars FROM sync_rows WHERE room = ?', args: [room] });
		const rows = Number(usage.rows[0]?.n ?? 0);
		if (rows >= MAX_ROWS) return json({ error: 'too many charts' }, { status: 413 });
		if (Number(usage.rows[0]?.chars ?? 0) + size > MAX_ROOM_CHARS) return json({ error: 'this sync is full' }, { status: 413 });
		if (rows === 0) {
			const opening = await limited([{ limit: LIMITS.newRooms, who }]);
			if (opening) return opening;
		}
		const at = Date.now();
		const written = await db().execute({
			sql: 'INSERT INTO sync_rows (room, id, size, updated_at, data) VALUES (?, ?, ?, ?, ?) ON CONFLICT (room, id) DO NOTHING',
			args: [room, id, size, at, data]
		});
		return written.rowsAffected === 0 ? moved() : json({ at });
	}
	const others = await db().execute({ sql: 'SELECT COALESCE(SUM(size), 0) AS chars FROM sync_rows WHERE room = ? AND id != ?', args: [room, id] });
	if (Number(others.rows[0]?.chars ?? 0) + size > MAX_ROOM_CHARS) return json({ error: 'this sync is full' }, { status: 413 });
	// Strictly later than the version it replaces, so two writes in one millisecond never share one.
	const at = Math.max(Date.now(), expected! + 1);
	const written = await db().execute({
		sql: 'UPDATE sync_rows SET data = ?, size = ?, updated_at = ? WHERE room = ? AND id = ? AND updated_at = ?',
		args: [data, size, at, room, id, expected]
	});
	return written.rowsAffected === 0 ? moved() : json({ at });
};
