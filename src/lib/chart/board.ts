import { actionKey, getByKey, isRoutine, todayKey, weekStartKey, type ActionMeta, type ChartData } from './model.ts';

export type Lane = 'open' | 'todo' | 'doing' | 'done';

export const LANES: readonly Lane[] = ['open', 'todo', 'doing', 'done'];

export const LANE_NAMES: Record<Lane, string> = { open: 'Open', todo: 'To do', doing: 'Doing', done: 'Done' };

export type Card = {
	key: string;
	text: string;
	pillarIndex: number;
	/** Its place in the pillar, 0 to 7, which is the order Open keeps. */
	slot: number;
	routine: boolean;
	doneAt?: string;
	/** Its order in To do and Doing. In Done, when it was moved there, so the latest of a day comes first. */
	rank?: number;
};

export type Board = Record<Lane, Card[]>;

/** Changes to `meta`, per action key. A field set to undefined is cleared. */
export type MetaPatch = Record<string, Partial<ActionMeta>>;

/** A routine is never done: it is ticked day by day in Today. */
export function laneOf(meta: ActionMeta | undefined): Lane {
	if (meta?.done && !isRoutine(meta)) return 'done';
	return meta?.lane === 'todo' || meta?.lane === 'doing' ? meta.lane : 'open';
}

export function canGo(card: Card, lane: Lane): boolean {
	return lane !== 'done' || !card.routine;
}

function chartOrder(a: Card, b: Card): number {
	return a.pillarIndex - b.pillarIndex || a.slot - b.slot;
}

function byRank(a: number | undefined, b: number | undefined, missing: number): number {
	const left = a ?? missing;
	const right = b ?? missing;
	return left === right ? 0 : left < right ? -1 : 1;
}

/** Newest first: by day, then the last one moved there, then the chart's order. */
function doneOrder(a: Card, b: Card): number {
	return (b.doneAt ?? '').localeCompare(a.doneAt ?? '') || byRank(b.rank, a.rank, Number.NEGATIVE_INFINITY) || chartOrder(a, b);
}

export function boardOf(data: ChartData): Board {
	const board: Board = { open: [], todo: [], doing: [], done: [] };
	for (let pillarIndex = 0; pillarIndex < 8; pillarIndex++) {
		for (let slot = 0; slot < 8; slot++) {
			const key = actionKey(pillarIndex, slot);
			const text = getByKey(data, key).trim();
			if (!text) continue;
			const meta = data.meta?.[key];
			const card: Card = { key, text, pillarIndex, slot, routine: isRoutine(meta) };
			const lane = laneOf(meta);
			if (lane === 'done' && meta?.doneAt) card.doneAt = meta.doneAt;
			if (lane !== 'open' && meta?.rank !== undefined) card.rank = meta.rank;
			board[lane].push(card);
		}
	}
	for (const lane of ['todo', 'doing'] as const) {
		board[lane].sort((a, b) => byRank(a.rank, b.rank, Number.POSITIVE_INFINITY) || chartOrder(a, b));
	}
	board.done.sort(doneOrder);
	return board;
}

export function findCard(board: Board, key: string): { lane: Lane; index: number; card: Card } | null {
	for (const lane of LANES) {
		const index = board[lane].findIndex((card) => card.key === key);
		if (index >= 0) return { lane, index, card: board[lane][index]! };
	}
	return null;
}

/**
 * The board as it will read once `key` lands in `lane` at `index`. Open keeps the chart's order and Done puts
 * the newest first, so in those two the card goes where it will settle, whatever the index.
 */
export function placed(board: Board, key: string, lane: Lane, index: number, today: string = todayKey()): Board {
	const found = findCard(board, key);
	if (!found) return board;
	const next: Board = { open: [...board.open], todo: [...board.todo], doing: [...board.doing], done: [...board.done] };
	next[found.lane].splice(found.index, 1);
	const card = lane === 'done' && found.lane !== 'done' ? { ...found.card, doneAt: today, rank: Number.POSITIVE_INFINITY } : found.card;
	if (lane === 'open') {
		next.open.push(card);
		next.open.sort(chartOrder);
	} else if (lane === 'done') {
		next.done.push(card);
		next.done.sort(doneOrder);
	} else {
		next[lane].splice(Math.max(0, Math.min(index, next[lane].length)), 0, card);
	}
	return next;
}

/**
 * What `meta` needs so `key` sits in `lane` at `index`. Null when the card cannot go there. To do and Doing are
 * renumbered from 0 so their order survives any merge; Done takes today's date and the time it was moved, and
 * leaving Done reopens it.
 */
export function moveCard(
	data: ChartData,
	key: string,
	lane: Lane,
	index: number,
	today: string = todayKey(),
	now: number = Date.now()
): MetaPatch | null {
	const board = boardOf(data);
	const found = findCard(board, key);
	if (!found || !canGo(found.card, lane)) return null;
	const meta = data.meta?.[key];
	const reopen: Partial<ActionMeta> = found.lane === 'done' ? { done: false, doneAt: undefined } : {};
	if (lane === 'done') {
		if (found.lane === 'done') return {};
		return { [key]: { kind: meta?.kind ?? 'milestone', done: true, doneAt: today, lane: undefined, rank: now } };
	}
	if (lane === 'open') {
		if (found.lane === 'open') return {};
		return { [key]: { ...reopen, lane: undefined, rank: undefined } };
	}
	const list = placed(board, key, lane, index, today)[lane];
	const patch: MetaPatch = {};
	list.forEach((card, rank) => {
		if (card.key === key) {
			if (found.lane !== lane || meta?.rank !== rank) patch[key] = { ...reopen, lane, rank };
		} else if (data.meta?.[card.key]?.rank !== rank) {
			patch[card.key] = { rank };
		}
	});
	return patch;
}

/** Today deals pinned routines first, then what is in Doing, then To do, each in its board order. */
export function dealFirst(a: ActionMeta | undefined, b: ActionMeta | undefined): number {
	const weight = (meta: ActionMeta | undefined): number => {
		if (meta?.pinned) return 0;
		const lane = laneOf(meta);
		return lane === 'doing' ? 1 : lane === 'todo' ? 2 : 3;
	};
	const rank = (meta: ActionMeta | undefined): number => (meta?.pinned ? 0 : (meta?.rank ?? 0));
	return weight(a) - weight(b) || rank(a) - rank(b);
}

/** Done, split at the start of this week, for a look back at the end of it. */
export function doneByWeek(cards: Card[], now: Date = new Date()): { week: Card[]; earlier: Card[] } {
	const monday = weekStartKey(now);
	return {
		week: cards.filter((card) => (card.doneAt ?? '') >= monday),
		earlier: cards.filter((card) => (card.doneAt ?? '') < monday)
	};
}

/** The list one step to the side. Done is skipped for a routine. */
export function besideLane(card: Card, from: Lane, step: 1 | -1): Lane | null {
	let at = LANES.indexOf(from) + step;
	while (LANES[at] && !canGo(card, LANES[at]!)) at += step;
	return LANES[at] ?? null;
}

/**
 * The index in the whole list for a place among the cards a filter shows: before the shown card at `at`, or
 * after the last shown one. `rest` is the list without the card being moved.
 */
export function wholeIndex(rest: Card[], shown: (card: Card) => boolean, at: number): number {
	const visible = rest.filter(shown);
	if (at < visible.length) return rest.indexOf(visible[Math.max(0, at)]!);
	const last = visible.at(-1);
	return last ? rest.indexOf(last) + 1 : rest.length;
}
