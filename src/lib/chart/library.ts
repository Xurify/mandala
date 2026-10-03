import {
	emptyChart,
	filledCount,
	parseChart,
	type ChartData
} from './model.ts';

export const LIBRARY_KEY = 'mandala-library-v1';
export const UNTITLED = 'Untitled';
export const TRASH_DAYS = 30;

const DAY_MS = 86_400_000;
export const TRASH_MS = TRASH_DAYS * DAY_MS;

export type ChartRecord = {
	id: string;
	updatedAt: number;
	data: ChartData;
};

export type DeletedRecord = {
	id: string;
	updatedAt: number;
	deletedAt: number;
	data: ChartData;
};

export type ChartLibrary = {
	activeId: string;
	charts: ChartRecord[];
	deleted: DeletedRecord[];
};

export type ChartSummary = {
	id: string;
	title: string;
	filled: number;
	updatedAt: number;
	active: boolean;
};

export type DeletedSummary = {
	id: string;
	title: string;
	filled: number;
	deletedAt: number;
	daysLeft: number;
};

export function cloneChart(data: ChartData): ChartData {
	return parseChart(JSON.stringify(data)) ?? emptyChart();
}

export function titleOf(data: ChartData): string {
	const goal = data.goal.trim();
	return goal || UNTITLED;
}

function startOfLocalDay(ms: number): number {
	const date = new Date(ms);
	return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function clockLabel(ms: number): string {
	return new Date(ms)
		.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
		.replace(' AM', ' am')
		.replace(' PM', ' pm');
}

function daysAgo(at: number, now: number): number {
	return Math.round((startOfLocalDay(now) - startOfLocalDay(at)) / DAY_MS);
}

function shortDate(at: number, now: number): string {
	const date = new Date(at);
	const sameYear = date.getFullYear() === new Date(now).getFullYear();
	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		...(sameYear ? {} : { year: 'numeric' })
	});
}

/** When a chart was last saved. Today and yesterday include the time. `now` is injectable for tests. */
export function formatUpdated(at: number, now = Date.now()): string {
	const days = daysAgo(at, now);
	if (days === 0) return `Updated ${clockLabel(at)}`;
	if (days === 1) return `Updated yesterday at ${clockLabel(at)}`;
	return `Updated ${shortDate(at, now)}`;
}

/** When a chart was deleted. Today and yesterday include the time. `now` is injectable for tests. */
export function formatDeleted(at: number, now = Date.now()): string {
	const days = daysAgo(at, now);
	if (days === 0) return `Deleted ${clockLabel(at)}`;
	if (days === 1) return `Deleted yesterday at ${clockLabel(at)}`;
	return `Deleted ${shortDate(at, now)}`;
}

/** Day heading in the trash list. Today, yesterday, or a short date. */
export function deletedDayLabel(at: number, now = Date.now()): string {
	const days = daysAgo(at, now);
	if (days <= 0) return 'Today';
	if (days === 1) return 'Yesterday';
	return shortDate(at, now);
}

/** Clock time in the trash list, so copies that share a name can be told apart. */
export function deletedClock(at: number): string {
	return clockLabel(at);
}

/** Short relative time for list rows. Before today it falls back to the clock; the day heading carries the date. */
export function formatAgo(at: number, now = Date.now()): string {
	const minutes = Math.floor((now - at) / 60_000);
	if (minutes < 1) return 'Just now';
	if (minutes < 60) return `${minutes} min ago`;
	if (daysAgo(at, now) === 0) return `${Math.floor(minutes / 60)} h ago`;
	return clockLabel(at);
}

/** Whole days left before a deleted chart is removed. `0` means the hold is over. */
export function daysUntilPurge(deletedAt: number, now = Date.now()): number {
	const remaining = TRASH_MS - (now - deletedAt);
	if (remaining <= 0) return 0;
	return Math.ceil(remaining / DAY_MS);
}

export function formatDeletesIn(daysLeft: number): string {
	if (daysLeft <= 1) return 'Deletes in 1 day';
	return `Deletes in ${daysLeft} days`;
}

/** Short hold remaining. The dialog subtitle already states the 30-day rule. */
export function formatDaysLeft(daysLeft: number): string {
	if (daysLeft <= 1) return '1 day left';
	return `${daysLeft} days left`;
}

export function purgeDeleted(deleted: DeletedRecord[], now = Date.now()): DeletedRecord[] {
	return deleted.filter((item) => now - item.deletedAt < TRASH_MS);
}

export function purgeLibrary(library: ChartLibrary, now = Date.now()): ChartLibrary {
	const deleted = purgeDeleted(library.deleted, now);
	if (deleted.length === library.deleted.length) return library;
	return { ...library, deleted };
}

export function newId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function newRecord(data: ChartData, at = Date.now()): ChartRecord {
	return {
		id: newId(),
		updatedAt: at,
		data: cloneChart(data)
	};
}

export function emptyLibrary(): ChartLibrary {
	const record = newRecord(emptyChart());
	return { activeId: record.id, charts: [record], deleted: [] };
}

export function migrateFromV1(raw: string | null): ChartLibrary {
	const data = raw ? (parseChart(raw) ?? emptyChart()) : emptyChart();
	const record = newRecord(data);
	return { activeId: record.id, charts: [record], deleted: [] };
}

function chartFromUnknown(value: unknown): ChartData | null {
	if (!value || typeof value !== 'object') return null;
	return parseChart(JSON.stringify(value));
}

export function parseLibrary(raw: string): ChartLibrary | null {
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== 'object') return null;
		const record = parsed as Record<string, unknown>;
		if (typeof record.activeId !== 'string' || !record.activeId) return null;
		if (!Array.isArray(record.charts) || record.charts.length < 1) return null;

		const charts: ChartRecord[] = [];
		for (const item of record.charts) {
			if (!item || typeof item !== 'object') return null;
			const row = item as Record<string, unknown>;
			if (typeof row.id !== 'string' || !row.id) return null;
			if (typeof row.updatedAt !== 'number' || !Number.isFinite(row.updatedAt)) return null;
			const data = chartFromUnknown(row.data);
			if (!data) return null;
			charts.push({ id: row.id, updatedAt: row.updatedAt, data });
		}

		const ids = new Set(charts.map((chart) => chart.id));
		if (ids.size !== charts.length) return null;
		const activeId = ids.has(record.activeId) ? record.activeId : charts[0]!.id;
		return { activeId, charts, deleted: parseDeleted(record.deleted, ids) };
	} catch {
		return null;
	}
}

function deletedFromUnknown(value: unknown): DeletedRecord | null {
	if (!value || typeof value !== 'object') return null;
	const row = value as Record<string, unknown>;
	if (typeof row.id !== 'string' || !row.id) return null;
	if (typeof row.updatedAt !== 'number' || !Number.isFinite(row.updatedAt)) return null;
	if (typeof row.deletedAt !== 'number' || !Number.isFinite(row.deletedAt)) return null;
	const data = chartFromUnknown(row.data);
	if (!data) return null;
	return { id: row.id, updatedAt: row.updatedAt, deletedAt: row.deletedAt, data };
}

function parseDeleted(value: unknown, liveIds: Set<string>): DeletedRecord[] {
	if (!Array.isArray(value)) return [];
	const byId = new Map<string, DeletedRecord>();
	for (const item of value) {
		const row = deletedFromUnknown(item);
		if (!row || liveIds.has(row.id)) continue;
		const previous = byId.get(row.id);
		if (!previous || row.deletedAt >= previous.deletedAt) byId.set(row.id, row);
	}
	return [...byId.values()];
}

function newestChart(charts: ChartRecord[]): ChartRecord {
	return charts.slice().sort((a, b) => b.updatedAt - a.updatedAt)[0]!;
}

/** Move one live chart into recently deleted. The last chart leaves a blank one open. */
export function deleteFromLibrary(
	library: ChartLibrary,
	id: string,
	now = Date.now()
): ChartLibrary | null {
	const target = library.charts.find((chart) => chart.id === id);
	if (!target) return null;
	const remaining = library.charts.filter((chart) => chart.id !== id);
	const removed: DeletedRecord = {
		id: target.id,
		updatedAt: target.updatedAt,
		deletedAt: now,
		data: cloneChart(target.data)
	};
	const deleted = purgeDeleted(
		[removed, ...library.deleted.filter((item) => item.id !== id)],
		now
	);
	if (remaining.length === 0) {
		const blank = newRecord(emptyChart(), now);
		return { activeId: blank.id, charts: [blank], deleted };
	}
	const activeId = library.activeId === id ? newestChart(remaining).id : library.activeId;
	return { activeId, charts: remaining, deleted };
}

/** Put a deleted chart back into the live library and make it active. */
export function restoreFromLibrary(
	library: ChartLibrary,
	id: string,
	now = Date.now()
): ChartLibrary | null {
	const item = library.deleted.find((row) => row.id === id);
	if (!item || now - item.deletedAt >= TRASH_MS) return null;
	const record: ChartRecord = {
		id: item.id,
		updatedAt: now,
		data: cloneChart(item.data)
	};
	return {
		activeId: record.id,
		charts: [...library.charts, record],
		deleted: library.deleted.filter((row) => row.id !== id)
	};
}

/** Drop a deleted chart before the 30-day hold ends. */
export function forgetFromLibrary(library: ChartLibrary, id: string): ChartLibrary | null {
	return forgetManyFromLibrary(library, [id]);
}

/** Put deleted charts back. The newest one becomes the open chart. */
export function restoreManyFromLibrary(
	library: ChartLibrary,
	ids: readonly string[],
	now = Date.now()
): ChartLibrary | null {
	const want = new Set(ids);
	const rows = library.deleted
		.filter((row) => want.has(row.id) && now - row.deletedAt < TRASH_MS)
		.slice()
		.sort((a, b) => a.deletedAt - b.deletedAt);
	if (rows.length === 0) return null;
	const records: ChartRecord[] = rows.map((item) => ({
		id: item.id,
		updatedAt: now,
		data: cloneChart(item.data)
	}));
	const drop = new Set(records.map((row) => row.id));
	const newest = records[records.length - 1]!;
	return {
		activeId: newest.id,
		charts: [...library.charts, ...records],
		deleted: library.deleted.filter((row) => !drop.has(row.id))
	};
}

/** Drop several deleted charts before the hold ends. */
export function forgetManyFromLibrary(
	library: ChartLibrary,
	ids: readonly string[]
): ChartLibrary | null {
	const drop = new Set(ids);
	if (!library.deleted.some((row) => drop.has(row.id))) return null;
	return { ...library, deleted: library.deleted.filter((row) => !drop.has(row.id)) };
}

export function activeRecord(library: ChartLibrary): ChartRecord {
	return library.charts.find((chart) => chart.id === library.activeId) ?? library.charts[0]!;
}

export function summarize(
	charts: ChartRecord[],
	activeId: string,
	live: ChartData
): ChartSummary[] {
	const rows: ChartSummary[] = charts.map((chart) => {
		const active = chart.id === activeId;
		return {
			id: chart.id,
			title: titleOf(active ? live : chart.data),
			filled: active ? filledCount(live) : filledCount(chart.data),
			updatedAt: chart.updatedAt,
			active
		};
	});
	rows.sort((a, b) => {
		if (a.active !== b.active) return a.active ? -1 : 1;
		return b.updatedAt - a.updatedAt;
	});
	return rows;
}

export function summarizeDeleted(deleted: DeletedRecord[], now = Date.now()): DeletedSummary[] {
	return purgeDeleted(deleted, now)
		.slice()
		.sort((a, b) => b.deletedAt - a.deletedAt)
		.map((item) => ({
			id: item.id,
			title: titleOf(item.data),
			filled: filledCount(item.data),
			deletedAt: item.deletedAt,
			daysLeft: daysUntilPurge(item.deletedAt, now)
		}));
}

export function flushActive(
	charts: ChartRecord[],
	activeId: string,
	data: ChartData,
	at = Date.now()
): ChartRecord[] {
	return charts.map((chart) =>
		chart.id === activeId ? { id: chart.id, updatedAt: at, data: cloneChart(data) } : chart
	);
}
