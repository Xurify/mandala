import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BRIEF, BROWSER_KEYS, CHART, TOOL } from './contract.ts';
import { A, slotted } from './fixtures.ts';
import { emptyChart, type ChartData, type Tool } from './model.ts';
import { forSharing } from './share.ts';

const src = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('the sync contract', () => {
	it('gives another person what is shared, and only that', () => {
		const tool: Tool = { id: 't', url: 'https://youtu.be/x', title: 'X', kind: 'repeat', action: A.a0_0, known: true, opened: ['2026-10-01'] };
		const full: ChartData = {
			...slotted(emptyChart()),
			meta: { [A.a0_0]: { kind: 'routine' } },
			days: { '2026-10-01': { focus: [], checked: [] } },
			weeks: { '2026-09-28': { note: '' } },
			tools: { p0: [tool] },
			brief: { timeline: 'October' },
			icons: { 'youtu.be': 'data:image/png;base64,AAAA' },
			cleared: { [`action_${'0'.repeat(24)}99`]: { text: 'An old line', pillar: 0, slot: 1 } },
			timer: { action: A.a0_0, since: 1_000, length: 25 }
		};
		const shared = forSharing(full);
		for (const [field, reach] of Object.entries(CHART)) {
			expect(shared[field as keyof ChartData] !== undefined, field).toBe(reach === 'shared');
		}
		const sharedTool = shared.tools!.p0![0]!;
		for (const [field, reach] of Object.entries(TOOL)) {
			expect(sharedTool[field as keyof Tool] !== undefined, field).toBe(reach === 'shared');
		}
		expect(Object.values(BRIEF).every((reach) => reach === CHART.brief)).toBe(true);
	});

	it('lists every key the app keeps in the browser, and nothing it no longer keeps', () => {
		const files = readdirSync(src, { recursive: true, encoding: 'utf8' }).filter(
			(file) => /\.(ts|svelte|html)$/.test(file) && !file.endsWith('.test.ts')
		);
		const sources = files.map((file) => readFileSync(join(src, file), 'utf8'));
		const constants = new Map<string, string>();
		for (const text of sources) {
			for (const [, name, value] of text.matchAll(/(?:const|let)\s+([A-Z_][A-Z0-9_]*)\s*=\s*['"]([^'"]+)['"]/g)) constants.set(name!, value!);
		}
		const used = new Set<string>();
		for (const text of sources) {
			for (const match of text.matchAll(/(?:local|session)Storage\.(?:get|set|remove)Item\(\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_]\w*))/g)) {
				const key = match[1] ?? match[2] ?? constants.get(match[3]!);
				expect(key, match[0]).toBeDefined();
				used.add(key!);
			}
		}
		expect([...used].sort()).toEqual(Object.keys(BROWSER_KEYS).sort());
	});
});
