import type { ChartData } from '../model.ts';

/**
 * Client helpers for the one-row cloud API (/api/chart/<key>). Everything is
 * same-origin: the API routes ship with the app, so there is no server URL to
 * configure and no CORS to negotiate.
 *
 * Two uses of one row shape:
 *   - a published share: public id, owner keeps the write secret in
 *     localStorage so edits can be re-published and the share revoked
 *   - a device-sync copy: the owner's personal sync key is both key and
 *     secret; devices pull on open and push after edits
 */
const SECRET_KEY = 'mandala-share-secrets-v1';

export type PublishedShare = { id: string; updatedAt: number };

function readSecrets(): Record<string, string> {
	try {
		const raw = localStorage.getItem(SECRET_KEY);
		return raw ? (JSON.parse(raw) as Record<string, string>) : {};
	} catch {
		return {};
	}
}

function writeSecrets(secrets: Record<string, string>): void {
	try {
		localStorage.setItem(SECRET_KEY, JSON.stringify(secrets));
	} catch {
		// storage blocked; secret won't persist and the share can't be updated
	}
}

export function secretFor(id: string): string | null {
	return readSecrets()[id] ?? null;
}

/** The share page lives on this app, so a share link is always same-origin. */
export function shareUrl(id: string): string {
	const origin = typeof location === 'undefined' ? '' : location.origin;
	return `${origin}/s/${id}`;
}

function newId(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 22);
}

function newSecret(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(24));
	return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('');
}

async function request(
	method: string,
	id: string,
	secret: string | null,
	body?: unknown,
	extraHeaders: Record<string, string> = {}
): Promise<Response> {
	const headers: Record<string, string> = { 'content-type': 'application/json', ...extraHeaders };
	if (secret) headers['x-chart-secret'] = secret;
	return fetch(`/api/chart/${id}`, {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body)
	});
}

/** Publishes the chart (or updates an existing share) and returns the public id. */
export async function publishChart(
	data: ChartData,
	existingId: string | null
): Promise<PublishedShare> {
	const id = existingId ?? newId();
	const secret = existingId ? secretFor(id) : null;
	if (existingId && !secret) {
		throw new Error('The update secret for this share is missing on this device.');
	}
	const useSecret = secret ?? newSecret();
	const response = await request('PUT', id, useSecret, { chart: data });
	if (!response.ok) {
		const detail = ((await response.json().catch(() => null)) as { error?: string } | null)?.error;
		throw new Error(detail ?? `Publish failed (${response.status}).`);
	}
	const stored = (await response.json()) as { updatedAt: number };
	if (!secret) {
		const secrets = readSecrets();
		secrets[id] = useSecret;
		writeSecrets(secrets);
	}
	return { id, updatedAt: stored.updatedAt };
}

/** Removes a published share. */
export async function unpublishChart(id: string): Promise<void> {
	const secret = secretFor(id);
	if (!secret) throw new Error('The update secret for this share is missing on this device.');
	const response = await request('DELETE', id, secret);
	if (!response.ok && response.status !== 404) {
		throw new Error(`Could not stop sharing (${response.status}).`);
	}
	const secrets = readSecrets();
	delete secrets[id];
	writeSecrets(secrets);
}

export type FetchedRow = { chart: ChartData | null; updatedAt: number | null; unchanged: boolean };

/**
 * Fetches a row (share snapshot or device copy). Pass `ifNoneMatch` (a
 * previous updatedAt) for a cheap conditional read: an unchanged row comes
 * back as `{ chart: null, unchanged: true }` without a body.
 */
export async function fetchRow(id: string, ifNoneMatch: number | null = null): Promise<FetchedRow> {
	const headers: Record<string, string> =
		ifNoneMatch === null ? {} : { 'if-none-match': `"${ifNoneMatch.toString(36)}"` };
	const response = await request('GET', id, null, undefined, headers);
	if (response.status === 404) return { chart: null, updatedAt: null, unchanged: false };
	if (response.status === 304) return { chart: null, updatedAt: ifNoneMatch, unchanged: true };
	if (!response.ok) throw new Error(`Could not load the chart (${response.status}).`);
	const payload = (await response.json()) as { chart: unknown; updatedAt: number };
	return { chart: (payload.chart as ChartData) ?? null, updatedAt: payload.updatedAt, unchanged: false };
}

/** The share page reads through the same helper; the name says what it means there. */
export const fetchShare = fetchRow;

/** Pushes a whole chart as the row's latest snapshot. For device sync, the
 * sync key doubles as the write secret. */
export async function pushRow(
	key: string,
	secret: string,
	data: ChartData
): Promise<{ updatedAt: number }> {
	const response = await request('PUT', key, secret, { chart: data });
	if (!response.ok) {
		const detail = ((await response.json().catch(() => null)) as { error?: string } | null)?.error;
		throw new Error(detail ?? `Sync failed (${response.status}).`);
	}
	return (await response.json()) as { updatedAt: number };
}
