import { beforeEach, describe, expect, it, vi } from 'vitest';

type Need = { provider: 'webllm' | 'builtin'; model: string; download: string | null };

const coach = vi.hoisted(() => ({
	needs: 0,
	need: null as (() => Need | null) | null,
	loaded: false,
	answers: 0,
	sketches: 0,
	asked: [] as { direction: string; situation: string }[],
	fills: [] as { pillarIndex: number; count: number; earlier: number }[]
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
	fillActions: async (draft: { actions: string[][] }, pillarIndex: number, count: number) => {
		coach.loaded = true;
		coach.fills.push({ pillarIndex, count, earlier: draft.actions.flat().filter((action) => action.startsWith('New ')).length });
		return Array.from({ length: count }, (_, index) => `New ${pillarIndex}.${index}`);
	},
	answer: async () => {
		coach.loaded = true;
		coach.answers++;
		return 'Start with the pillar you skipped.';
	},
	proposePillars: async (answers: { direction: string; situation: string }, onPartial: (draft: unknown) => void) => {
		coach.loaded = true;
		coach.sketches++;
		coach.asked.push({ direction: answers.direction, situation: answers.situation });
		const draft = sketchOf(answers.direction, coach.sketches);
		onPartial(structuredClone(draft));
		return { chart: draft, raw: '' };
	},
	fillDraftActions: async (draft: { actions: string[][] }, answers: { direction: string; situation: string }, onPartial: (draft: unknown) => void) => {
		coach.asked.push({ direction: answers.direction, situation: answers.situation });
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
	coach.asked = [];
	coach.fills = [];
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

describe('HelperStore sketch, from a message that says more than the goal', () => {
	const SLOVAK =
		'I want to learn Slovak. I am currently about a A1 maybe A2, but I have an insane lack of vocabulary and I am shit at reading as well as bad with having conversation';

	function onChart() {
		coach.need = () => ({ provider: 'webllm', model: 'Qwen3-4B-q4f16_1-MLC', download: null });
		return store();
	}

	async function sketch(helper: InstanceType<typeof HelperStore>) {
		await helper.send(SLOVAK);
		helper.choose(helper.chips.find((chip) => chip.act.kind === 'sketch')!);
		await vi.waitFor(() => expect(coach.sketches).toBe(1));
		await vi.waitFor(() => expect(helper.busy).toBe(false));
	}

	it('keeps what was said, and the pillars hear it', async () => {
		const helper = onChart();
		await helper.send(SLOVAK);
		expect(helper.messages.at(-1)?.text).toBe('A new goal gets its own chart. Your current one stays. I kept what you told me.');
		helper.choose(helper.chips.find((chip) => chip.act.kind === 'sketch')!);
		await vi.waitFor(() => expect(coach.sketches).toBe(1));
		expect(coach.asked[0]?.direction).toBe('learn Slovak');
		expect(coach.asked[0]?.situation).toMatch(/A1 maybe A2.*vocabulary.*reading.*conversation/);
	});

	it('asks only for time and a date, with chips, and the card writes the actions', async () => {
		const helper = onChart();
		await sketch(helper);
		expect(helper.messages.at(-1)?.text).toBe('How much time can you give it a day, and is there a date?');
		expect(helper.chips.map((chip) => chip.label)).toEqual(['15 minutes a day', '30 minutes a day', 'An hour a day', 'No date']);
		const card = helper.messages.find((message) => message.card?.kind === 'chart')!;
		expect(card.card?.kind === 'chart' && card.card.sketch).toBe(true);
		await helper.send('30 minutes a day');
		await vi.waitFor(() => expect(helper.messages.at(-1)?.text).toMatch(/of 64 actions are in/));
		expect(coach.asked.at(-1)?.situation).toMatch(/conversation 30 minutes a day$/);
		const filled = helper.messages.find((message) => message.card?.kind === 'chart')!;
		expect(filled.card?.kind === 'chart' && filled.card.sketch).toBe(false);
	});

	it('writes the actions instead of keeping an empty chart when the sketch is used', async () => {
		const helper = onChart();
		await sketch(helper);
		const card = helper.messages.find((message) => message.card?.kind === 'chart')!;
		helper.use(card.id);
		await vi.waitFor(() => expect(helper.messages.at(-1)?.text).toMatch(/of 64 actions are in/));
		expect(helper.messages.some((message) => message.text.startsWith('Done.'))).toBe(false);
	});

	it('tries other pillars from the card', async () => {
		const helper = onChart();
		await sketch(helper);
		helper.otherPillars();
		await vi.waitFor(() => expect(coach.sketches).toBe(2));
		expect(coach.asked[1]?.situation).toMatch(/vocabulary/);
	});
});

describe('HelperStore fill the whole chart', () => {
	function gappy() {
		coach.need = () => ({ provider: 'webllm', model: 'Qwen3-4B-q4f16_1-MLC', download: null });
		const data = emptyChart();
		data.goal = 'Learn Slovak';
		data.pillars = ['Words', 'Reading', 'Speaking', 'Listening', 'Grammar', 'Writing', 'Tutor', 'Review'];
		data.actions[1] = data.actions[1]!.map(() => 'Read a page');
		const changed: string[] = [];
		const helper = new HelperStore({
			data: () => data,
			selectedPillar: () => null,
			applyDraft: () => true,
			setCells: (edits) => {
				for (const edit of edits) changed.push(edit.key);
			},
			setToday: () => {},
			pinWeek: () => {},
			showCell: () => {}
		});
		return { helper, changed };
	}

	it('fills every pillar with gaps on one card, each pillar seeing the ones before', async () => {
		const { helper, changed } = gappy();
		await helper.send('Fill the whole chart');
		await vi.waitFor(() => expect(helper.busy).toBe(false));
		expect(coach.fills.map((fill) => fill.pillarIndex)).toEqual([0, 2, 3, 4, 5, 6, 7]);
		expect(coach.fills.map((fill) => fill.earlier)).toEqual([0, 8, 16, 24, 32, 40, 48]);
		const card = helper.messages.at(-1)!;
		expect(card.text).toBe('56 actions across 7 pillars, ready to add.');
		expect(card.card?.kind === 'cells' && card.card.edits.length).toBe(56);
		helper.use(card.id);
		expect(changed).toHaveLength(56);
		expect(helper.messages.at(-1)?.text).toBe('Added 56 actions.');
	});

	it('fills only the pillar a message names', async () => {
		const { helper } = gappy();
		await helper.send('write actions for Speaking');
		await vi.waitFor(() => expect(helper.busy).toBe(false));
		expect(coach.fills.map((fill) => fill.pillarIndex)).toEqual([2]);
		expect(helper.messages.at(-1)?.text).toBe('8 actions, ready to add.');
		helper.use(helper.messages.at(-1)!.id);
		expect(helper.messages.at(-1)?.text).toBe('Added 8 actions to Speaking.');
	});

	it('offers the whole chart as a chip', async () => {
		const { helper } = gappy();
		helper.show();
		// Opening the panel warms the model. Wait for it, so the job's import is not a second, concurrent mocked import.
		await vi.waitFor(() => expect(coach.needs).toBe(1));
		const chip = helper.chips.find((entry) => entry.label === 'Fill all 7 pillars');
		expect(chip).toBeDefined();
		helper.choose(chip!);
		await vi.waitFor(() => expect(coach.fills).toHaveLength(7));
	});
});
