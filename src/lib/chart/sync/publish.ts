import { newId } from '../id.ts';
import { parseChart, type ChartData } from '../model.ts';
import { forSharing } from '../share.ts';

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
	}
}

export function secretFor(id: string): string | null {
	return readSecrets()[id] ?? null;
}

export function shareUrl(id: string): string {
	const origin = typeof location === 'undefined' ? '' : location.origin;
	return `${origin}/s/${id}`;
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

export async function publishChart(
	data: ChartData,
	existingId: string | null,
	notes = false
): Promise<PublishedShare> {
	const id = existingId ?? newId('share');
	const secret = existingId ? secretFor(id) : null;
	if (existingId && !secret) {
		throw new Error('The update secret for this share is missing on this device.');
	}
	const useSecret = secret ?? newSecret();
	const response = await request('PUT', id, useSecret, { chart: forSharing(data, { notes }) });
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

export async function fetchRow(id: string, ifNoneMatch: number | null = null): Promise<FetchedRow> {
	const headers: Record<string, string> =
		ifNoneMatch === null ? {} : { 'if-none-match': `"${ifNoneMatch.toString(36)}"` };
	const response = await request('GET', id, null, undefined, headers);
	if (response.status === 404) return { chart: null, updatedAt: null, unchanged: false };
	if (response.status === 304) return { chart: null, updatedAt: ifNoneMatch, unchanged: true };
	if (!response.ok) throw new Error(`Could not load the chart (${response.status}).`);
	const payload = (await response.json()) as { chart: unknown; updatedAt: number };
	if (!payload.chart) return { chart: null, updatedAt: payload.updatedAt, unchanged: false };
	// Unreadable is not missing: treated as missing, sync would write this device's copy over it.
	const chart = parseChart(JSON.stringify(payload.chart));
	if (!chart) throw new Error('This chart cannot be read here. It may come from a newer version of Mandala.');
	return { chart, updatedAt: payload.updatedAt, unchanged: false };
}

export const fetchShare = fetchRow;

export type PushedRow = { updatedAt: number; moved: false } | { moved: true };

/** For device sync, the sync key doubles as the write secret. `expected` null writes only where there is no row yet. */
export async function pushRow(key: string, secret: string, data: ChartData, expected: number | null): Promise<PushedRow> {
	const condition: Record<string, string> = expected === null ? { 'if-none-match': '*' } : { 'if-match': `"${expected.toString(36)}"` };
	const response = await request('PUT', key, secret, { chart: data }, condition);
	if (response.status === 412) return { moved: true };
	if (!response.ok) {
		const detail = ((await response.json().catch(() => null)) as { error?: string } | null)?.error;
		throw new Error(detail ?? `Sync failed (${response.status}).`);
	}
	const { updatedAt } = (await response.json()) as { updatedAt: number };
	return { updatedAt, moved: false };
}
