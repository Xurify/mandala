import { emptyChart, hasContent, type ChartData } from '../model.ts';
import { newRecord, type ChartLibrary, type ChartRecord, type DeletedRecord } from '../library.ts';
import { clashesOf, overlayLocalEdits, type Clash } from './sync.ts';

/** One chart as it travels: live, or in recently deleted with `deletedAt`. */
export type SyncedChart = { id: string; updatedAt: number; deletedAt?: number; data: ChartData };

/** A row on the server. `chart` is null once the chart was deleted for good, so no device brings it back. */
export type RemoteRow = { id: string; at: number; chart: SyncedChart | null };

/** What this device last agreed with the server on, per chart: the row's version and what it held. */
export type Base = { at: number; chart: SyncedChart | null };

export type Bases = Record<string, Base>;

/** `expected` is the version this write may replace; null writes only where there is no row yet. */
export type Push = { id: string; chart: SyncedChart | null; expected: number | null };

/** `clashes`: lines both sides rewrote, where this device's words were kept. `lost`: this device's edits to a chart deleted for good elsewhere. */
export type ChartPlan = { next?: SyncedChart | null; push?: Push; base?: Base; clashes?: Clash[]; lost?: SyncedChart };

export type Plan = {
	library: ChartLibrary;
	push: Push[];
	bases: Bases;
	changed: string[];
	clashes: { id: string; clashes: Clash[] }[];
	lost: SyncedChart[];
};

export function localChart(library: ChartLibrary, id: string): SyncedChart | null {
	const live = library.charts.find((record) => record.id === id);
	if (live) return { id, updatedAt: live.updatedAt, data: live.data };
	const gone = library.deleted.find((record) => record.id === id);
	return gone ? { id, updatedAt: gone.updatedAt, deletedAt: gone.deletedAt, data: gone.data } : null;
}

function same(a: SyncedChart | null, b: SyncedChart | null): boolean {
	if (!a || !b) return a === b;
	return a.deletedAt === b.deletedAt && JSON.stringify(a.data) === JSON.stringify(b.data);
}

/**
 * One chart. `row` is the server's, when it was read this round; without it the server still holds `base`.
 * Changed on one side, it goes to the other. Changed on both, this device's edits go on top of the server's
 * copy and the result goes both ways. Deleting for good wins over any edit.
 */
export function planChart(local: SyncedChart | null, base: Base | undefined, row: RemoteRow | undefined): ChartPlan {
	// Ids are never reused, so a chart deleted for good that shows up here again is a stale copy (another tab's).
	if (base && base.chart === null && (!row || row.at === base.at)) return local ? { next: null } : {};
	const remoteChanged = row !== undefined && row.at !== base?.at;
	const localChanged = base ? !same(local, base.chart) : local !== null;
	if (!remoteChanged) {
		if (!localChanged || !local && !base?.chart) return {};
		if (local && !base && !local.deletedAt && !hasContent(local.data)) return {};
		return { push: { id: (local ?? base!.chart)!.id, chart: local, expected: base?.at ?? null } };
	}
	const remote = row!;
	const seen: Base = { at: remote.at, chart: remote.chart };
	if (!localChanged || !remote.chart) {
		if (same(local, remote.chart)) return { base: seen };
		return localChanged && local && !remote.chart ? { next: null, base: seen, lost: local } : { next: remote.chart, base: seen };
	}
	if (!local) return { base: seen, push: { id: remote.id, chart: null, expected: remote.at } };
	const merged = mergeCharts(base?.chart ?? remote.chart, local, remote.chart);
	if (same(merged, remote.chart)) return { next: remote.chart, base: seen };
	const clashes = base?.chart ? clashesOf(base.chart.data, local.data, remote.chart.data) : [];
	return { next: merged, base: seen, push: { id: merged.id, chart: merged, expected: remote.at }, ...(clashes.length > 0 ? { clashes } : {}) };
}

function mergeCharts(base: SyncedChart, local: SyncedChart, remote: SyncedChart): SyncedChart {
	const deletedAt = local.deletedAt !== base.deletedAt ? local.deletedAt : remote.deletedAt;
	return {
		id: remote.id,
		updatedAt: Math.max(local.updatedAt, remote.updatedAt),
		...(deletedAt === undefined ? {} : { deletedAt }),
		data: overlayLocalEdits(base.data, local.data, remote.data)
	};
}

export function planSync(library: ChartLibrary, bases: Bases, rows: readonly RemoteRow[]): Plan {
	const byId = new Map(rows.map((row) => [row.id, row]));
	const ids = new Set([...library.charts.map((record) => record.id), ...library.deleted.map((record) => record.id), ...Object.keys(bases), ...byId.keys()]);
	const nextBases: Bases = { ...bases };
	const changes = new Map<string, SyncedChart | null>();
	const push: Push[] = [];
	const clashes: Plan['clashes'] = [];
	const lost: SyncedChart[] = [];
	for (const id of ids) {
		const plan = planChart(localChart(library, id), bases[id], byId.get(id));
		if (plan.base) nextBases[id] = plan.base;
		if (plan.next !== undefined) changes.set(id, plan.next);
		if (plan.push) push.push(plan.push);
		if (plan.clashes) clashes.push({ id, clashes: plan.clashes });
		if (plan.lost) lost.push(plan.lost);
	}
	return { library: withCharts(library, changes), push, bases: nextBases, changed: [...changes.keys()], clashes, lost };
}

/** Puts each chart where it now belongs: live, recently deleted, or nowhere. The open chart stays this device's choice. */
export function withCharts(library: ChartLibrary, changes: ReadonlyMap<string, SyncedChart | null>): ChartLibrary {
	if (changes.size === 0) return library;
	let charts = library.charts.filter((record) => !changes.has(record.id) || isLive(changes.get(record.id)));
	let deleted = library.deleted.filter((record) => !changes.has(record.id) || isGone(changes.get(record.id)));
	for (const [id, chart] of changes) {
		if (!chart) continue;
		const data = JSON.parse(JSON.stringify(chart.data)) as ChartData;
		if (chart.deletedAt === undefined) {
			const record: ChartRecord = { id, updatedAt: chart.updatedAt, data };
			charts = charts.some((each) => each.id === id) ? charts.map((each) => (each.id === id ? record : each)) : [...charts, record];
		} else {
			const record: DeletedRecord = { id, updatedAt: chart.updatedAt, deletedAt: chart.deletedAt, data };
			deleted = deleted.some((each) => each.id === id) ? deleted.map((each) => (each.id === id ? record : each)) : [...deleted, record];
		}
	}
	if (charts.length === 0) charts = [newRecord(emptyChart())];
	const activeId = charts.some((record) => record.id === library.activeId)
		? library.activeId
		: charts.slice().sort((a, b) => b.updatedAt - a.updatedAt)[0]!.id;
	return { activeId, charts, deleted };
}

function isLive(chart: SyncedChart | null | undefined): boolean {
	return !!chart && chart.deletedAt === undefined;
}

function isGone(chart: SyncedChart | null | undefined): boolean {
	return !!chart && chart.deletedAt !== undefined;
}
