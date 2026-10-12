import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ACTION_META, BRIEF, BROWSER_KEYS, CHART, CHART_PART, META_PART, TOOL, TOOL_PART } from './contract.ts';
import { withoutHistory } from './library.ts';
import { A, slotted } from './fixtures.ts';
import { emptyChart, type ActionMeta, type ChartData, type Tool } from './model.ts';
import { forSharing } from './share.ts';

const src = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('the sync contract', () => {
	const tool: Tool = { id: 't', url: 'https://youtu.be/x', title: 'X', kind: 'repeat', action: A.a0_0, known: true, opened: ['2026-10-01'] };
	const meta: ActionMeta = { kind: 'milestone', pinned: true, done: true, doneAt: '2026-10-01', note: 'Page 40', details: 'Ask Ana', lane: 'doing', rank: 0 };
	const full = (): ChartData => ({
		...slotted(emptyChart()),
		meta: { [A.a0_0]: { ...meta } },
		days: { '2026-10-01': { focus: [A.a0_0], checked: [A.a0_0], sessions: [{ action: A.a0_0, at: '07:00', minutes: 30 }] } },
		weeks: { '2026-09-28': { note: 'A good week' } },
		tools: { p0: [{ ...tool }] },
		brief: { timeline: 'October' },
		icons: { 'youtu.be': 'data:image/png;base64,AAAA' },
		cleared: { [`action_${'0'.repeat(24)}99`]: { text: 'An old line', pillar: 0, slot: 1 } },
		timer: { action: A.a0_0, since: 1_000, length: 25 }
	});

	it('gives another person what is shared, and only that', () => {
		const shared = forSharing(full());
		for (const [field, reach] of Object.entries(CHART)) {
			expect(shared[field as keyof ChartData] !== undefined, field).toBe(reach === 'shared');
		}
		const sharedMeta = shared.meta![A.a0_0]!;
		for (const [field, reach] of Object.entries(ACTION_META)) {
			expect(sharedMeta[field as keyof ActionMeta] !== undefined, field).toBe(reach === 'shared');
		}
		const sharedTool = shared.tools!.p0![0]!;
		for (const [field, reach] of Object.entries(TOOL)) {
			expect(sharedTool[field as keyof Tool] !== undefined, field).toBe(reach === 'shared');
		}
		expect(Object.values(BRIEF).every((reach) => reach === CHART.brief)).toBe(true);
	});

	it('keeps notes private unless the share asks for them', () => {
		const asked = forSharing(full(), { notes: true }).meta![A.a0_0]!;
		for (const [field, reach] of Object.entries(ACTION_META)) {
			expect(asked[field as keyof ActionMeta] !== undefined, field).toBe(reach === 'shared' || reach === 'asked');
		}
		expect(asked).toEqual({ kind: 'milestone', pinned: true, note: 'Page 40', details: 'Ask Ana' });
	});

	it('copies a chart fresh: the plan and its setup, none of the history', () => {
		const data = full();
		const fresh = withoutHistory(data);
		for (const [field, part] of Object.entries(CHART_PART)) {
			expect(fresh[field as keyof ChartData] !== undefined, field).toBe(part === 'plan');
		}
		for (const [field, part] of Object.entries(META_PART)) {
			expect(fresh.meta![A.a0_0]![field as keyof ActionMeta] !== undefined, field).toBe(part === 'plan');
		}
		for (const [field, part] of Object.entries(TOOL_PART)) {
			expect(fresh.tools!.p0![0]![field as keyof Tool] !== undefined, field).toBe(part === 'plan');
		}
		expect(data.days).toBeDefined();
		expect(data.meta![A.a0_0]!.done).toBe(true);
	});

	it('never shares what a fresh copy would leave behind', () => {
		for (const [field, part] of Object.entries(CHART_PART)) if (part === 'history') expect(CHART[field as keyof ChartData], field).not.toBe('shared');
		for (const [field, part] of Object.entries(META_PART)) if (part === 'history') expect(ACTION_META[field as keyof ActionMeta], field).not.toBe('shared');
		for (const [field, part] of Object.entries(TOOL_PART)) if (part === 'history') expect(TOOL[field as keyof Tool], field).not.toBe('shared');
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
