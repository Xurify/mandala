import { describe, expect, it } from 'vitest';
import { CHART_VERSION, emptyChart } from '../model.ts';
import { newSyncKey, sealText, syncSecrets } from './key.ts';
import { seal, unseal } from './remote.ts';

describe('unseal', async () => {
	const { seal: key } = await syncSecrets(newSyncKey());
	const data = { ...emptyChart(), goal: 'Learn Estonian' };

	it('reads back a chart it sealed, in the bin or not', async () => {
		const chart = { id: 'chart_a', updatedAt: 5, deletedAt: 9, data };
		const row = await unseal(key, { id: 'chart_a', at: 12, data: await seal(key, chart) });
		expect(row?.at).toBe(12);
		expect(row?.chart?.deletedAt).toBe(9);
		expect(row?.chart?.data.goal).toBe('Learn Estonian');
	});

	it('reads a chart deleted for good as null', async () => {
		expect(await unseal(key, { id: 'chart_a', at: 12, data: null })).toEqual({ id: 'chart_a', at: 12, chart: null });
	});

	it('leaves a row it cannot read: another key, or a newer Mandala', async () => {
		const { seal: other } = await syncSecrets(newSyncKey());
		const chart = { id: 'chart_a', updatedAt: 5, data };
		expect(await unseal(key, { id: 'chart_a', at: 12, data: await seal(other, chart) })).toBeNull();
		const newer = JSON.stringify({ ...chart, data: { ...data, version: CHART_VERSION + 1 } });
		expect(await unseal(key, { id: 'chart_a', at: 12, data: await sealText(key, 'chart_a', newer) })).toBeNull();
	});
});
