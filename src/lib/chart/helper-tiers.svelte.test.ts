import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoachTier } from './coach-model.ts';

type Need = { tier: CoachTier; provider: 'webllm' | 'builtin'; model: string; download: string | null };

const coach = vi.hoisted(() => ({
	needs: [] as [CoachTier, readonly string[]][],
	need: null as ((tier: CoachTier) => Need | null) | null,
	loaded: false
}));

vi.mock('./coach.browser.ts', () => ({
	needFor: async (tier: CoachTier, agreed: readonly string[]) => {
		coach.needs.push([tier, [...agreed]]);
		return coach.need?.(tier) ?? null;
	},
	coachLoaded: () => coach.loaded,
	resumeCoach: () => {},
	watchCoachProgress: () => () => {},
	loadCoach: async () => {
		coach.loaded = true;
	},
	answer: async () => {
		coach.loaded = true;
		return 'Start with the pillar you skipped.';
	}
}));

const { HelperStore } = await import('./helper.svelte.ts');
const { emptyChart } = await import('./model.ts');

function store() {
	const data = emptyChart();
	data.goal = 'Run a half marathon';
	data.pillars = ['Easy runs', 'Speed', 'Long run', 'Strength', 'Sleep', 'Food', 'Shoes', 'Calendar'];
	return new HelperStore({
		data: () => data,
		selectedPillar: () => null,
		applyDraft: () => true,
		setCells: () => {},
		setToday: () => {},
		pinWeek: () => {},
		showCell: () => {}
	});
}

const webllm = (tier: CoachTier): Need =>
	tier === 'talk'
		? { tier, provider: 'webllm', model: 'Qwen3-1.7B-q4f16_1-MLC', download: '1 GB' }
		: { tier, provider: 'webllm', model: 'Qwen3-4B-q4f16_1-MLC', download: '2.3 GB' };

beforeEach(() => {
	coach.needs = [];
	coach.need = webllm;
	coach.loaded = false;
});

describe('HelperStore model tiers', () => {
	it('asks for the small download for an open question, then answers once agreed', async () => {
		const helper = store();
		await helper.send('How do I stay motivated?');
		const card = helper.messages.at(-1)!;
		expect(coach.needs[0]?.[0]).toBe('talk');
		expect(card.card).toEqual({ kind: 'download', size: '1 GB', builtin: false });
		expect(card.text).toMatch(/^I answer with a small model/);

		helper.allowDownload(card.id);
		await vi.waitFor(() => expect(helper.messages.at(-1)?.text).toBe('Start with the pillar you skipped.'));

		await helper.send('Should I run in the morning?');
		expect(coach.needs.at(-1)).toEqual(['talk', ['Qwen3-1.7B-q4f16_1-MLC']]);
		expect(helper.messages.filter((message) => message.card?.kind === 'download')).toHaveLength(1);
	});

	it('asks for the writer before writing', async () => {
		const helper = store();
		await helper.start('fill');
		expect(coach.needs[0]?.[0]).toBe('write');
		expect(helper.messages.at(-1)?.card).toEqual({ kind: 'download', size: '2.3 GB', builtin: false });
	});

	it('runs straight away when nothing has to download', async () => {
		coach.need = (tier) => ({ tier, provider: 'builtin', model: 'built-in', download: null });
		const helper = store();
		await helper.send('How do I stay motivated?');
		expect(helper.messages.some((message) => message.card?.kind === 'download')).toBe(false);
		expect(helper.messages.at(-1)?.text).toBe('Start with the pillar you skipped.');
	});

	it("offers the browser's own model when it still has to fetch it", async () => {
		coach.need = (tier) => ({ tier, provider: 'builtin', model: 'built-in', download: '' });
		const helper = store();
		await helper.send('How do I stay motivated?');
		expect(helper.messages.at(-1)?.card).toEqual({ kind: 'download', size: '', builtin: true });
		expect(helper.messages.at(-1)?.text).toMatch(/model of its own/);
	});

	it('says so when nothing can run here', async () => {
		coach.need = () => null;
		const helper = store();
		await helper.send('How do I stay motivated?');
		expect(helper.messages.at(-1)?.text).toMatch(/can't run me on the device/);
	});
});
