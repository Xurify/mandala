import type { ChartLibrary } from '../library.ts';
import { newSyncKey, normalizeSyncKey, syncSecrets, type SyncSecrets } from './key.ts';
import { localChart, planChart, planSync, withCharts, type Bases, type Plan, type Push, type RemoteRow } from './plan.ts';
import { listRows, putRow, seal, SyncError, unseal, type SyncFailure } from './remote.ts';

export const SYNC_KEY = 'mandala-sync-key';
export const SYNC_STATE = 'mandala-sync-v1';

const LOCK = 'mandala-sync';
/** Server instances keep their own clocks, so a row can land a little behind one already read. */
const OVERLAP_MS = 120_000;
const EVERY_MS = 45_000;
const AFTER_EDIT_MS = 2_000;
const TRIES = 4;

export type SyncStatus = 'off' | 'syncing' | 'synced' | SyncFailure;

type State = { room: string; cursor: number; bases: Bases };

export interface SyncHost {
	/** The library with this tab's edits written in. */
	library(): ChartLibrary;
	/** Charts that came from another device. `from` is the library they were planned against. */
	adopt(next: ChartLibrary, from: ChartLibrary, changed: readonly string[]): void;
	/** Lines both devices rewrote, where this device's words were kept, and charts with edits here deleted for good elsewhere. */
	clashed(clashes: Plan['clashes'], lost: Plan['lost']): void;
}

/**
 * Keeps every chart the same on each device that holds the key: on opening, on coming back to the tab, on
 * reconnecting, shortly after an edit, and every so often while the page is in view. One tab at a time runs a
 * round, and every round starts from what storage holds, so tabs never undo each other.
 */
export class DeviceSync {
	key = $state<string | null>(null);
	status = $state<SyncStatus>('off');
	lastAt = $state<number | null>(null);
	problem = $state('');

	#host: SyncHost;
	#secrets: { key: string; secrets: Promise<SyncSecrets> } | null = null;
	#running = false;
	#again = false;
	#timer: ReturnType<typeof setTimeout> | null = null;
	#started = false;
	/** Set when the server asked to wait; rounds asked for sooner run when it ends. */
	#pauseUntil = 0;

	constructor(host: SyncHost) {
		this.#host = host;
	}

	start(): void {
		this.key = readKey();
		this.status = this.key ? 'syncing' : 'off';
		if (this.#started || typeof window === 'undefined') return;
		this.#started = true;
		document.addEventListener('visibilitychange', () => this.soon(0));
		window.addEventListener('online', () => this.soon(0));
		window.addEventListener('storage', (event) => {
			if (event.key !== SYNC_KEY) return;
			this.key = readKey();
			this.status = this.key ? 'syncing' : 'off';
			this.soon(0);
		});
		setInterval(() => {
			if (document.visibilityState === 'visible') this.soon(0);
		}, EVERY_MS);
		this.soon(0);
	}

	/** A new key for this device, and every chart on it goes up. */
	turnOn(): string {
		const key = newSyncKey();
		this.#use(key);
		return key;
	}

	/** Joins the charts another device keeps under `typed`. False when it is not a key. */
	join(typed: string): boolean {
		const key = normalizeSyncKey(typed);
		if (!key) return false;
		this.#use(key);
		return true;
	}

	/** This device stops. Its charts stay, and so does the copy the other devices keep. */
	turnOff(): void {
		writeKey(null);
		try {
			localStorage.removeItem(SYNC_STATE);
		} catch {}
		this.key = null;
		this.status = 'off';
		this.problem = '';
		this.lastAt = null;
	}

	soon(delay = AFTER_EDIT_MS): void {
		if (!this.key) return;
		if (this.#timer) clearTimeout(this.#timer);
		this.#timer = setTimeout(() => {
			this.#timer = null;
			void this.now();
		}, Math.max(delay, this.#pauseUntil - Date.now()));
	}

	async now(): Promise<void> {
		if (!this.key) return;
		if (this.#running) {
			this.#again = true;
			return;
		}
		this.#running = true;
		this.status = 'syncing';
		const key = this.key;
		try {
			await withLock(() => this.#round(key));
			if (this.key !== key) return;
			this.status = 'synced';
			this.problem = '';
			this.lastAt = Date.now();
		} catch (error) {
			if (this.key !== key) return;
			this.status = error instanceof SyncError ? error.kind : 'error';
			this.problem = error instanceof Error ? error.message : '';
			if (error instanceof SyncError && error.retryAfter) this.#pauseUntil = Date.now() + error.retryAfter * 1000;
		} finally {
			this.#running = false;
			if (this.#again || this.status === 'limited') {
				this.#again = false;
				this.soon(500);
			}
		}
	}

	#use(key: string): void {
		writeKey(key);
		try {
			localStorage.removeItem(SYNC_STATE);
		} catch {}
		this.key = key;
		this.problem = '';
		this.lastAt = null;
		void this.now();
	}

	#secretsFor(key: string): Promise<SyncSecrets> {
		if (this.#secrets?.key !== key) this.#secrets = { key, secrets: syncSecrets(key) };
		return this.#secrets.secrets;
	}

	async #round(key: string): Promise<void> {
		const secrets = await this.#secretsFor(key);
		const state = readState(secrets.room);
		const sealed = await listRows(secrets.room, Math.max(0, state.cursor - OVERLAP_MS));
		const rows: RemoteRow[] = [];
		let cursor = state.cursor;
		let unread = Infinity;
		for (const row of sealed) {
			const open = await unseal(secrets.seal, row);
			if (open) rows.push(open);
			else unread = Math.min(unread, row.at);
			cursor = Math.max(cursor, row.at);
		}
		if (this.key !== key) return;
		const from = this.#host.library();
		const plan = planSync(from, state.bases, rows);
		if (plan.changed.length > 0) this.#host.adopt(plan.library, from, plan.changed);
		if (plan.clashes.length > 0 || plan.lost.length > 0) this.#host.clashed(plan.clashes, plan.lost);
		state.bases = plan.bases;
		// A row this version cannot read is asked for again next time, in case an update can.
		state.cursor = Math.min(cursor, unread - 1);
		writeState(state);
		for (const push of plan.push) await this.#send(push, state, secrets, key);
	}

	/** One chart up. When another device wrote first, its copy comes down, this device's edits go on top, and it tries again. */
	async #send(first: Push, state: State, secrets: SyncSecrets, key: string): Promise<void> {
		let push: Push | undefined = first;
		for (let attempt = 0; push && attempt < TRIES; attempt++) {
			if (this.key !== key) return;
			const data = push.chart ? await seal(secrets.seal, push.chart) : null;
			const written = await putRow(secrets.room, push.id, data, push.expected);
			if (written.ok) {
				state.bases[push.id] = { at: written.at, chart: push.chart };
				writeState(state);
				return;
			}
			if (!written.row) {
				push = { ...push, expected: null };
				continue;
			}
			const row = await unseal(secrets.seal, written.row);
			if (!row) return;
			const from = this.#host.library();
			const plan = planChart(localChart(from, push.id), state.bases[push.id], row);
			if (plan.base) state.bases[push.id] = plan.base;
			if (plan.next !== undefined) this.#host.adopt(withCharts(from, new Map([[push.id, plan.next]])), from, [push.id]);
			if (plan.clashes || plan.lost) this.#host.clashed(plan.clashes ? [{ id: push.id, clashes: plan.clashes }] : [], plan.lost ? [plan.lost] : []);
			writeState(state);
			push = plan.push;
		}
		if (push) throw new SyncError('error', 'Another device kept saving the same chart. Trying again soon.');
	}
}

async function withLock(run: () => Promise<void>): Promise<void> {
	if (typeof navigator !== 'undefined' && navigator.locks) await navigator.locks.request(LOCK, run);
	else await run();
}

function readKey(): string | null {
	try {
		return normalizeSyncKey(localStorage.getItem(SYNC_KEY) ?? '');
	} catch {
		return null;
	}
}

function writeKey(key: string | null): void {
	try {
		if (key) localStorage.setItem(SYNC_KEY, key);
		else localStorage.removeItem(SYNC_KEY);
	} catch {}
}

function readState(room: string): State {
	try {
		const parsed = JSON.parse(localStorage.getItem(SYNC_STATE) ?? 'null') as State | null;
		if (parsed?.room === room && typeof parsed.cursor === 'number' && parsed.bases) return parsed;
	} catch {}
	return { room, cursor: 0, bases: {} };
}

function writeState(state: State): void {
	try {
		localStorage.setItem(SYNC_STATE, JSON.stringify(state));
	} catch {}
}
