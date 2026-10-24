import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyChart } from '../model.ts';
import { publishChart, unpublishChart } from './publish.ts';

const share = { id: 'share_01m5qnzqnce1vrm4awy56y2tbk' as const, secret: 's3cret', updatedAt: 1_000, auto: true };

function answering(status: number, body: unknown = {}) {
	const calls: { url: string; init: RequestInit }[] = [];
	const fetch = vi.fn(async (url: string, init: RequestInit) => {
		calls.push({ url, init });
		return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
	});
	vi.stubGlobal('fetch', fetch);
	return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('publishChart', () => {
	it('publishes a new page with a fresh id and secret, and hands them back to keep', async () => {
		const calls = answering(200, { updatedAt: 5_000 });
		const result = await publishChart(emptyChart(), null);
		expect(result.id).toMatch(/^share_/);
		expect(result.secret.length).toBeGreaterThan(16);
		expect(result.updatedAt).toBe(5_000);
		expect(calls[0]!.url).toBe(`/api/chart/${result.id}`);
		expect((calls[0]!.init.headers as Record<string, string>)['x-chart-secret']).toBe(result.secret);
	});

	it('updates an existing page with its own secret, keeping how it is set up', async () => {
		const calls = answering(200, { updatedAt: 6_000 });
		const result = await publishChart(emptyChart(), share, true);
		expect(result).toEqual({ ...share, updatedAt: 6_000, notes: true });
		expect(calls[0]!.url).toBe(`/api/chart/${share.id}`);
		expect((calls[0]!.init.headers as Record<string, string>)['x-chart-secret']).toBe('s3cret');
	});

	it('never sends the share itself with the page', async () => {
		const calls = answering(200, { updatedAt: 1 });
		await publishChart({ ...emptyChart(), share }, share);
		expect(JSON.parse(calls[0]!.init.body as string).chart.share).toBeUndefined();
	});

	it('says what the server said when it refuses', async () => {
		answering(403, { error: 'wrong secret' });
		await expect(publishChart(emptyChart(), share)).rejects.toThrow('wrong secret');
	});
});

describe('unpublishChart', () => {
	it('removes the page, and counts one already gone as removed', async () => {
		answering(204);
		await expect(unpublishChart(share)).resolves.toBeUndefined();
		answering(404);
		await expect(unpublishChart(share)).resolves.toBeUndefined();
	});

	it('fails when the server refuses, so the page stays listed', async () => {
		answering(403);
		await expect(unpublishChart(share)).rejects.toThrow('403');
	});
});
