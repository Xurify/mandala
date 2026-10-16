import { isId, type Id } from './id.ts';
import { dateKeyOf, clockOf, isActionId, isRoutine, idAt, pillarOfAction, wordsOf, type ActionId, type ChartData, type Session, type SessionMode } from './model.ts';
import { opened, toolInChart } from './tools.ts';
import { sessionIds } from './timer.ts';

/**
 * Time measured outside the app, brought in. A browser extension that watches a page (a video, a course, a
 * practice site) posts what ran to the open Mandala tab, and the tab writes it on the chart. Every session comes
 * with its own id, so one that is posted again, after a reload or a lost reply, is logged once. The page answers
 * every request, and `mandala:hello` on its own, so the sender can tell an app that understands it from one that
 * does not.
 *
 * Messages travel by `window.postMessage` on the page's own origin. `MAX_MINUTES` is the same cap Log time has.
 */

export const INGEST_VERSION = 1;
export const INGEST_REQUEST = 'mandala:ingest';
export const INGEST_RESULT = 'mandala:ingest:result';
export const INGEST_HELLO = 'mandala:hello';
export const INGEST_READY = 'mandala:ready';

export const MAX_MINUTES = 600;
const MAX_SESSIONS = 200;

export type IngestSession = {
	/** A `session_` TypeID the sender made. */
	id: string;
	/** An action on the chart. Without one, `pillar` or `link` picks it. */
	action?: string;
	/** A pillar, 0 to 7, whose routine the minutes land on, as Mandala hands shelf links out. */
	pillar?: number;
	/** A shelf link id. Its action, or its pillar's, takes the time, and the link is marked opened that day. */
	link?: string;
	minutes: number;
	mode?: SessionMode;
	/** Epoch ms. The session is logged on the day it started, like a timer. */
	startedAt: number;
};

export type IngestRequest = {
	type: typeof INGEST_REQUEST;
	version: number;
	requestId: string;
	sessions: IngestSession[];
};

export type IngestSkip = { id: string; reason: string };

export type IngestResult = {
	type: typeof INGEST_RESULT;
	version: number;
	requestId: string;
	/** Ids logged now. */
	logged: string[];
	/** Ids the chart already had. */
	known: string[];
	skipped: IngestSkip[];
};

export type IngestLogged = { id: Id<'session'>; action: ActionId; minutes: number; mode: SessionMode; dateKey: string; link?: string };

export function isIngestRequest(value: unknown): value is IngestRequest {
	if (!value || typeof value !== 'object') return false;
	const record = value as Record<string, unknown>;
	return record.type === INGEST_REQUEST && typeof record.requestId === 'string' && Array.isArray(record.sessions);
}

export function isHello(value: unknown): boolean {
	return !!value && typeof value === 'object' && (value as Record<string, unknown>).type === INGEST_HELLO;
}

export function ready(): { type: typeof INGEST_READY; version: number } {
	return { type: INGEST_READY, version: INGEST_VERSION };
}

function writtenSlots(data: ChartData, pillarIndex: number): number[] {
	return [0, 1, 2, 3, 4, 5, 6, 7].filter((slot) => (data.actions[pillarIndex]?.[slot] ?? '').trim());
}

/**
 * The action a pillar's time lands on, the way shelf links are handed out: a routine first, then any line that is
 * not a milestone, then the first line written.
 */
export function actionForPillar(data: ChartData, pillarIndex: number): ActionId | null {
	const slots = writtenSlots(data, pillarIndex);
	const kindAt = (slot: number) => data.meta?.[idAt(data, pillarIndex, slot)]?.kind;
	const slot =
		slots.find((candidate) => isRoutine(data.meta?.[idAt(data, pillarIndex, candidate)])) ??
		slots.find((candidate) => kindAt(candidate) !== 'milestone') ??
		slots[0];
	return slot === undefined ? null : idAt(data, pillarIndex, slot);
}

function resolveAction(data: ChartData, session: IngestSession): { action: ActionId; pillarIndex: number } | { reason: string } {
	if (session.action !== undefined) {
		if (!isActionId(session.action) || !wordsOf(data, session.action)) return { reason: 'not a written action on this chart' };
		const pillarIndex = pillarOfAction(data, session.action);
		if (pillarIndex === null) return { reason: 'not a written action on this chart' };
		return { action: session.action, pillarIndex };
	}
	if (typeof session.link === 'string') {
		const found = toolInChart(data, session.link);
		if (!found) return { reason: 'not a link on this chart’s shelves' };
		if (found.tool.action && wordsOf(data, found.tool.action)) return { action: found.tool.action, pillarIndex: found.pillarIndex };
		const action = actionForPillar(data, found.pillarIndex);
		return action ? { action, pillarIndex: found.pillarIndex } : { reason: 'the link’s pillar has no actions written' };
	}
	if (Number.isInteger(session.pillar) && (session.pillar as number) >= 0 && (session.pillar as number) < 8) {
		const action = actionForPillar(data, session.pillar as number);
		return action ? { action, pillarIndex: session.pillar as number } : { reason: 'the pillar has no actions written' };
	}
	return { reason: 'names no action, pillar, or link' };
}

/**
 * Writes the sessions on the chart and says what happened to each. Mutates `data`; `changed` says whether
 * anything was written.
 */
export function ingest(data: ChartData, request: IngestRequest, now: Date = new Date()): { changed: boolean; logged: IngestLogged[]; result: IngestResult } {
	const result: IngestResult = { type: INGEST_RESULT, version: INGEST_VERSION, requestId: request.requestId, logged: [], known: [], skipped: [] };
	const logged: IngestLogged[] = [];
	const have = sessionIds(data);
	const seen = new Set<string>();
	for (const session of request.sessions.slice(0, MAX_SESSIONS)) {
		const id = session?.id;
		if (!isId('session', id)) {
			result.skipped.push({ id: String(id), reason: 'needs a session_ id' });
			continue;
		}
		if (have.has(id) || seen.has(id)) {
			result.known.push(id);
			continue;
		}
		seen.add(id);
		const minutes = Number(session.minutes);
		if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_MINUTES) {
			result.skipped.push({ id, reason: `minutes must be a whole number from 1 to ${MAX_MINUTES}` });
			continue;
		}
		const startedAt = Number(session.startedAt);
		if (!Number.isFinite(startedAt) || startedAt > now.getTime() + 60_000) {
			result.skipped.push({ id, reason: 'startedAt must be a time that has passed, in epoch ms' });
			continue;
		}
		const mode: SessionMode = session.mode === 'passive' ? 'passive' : 'active';
		const found = resolveAction(data, session);
		if ('reason' in found) {
			result.skipped.push({ id, reason: found.reason });
			continue;
		}
		const link = typeof session.link === 'string' ? toolInChart(data, session.link) : null;
		if (link && link.pillarIndex !== found.pillarIndex) {
			result.skipped.push({ id, reason: 'the link is on another pillar’s shelf than the action' });
			continue;
		}
		const start = new Date(startedAt);
		const dateKey = dateKeyOf(start);
		const entry: Session = { id, action: found.action, at: clockOf(start), minutes, source: 'extension', ...(mode === 'passive' ? { mode } : {}), ...(link ? { link: link.tool.id } : {}) };
		data.days ??= {};
		const day = data.days[dateKey] ?? { focus: [], checked: [] };
		data.days[dateKey] = { ...day, sessions: [...(day.sessions ?? []), entry] };
		if (link) {
			const list = data.tools?.[`p${link.pillarIndex}`] ?? [];
			data.tools![`p${link.pillarIndex}`] = list.map((tool) => (tool.id === link.tool.id ? opened(tool, start) : tool));
		}
		have.add(id);
		result.logged.push(id);
		logged.push({ id, action: found.action, minutes, mode, dateKey, ...(link ? { link: link.tool.id } : {}) });
	}
	return { changed: logged.length > 0, logged, result };
}

/** One line for the toast: what came in, by action, with passive apart. */
export function ingestWords(data: ChartData, logged: readonly IngestLogged[]): string {
	const byAction = new Map<ActionId, { active: number; passive: number }>();
	for (const entry of logged) {
		const sum = byAction.get(entry.action) ?? { active: 0, passive: 0 };
		sum[entry.mode] += entry.minutes;
		byAction.set(entry.action, sum);
	}
	const parts = [...byAction.entries()].map(([action, sum]) => {
		const text = wordsOf(data, action) || 'a line since removed';
		const ran = [sum.active > 0 ? `${sum.active} min` : '', sum.passive > 0 ? `${sum.passive} min passive` : ''].filter(Boolean).join(' + ');
		return `${ran} on “${text}”`;
	});
	if (parts.length <= 2) return `Logged ${parts.join(' and ')}.`;
	return `Logged ${parts.slice(0, 2).join(', ')}, and ${parts.length - 2} more.`;
}
