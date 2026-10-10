import { dateKeyOf, getByKey, type ChartData } from './model.ts';

/** One thing finished on a day: a ticked action, or a milestone marked done. */
export type DayDone = {
	key: string;
	text: string;
	pillarIndex: number;
	/** Local time of the tick, "HH:MM", when the log kept it. */
	at?: string;
	milestone: boolean;
};

export type MonthDay = {
	key: string;
	day: number;
	inMonth: boolean;
	today: boolean;
	future: boolean;
	done: DayDone[];
};

export type Month = {
	year: number;
	/** 0 to 11, as `Date` counts. */
	month: number;
	title: string;
	/** Rows of seven, Monday first, padded with the days around the month. */
	weeks: MonthDay[][];
	/** Days in the month with something done, and how many things in all. */
	days: number;
	ticks: number;
};

function pillarOf(key: string): number {
	return Number(key.slice(1).split('_')[0]);
}

/** What was finished on a day: the ticked actions in the order they were ticked, then milestones closed that day. */
export function doneOn(data: ChartData, dateKey: string): DayDone[] {
	const log = data.days?.[dateKey];
	const out: DayDone[] = [];
	const seen = new Set<string>();
	for (const key of log?.checked ?? []) {
		if (!key.startsWith('a') || seen.has(key)) continue;
		seen.add(key);
		out.push({ key, text: getByKey(data, key).trim() || 'A line since removed', pillarIndex: pillarOf(key), at: log?.at?.[key], milestone: false });
	}
	out.sort((a, b) => (a.at ?? '99').localeCompare(b.at ?? '99'));
	for (const [key, meta] of Object.entries(data.meta ?? {})) {
		if (meta.kind !== 'milestone' || !meta.done || meta.doneAt !== dateKey || seen.has(key)) continue;
		out.push({ key, text: getByKey(data, key).trim() || 'A line since removed', pillarIndex: pillarOf(key), milestone: true });
	}
	return out;
}

/** A month of days, each with what was finished on it. */
export function monthOf(data: ChartData, year: number, month: number, now: Date = new Date()): Month {
	const first = new Date(year, month, 1, 12);
	const start = new Date(first);
	start.setDate(1 - ((first.getDay() + 6) % 7));
	const todayKey = dateKeyOf(now);
	const weeks: MonthDay[][] = [];
	const cursor = new Date(start);
	let days = 0;
	let ticks = 0;
	do {
		const week: MonthDay[] = [];
		for (let column = 0; column < 7; column++) {
			const key = dateKeyOf(cursor);
			const inMonth = cursor.getMonth() === month && cursor.getFullYear() === year;
			const done = doneOn(data, key);
			if (inMonth && done.length > 0) {
				days += 1;
				ticks += done.length;
			}
			week.push({ key, day: cursor.getDate(), inMonth, today: key === todayKey, future: key > todayKey, done });
			cursor.setDate(cursor.getDate() + 1);
		}
		weeks.push(week);
	} while (cursor.getMonth() === month && cursor.getFullYear() === year);
	return {
		year,
		month,
		title: first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
		weeks,
		days,
		ticks
	};
}

/** The month `by` months away. */
export function shiftMonth(year: number, month: number, by: number): { year: number; month: number } {
	const date = new Date(year, month + by, 1, 12);
	return { year: date.getFullYear(), month: date.getMonth() };
}

/** The month of the earliest day with something done, so the view knows how far back to go. Null when nothing is. */
export function firstDoneMonth(data: ChartData): { year: number; month: number } | null {
	const keys = Object.entries(data.days ?? {})
		.filter(([, log]) => log.checked.length > 0)
		.map(([key]) => key);
	for (const meta of Object.values(data.meta ?? {})) {
		if (meta.kind === 'milestone' && meta.done && meta.doneAt) keys.push(meta.doneAt);
	}
	if (keys.length === 0) return null;
	const [year, month] = keys.sort()[0]!.split('-').map(Number);
	return { year: year!, month: month! - 1 };
}

/** The month in one line: how much got done, on how many days. */
export function monthLine(month: Month): string {
	if (month.ticks === 0) return 'Nothing finished this month yet.';
	const things = month.ticks === 1 ? '1 thing' : `${month.ticks} things`;
	const days = month.days === 1 ? '1 day' : `${month.days} days`;
	return `${things} finished on ${days}.`;
}

/** A day's date as the calendar says it: "Saturday, October 10". */
export function dayTitle(dateKey: string): string {
	const [year, month, day] = dateKey.split('-').map(Number);
	return new Date(year!, month! - 1, day!, 12).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
