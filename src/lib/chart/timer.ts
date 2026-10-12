import { clockOf, dateKeyOf, pillarOfAction, wordsOf, type ActionId, type ChartData, type Session, type Timer } from './model.ts';

export const BLOCK_MINUTES = 25;
export const BREAK_MINUTES = 5;
/** A stopwatch that ran longer than this was most likely left on, so stopping it asks how long instead of logging it. */
export const FORGOTTEN_MINUTES = 180;

const MINUTE = 60_000;

export function elapsedMs(timer: Timer, now: number): number {
	return Math.max(0, now - timer.since);
}

/** Null for a stopwatch, which has no end. */
export function remainingMs(timer: Timer, now: number): number | null {
	if (!timer.length) return null;
	return Math.max(0, timer.since + timer.length * MINUTE - now);
}

export function isOver(timer: Timer, now: number): boolean {
	return remainingMs(timer, now) === 0;
}

/** Whole minutes run, so under a minute is none. A block counts no further than its length, however late it was stopped. */
export function minutesRun(timer: Timer, now: number): number {
	const minutes = Math.floor(elapsedMs(timer, now) / MINUTE);
	return timer.length ? Math.min(timer.length, minutes) : minutes;
}

export function isForgotten(timer: Timer, now: number): boolean {
	return !timer.length && elapsedMs(timer, now) > FORGOTTEN_MINUTES * MINUTE;
}

/** What stopping it now would log, on the day it started. Nothing for a break, or for under a minute. */
export function sessionOf(timer: Timer, now: number, minutes = minutesRun(timer, now)): { dateKey: string; session: Session } | null {
	if (!timer.action || minutes < 1) return null;
	const start = new Date(timer.since);
	return { dateKey: dateKeyOf(start), session: { action: timer.action, at: clockOf(start), minutes } };
}

/** Time spent before it was logged, so it starts `minutes` before `now`. */
export function sessionEndingAt(action: ActionId, minutes: number, now: Date): { dateKey: string; session: Session } {
	const start = new Date(now.getTime() - minutes * MINUTE);
	const sameDay = dateKeyOf(start) === dateKeyOf(now);
	return { dateKey: dateKeyOf(now), session: { action, at: sameDay ? clockOf(start) : '00:00', minutes } };
}

export function addSession(data: ChartData, dateKey: string, session: Session): void {
	data.days ??= {};
	const existing = data.days[dateKey] ?? { focus: [], checked: [] };
	data.days[dateKey] = { ...existing, sessions: [...(existing.sessions ?? []), session] };
}

export function sessionsOn(data: ChartData, dateKey: string): Session[] {
	return [...(data.days?.[dateKey]?.sessions ?? [])].sort((a, b) => a.at.localeCompare(b.at));
}

export function minutesOn(data: ChartData, dateKey: string, action?: ActionId): number {
	return sessionsOn(data, dateKey)
		.filter((session) => action === undefined || session.action === action)
		.reduce((sum, session) => sum + session.minutes, 0);
}

/** Minutes per pillar over the last `days` days, today included. */
export function minutesByPillar(data: ChartData, now: Date = new Date(), days = 7): number[] {
	const out = Array.from({ length: 8 }, () => 0);
	for (let back = 0; back < days; back++) {
		const date = new Date(now);
		date.setDate(now.getDate() - back);
		for (const session of sessionsOn(data, dateKeyOf(date))) {
			const pillar = pillarOfAction(data, session.action);
			if (pillar !== null) out[pillar]! += session.minutes;
		}
	}
	return out;
}

export function formatMinutes(minutes: number): string {
	if (minutes < 60) return `${minutes} min`;
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** As a clock reads: "4:05", or "1:02:05" past the hour. */
export function clockFace(ms: number): string {
	const total = Math.floor(ms / 1000);
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = String(total % 60).padStart(2, '0');
	return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

/** How far round the ring is, 0 to 1. A block empties over its length; the stopwatch goes round once an hour. */
export function ringShare(timer: Timer, now: number): number {
	const remaining = remainingMs(timer, now);
	if (remaining !== null) return remaining / (timer.length! * MINUTE);
	return (elapsedMs(timer, now) % (60 * MINUTE)) / (60 * MINUTE);
}

/** What a timer or a session is on, in words. A break is on nothing. */
export function actionLabel(data: ChartData, action: ActionId | undefined): string {
	return action ? wordsOf(data, action) || 'An action since removed' : 'Break';
}
