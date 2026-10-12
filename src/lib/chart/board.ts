import { actionKey, clockOf, dateKeyOffset, getByKey, isRoutine, setMeta, todayKey, weekStartKey, type ActionMeta, type ChartData, type DayLog } from './model.ts';

export type Lane = 'open' | 'todo' | 'doing' | 'done';

export const LANES: readonly Lane[] = ['open', 'todo', 'doing', 'done'];

export const LANE_NAMES: Record<Lane, string> = { open: 'Open', todo: 'To do', doing: 'Doing', done: 'Done' };

export type Card = {
	key: string;
	text: string;
	pillarIndex: number;
	slot: number;
	routine: boolean;
	doneAt?: string;
	rank?: number;
};

export type Board = Record<Lane, Card[]>;

export type MetaPatch = Record<string, Partial<ActionMeta>>;

/** What a move writes: the actions' meta, and each day log it ticks, unticks, or takes a pick off. */
export type Change = { meta: MetaPatch; days: Record<string, DayLog> };

export function laneOf(meta: ActionMeta | undefined): Lane {
	if (meta?.done && !isRoutine(meta)) return 'done';
	return meta?.lane === 'todo' || meta?.lane === 'doing' ? meta.lane : 'open';
}

/** Ticked in Today, dropped in Done, or marked done in the editor: the three are one record. */
export function finishedOn(data: ChartData, key: string, dateKey: string): boolean {
	const meta = data.meta?.[key];
	if (isRoutine(meta)) return data.days?.[dateKey]?.checked.includes(key) ?? false;
	return meta?.done === true && meta.doneAt === dateKey;
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

function doneOrder(a: Card, b: Card): number {
	return (b.doneAt ?? '').localeCompare(a.doneAt ?? '') || byRank(b.rank, a.rank, Number.NEGATIVE_INFINITY) || chartOrder(a, b);
}

export function tomorrowOf(today: string): string {
	return dateKeyOffset(1, new Date(`${today}T12:00`));
}

/** Today's picks show in Doing, and tomorrow's plan in To do, whatever list they were filed in. */
export function boardOf(data: ChartData, today: string = todayKey()): Board {
	const board: Board = { open: [], todo: [], doing: [], done: [] };
	const day = data.days?.[today];
	const planned = data.days?.[tomorrowOf(today)]?.focus;
	for (let pillarIndex = 0; pillarIndex < 8; pillarIndex++) {
		for (let slot = 0; slot < 8; slot++) {
			const key = actionKey(pillarIndex, slot);
			const text = getByKey(data, key).trim();
			if (!text) continue;
			const meta = data.meta?.[key];
			const card: Card = { key, text, pillarIndex, slot, routine: isRoutine(meta) };
			const filed = laneOf(meta);
			let lane = filed;
			if ((filed === 'open' || filed === 'todo') && day?.focus.includes(key)) lane = 'doing';
			else if (filed === 'open' && planned?.includes(key)) lane = 'todo';
			if (lane === 'done' && meta?.doneAt) card.doneAt = meta.doneAt;
			if (lane === filed && lane !== 'open' && meta?.rank !== undefined) card.rank = meta.rank;
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

function blank(): Change {
	return { meta: {}, days: {} };
}

function patchMeta(change: Change, key: string, patch: Partial<ActionMeta>): void {
	change.meta[key] = { ...change.meta[key], ...patch };
}

function editDay(change: Change, data: ChartData, dateKey: string, edit: (log: DayLog) => DayLog): void {
	const log = change.days[dateKey] ?? data.days?.[dateKey] ?? { focus: [], checked: [] };
	const next = edit(log);
	if (next !== log) change.days[dateKey] = next;
}

function tick(key: string, time: string): (log: DayLog) => DayLog {
	return (log) => (log.checked.includes(key) ? log : { ...log, checked: [...log.checked, key], at: { ...log.at, [key]: time } });
}

function untick(key: string): (log: DayLog) => DayLog {
	return (log) => {
		if (!log.checked.includes(key)) return log;
		const at = { ...log.at };
		delete at[key];
		return { ...log, checked: log.checked.filter((each) => each !== key), at: Object.keys(at).length > 0 ? at : undefined };
	};
}

/** Kept as dropped, the same as a pick taken off in Today, so Bindu sees it. */
function unpick(key: string): (log: DayLog) => DayLog {
	return (log) =>
		log.focus.includes(key)
			? { ...log, focus: log.focus.filter((each) => each !== key), dropped: [...new Set([...(log.dropped ?? []), key])] }
			: log;
}

/** A plain action becomes a milestone, so once done it leaves Today's picks. */
export function finish(
	data: ChartData,
	key: string,
	today: string = todayKey(),
	time: string = clockOf(new Date()),
	now: number = Date.now()
): Change {
	const change = blank();
	const meta = data.meta?.[key];
	if (!isRoutine(meta) && !(meta?.done && meta.doneAt === today)) {
		patchMeta(change, key, { kind: meta?.kind ?? 'milestone', done: true, doneAt: today, rank: now });
		if (meta?.done && meta.doneAt) editDay(change, data, meta.doneAt, untick(key));
	}
	editDay(change, data, today, tick(key, time));
	return change;
}

export function reopen(data: ChartData, key: string, today: string = todayKey()): Change {
	const change = blank();
	const meta = data.meta?.[key];
	if (isRoutine(meta)) {
		editDay(change, data, today, untick(key));
	} else if (meta?.done) {
		patchMeta(change, key, { done: false, doneAt: undefined });
		if (meta.doneAt) editDay(change, data, meta.doneAt, untick(key));
	}
	return change;
}

export function applyChange(data: ChartData, change: Change): boolean {
	const days = Object.keys(change.days);
	if (Object.keys(change.meta).length === 0 && days.length === 0) return false;
	for (const [key, patch] of Object.entries(change.meta)) setMeta(data, key, patch);
	if (days.length > 0) data.days = { ...data.days, ...change.days };
	return true;
}

/** To do and Doing are renumbered from 0 on every move, so their order survives a sync merge. */
export function moveCard(
	data: ChartData,
	key: string,
	lane: Lane,
	index: number,
	today: string = todayKey(),
	now: number = Date.now(),
	time: string = clockOf(new Date(now))
): Change | null {
	const board = boardOf(data, today);
	const found = findCard(board, key);
	if (!found || !canGo(found.card, lane)) return null;
	if (lane === 'done') return found.lane === 'done' ? blank() : finish(data, key, today, time, now);
	if (lane === 'open' && found.lane === 'open') return blank();
	const change = found.lane === 'done' ? reopen(data, key, today) : blank();
	if (lane !== 'doing') editDay(change, data, today, unpick(key));
	if (lane === 'open') editDay(change, data, tomorrowOf(today), unpick(key));
	if (lane === 'open') {
		patchMeta(change, key, { lane: undefined, rank: undefined });
		return change;
	}
	placed(board, key, lane, index, today)[lane].forEach((card, rank) => {
		const meta = data.meta?.[card.key];
		if (laneOf(meta) !== lane || meta?.rank !== rank) patchMeta(change, card.key, { lane, rank });
	});
	return change;
}

export type Moment = { dateKey: string; what: 'finished' | 'ticked' | 'picked' | 'dropped'; at?: string };

/** What the day logs say happened to an action, newest first: one moment a day. */
export function historyOf(data: ChartData, key: string, limit = 8): Moment[] {
	const routine = isRoutine(data.meta?.[key]);
	const out: Moment[] = [];
	for (const dateKey of Object.keys(data.days ?? {}).sort().reverse()) {
		const log = data.days![dateKey]!;
		if (log.checked.includes(key)) out.push({ dateKey, what: routine ? 'ticked' : 'finished', at: log.at?.[key] });
		else if (log.dropped?.includes(key)) out.push({ dateKey, what: 'dropped' });
		else if (log.focus.includes(key)) out.push({ dateKey, what: 'picked' });
		if (out.length === limit) break;
	}
	return out;
}

export function dealFirst(a: ActionMeta | undefined, b: ActionMeta | undefined): number {
	const weight = (meta: ActionMeta | undefined): number => {
		if (meta?.pinned) return 0;
		const lane = laneOf(meta);
		return lane === 'doing' ? 1 : lane === 'todo' ? 2 : 3;
	};
	const rank = (meta: ActionMeta | undefined): number => (meta?.pinned ? 0 : (meta?.rank ?? 0));
	return weight(a) - weight(b) || rank(a) - rank(b);
}

export function doneByWeek(cards: Card[], now: Date = new Date()): { week: Card[]; earlier: Card[] } {
	const monday = weekStartKey(now);
	return {
		week: cards.filter((card) => (card.doneAt ?? '') >= monday),
		earlier: cards.filter((card) => (card.doneAt ?? '') < monday)
	};
}

export function besideLane(card: Card, from: Lane, step: 1 | -1): Lane | null {
	let at = LANES.indexOf(from) + step;
	while (LANES[at] && !canGo(card, LANES[at]!)) at += step;
	return LANES[at] ?? null;
}

export function wholeIndex(rest: Card[], shown: (card: Card) => boolean, at: number): number {
	const visible = rest.filter(shown);
	if (at < visible.length) return rest.indexOf(visible[Math.max(0, at)]!);
	const last = visible.at(-1);
	return last ? rest.indexOf(last) + 1 : rest.length;
}
