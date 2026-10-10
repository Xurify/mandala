import { buildChart, getPreset, type PresetId } from './presets/index.ts';
import type { ViewMode } from './chart.svelte.ts';
import { dateKeyOf, type ChartData, type DayLog } from './model.ts';

/**
 * Ready-made situations for trying each feature by hand, from `/dev/demo`. Each one opens as a new chart
 * (or fills the current one when it is empty), so nothing saved is touched.
 */
export type DemoId =
	| 'complete'
	| 'pillar'
	| 'empty'
	| 'spatial'
	| 'search'
	| 'views'
	| 'today'
	| 'reflection'
	| 'bindu-week'
	| 'bindu-review'
	| 'bindu-fill'
	| 'bindu-new';

export type DemoSetup = {
	/** The chart to open. Null opens a new, empty one. */
	data: ChartData | null;
	view: ViewMode;
	/** A cell to put the cursor in. */
	focus?: string;
	/** Text to search for. */
	query?: string;
	/** Something to open once the chart is in view. */
	open?: { bindu: 'home' | 'review' | 'write-fill' | 'write-new' } | { reflection: true };
};

export type Demo = {
	id: DemoId;
	title: string;
	group: 'Writing the chart' | 'Moving around' | 'Days and weeks' | 'Bindu';
	/** What to do once it opens, in order. */
	steps: string[];
	/** A chat app's reply to paste back, for the demos that need one. */
	reply?: () => string;
};

function preset(id: PresetId): ChartData {
	return buildChart(getPreset(id)!);
}

/** A history of ticks: for each day back, which actions were picked and ticked. */
function history(data: ChartData, now: Date, days: Record<number, { focus: string[]; checked: string[] }>): void {
	data.days = {};
	for (const [back, log] of Object.entries(days)) {
		const date = new Date(now);
		date.setDate(now.getDate() - Number(back));
		const entry: DayLog = { focus: log.focus, checked: log.checked, started: log.focus.length > 0 };
		entry.at = Object.fromEntries(log.checked.map((key, index) => [key, `0${7 + (index % 3)}:${10 + index * 7}`]));
		data.days[dateKeyOf(date)] = entry;
	}
}

/** A lived-in week: most pillars ticked, two quiet, a milestone closed, and one pick that keeps slipping. */
function livedIn(now: Date): ChartData {
	const data = preset('language');
	history(data, now, {
		0: { focus: ['a0_1', 'a2_0', 'a4_0'], checked: ['a0_1'] },
		1: { focus: ['a0_0', 'a1_0', 'a3_2'], checked: ['a0_0', 'a1_0', 'a3_2'] },
		2: { focus: ['a5_1', 'a1_3', 'a2_2'], checked: ['a5_1', 'a2_2'] },
		3: { focus: ['a0_2', 'a3_0', 'a4_1'], checked: ['a0_2', 'a3_0', 'a4_1', 'a1_1'] },
		4: { focus: ['a5_1', 'a2_3', 'a0_0'], checked: ['a2_3', 'a0_0'] },
		5: { focus: ['a1_2', 'a4_2', 'a5_1'], checked: ['a1_2', 'a4_2'] },
		9: { focus: ['a5_1'], checked: [] }
	});
	const twoDaysAgo = new Date(now);
	twoDaysAgo.setDate(now.getDate() - 2);
	data.meta = {
		a3_5: { kind: 'milestone', done: true, doneAt: dateKeyOf(twoDaysAgo) },
		a1_6: { kind: 'milestone', done: true, doneAt: dateKeyOf(now) },
		a2_7: { kind: 'milestone' },
		a0_0: { kind: 'routine' }
	};
	return data;
}

export const DEMOS: readonly Demo[] = [
	{
		id: 'complete',
		title: 'Write the last line',
		group: 'Writing the chart',
		steps: [
			'Every cell is written but one. The cursor is already in it.',
			'Type anything. The pillar stamps its check, its block glows, and the ring at the top draws all eight arcs and a check.',
			'Clear the cell and type again to see it once more.'
		]
	},
	{
		id: 'pillar',
		title: 'Finish a pillar',
		group: 'Writing the chart',
		steps: [
			'Core phrases is one action short. The cursor is in the empty cell.',
			'Type anything. Its check stamps onto pillar 3, its block glows, and its arc in the ring redraws.',
			'The chart is not full, so there is no chart moment.'
		]
	},
	{
		id: 'empty',
		title: 'A blank chart',
		group: 'Writing the chart',
		steps: [
			'A new, empty chart in chart view. The ring draws itself, the center dot lands, then the words.',
			'Try each way to start: a preset, a chat app, or writing it yourself.'
		]
	},
	{
		id: 'views',
		title: 'Views that move',
		group: 'Moving around',
		steps: [
			'Click any cell. Its block grows into the editor.',
			'Switch views with the dock. The dock stays where it is while the page changes under it.',
			'Change the theme or the accent in the menu (the three dots). The page crossfades.'
		]
	},
	{
		id: 'spatial',
		title: 'Move around the map',
		group: 'Moving around',
		steps: [
			'The editor is open on the goal.',
			'Tap the numbered pillars, or the arrows on a wide screen. Each block slides in from where it sits on the chart: pillar 1 from the top left, pillar 8 from the bottom right.'
		]
	},
	{
		id: 'search',
		title: 'Search and travel',
		group: 'Moving around',
		steps: ['The search already holds "phrases".', 'Click a result. The chip travels into the cell it names, in the editor.']
	},
	{
		id: 'today',
		title: "Today's three",
		group: 'Days and weeks',
		steps: ['Today view, with a week of history behind it.', 'Deal three, start the day, then tick them all to see the day sealed.']
	},
	{
		id: 'reflection',
		title: 'Your week',
		group: 'Days and weeks',
		steps: [
			'The weekly reflection opens: how the week went, what you finished, what sat out, and a line for next week.',
			'Rewrite an action on the "What sat out" page. Save the week to see the ring draw the pillars that moved.',
			'You can open it any day from the command palette: Reflect on this week.'
		]
	},
	{
		id: 'bindu-week',
		title: 'Bindu with a week behind it',
		group: 'Bindu',
		steps: [
			'Bindu opens with a note from your week.',
			"Open How it is going, then Today's three. Swap a pick, then put them on today."
		]
	},
	{
		id: 'bindu-review',
		title: 'Bindu reviews weak lines',
		group: 'Bindu',
		steps: [
			'Review opens on a chart with weak lines. The chart sweeps, then the weak cells get a ring.',
			'Click a line to open it in the editor and fix it. It folds out of the list.'
		]
	},
	{
		id: 'bindu-fill',
		title: 'Fill the gaps with a chat app',
		group: 'Bindu',
		steps: [
			'Write with a chat app opens on Fill the gaps. Copy the prompt.',
			'Instead of a chat app, use "Copy a sample reply" on this card, then paste it into the reply box (or anywhere in Bindu).',
			'Add the lines to the chart to see the moment.'
		],
		reply: () => JSON.stringify(preset('fitness'))
	},
	{
		id: 'bindu-new',
		title: 'Start a chart with a chat app',
		group: 'Bindu',
		steps: [
			'A blank chart, with Bindu on Write with a chat app. Type a goal and copy the prompt.',
			'Use "Copy a sample reply" on this card and paste it into the reply box.',
			'Start this chart to see it open, with the moment in Bindu.'
		],
		reply: () => JSON.stringify(preset('music'))
	}
];

/** What a demo opens. `now` fixes the history to a day. */
export function demoSetup(id: DemoId, now: Date = new Date()): DemoSetup {
	if (id === 'complete') {
		const data = preset('language');
		data.actions[7]![7] = '';
		return { data, view: 'split', focus: 'a7_7' };
	}
	if (id === 'pillar') {
		const data = preset('language');
		data.actions[2]![5] = '';
		for (let index = 4; index < 8; index++) data.actions[6]![index] = '';
		return { data, view: 'split', focus: 'a2_5' };
	}
	if (id === 'empty') return { data: null, view: 'view' };
	if (id === 'views') return { data: preset('fitness'), view: 'view' };
	if (id === 'spatial') return { data: preset('study'), view: 'edit', focus: 'g' };
	if (id === 'search') return { data: preset('language'), view: 'view', query: 'phrases' };
	if (id === 'today') return { data: livedIn(now), view: 'today' };
	if (id === 'reflection') return { data: livedIn(now), view: 'today', open: { reflection: true } };
	if (id === 'bindu-week') return { data: livedIn(now), view: 'view', open: { bindu: 'home' } };
	if (id === 'bindu-review') {
		const data = preset('health');
		data.actions[0]![0] = 'Be healthier';
		data.actions[1]![2] = 'Sleep more';
		data.actions[3]![1] = 'Get 10k followers';
		data.actions[5]![4] = 'Work hard every day';
		data.pillars[6] = 'Motivation';
		return { data, view: 'view', open: { bindu: 'review' } };
	}
	if (id === 'bindu-fill') {
		const data = preset('fitness');
		data.pillars[6] = '';
		data.actions[6] = data.actions[6]!.map(() => '');
		data.actions[2] = data.actions[2]!.map((action, index) => (index < 3 ? action : ''));
		return { data, view: 'view', open: { bindu: 'write-fill' } };
	}
	return { data: null, view: 'view', open: { bindu: 'write-new' } };
}

export function isDemoId(value: string | null): value is DemoId {
	return DEMOS.some((demo) => demo.id === value);
}
