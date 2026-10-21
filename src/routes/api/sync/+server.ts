import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { clientOf, LIMITS } from '$lib/server/limit';
import { limited, roomOf, unavailable, type SyncRow } from '$lib/server/sync';

export const prerender = false;

const PAGE = 200;

/** Every row in the room written after `since`, oldest first. `more` asks for the next page. */
export const GET: RequestHandler = async ({ request, url, getClientAddress }) => {
	const down = await unavailable();
	if (down) return down;
	const room = await roomOf(request);
	if (!room) return json({ error: 'missing room' }, { status: 400 });
	const since = Number(url.searchParams.get('since') ?? '0');
	if (!Number.isSafeInteger(since) || since < 0) return json({ error: 'bad since' }, { status: 400 });
	const busy = await limited([
		{ limit: LIMITS.reads, who: await clientOf(getClientAddress()) },
		{ limit: LIMITS.roomReads, who: room }
	]);
	if (busy) return busy;
	const result = await db().execute({
		sql: 'SELECT id, data, updated_at FROM sync_rows WHERE room = ? AND updated_at > ? ORDER BY updated_at LIMIT ?',
		args: [room, since, PAGE + 1]
	});
	const rows: SyncRow[] = result.rows.slice(0, PAGE).map((row) => ({
		id: String(row.id),
		data: row.data === null ? null : String(row.data),
		at: Number(row.updated_at)
	}));
	return json({ rows, more: result.rows.length > PAGE }, { headers: { 'cache-control': 'no-store' } });
};
