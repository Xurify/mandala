import { dateKeyOf, hasContent, pillarOfAction, wordsOf, type ActionId, type ChartData, type Tool } from './model.ts';

export type DayDone = {
	id: ActionId;
	text: string;
	pillarIndex: number;
	/** Local time of the tick, "HH:MM", when the log kept it. */
	at?: string;
	milestone: boolean;
};

/** A chart, as the calendar reads it. Each one is a goal. */
export type Goal = { id: string; title: string; data: ChartData };

export type GoalDone = DayDone & { goal: string };

export type MonthDay = {
	key: string;
	day: number;
	inMonth: boolean;
	today: boolean;
	future: boolean;
	done: GoalDone[];
	/** The goals that finished something that day, in the order they were given. */
	goals: string[];
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
	moved: string[];
	/** Goals with lines on them that finished nothing this month. */
	quiet: string[];
};

export function doneOn(data: ChartData, dateKey: string): DayDone[] {
	const log = data.days?.[dateKey];
	const out: DayDone[] = [];
	for (const id of new Set(log?.checked ?? [])) {
		const pillarIndex = pillarOfAction(data, id);
		if (pillarIndex === null) continue;
		const meta = data.meta?.[id];
		const milestone = meta?.kind === 'milestone' && meta.done === true && meta.doneAt === dateKey;
		out.push({ id, text: wordsOf(data, id) || 'A line since removed', pillarIndex, at: log?.at?.[id], milestone });
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

export function monthOf(goals: Goal[], year: number, month: number, now: Date = new Date()): Month {
	const first = new Date(year, month, 1, 12);
	const start = new Date(first);
	start.setDate(1 - ((first.getDay() + 6) % 7));
	const todayKey = dateKeyOf(now);
	const weeks: MonthDay[][] = [];
	const cursor = new Date(start);
	let finishedDays = 0;
	let finishedCount = 0;
	const moved = new Set<string>();
	do {
		const week: MonthDay[] = [];
		for (let column = 0; column < 7; column++) {
			const key = dateKeyOf(cursor);
			const inMonth = cursor.getMonth() === month && cursor.getFullYear() === year;
			const done = goals.flatMap((goal) => doneOn(goal.data, key).map((entry) => ({ ...entry, goal: goal.id })));
			const active = goals.filter((goal) => done.some((entry) => entry.goal === goal.id)).map((goal) => goal.id);
			if (inMonth && done.length > 0) {
				finishedDays += 1;
				finishedCount += done.length;
				for (const id of active) moved.add(id);
			}
			const pillars = [...new Set(done.map((entry) => entry.pillarIndex))].sort((left, right) => left - right);
			week.push({ key, day: cursor.getDate(), inMonth, today: key === todayKey, future: key > todayKey, done, goals: active, pillars });
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
		finishedCount,
		moved: goals.filter((goal) => moved.has(goal.id)).map((goal) => goal.id),
		quiet: goals.filter((goal) => !moved.has(goal.id) && hasContent(goal.data)).map((goal) => goal.id)
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

export function firstDoneMonth(goals: Goal[]): { year: number; month: number } | null {
	const keys = goals.flatMap((goal) =>
		Object.entries(goal.data.days ?? {})
			.filter(([, log]) => log.checked.length > 0)
			.map(([key]) => key)
	);
	if (keys.length === 0) return null;
	const [year, month] = keys.sort()[0]!.split('-').map(Number);
	return { year: year!, month: month! - 1 };
}

export function monthLine(month: Month): string {
	if (month.finishedCount === 0) return 'Nothing finished this month yet.';
	const things = month.finishedCount === 1 ? '1 thing' : `${month.finishedCount} things`;
	if (month.moved.length > 1) return `${things} finished across ${month.moved.length} goals.`;
	const days = month.finishedDays === 1 ? '1 day' : `${month.finishedDays} days`;
	return `${things} finished on ${days}.`;
}

export function dayTitle(dateKey: string): string {
	const [year, month, day] = dateKey.split('-').map(Number);
	return new Date(year!, month! - 1, day!, 12).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
