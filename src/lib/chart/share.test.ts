import { describe, expect, it } from 'vitest';
import { decodeChartShare, encodeChartShare, forSharing, isShareHash } from './share.ts';
import { emptyChart, type ChartData } from './model.ts';

function sampleChart(): ChartData {
	const data = emptyChart();
	data.goal = 'Run a half marathon';
	data.pillars[0] = 'Training';
	data.actions[0]![0] = 'Print a 16-week plan';
	data.meta = { a0_0: { kind: 'routine', pinned: true } };
	data.days = { '2026-09-30': { focus: ['a0_0'], checked: ['a0_0'] } };
	return data;
}

describe('share encoding', () => {
	it('round-trips a chart through the hash payload', async () => {
		const payload = await encodeChartShare(sampleChart());
		expect(payload.startsWith('c=')).toBe(true);
		const decoded = await decodeChartShare(`#${payload}`);
		expect(decoded?.goal).toBe('Run a half marathon');
		expect(decoded?.pillars[0]).toBe('Training');
		expect(decoded?.meta).toEqual(sampleChart().meta);
		expect(decoded?.days).toEqual(sampleChart().days);
	});

	it('leaves the draft brief out of the link', async () => {
		const data = sampleChart();
		data.brief = { constraint: 'A bad knee' };
		const decoded = await decodeChartShare(`#${await encodeChartShare(data)}`);
		expect(decoded?.goal).toBe('Run a half marathon');
		expect(decoded?.brief).toBeUndefined();
	});

	it('leaves site icons out of the link', async () => {
		const data = sampleChart();
		data.icons = { 'readline.app': 'data:image/png;base64,iVBORw0KGgo=' };
		const decoded = await decodeChartShare(`#${await encodeChartShare(data)}`);
		expect(decoded?.goal).toBe('Run a half marathon');
		expect(decoded?.icons).toBeUndefined();
	});

	it('gives another person the chart without the brief, the icons, or what was opened when', () => {
		const data = emptyChart();
		data.brief = { timeline: 'October' };
		data.icons = { 'youtube.com': 'data:image/png;base64,AAAA' };
		data.tools = { p0: [{ id: 't', url: 'https://youtu.be/x', title: 'X', kind: 'repeat', opened: ['2026-10-01'], known: true }] };
		const shared = forSharing(data);
		expect(shared.brief).toBeUndefined();
		expect(shared.icons).toBeUndefined();
		expect(shared.tools).toEqual({ p0: [{ id: 't', url: 'https://youtu.be/x', title: 'X', kind: 'repeat' }] });
		expect(data.tools.p0![0]!.opened).toEqual(['2026-10-01']);
	});

	it('round-trips a plain (uncompressed) payload', async () => {
		const json = JSON.stringify(sampleChart());
		let binary = '';
		for (const byte of new TextEncoder().encode(json)) {
			binary += String.fromCharCode(byte);
		}
		const payload = `c=${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
		const decoded = await decodeChartShare(`#${payload}`);
		expect(decoded?.goal).toBe('Run a half marathon');
	});

	it('detects share hashes', () => {
		expect(isShareHash('#c=abc')).toBe(true);
		expect(isShareHash('#other')).toBe(false);
		expect(isShareHash('')).toBe(false);
	});

	it('returns null for malformed payloads', async () => {
		expect(await decodeChartShare('#c=')).toBeNull();
		expect(await decodeChartShare('#c=!!!not-base64!!!')).toBeNull();
		expect(await decodeChartShare('#c=eyJpbnZhbGlkIjp0cnVlfQ')).toBeNull();
		expect(await decodeChartShare('')).toBeNull();
	});
});
