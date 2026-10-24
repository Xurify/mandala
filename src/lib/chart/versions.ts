import type { ChartData } from './model.ts';

/**
 * Earlier versions of a chart, kept on this device whenever sync replaces or outvotes what was here, so nothing
 * another device did is lost for good. They live in IndexedDB: twenty copies of a chart do not fit beside the
 * library in localStorage.
 *
 * `synced`: the chart here before changes from another device. `theirs` and `yours`: the side whose words gave way
 * when both rewrote a line.
 * `deleted`: the chart here before another device deleted it for good. `restored`: the chart before an earlier
 * version replaced it.
 */
export type VersionWhy = 'synced' | 'theirs' | 'yours' | 'deleted' | 'restored';

export type Version = { id: number; chartId: string; at: number; why: VersionWhy; data: ChartData };

export const VERSIONS_PER_CHART = 20;
export const VERSION_DAYS = 30;
/** Ticks from a phone arrive every few minutes; one copy per stretch of them is enough to go back to. */
export const QUIET_MS = 15 * 60_000;

const DAY_MS = 86_400_000;

export const WHY_LABELS: Record<VersionWhy, string> = {
	synced: 'Before changes from your other device',
	theirs: "Your other device's version",
	yours: 'Your version, before newer words from your other device',
	deleted: 'Before your other device deleted it',
	restored: 'Before you went back to an earlier version'
};

/**
 * What to do with a new copy: keep it, skip it (the same as the last, or a `synced` copy soon after another), or
 * `relabel` the last one, the same chart, with the more telling reason.
 */
export function placeVersion(previous: readonly Version[], next: Omit<Version, 'id'>): 'keep' | 'skip' | { relabel: number } {
	const last = previous.filter((version) => version.chartId === next.chartId).sort((a, b) => b.at - a.at)[0];
	if (!last) return 'keep';
	if (JSON.stringify(last.data) === JSON.stringify(next.data)) return last.why === 'synced' && next.why !== 'synced' ? { relabel: last.id } : 'skip';
	return next.why === 'synced' && last.why === 'synced' && next.at - last.at < QUIET_MS ? 'skip' : 'keep';
}

/** Ids past the limit for their chart, or older than the days kept. */
export function overflow(versions: readonly Version[], now: number): number[] {
	const drop: number[] = [];
	const byChart = new Map<string, Version[]>();
	for (const version of versions) {
		if (now - version.at > VERSION_DAYS * DAY_MS) drop.push(version.id);
		else byChart.set(version.chartId, [...(byChart.get(version.chartId) ?? []), version]);
	}
	for (const list of byChart.values()) {
		drop.push(...list.sort((a, b) => b.at - a.at).slice(VERSIONS_PER_CHART).map((version) => version.id));
	}
	return drop;
}

const DB_NAME = 'mandala-versions';
const STORE = 'versions';

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, 1);
		request.onupgradeneeded = () => {
			if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function done(tx: IDBTransaction, db: IDBDatabase): Promise<void> {
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => {
			db.close();
			resolve();
		};
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error);
	});
}

export async function listVersions(): Promise<Version[]> {
	if (typeof indexedDB === 'undefined') return [];
	try {
		const db = await openDb();
		const tx = db.transaction(STORE, 'readonly');
		const request = tx.objectStore(STORE).getAll() as IDBRequest<Version[]>;
		await done(tx, db);
		return request.result.sort((a, b) => b.at - a.at);
	} catch {
		return [];
	}
}

let queue: Promise<void> = Promise.resolve();

/**
 * Keeps a copy when it is worth keeping, and clears what is past the limits. Copies are kept one after another,
 * so each sees the last and the same chart is not kept twice. Never throws: a copy is a nicety.
 */
export function keepVersion(next: Omit<Version, 'id'>): Promise<void> {
	queue = queue.then(() => keepNow(next));
	return queue;
}

async function keepNow(next: Omit<Version, 'id'>): Promise<void> {
	if (typeof indexedDB === 'undefined') return;
	try {
		const before = await listVersions();
		const place = placeVersion(before, next);
		if (place === 'skip') return;
		const db = await openDb();
		const tx = db.transaction(STORE, 'readwrite');
		const store = tx.objectStore(STORE);
		if (place !== 'keep') {
			const last = before.find((version) => version.id === place.relabel)!;
			store.put({ ...last, why: next.why });
			await done(tx, db);
			return;
		}
		const added = store.add(JSON.parse(JSON.stringify(next)));
		added.onsuccess = () => {
			const all = [...before, { ...next, id: Number(added.result) }];
			for (const id of overflow(all, next.at)) store.delete(id);
		};
		await done(tx, db);
	} catch {}
}

export async function forgetVersion(id: number): Promise<void> {
	if (typeof indexedDB === 'undefined') return;
	try {
		const db = await openDb();
		const tx = db.transaction(STORE, 'readwrite');
		tx.objectStore(STORE).delete(id);
		await done(tx, db);
	} catch {}
}
