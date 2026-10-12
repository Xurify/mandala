import type { ActionMeta, ChartBrief, ChartData, ClearedAction, DayLog, Session, Timer, Tool, WeekReflection } from './model.ts';

/**
 * Where each piece of saved data may travel. `shared`: with anyone, by link or published share, and between your
 * devices. `yours`: between your own devices, never to another person. `device`: nowhere; it describes this
 * device or this browser.
 *
 * Every field of the saved chart is placed here, and the `Record<keyof …>` types make a new field fail
 * `bun run check` until it is. `contract.test.ts` holds `forSharing` and the browser's storage to this list.
 * What cloud sync still needs is in `docs/sync.md`.
 */
export type Reach = 'shared' | 'yours' | 'device';

export const CHART: Record<keyof ChartData, Reach> = {
	version: 'shared',
	goal: 'shared',
	pillars: 'shared',
	actions: 'shared',
	actionIds: 'shared',
	meta: 'shared',
	days: 'shared',
	weeks: 'shared',
	tools: 'shared',
	brief: 'yours',
	icons: 'yours',
	cleared: 'shared',
	timer: 'yours'
};

export const ACTION_META: Record<keyof ActionMeta, Reach> = {
	kind: 'shared',
	pinned: 'shared',
	done: 'shared',
	doneAt: 'shared',
	note: 'shared',
	details: 'shared',
	lane: 'shared',
	rank: 'shared'
};

export const DAY_LOG: Record<keyof DayLog, Reach> = {
	focus: 'shared',
	checked: 'shared',
	started: 'shared',
	at: 'shared',
	dropped: 'shared',
	declined: 'shared',
	shown: 'shared',
	sessions: 'shared'
};

export const SESSION: Record<keyof Session, Reach> = {
	action: 'shared',
	at: 'shared',
	minutes: 'shared'
};

/** A timer running on your phone shows on your laptop; another person gets the time it logged, not the timer. */
export const TIMER: Record<keyof Timer, Reach> = {
	action: 'yours',
	since: 'yours',
	length: 'yours'
};

export const WEEK: Record<keyof WeekReflection, Reach> = {
	note: 'shared',
	dismissed: 'shared',
	savedAt: 'shared'
};

export const TOOL: Record<keyof Tool, Reach> = {
	id: 'shared',
	url: 'shared',
	title: 'shared',
	kind: 'shared',
	action: 'shared',
	known: 'yours',
	opened: 'yours'
};

export const CLEARED: Record<keyof ClearedAction, Reach> = {
	text: 'shared',
	pillar: 'shared',
	slot: 'shared'
};

export const BRIEF: Record<keyof ChartBrief, Reach> = {
	timeline: 'yours',
	situation: 'yours',
	focus: 'yours',
	constraint: 'yours'
};

export const BROWSER_KEYS: Record<string, string> = {
	'mandala-library-v1': 'Every chart, the open one, and the trash. Cloud sync carries the charts, not the open one',
	'mandala-held': 'Charts this version could not read, set aside before the library was written back',
	'mandala-sync-room': 'The sync key of the device-sync prototype',
	'mandala-sync-state-v1': 'The prototype: the chart it syncs and its last synced copy',
	'mandala-share-state-v1': 'Which charts were published from here, and whether they update on their own',
	'mandala-share-secrets-v1': 'The secret that lets this device update its published shares',
	mandala_reflect: 'The day and hour the weekly reflection is offered',
	mandala_view_mode: 'The view last open',
	mandala_view_scale: 'Fit or Large',
	mandala_goal_fit: 'Measured goal text sizes, so the goal does not resize after paint',
	mandala_chat_app: 'The chat app prompts open in',
	theme: 'Light, dark, or the system',
	accent: 'The accent, when not the default'
};
