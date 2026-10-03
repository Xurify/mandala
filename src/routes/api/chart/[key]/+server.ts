import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, initDb } from '$lib/server/db';

export const prerender = false;

// One key, one row, two uses: a personal sync key (whole-chart last write,
// secret = the key itself) or a published share (public id, owner-held
// secret). Reads only need the key; writes and deletes need the secret.
const KEY_RE = /^[A-Za-z0-9_-]{8,128}$/;
const MAX_BYTES = 256 * 1024;

function etagFor(updatedAt: number): string {
	return `"${updatedAt.toString(36)}"`;
}

export const GET: RequestHandler = async ({ params, request }) => {
	const key = params.key ?? '';
	if (!KEY_RE.test(key)) return json({ error: 'bad key' }, { status: 400 });
	await initDb();
	const result = await db().execute({
		sql: 'SELECT data, updated_at FROM charts WHERE key = ?',
		args: [key]
	});
	const row = result.rows[0];
	if (!row) return json({ error: 'not found' }, { status: 404 });
	const updatedAt = Number(row.updated_at);
	const etag = etagFor(updatedAt);
	if (request.headers.get('if-none-match') === etag) {
		return new Response(null, { status: 304, headers: { etag } });
	}
	return json({ chart: JSON.parse(String(row.data)), updatedAt }, { headers: { etag } });
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const key = params.key ?? '';
	if (!KEY_RE.test(key)) return json({ error: 'bad key' }, { status: 400 });
	const secret = request.headers.get('x-chart-secret');
	if (!secret || secret.length < 8) return json({ error: 'missing secret' }, { status: 401 });

	let payload: { chart?: unknown };
	try {
		payload = (await request.json()) as { chart?: unknown };
	} catch {
		return json({ error: 'bad body' }, { status: 400 });
	}
	const chart = payload.chart;
	// A whole-chart snapshot must at least look like a chart.
	if (
		typeof chart !== 'object' ||
		chart === null ||
		typeof (chart as { goal?: unknown }).goal !== 'string' ||
		!Array.isArray((chart as { pillars?: unknown }).pillars)
	) {
		return json({ error: 'bad chart' }, { status: 400 });
	}
	const data = JSON.stringify(chart);
	if (data.length > MAX_BYTES) return json({ error: 'chart too large' }, { status: 413 });

	await initDb();
	const existing = await db().execute({
		sql: 'SELECT secret FROM charts WHERE key = ?',
		args: [key]
	});
	const row = existing.rows[0];
	if (row && String(row.secret) !== secret) {
		return json({ error: 'wrong secret' }, { status: 403 });
	}
	const updatedAt = Date.now();
	await db().execute({
		sql: `INSERT INTO charts (key, secret, data, updated_at) VALUES (?, ?, ?, ?)
			ON CONFLICT(key) DO UPDATE SET secret = excluded.secret, data = excluded.data, updated_at = excluded.updated_at`,
		args: [key, secret, data, updatedAt]
	});
	return json({ ok: true, updatedAt });
};

export const DELETE: RequestHandler = async ({ params, request }) => {
	const key = params.key ?? '';
	if (!KEY_RE.test(key)) return json({ error: 'bad key' }, { status: 400 });
	const secret = request.headers.get('x-chart-secret');
	if (!secret) return json({ error: 'missing secret' }, { status: 401 });
	await initDb();
	const existing = await db().execute({
		sql: 'SELECT secret FROM charts WHERE key = ?',
		args: [key]
	});
	const row = existing.rows[0];
	if (row && String(row.secret) !== secret) {
		return json({ error: 'wrong secret' }, { status: 403 });
	}
	await db().execute({ sql: 'DELETE FROM charts WHERE key = ?', args: [key] });
	return json({ ok: true });
};
