import { clockOf, dateKeyOf, PASSIVE_WEIGHT, pillarOfAction, wordsOf, type ActionId, type ChartData, type Session, type SessionMode, type Timer } from './model.ts';

export const BLOCK_MINUTES = 25;
export const BREAK_MINUTES = 5;
/** A stopwatch that ran longer than this was most likely left on, so stopping it asks how long instead of logging it. */
export const FORGOTTEN_MINUTES = 180;

const MINUTE = 60_000;

export function elapsedMs(timer: Timer, now: number): number {
	return Math.max(0, now - timer.since);
}

export function remainingMs(timer: Timer, now: number): number | null {
	if (!timer.length) return null;
	return Math.max(0, timer.since + timer.length * MINUTE - now);
}

export function isOver(timer: Timer, now: number): boolean {
	return remainingMs(timer, now) === 0;
}

export function minutesRun(timer: Timer, now: number): number {
	const minutes = Math.floor(elapsedMs(timer, now) / MINUTE);
	return timer.length ? Math.min(timer.length, minutes) : minutes;
}

export function isForgotten(timer: Timer, now: number): boolean {
	return !timer.length && elapsedMs(timer, now) > FORGOTTEN_MINUTES * MINUTE;
}

export function sessionOf(timer: Timer, now: number, minutes = minutesRun(timer, now)): { dateKey: string; session: Session } | null {
	if (!timer.action || minutes < 1) return null;
	const start = new Date(timer.since);
	return { dateKey: dateKeyOf(start), session: { action: timer.action, at: clockOf(start), minutes, ...(timer.link ? { link: timer.link } : {}) } };
}

export function sessionEndingAt(action: ActionId, minutes: number, now: Date, link?: string, mode?: SessionMode): { dateKey: string; session: Session } {
	const start = new Date(now.getTime() - minutes * MINUTE);
	const sameDay = dateKeyOf(start) === dateKeyOf(now);
	return {
		dateKey: dateKeyOf(now),
		session: { action, at: sameDay ? clockOf(start) : '00:00', minutes, ...(mode === 'passive' ? { mode } : {}), ...(link ? { link } : {}) }
	};
}

export function addSession(data: ChartData, dateKey: string, session: Session): void {
	data.days ??= {};
	const existing = data.days[dateKey] ?? { focus: [], checked: [] };
	data.days[dateKey] = { ...existing, sessions: [...(existing.sessions ?? []), session] };
}

export function sessionsOn(data: ChartData, dateKey: string): Session[] {
	return [...(data.days?.[dateKey]?.sessions ?? [])].sort((a, b) => a.at.localeCompare(b.at));
}

export function passiveWeightOf(data: ChartData): number {
	return data.passiveWeight ?? PASSIVE_WEIGHT;
}

export function isPassive(session: Session): boolean {
	return session.mode === 'passive';
}

/** Minutes as they ran, active and passive apart. */
export function splitMinutes(sessions: readonly Session[]): { active: number; passive: number } {
	let active = 0;
	let passive = 0;
	for (const session of sessions) {
		if (isPassive(session)) passive += session.minutes;
		else active += session.minutes;
	}
	return { active, passive };
}

/** What the sessions count for, with passive ones at the chart's weight. Whole minutes, rounded once. */
export function countedMinutes(data: ChartData, sessions: readonly Session[]): number {
	const { active, passive } = splitMinutes(sessions);
	return Math.round(active + passive * passiveWeightOf(data));
}

export function minutesOn(data: ChartData, dateKey: string, action?: ActionId): number {
	return countedMinutes(
		data,
		sessionsOn(data, dateKey).filter((session) => action === undefined || session.action === action)
	);
}

export function minutesByPillar(data: ChartData, now: Date = new Date(), days = 7): number[] {
	const byPillar = Array.from({ length: 8 }, (): Session[] => []);
	for (let back = 0; back < days; back++) {
		const date = new Date(now);
		date.setDate(now.getDate() - back);
		for (const session of sessionsOn(data, dateKeyOf(date))) {
			const pillar = pillarOfAction(data, session.action);
			if (pillar !== null) byPillar[pillar]!.push(session);
		}
	}
	return byPillar.map((sessions) => countedMinutes(data, sessions));
}

/** Minutes as they ran, per pillar, in one mode, over the same days as `minutesByPillar`. */
export function ranMinutesByPillar(data: ChartData, mode: SessionMode, now: Date = new Date(), days = 7): number[] {
	const out = Array.from({ length: 8 }, () => 0);
	for (let back = 0; back < days; back++) {
		const date = new Date(now);
		date.setDate(now.getDate() - back);
		for (const session of sessionsOn(data, dateKeyOf(date))) {
			const pillar = pillarOfAction(data, session.action);
			if (pillar !== null && isPassive(session) === (mode === 'passive')) out[pillar]! += session.minutes;
		}
	}
	return out;
}

export function passiveMinutesByPillar(data: ChartData, now: Date = new Date(), days = 7): number[] {
	return ranMinutesByPillar(data, 'passive', now, days);
}

/** Every session id on the chart, so one that arrives again is known. */
export function sessionIds(data: ChartData): Set<string> {
	const ids = new Set<string>();
	for (const log of Object.values(data.days ?? {})) for (const session of log.sessions ?? []) if (session.id) ids.add(session.id);
	return ids;
}

export function formatMinutes(minutes: number): string {
	if (minutes < 60) return `${minutes} min`;
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function clockFace(ms: number): string {
	const total = Math.floor(ms / 1000);
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = String(total % 60).padStart(2, '0');
	return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

export function ringShare(timer: Timer, now: number): number {
	const remaining = remainingMs(timer, now);
	if (remaining !== null) return remaining / (timer.length! * MINUTE);
	return (elapsedMs(timer, now) % (60 * MINUTE)) / (60 * MINUTE);
}

export function actionLabel(data: ChartData, action: ActionId | undefined): string {
	return action ? wordsOf(data, action) || 'An action since removed' : 'Break';
}
