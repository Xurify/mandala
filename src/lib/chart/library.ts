import {
	emptyChart,
	filledCount,
	parseChart,
	type ChartData
} from './model.ts';

export const LIBRARY_KEY = 'mandala-library-v1';
export const CHART_CAP = 12;
export const UNTITLED = 'Untitled';

export type ChartRecord = {
	id: string;
	updatedAt: number;
	data: ChartData;
};

export type ChartLibrary = {
	activeId: string;
	charts: ChartRecord[];
};

export type ChartSummary = {
	id: string;
	title: string;
	filled: number;
	updatedAt: number;
	active: boolean;
};

export function cloneChart(data: ChartData): ChartData {
	return parseChart(JSON.stringify(data)) ?? emptyChart();
}

export function titleOf(data: ChartData): string {
	const goal = data.goal.trim();
	return goal || UNTITLED;
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
	return { activeId: record.id, charts: [record] };
}

export function migrateFromV1(raw: string | null): ChartLibrary {
	const data = raw ? (parseChart(raw) ?? emptyChart()) : emptyChart();
	const record = newRecord(data);
	return { activeId: record.id, charts: [record] };
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
		return { activeId, charts };
	} catch {
		return null;
	}
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
