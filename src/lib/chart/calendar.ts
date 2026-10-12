import { dateKeyOf, getByKey, type ChartData, type Tool } from './model.ts';

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
	pillars: number[];
};

export type Month = {
	year: number;
	/** 0 to 11, as `Date` counts. */
	month: number;
	title: string;
	weeks: MonthDay[][];
	finishedDays: number;
	finishedCount: number;
};

function pillarOf(key: string): number {
	return Number(key.slice(1).split('_')[0]);
}

export function doneOn(data: ChartData, dateKey: string): DayDone[] {
	const log = data.days?.[dateKey];
	const out: DayDone[] = [];
	const seen = new Set<string>();
	for (const key of log?.checked ?? []) {
		if (!key.startsWith('a') || seen.has(key)) continue;
		seen.add(key);
		const meta = data.meta?.[key];
		const milestone = meta?.kind === 'milestone' && meta.done === true && meta.doneAt === dateKey;
		out.push({ key, text: getByKey(data, key).trim() || 'A line since removed', pillarIndex: pillarOf(key), at: log?.at?.[key], milestone });
	}
	out.sort((a, b) => (a.at ?? '99').localeCompare(b.at ?? '99'));
	return out;
}

export function openedOn(data: ChartData, dateKey: string): { pillarIndex: number; tool: Tool }[] {
	const out: { pillarIndex: number; tool: Tool }[] = [];
	for (let pillarIndex = 0; pillarIndex < 8; pillarIndex++) {
		for (const tool of data.tools?.[`p${pillarIndex}`] ?? []) {
			if (tool.opened?.includes(dateKey)) out.push({ pillarIndex, tool });
		}
	}
	return out;
}

export function monthOf(data: ChartData, year: number, month: number, now: Date = new Date()): Month {
	const first = new Date(year, month, 1, 12);
	const start = new Date(first);
	start.setDate(1 - ((first.getDay() + 6) % 7));
	const todayKey = dateKeyOf(now);
	const weeks: MonthDay[][] = [];
	const cursor = new Date(start);
	let finishedDays = 0;
	let finishedCount = 0;
	do {
		const week: MonthDay[] = [];
		for (let column = 0; column < 7; column++) {
			const key = dateKeyOf(cursor);
			const inMonth = cursor.getMonth() === month && cursor.getFullYear() === year;
			const done = doneOn(data, key);
			if (inMonth && done.length > 0) {
				finishedDays += 1;
				finishedCount += done.length;
			}
			const pillars = [...new Set(done.map((entry) => entry.pillarIndex))].sort((left, right) => left - right);
			week.push({ key, day: cursor.getDate(), inMonth, today: key === todayKey, future: key > todayKey, done, pillars });
			cursor.setDate(cursor.getDate() + 1);
		}
		weeks.push(week);
	} while (cursor.getMonth() === month && cursor.getFullYear() === year);
	return {
		year,
		month,
		title: first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
		weeks,
		finishedDays,
		finishedCount
	};
}

export function shiftMonth(year: number, month: number, by: number): { year: number; month: number } {
	const date = new Date(year, month + by, 1, 12);
	return { year: date.getFullYear(), month: date.getMonth() };
}

export function lastDoneDay(month: Month): string | null {
	const days = month.weeks.flat().filter((day) => day.inMonth && day.done.length > 0);
	return days.at(-1)?.key ?? null;
}

export function firstDoneMonth(data: ChartData): { year: number; month: number } | null {
	const keys = Object.entries(data.days ?? {})
		.filter(([, log]) => log.checked.length > 0)
		.map(([key]) => key);
	if (keys.length === 0) return null;
	const [year, month] = keys.sort()[0]!.split('-').map(Number);
	return { year: year!, month: month! - 1 };
}

export function monthLine(month: Month): string {
	if (month.finishedCount === 0) return 'Nothing finished this month yet.';
	const things = month.finishedCount === 1 ? '1 thing' : `${month.finishedCount} things`;
	const days = month.finishedDays === 1 ? '1 day' : `${month.finishedDays} days`;
	return `${things} finished on ${days}.`;
}

export function dayTitle(dateKey: string): string {
	const [year, month, day] = dateKey.split('-').map(Number);
	return new Date(year!, month! - 1, day!, 12).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
