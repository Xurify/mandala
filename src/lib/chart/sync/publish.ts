import { newId } from '../id.ts';
import { parseChart, type ChartData, type Share } from '../model.ts';
import { forSharing } from '../share.ts';

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

/**
 * Publishes the chart to its page, or to a new one when it has none. The share that comes back is the chart's
 * to keep (`data.share`): the secret in it is what lets any of the person's devices update or remove the page.
 */
export async function publishChart(data: ChartData, existing: Share | null, notes = false): Promise<Share> {
	const id = existing?.id ?? newId('share');
	const secret = existing?.secret ?? newSecret();
	const response = await request('PUT', id, secret, { chart: forSharing(data, { notes }) });
	if (!response.ok) {
		const detail = ((await response.json().catch(() => null)) as { error?: string } | null)?.error;
		throw new Error(detail ?? `Publish failed (${response.status}).`);
	}
	const stored = (await response.json()) as { updatedAt: number };
	return { ...existing, id, secret, updatedAt: stored.updatedAt, ...(notes ? { notes: true } : { notes: undefined }) };
}

/** Removes the page. A page already gone counts as removed. */
export async function unpublishChart(share: Pick<Share, 'id' | 'secret'>): Promise<void> {
	const response = await request('DELETE', share.id, share.secret);
	if (!response.ok && response.status !== 404) {
		throw new Error(`Could not stop sharing (${response.status}).`);
	}
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
