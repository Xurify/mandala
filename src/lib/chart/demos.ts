import { buildChart, getPreset, type PresetId } from './presets/index.ts';
import type { ViewMode } from './chart.svelte.ts';
import { applyChange, finish } from './board.ts';
import { dateKeyOf, idAt, idOfKey, setMeta, type ActionId, type ActionMeta, type ChartData, type Tool } from './model.ts';

/**
 * Ready-made situations for trying each feature by hand, from `/dev/demo`. Each one opens as a new chart
 * (or fills the current one when it is empty), so nothing saved is touched.
 */
export type DemoId =
	| 'complete'
	| 'pillar'
	| 'phone'
	| 'today'
	| 'calendar'
	| 'board'
	| 'reflection'
	| 'bindu-week'
	| 'bindu-review'
	| 'bindu-fill'
	| 'bindu-new'
	| 'tools'
	| 'select';

export type DemoSetup = {
	/** Null opens a new, empty one. */
	data: ChartData | null;
	view: ViewMode;
	focus?: string;
	copies?: number;
	/** Opened as charts of their own before `data`, so a view across charts has more than one goal. */
	others?: ChartData[];
	open?: { bindu: 'home' | 'review' | 'write-fill' | 'write-new' } | { reflection: true } | { select: true };
};

export type Demo = {
	id: DemoId;
	title: string;
	group: 'Writing the chart' | 'Days and weeks' | 'Tools' | 'Your charts' | 'Bindu';
	steps: string[];
	reply?: () => string;
};

function preset(id: PresetId): ChartData {
	return buildChart(getPreset(id)!);
}

/** The demos name actions by their cell, `a{k}_{j}`, which reads better here than an id. */
function idIn(data: ChartData, key: string): ActionId {
	return idOfKey(data, key)!;
}

function metaFor(data: ChartData, byCell: Record<string, ActionMeta>): Record<ActionId, ActionMeta> {
	return Object.fromEntries(Object.entries(byCell).map(([key, meta]) => [idIn(data, key), meta]));
}

/** Ticks go through `finish`, the same as in the app, so a one-time action ticked here is done that day. */
function history(data: ChartData, now: Date, days: Record<number, { focus: string[]; checked: string[] }>): void {
	data.days = {};
	for (const back of Object.keys(days).map(Number).sort((a, b) => b - a)) {
		const date = new Date(now);
		date.setDate(now.getDate() - back);
		const dateKey = dateKeyOf(date);
		const { focus, checked } = days[back]!;
		data.days[dateKey] = { focus: focus.map((key) => idIn(data, key)), checked: [], started: focus.length > 0 };
		checked.forEach((key, index) =>
			applyChange(data, finish(data, idIn(data, key), dateKey, `0${7 + (index % 3)}:${10 + index * 7}`, date.getTime() + index))
		);
	}
}

function livedIn(now: Date): ChartData {
	const data = preset('language');
	data.meta = metaFor(data, { a2_7: { kind: 'milestone' }, a0_0: { kind: 'routine' } });
	history(data, now, {
		0: { focus: ['a0_1', 'a2_0', 'a4_0'], checked: ['a1_6', 'a0_1'] },
		1: { focus: ['a0_0', 'a1_0', 'a3_2'], checked: ['a0_0', 'a1_0', 'a3_2'] },
		2: { focus: ['a5_1', 'a1_3', 'a2_2'], checked: ['a5_1', 'a2_2', 'a3_5'] },
		3: { focus: ['a0_2', 'a3_0', 'a4_1'], checked: ['a0_2', 'a3_0', 'a4_1', 'a1_1'] },
		4: { focus: ['a5_1', 'a2_3', 'a0_0'], checked: ['a2_3', 'a0_0'] },
		5: { focus: ['a1_2', 'a4_2', 'a5_1'], checked: ['a1_2', 'a4_2'] },
		9: { focus: ['a5_1'], checked: [] }
	});
	return data;
}

function inTraining(now: Date): ChartData {
	const data = preset('fitness');
	data.meta = metaFor(data, { a1_0: { kind: 'routine' } });
	history(data, now, {
		0: { focus: ['a2_1', 'a3_0'], checked: ['a1_0'] },
		2: { focus: ['a0_2', 'a6_1'], checked: ['a1_0', 'a0_2'] },
		3: { focus: ['a3_0'], checked: ['a1_0'] },
		6: { focus: ['a4_3', 'a5_0'], checked: ['a4_3', 'a5_0', 'a1_0'] }
	});
	return data;
}

function onTheBoard(now: Date): ChartData {
	const data = livedIn(now);
	const filed: Record<string, Partial<ActionMeta>> = {
		a0_0: { kind: 'routine', lane: 'doing', rank: 0 },
		a5_0: { kind: 'milestone', lane: 'doing', rank: 1 },
		a2_1: { kind: 'milestone', lane: 'doing', rank: 2 },
		a5_2: { kind: 'milestone', lane: 'todo', rank: 0 },
		a4_0: { kind: 'milestone', lane: 'todo', rank: 1 },
		a3_1: { kind: 'milestone', lane: 'todo', rank: 2 }
	};
	for (const [key, meta] of Object.entries(filed)) setMeta(data, idIn(data, key), meta);
	const nineDaysAgo = new Date(now);
	nineDaysAgo.setDate(now.getDate() - 9);
	applyChange(data, finish(data, idIn(data, 'a1_4'), dateKeyOf(nineDaysAgo), '19:40', nineDaysAgo.getTime()));
	return data;
}

function shelves(data: ChartData, now: Date): NonNullable<ChartData['tools']> {
	const days = (count: number) =>
		Array.from({ length: count }, (_, index) => {
			const date = new Date(now);
			date.setDate(now.getDate() - index);
			return dateKeyOf(date);
		}).reverse();
	const tool = (id: string, url: string, title: string, extra: Partial<Tool> = {}): Tool => ({ id, url, title, kind: 'repeat', ...extra });
	return {
		p0: [tool('t-conv', 'https://youtu.be/6mCmru24BOI', 'Jak začít a udržet konverzaci s kýmkoliv', { kind: 'once', action: idAt(data, 0, 1) })],
		p1: [
			tool('t-easy', 'https://youtu.be/SZaaZpKLTFE', "you'll understand this video WITHOUT subtitles! 💯🇷🇺 | Super Easy Russian", { opened: days(3) }),
			tool('t-talk', 'https://youtu.be/wzMrFFcC1BU', "Let's Talk IN RUSSIAN! Easy Russian Listening Practice about new hobbies and life updates"),
			tool('t-words', 'https://youtu.be/5jJBrcct4o0', 'Learn 1000 Most Common Russian Words #16 (Words 301–320)', { opened: days(11) }),
			tool('t-kava', 'https://youtu.be/7VXq-j5Ni1g', 'Na káve s | Kristína Svarinská prežíva výnimočný rok'),
			tool('t-site', 'https://comprehensiblerussian.com/#/home', 'Comprehensible Russian')
		],
		p2: [
			tool('t-car', 'https://www.youtube.com/shorts/GKoQRaUraTo', 'Car Vocabulary in Slovak 🚗🤔', { opened: days(6) }),
			tool('t-room', 'https://www.youtube.com/shorts/3KCVOyS6UPc', 'The Living Room in Slovak 🛋️😀'),
			tool('t-eat', 'https://youtu.be/MCX0Px4izek', '"Кушать" или "есть"? Difference explained', { kind: 'once' }),
			tool('t-test', 'https://youtu.be/1FWYOawIJNA', 'Are you really A2 level? Take this vocabulary test', { kind: 'once', known: true, opened: days(1) })
		],
		p4: [
			tool('t-lingq', 'https://www.lingq.com/en/learn/ru/web/reader/23800803', 'LingQ reader', { action: idAt(data, 4, 0) }),
			tool('t-read', 'https://readline.app/r/moya-devushka', 'Moya devushka · readline', { action: idAt(data, 4, 0) })
		]
	};
}

export const DEMOS: readonly Demo[] = [
	{
		id: 'complete',
		title: 'Write the last line',
		group: 'Writing the chart',
		steps: [
			'Every cell is written but one. The cursor is already in it.',
			'Type the line, then pause or leave the cell. The pillar stamps its check, its block glows, and the ring at the top draws all eight arcs and a check.',
			'Clear the cell and type again to see it once more. Nothing plays while you are still typing.'
		]
	},
	{
		id: 'pillar',
		title: 'Finish a pillar',
		group: 'Writing the chart',
		steps: [
			'Core phrases is one action short. The cursor is in the empty cell.',
			'Type the line, then pause or leave the cell. Its check stamps onto pillar 3, its block glows, and its arc in the ring redraws.',
			'The chart is not full, so there is no chart moment.'
		]
	},
	{
		id: 'phone',
		title: 'The chart on a phone',
		group: 'Writing the chart',
		steps: [
			'Open it on a phone, or narrow the window under 900px. 81 cells cannot hold their words there, so the chart shows its center: the goal, and each pillar with how many of its eight actions are written.',
			'Tap a pillar. Its block opens with every action in words; the arrows walk round the pillars, and a tap on a line opens it in the editor.'
		]
	},
	{
		id: 'today',
		title: "Today's three",
		group: 'Days and weeks',
		steps: [
			'Today view, with ten days of ticks in the log: Calendar in the dock shows them day by day, and Bindu counts them in How it is going.',
			'Today\'s three are picked and one is done. Tick the rest and the habit to see the day sealed. Adjust deals three again; Plan tomorrow picks the next day\'s.',
			'A second chart, the half marathon, has two picks left today. Also today, under the list, names it and opens it; the dot on the chart title says the same from every view, and its row in the menu counts what is left.'
		]
	},
	{
		id: 'calendar',
		title: 'The calendar',
		group: 'Days and weeks',
		steps: [
			'Every chart is on it. A day shows a dot for each goal that finished something; tap it to read what, under each goal, and when.',
			'Under the month, Quiet this month names a goal with lines on it and nothing finished. The emergency fund is that goal here.',
			'Pick one chart from the title menu: its days show a ring of its pillars instead, and a line under the month says what the other charts finished, with Show all charts. Arrow keys walk the days; the arrows at the top turn the month.',
			'Reach it from Calendar in the dock, the command palette (Go to Calendar), or the C key.'
		]
	},
	{
		id: 'board',
		title: 'The board',
		group: 'Days and weeks',
		steps: [
			'Every action on the chart is a card. Open keeps the chart\'s order; To do, Doing, and Done hold what you moved.',
			'Drag a card into another list, or up and down in To do and Doing. On a phone, hold a card for a moment before you drag, or drop it on a list\'s tab.',
			'Drop one in Done: its check stamps, Today ticks it, and the calendar shows it today. "Talk to yourself for 5 minutes after dinner" is a routine, so Done turns it away.',
			'Today\'s three sit in Doing, marked Today. Open Today and tick one: it is in Done when you come back. Untick it, or drag it out of Done, and it reopens everywhere.',
			'With the keyboard: Tab to a card, Space picks it up, the arrows carry it, Space puts it down, Escape puts it back.',
			'Click a card: it opens beside the board like a ticket. Write notes on it, move it, change its kind, read its activity. Click another card and the sheet follows; Escape closes it.'
		]
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
		id: 'tools',
		title: 'Videos on a shelf',
		group: 'Tools',
		steps: [
			'Today opens with real Slovak and Russian links behind the actions. Each routine hands out one a day: tap ▶ to open it, the arrows for another, or the shelf button to open that pillar\'s shelf.',
			'On Listening\'s shelf, each link is one line: who hands it out, how often, and Up next on the one Today shows. The arrow opens its settings. One video was opened 11 of the last 14 days, so the shelf asks. Known ones wait folded at the end.',
			'Choose Actions under the pillar\'s name: the block turns back over. Click an action that hands out links, then Hands out … from the shelf to turn it again. On Sentence patterns, a link\'s See action 1 turns back to that cell.',
			'Remove a link from its settings, then press Undo on the slip. It goes back where it was.',
			'Click an action cell and paste a YouTube link into its note. It lands on the shelf, handed out by that action, and the cell counts it. Paste one anywhere else on the chart to pick a pillar instead. On Android, share from YouTube to Mandala does the same.',
			'On pillar 5, Sentence patterns, open the readline link\'s settings, press Add an icon, and pick any picture, an SVG included, or copy SVG code and press Ctrl V on that row. Every readline link wears it, in Today too.',
			'Open the calendar from Today: the day lists what was opened from a shelf. Press Ctrl K and type a video\'s title to open it from anywhere.'
		]
	},
	{
		id: 'select',
		title: 'Clearing out copies',
		group: 'Your charts',
		steps: [
			'Select charts opens with six copies of one chart. Select all, or type part of a name and Select these to pick every match.',
			'Untick the one to keep, or shift-click to pick a run of rows. Delete moves them to recently deleted, and the slip can undo all of them at once.',
			'It also opens from the chart switcher, under the list: Select charts.'
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
		title: 'Bindu finds weak lines',
		group: 'Bindu',
		steps: [
			'Weak lines opens on a chart with lines that fail the two tests. The chart sweeps, then the weak cells get a ring.',
			'Click a line to open it in the editor and fix it. It folds out of the list.',
			'Or press Review with a prompt instead: the chat app rewrites the failing lines, in any language, and Keep writes them in.'
		]
	},
	{
		id: 'bindu-fill',
		title: 'Fill the gaps with a prompt',
		group: 'Bindu',
		steps: [
			'Fill chart using a prompt opens on Fill the gaps. Copy the prompt, or open it in Claude or ChatGPT.',
			'Instead of a chat app, use "Copy a sample reply" on this card, then paste it into the reply box (or anywhere in Bindu).',
			'Add the lines to the chart to see the moment.'
		],
		reply: () => JSON.stringify(preset('fitness'))
	},
	{
		id: 'bindu-new',
		title: 'Start a chart with a prompt',
		group: 'Bindu',
		steps: [
			'A blank chart, with Bindu on Fill chart using a prompt. Type a goal and copy the prompt, or open it in Claude or ChatGPT.',
			'Use "Copy a sample reply" on this card and paste it into the reply box.',
			'Start this chart to see it open, with the moment in Bindu.'
		],
		reply: () => JSON.stringify(preset('music'))
	}
];

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
	if (id === 'phone') return { data: livedIn(now), view: 'view' };
	if (id === 'today') return { data: livedIn(now), view: 'today', others: [inTraining(now)] };
	if (id === 'calendar') return { data: livedIn(now), view: 'calendar', others: [inTraining(now), preset('money')] };
	if (id === 'board') return { data: onTheBoard(now), view: 'board' };
	if (id === 'tools') {
		const data = livedIn(now);
		data.meta = { ...data.meta, ...metaFor(data, { a1_0: { kind: 'routine' }, a1_1: { kind: 'routine' }, a2_1: { kind: 'routine' }, a4_0: { kind: 'milestone', pinned: true } }) };
		data.tools = shelves(data, now);
		return { data, view: 'today' };
	}
	if (id === 'select') return { data: preset('language'), view: 'view', copies: 5, open: { select: true } };
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
