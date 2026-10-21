import type { ActionMeta, ChartData, DayLog, Session, Tool } from '../model.ts';
import { cloneChart } from '../library.ts';

/**
 * A device that edited while the server moved ahead re-applies only what it changed since `base` (its last
 * synced snapshot) onto the server copy, so a stale tab can't clobber newer work.
 */
export function overlayLocalEdits(
	base: ChartData,
	live: ChartData,
	target: ChartData
): ChartData {
	// The open chart is a Svelte proxy, which structuredClone refuses.
	const edited = cloneChart(live);
	const merged = cloneChart(target);

	if (base.goal !== edited.goal) merged.goal = edited.goal;
	for (let pillarIndex = 0; pillarIndex < 8; pillarIndex++) {
		if (base.pillars[pillarIndex] !== edited.pillars[pillarIndex]) merged.pillars[pillarIndex] = edited.pillars[pillarIndex]!;
		for (let slot = 0; slot < 8; slot++) {
			const text = edited.actions[pillarIndex]![slot]!;
			const id = edited.actionIds[pillarIndex]![slot]!;
			if (base.actions[pillarIndex]![slot] === text && base.actionIds[pillarIndex]![slot] === id) continue;
			merged.actions[pillarIndex]![slot] = text;
			merged.actionIds[pillarIndex]![slot] = id;
		}
	}

	overlayGroup(base.meta, edited.meta, (id, value) => {
		if (value === null) delete merged.meta?.[id];
		else {
			merged.meta ??= {};
			merged.meta[id] = overlayFields(base.meta?.[id], value, merged.meta[id]) as ActionMeta;
		}
	});
	overlayGroup(base.cleared, edited.cleared, (id, value) => {
		if (value === null) delete merged.cleared?.[id];
		else {
			merged.cleared ??= {};
			merged.cleared[id] = value;
		}
	});
	overlayGroup(base.days, edited.days, (key, value) => {
		if (value === null) delete merged.days?.[key];
		else {
			merged.days ??= {};
			merged.days[key] = overlayDay(base.days?.[key], value, merged.days[key]);
		}
	});
	overlayGroup(base.weeks, edited.weeks, (key, value) => {
		if (value === null) delete merged.weeks?.[key];
		else {
			merged.weeks ??= {};
			merged.weeks[key] = value;
		}
	});

	overlayGroup(base.tools, edited.tools, (key, value) => {
		const list = overlayTools(base.tools?.[key] ?? [], value ?? [], merged.tools?.[key] ?? []);
		merged.tools ??= {};
		if (list.length > 0) merged.tools[key] = list;
		else delete merged.tools[key];
	});
	if (merged.tools && Object.keys(merged.tools).length === 0) delete merged.tools;

	overlayGroup(base.icons, edited.icons, (host, value) => {
		if (value === null) delete merged.icons?.[host];
		else {
			merged.icons ??= {};
			merged.icons[host] = value;
		}
	});

	if (JSON.stringify(base.brief ?? null) !== JSON.stringify(edited.brief ?? null)) {
		merged.brief = edited.brief ? structuredClone(edited.brief) : undefined;
	}

	if (JSON.stringify(base.timer ?? null) !== JSON.stringify(edited.timer ?? null)) {
		merged.timer = edited.timer ? { ...edited.timer } : undefined;
	}

	if (base.passiveWeight !== edited.passiveWeight) merged.passiveWeight = edited.passiveWeight;

	return merged;
}

const DAY_LISTS = ['focus', 'checked', 'dropped', 'declined', 'shown', 'wrote'] as const;

/**
 * One day edited on two devices: each list takes what this device added or took off since `base`, and keeps
 * what the other device did, so a tick on the phone and a tick on the laptop both stay.
 */
export function overlayDay(base: DayLog | undefined, edited: DayLog, target: DayLog | undefined): DayLog {
	if (!target) return structuredClone(edited);
	const merged: DayLog = structuredClone(target);
	for (const field of DAY_LISTS) {
		const list = overlayList(base?.[field] ?? [], edited[field] ?? [], target[field] ?? [], String);
		if (list.length > 0 || field === 'focus' || field === 'checked') (merged[field] as string[]) = list;
		else delete merged[field];
	}
	const sessions = overlayList(base?.sessions ?? [], edited.sessions ?? [], target.sessions ?? [], sessionKey);
	if (sessions.length > 0) merged.sessions = sessions;
	else delete merged.sessions;
	overlayGroup(base?.at, edited.at, (id, value) => {
		if (value === null) delete merged.at?.[id];
		else merged.at = { ...merged.at, [id]: value };
	});
	if (merged.at && Object.keys(merged.at).length === 0) delete merged.at;
	if ((base?.started ?? false) !== (edited.started ?? false)) {
		if (edited.started) merged.started = true;
		else delete merged.started;
	}
	return merged;
}

/** A link moved, renamed, or opened on one device, and opened on the other, keeps both: `opened` merges as a list. */
function overlayTools(base: readonly Tool[], edited: readonly Tool[], target: readonly Tool[]): Tool[] {
	const was = new Map(base.map((tool) => [tool.id, tool]));
	const now = new Map(edited.map((tool) => [tool.id, tool]));
	const out: Tool[] = [];
	for (const tool of target) {
		const before = was.get(tool.id);
		const after = now.get(tool.id);
		if (before && !after) continue;
		out.push(before && after ? mergeTool(before, after, tool) : structuredClone(tool));
	}
	const kept = new Set(out.map((tool) => tool.id));
	for (const tool of edited) if (!was.has(tool.id) && !kept.has(tool.id)) out.push(structuredClone(tool));
	return out;
}

function mergeTool(base: Tool, edited: Tool, target: Tool): Tool {
	const merged = overlayFields(base, edited, target) as Tool;
	const opened = overlayList(base.opened ?? [], edited.opened ?? [], target.opened ?? [], String).sort();
	if (opened.length > 0) merged.opened = opened;
	else delete merged.opened;
	return merged;
}

/** Each field this device changed since `base` goes onto `target`; the rest stay as the other device left them. */
function overlayFields<T extends object>(base: T | undefined, edited: T, target: T | undefined): T {
	if (!target) return structuredClone(edited);
	const merged = structuredClone(target) as Record<string, unknown>;
	const before = (base ?? {}) as Record<string, unknown>;
	const after = edited as Record<string, unknown>;
	for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
		if (JSON.stringify(before[field]) === JSON.stringify(after[field])) continue;
		if (after[field] === undefined) delete merged[field];
		else merged[field] = structuredClone(after[field]);
	}
	return merged as T;
}

function sessionKey(session: Session): string {
	return session.id ?? JSON.stringify([session.action, session.at, session.minutes, session.mode ?? null]);
}

function overlayList<T>(base: readonly T[], edited: readonly T[], target: readonly T[], key: (item: T) => string): T[] {
	const had = new Set(base.map(key));
	const has = new Set(edited.map(key));
	const out = target.filter((item) => !had.has(key(item)) || has.has(key(item)));
	const seen = new Set(out.map(key));
	for (const item of edited) {
		const id = key(item);
		if (had.has(id) || seen.has(id)) continue;
		out.push(structuredClone(item));
		seen.add(id);
	}
	return out;
}

function overlayGroup<K extends string, T>(
	base: Record<K, T> | undefined,
	edited: Record<K, T> | undefined,
	apply: (key: K, value: T | null) => void
): void {
	const keys = new Set([...Object.keys(base ?? {}), ...Object.keys(edited ?? {})] as K[]);
	for (const key of keys) {
		const was = JSON.stringify(base?.[key] ?? null);
		const now = JSON.stringify(edited?.[key] ?? null);
		if (was === now) continue;
		apply(key, edited?.[key] == null ? null : structuredClone(edited[key]));
	}
}
