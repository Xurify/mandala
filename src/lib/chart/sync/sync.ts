import type { ChartData } from '../model.ts';
import { cloneChart } from '../library.ts';

/**
 * Whole-chart last-write-wins, except that a device that edited while the server moved ahead re-applies
 * only what it changed since `base` (its last synced snapshot) onto the server copy, so a stale tab can't
 * clobber newer work.
 */
export function overlayLocalEdits(
	base: ChartData,
	edited: ChartData,
	target: ChartData
): ChartData {
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
			merged.meta[id] = value;
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
			merged.days[key] = value;
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
		if (value === null) delete merged.tools?.[key];
		else {
			merged.tools ??= {};
			merged.tools[key] = value;
		}
	});

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

	return merged;
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
		apply(key, now === null ? null : structuredClone(edited![key]!));
	}
}
