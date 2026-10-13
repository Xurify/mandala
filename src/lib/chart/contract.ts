import type { ActionMeta, ChartBrief, ChartData, ClearedAction, DayLog, Session, Timer, Tool, WeekReflection } from './model.ts';

/**
 * Where each piece of saved data may travel. `shared`: with anyone, by link or published share, and between your
 * devices. `asked`: between your devices, and to another person only when you include it in that share.
 * `yours`: between your own devices, never to another person. `device`: nowhere; it describes this device or
 * this browser.
 *
 * Every field of the saved chart is placed here, and the `Record<keyof …>` types make a new field fail
 * `bun run check` until it is. `contract.test.ts` holds `forSharing`, `withoutHistory` and the browser's storage
 * to this list. What cloud sync still needs is in `docs/sync.md`.
 */
export type Reach = 'shared' | 'asked' | 'yours' | 'device';

/**
 * What a fresh copy keeps. `plan`: the chart and how it is set up to be worked. `history`: what happened while it
 * was worked, which a fresh copy starts without.
 */
export type Part = 'plan' | 'history';

export const CHART: Record<keyof ChartData, Reach> = {
	version: 'shared',
	goal: 'shared',
	pillars: 'shared',
	actions: 'shared',
	actionIds: 'shared',
	meta: 'shared',
	days: 'yours',
	weeks: 'yours',
	tools: 'shared',
	brief: 'yours',
	icons: 'yours',
	cleared: 'yours',
	timer: 'yours'
};

export const CHART_PART: Record<keyof ChartData, Part> = {
	version: 'plan',
	goal: 'plan',
	pillars: 'plan',
	actions: 'plan',
	actionIds: 'plan',
	meta: 'plan',
	days: 'history',
	weeks: 'history',
	tools: 'plan',
	brief: 'plan',
	icons: 'plan',
	cleared: 'history',
	timer: 'history'
};

export const ACTION_META: Record<keyof ActionMeta, Reach> = {
	kind: 'shared',
	pinned: 'shared',
	done: 'yours',
	doneAt: 'yours',
	note: 'asked',
	details: 'asked',
	lane: 'yours',
	rank: 'yours'
};

export const META_PART: Record<keyof ActionMeta, Part> = {
	kind: 'plan',
	pinned: 'plan',
	done: 'history',
	doneAt: 'history',
	note: 'plan',
	details: 'plan',
	lane: 'history',
	rank: 'history'
};

export const DAY_LOG: Record<keyof DayLog, Reach> = {
	focus: 'yours',
	checked: 'yours',
	started: 'yours',
	at: 'yours',
	dropped: 'yours',
	declined: 'yours',
	shown: 'yours',
	sessions: 'yours'
};

export const SESSION: Record<keyof Session, Reach> = {
	action: 'yours',
	at: 'yours',
	minutes: 'yours'
};

export const TIMER: Record<keyof Timer, Reach> = {
	action: 'yours',
	since: 'yours',
	length: 'yours'
};

export const WEEK: Record<keyof WeekReflection, Reach> = {
	note: 'yours',
	dismissed: 'yours',
	savedAt: 'yours'
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

export const TOOL_PART: Record<keyof Tool, Part> = {
	id: 'plan',
	url: 'plan',
	title: 'plan',
	kind: 'plan',
	action: 'plan',
	known: 'history',
	opened: 'history'
};

export const CLEARED: Record<keyof ClearedAction, Reach> = {
	text: 'yours',
	pillar: 'yours',
	slot: 'yours'
};

export const BRIEF: Record<keyof ChartBrief, Reach> = {
	timeline: 'yours',
	situation: 'yours',
	focus: 'yours',
	constraint: 'yours'
};

export function only<T extends object, P>(value: T, places: Record<keyof T, P>, keep: (place: P) => boolean): T {
	return Object.fromEntries(Object.entries(value).filter(([field]) => keep(places[field as keyof T]))) as T;
}

export function narrowed(data: ChartData, keepMeta: (field: keyof ActionMeta) => boolean, keepTool: (field: keyof Tool) => boolean): Pick<ChartData, 'meta' | 'tools'> {
	const meta = data.meta
		? Object.fromEntries(
				Object.entries(data.meta).map(([id, entry]) => [id, Object.fromEntries(Object.entries(entry).filter(([field]) => keepMeta(field as keyof ActionMeta)))])
			)
		: undefined;
	const tools = data.tools
		? Object.fromEntries(
				Object.entries(data.tools).map(([key, list]) => [key, list.map((tool) => Object.fromEntries(Object.entries(tool).filter(([field]) => keepTool(field as keyof Tool))) as Tool)])
			)
		: undefined;
	return { meta: meta as ChartData['meta'], tools };
}

export const BROWSER_KEYS: Record<string, string> = {
	'mandala-library-v1': 'Every chart, the open one, and the trash. Cloud sync carries the charts, not the open one',
	'mandala-held': 'Charts this version could not read, set aside before the library was written back',
	'mandala-sync-room': 'The sync key of the device-sync prototype',
	'mandala-sync-state-v1': 'The prototype: the chart it syncs and its last synced copy',
	'mandala-share-state-v1': 'Which charts were published from here, and whether they update on their own',
	'mandala-share-secrets-v1': 'The secret that lets this device update its published shares',
	mandala_reflect: 'The day and hour the weekly reflection is offered',
	mandala_start_sheet: 'The chart being written from the center out, and the preset it borrowed from',
	mandala_view_mode: 'The view last open',
	mandala_view_scale: 'Fit or Large',
	mandala_goal_fit: 'Measured goal text sizes, so the goal does not resize after paint',
	mandala_chat_app: 'The chat app prompts open in',
	theme: 'Light, dark, or the system',
	accent: 'The accent, when not the default'
};
