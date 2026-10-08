import { beforeEach, describe, expect, it, vi } from 'vitest';

type Need = { provider: 'webllm' | 'builtin'; model: string; download: string | null };

const coach = vi.hoisted(() => ({
	needs: 0,
	need: null as (() => Need | null) | null,
	loaded: false,
	answers: 0,
	sketches: 0
}));

vi.mock('./coach.browser.ts', () => ({
	needFor: async () => {
		coach.needs++;
		return coach.need?.() ?? null;
	},
	coachLoaded: () => coach.loaded,
	resumeCoach: () => {},
	watchCoachProgress: () => () => {},
	loadCoach: async () => {
		coach.loaded = true;
	},
	answer: async () => {
		coach.loaded = true;
		coach.answers++;
		return 'Start with the pillar you skipped.';
	},
	proposePillars: async (answers: { direction: string }, onPartial: (draft: unknown) => void) => {
		coach.loaded = true;
		coach.sketches++;
		const draft = sketchOf(answers.direction, coach.sketches);
		onPartial(structuredClone(draft));
		return { chart: draft, raw: '' };
	},
	fillDraftActions: async (draft: { actions: string[][] }, _answers: unknown, onPartial: (draft: unknown) => void) => {
		draft.actions = draft.actions.map((row, index) => row.map((_, action) => (index === 7 && action > 3 ? '' : `Step ${index}.${action}`)));
		onPartial(structuredClone(draft));
		return draft;
	}
}));

function sketchOf(goal: string, round: number) {
	return {
		goal,
		pillars: Array.from({ length: 8 }, (_, index) => `Pillar ${round}.${index}`),
		actions: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => ''))
	};
}

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

const webllm = (): Need => ({ provider: 'webllm', model: 'Qwen3-4B-q4f16_1-MLC', download: '2.3 GB' });

beforeEach(() => {
	coach.needs = 0;
	coach.need = webllm;
	coach.loaded = false;
	coach.answers = 0;
	coach.sketches = 0;
});

describe('HelperStore model consent', () => {
	it('asks before the download, then answers once agreed, and does not ask again', async () => {
		const helper = store();
		await helper.send('How do I stay motivated?');
		const card = helper.messages.at(-1)!;
		expect(card.card).toEqual({ kind: 'download', size: '2.3 GB', builtin: false });
		expect(card.text).toMatch(/^I write with a small model/);

		helper.allowDownload(card.id);
		await vi.waitFor(() => expect(helper.messages.at(-1)?.text).toBe('Start with the pillar you skipped.'));

		await helper.send('Should I run in the morning?');
		await vi.waitFor(() => expect(coach.answers).toBe(2));
		expect(helper.messages.filter((message) => message.card?.kind === 'download')).toHaveLength(1);
	});

	it('asks before writing too', async () => {
		const helper = store();
		await helper.start('fill');
		expect(coach.needs).toBe(1);
		expect(helper.messages.at(-1)?.card).toEqual({ kind: 'download', size: '2.3 GB', builtin: false });
	});

	it('runs straight away when nothing has to download', async () => {
		coach.need = () => ({ provider: 'builtin', model: 'built-in', download: null });
		const helper = store();
		await helper.send('How do I stay motivated?');
		expect(helper.messages.some((message) => message.card?.kind === 'download')).toBe(false);
		expect(helper.messages.at(-1)?.text).toBe('Start with the pillar you skipped.');
	});

	it("offers the browser's own model when it still has to fetch it", async () => {
		coach.need = () => ({ provider: 'builtin', model: 'built-in', download: '' });
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

describe('HelperStore sketch, as in the Slovak report', () => {
	function blank() {
		const data = emptyChart();
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

	async function sketched() {
		coach.need = () => ({ provider: 'webllm', model: 'Qwen3-4B-q4f16_1-MLC', download: null });
		const helper = blank();
		await helper.send('I want to learn Slovak');
		const sketch = helper.chips.find((chip) => chip.act.kind === 'sketch');
		expect(sketch).toBeDefined();
		helper.choose(sketch!);
		await vi.waitFor(() => expect(helper.messages.at(-1)?.text).toMatch(/^Anything that would change the plan/));
		return helper;
	}

	const lastCard = (helper: InstanceType<typeof HelperStore>) => helper.messages.filter((message) => message.card?.kind === 'chart').at(-1)!;

	it('redoes the pillars on "Try again", in view, without writing the actions', async () => {
		const helper = await sketched();
		await helper.send('Try again');
		await vi.waitFor(() => expect(coach.sketches).toBe(2));
		const card = lastCard(helper);
		expect(helper.messages.at(-1)?.id).toBe(card.id);
		expect(card.card?.kind === 'chart' && card.card.data.pillars[0]).toBe('Pillar 2.0');
		expect(card.card?.kind === 'chart' && card.card.data.actions.flat().every((action) => action === '')).toBe(true);
	});

	it('fills the actions in a card that sits next to the result', async () => {
		const helper = await sketched();
		await helper.send('go');
		await vi.waitFor(() => expect(helper.messages.at(-1)?.text).toMatch(/^60 of 64 actions are in/));
		const card = lastCard(helper);
		expect(helper.messages.at(-2)?.id).toBe(card.id);
		expect(card.state).toBe('open');
	});

	it('answers "I don\'t see the chart" by bringing the card down, without the model', async () => {
		const helper = await sketched();
		await helper.send('go');
		await vi.waitFor(() => expect(helper.messages.at(-1)?.text).toMatch(/^60 of 64/));
		await helper.send("I don't see the chart");
		const card = lastCard(helper);
		expect(helper.messages.at(-1)?.id).toBe(card.id);
		expect(helper.messages.at(-2)?.text).toBe('Here it is. Use this chart to keep it.');
		expect(coach.answers).toBe(0);
	});
});
