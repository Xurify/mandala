import { parseChart } from '../model.ts';
import { openText, sealText } from './key.ts';
import type { RemoteRow, SyncedChart } from './plan.ts';

/** A row as the server keeps it: sealed, or null once deleted for good. */
export type SealedRow = { id: string; data: string | null; at: number };

export type SyncFailure = 'offline' | 'unavailable' | 'error';

export class SyncError extends Error {
	constructor(
		readonly kind: SyncFailure,
		message: string
	) {
		super(message);
	}
}

async function call(path: string, room: string, init: RequestInit = {}): Promise<Response> {
	let response: Response;
	try {
		response = await fetch(path, { ...init, cache: 'no-store', headers: { ...init.headers, 'content-type': 'application/json', 'x-sync-room': room } });
	} catch {
		throw new SyncError('offline', 'No connection.');
	}
	if (response.status === 503) {
		const detail = ((await response.json().catch(() => null)) as { error?: string } | null)?.error;
		throw new SyncError('unavailable', detail ?? 'Sync is not set up on this server.');
	}
	return response;
}

export async function listRows(room: string, since: number): Promise<SealedRow[]> {
	const rows: SealedRow[] = [];
	let after = since;
	for (;;) {
		const response = await call(`/api/sync?since=${after}`, room);
		if (!response.ok) throw new SyncError('error', `Could not read the synced charts (${response.status}).`);
		const page = (await response.json()) as { rows: SealedRow[]; more: boolean };
		rows.push(...page.rows);
		if (!page.more || page.rows.length === 0) return rows;
		after = page.rows[page.rows.length - 1]!.at;
	}
}

export type Written = { ok: true; at: number } | { ok: false; row: SealedRow | null };

export async function putRow(room: string, id: string, data: string | null, expected: number | null): Promise<Written> {
	const condition: Record<string, string> = expected === null ? { 'if-none-match': '*' } : { 'if-match': `"${expected.toString(36)}"` };
	const response = await call(`/api/sync/${id}`, room, { method: 'PUT', headers: condition, body: JSON.stringify({ data }) });
	if (response.status === 412) return { ok: false, row: ((await response.json()) as { row: SealedRow | null }).row };
	if (!response.ok) {
		const detail = ((await response.json().catch(() => null)) as { error?: string } | null)?.error;
		throw new SyncError('error', detail ?? `Could not save a chart (${response.status}).`);
	}
	return { ok: true, at: ((await response.json()) as { at: number }).at };
}

export async function seal(key: CryptoKey, chart: SyncedChart): Promise<string> {
	return sealText(key, chart.id, JSON.stringify(chart));
}

/**
 * A row this version can read, or null: one sealed with another key, damaged, or written by a newer Mandala
 * stays on the server untouched until it can be read.
 */
export async function unseal(key: CryptoKey, row: SealedRow): Promise<RemoteRow | null> {
	if (row.data === null) return { id: row.id, at: row.at, chart: null };
	try {
		const parsed = JSON.parse(await openText(key, row.id, row.data)) as Partial<SyncedChart>;
		const data = parseChart(JSON.stringify(parsed.data));
		if (!data || parsed.id !== row.id || typeof parsed.updatedAt !== 'number') return null;
		const deletedAt = typeof parsed.deletedAt === 'number' ? parsed.deletedAt : undefined;
		return { id: row.id, at: row.at, chart: { id: row.id, updatedAt: parsed.updatedAt, ...(deletedAt === undefined ? {} : { deletedAt }), data } };
	} catch {
		return null;
	}
}
