import { allKeys, getByKey, setByKey, type ChartData } from '../model.ts';
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

	for (const key of allKeys()) {
		const was = getByKey(base, key);
		const now = getByKey(edited, key);
		if (was !== now) setByKey(merged, key, now);
	}

	overlayGroup(base.meta, edited.meta, (key, value) => {
		if (value === null) delete merged.meta?.[key];
		else {
			merged.meta ??= {};
			merged.meta[key] = value;
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

	return merged;
}

function overlayGroup<T>(
	base: Record<string, T> | undefined,
	edited: Record<string, T> | undefined,
	apply: (key: string, value: T | null) => void
): void {
	const keys = new Set([...Object.keys(base ?? {}), ...Object.keys(edited ?? {})]);
	for (const key of keys) {
		const was = JSON.stringify(base?.[key] ?? null);
		const now = JSON.stringify(edited?.[key] ?? null);
		if (was === now) continue;
		apply(key, now === null ? null : structuredClone(edited![key]!));
	}
}
