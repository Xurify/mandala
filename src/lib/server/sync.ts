import { json } from '@sveltejs/kit';
import { db, hasDb, initDb } from './db';

const ROOM_RE = /^[0-9a-f]{64}$/;

export type SyncRow = { id: string; data: string | null; at: number };

/**
 * The device sends a room id derived from its sync key; the table keeps only a hash of it, so a copy of the
 * table is not enough to write into anyone's room.
 */
export async function roomOf(request: Request): Promise<string | null> {
	const room = request.headers.get('x-sync-room') ?? '';
	if (!ROOM_RE.test(room)) return null;
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(room));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** A response when sync cannot run here, or null when it can. */
export async function unavailable(): Promise<Response | null> {
	if (!hasDb()) return json({ error: 'Sync is not set up on this server.' }, { status: 503 });
	try {
		await initDb();
		return null;
	} catch {
		return json({ error: 'The sync database did not answer.' }, { status: 503 });
	}
}

export async function rowAt(room: string, id: string): Promise<SyncRow | null> {
	const result = await db().execute({ sql: 'SELECT id, data, updated_at FROM sync_rows WHERE room = ? AND id = ?', args: [room, id] });
	const row = result.rows[0];
	return row ? { id: String(row.id), data: row.data === null ? null : String(row.data), at: Number(row.updated_at) } : null;
}

export function versionOf(tag: string): number | null {
	const match = /^"([0-9a-z]+)"$/.exec(tag.trim());
	if (!match) return null;
	const at = parseInt(match[1]!, 36);
	return Number.isSafeInteger(at) ? at : null;
}
