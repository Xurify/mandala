import { isId, newId, type Id } from './id.ts';

export const HUES = [25, 60, 100, 150, 195, 240, 290, 345] as const;
export const POS = [
	'top left',
	'top center',
	'top right',
	'middle left',
	'middle right',
	'bottom left',
	'bottom center',
	'bottom right'
] as const;
export const CELL_COUNT = 73;
export const TEXT_MAX = 120;

export type CellInfo =
	| { type: 'goal' }
	| { type: 'pillar'; k: number }
	| { type: 'action'; k: number };

export type ActionKind = 'routine' | 'milestone';

export type ActionId = Id<'action'>;

export type ActionMeta = {
	kind: ActionKind;
	pinned?: boolean;
	done?: boolean;
	doneAt?: string;
	note?: string;
	/** The card's notes on the board: longer than `note`, and kept off Today. */
	details?: string;
	lane?: 'todo' | 'doing';
	rank?: number;
};

export type DayLog = {
	focus: ActionId[];
	checked: ActionId[];
	started?: boolean;
	/** Local time of each tick, "HH:MM". */
	at?: Record<ActionId, string>;
	dropped?: ActionId[];
	declined?: ActionId[];
	/** As `id:key`. */
	shown?: string[];
};

export type WeekReflection = {
	note: string;
	dismissed?: boolean;
	savedAt?: string;
};

/** `day` is as `Date.getDay` gives it. */
export type ReflectAt = { day: number; hour: number };

/** Out of share links and published shares. Sync takes it to your own devices. */
export type ChartBrief = {
	timeline?: string;
	situation?: string;
	focus?: string;
	constraint?: string;
};

const BRIEF_FIELDS = ['timeline', 'situation', 'focus', 'constraint'] as const;

export function parseBrief(value: unknown): ChartBrief | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const record = value as Record<string, unknown>;
	const brief: ChartBrief = {};
	for (const field of BRIEF_FIELDS) {
		const text = record[field];
		if (typeof text === 'string' && text.trim()) brief[field] = text.trim().slice(0, TEXT_MAX * 2);
	}
	return Object.keys(brief).length > 0 ? brief : undefined;
}

export type ToolKind = 'once' | 'repeat';

export type Tool = {
	id: string;
	url: string;
	title: string;
	/** `once` retires itself the first time it is opened. `repeat` stays in rotation until it is known. */
	kind: ToolKind;
	/** Without one, or while its action is cleared, any routine in the pillar may hand it out. */
	action?: ActionId;
	known?: boolean;
	/** Oldest first. */
	opened?: string[];
};

export type ChartData = {
	version?: number;
	goal: string;
	pillars: string[];
	actions: string[][];
	/** Each action's id, in the same places as `actions`. A line keeps its id while its words change, and gets a new one once it is cleared. */
	actionIds: ActionId[][];
	meta?: Record<ActionId, ActionMeta>;
	days?: Record<string, DayLog>;
	weeks?: Record<string, WeekReflection>;
	brief?: ChartBrief;
	/** Keyed `p0` to `p7`. */
	tools?: Record<string, Tool[]>;
	icons?: Record<string, string>;
	cleared?: Record<ActionId, ClearedAction>;
};

/** A line cleared from the chart that something still points at, so its days still name it, and the same words back in the same place bring it back whole. */
export type ClearedAction = { text: string; pillar: number; slot: number };

export const ICON_MAX = 96_000;

export function parseIcons(value: unknown): Record<string, string> | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const out: Record<string, string> = {};
	for (const [host, icon] of Object.entries(value as Record<string, unknown>)) {
		if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(host) || typeof icon !== 'string') continue;
		if (!icon.startsWith('data:image/') || icon.length > ICON_MAX) continue;
		out[host.toLowerCase()] = icon;
	}
	return Object.keys(out).length > 0 ? out : undefined;
}

export function parseTools(value: unknown): Record<string, Tool[]> | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const out: Record<string, Tool[]> = {};
	for (const [key, list] of Object.entries(value as Record<string, unknown>)) {
		if (!/^p[0-7]$/.test(key) || !Array.isArray(list)) continue;
		const tools = list.flatMap((item): Tool[] => {
			if (!item || typeof item !== 'object') return [];
			const record = item as Record<string, unknown>;
			if (typeof record.id !== 'string' || typeof record.url !== 'string' || !isUrl(record.url)) return [];
			const tool: Tool = {
				id: record.id,
				url: record.url.trim(),
				title: typeof record.title === 'string' ? record.title.trim().slice(0, TEXT_MAX * 2) : '',
				kind: record.kind === 'once' ? 'once' : 'repeat'
			};
			if (isId('action', record.action)) tool.action = record.action;
			if (record.known === true) tool.known = true;
			if (Array.isArray(record.opened)) tool.opened = record.opened.filter((day): day is string => typeof day === 'string').slice(-60);
			return [tool];
		});
		if (tools.length > 0) out[key] = tools;
	}
	return Object.keys(out).length > 0 ? out : undefined;
}

export const CHART_VERSION = 1;

export function emptyChart(): ChartData {
	return {
		version: CHART_VERSION,
		goal: '',
		pillars: Array.from({ length: 8 }, () => ''),
		actions: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => '')),
		actionIds: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => newId('action')))
	};
}

export function isActionId(ref: string): ref is ActionId {
	return isId('action', ref);
}

export function idAt(data: ChartData, pillarIndex: number, slot: number): ActionId {
	return data.actionIds[pillarIndex]![slot]!;
}

export function slotOf(data: ChartData, id: ActionId): { pillarIndex: number; slot: number } | null {
	for (let pillarIndex = 0; pillarIndex < 8; pillarIndex++) {
		const slot = data.actionIds[pillarIndex]?.indexOf(id) ?? -1;
		if (slot >= 0) return { pillarIndex, slot };
	}
	return null;
}

export function keyOf(data: ChartData, id: ActionId): string | null {
	const at = slotOf(data, id);
	return at ? actionKey(at.pillarIndex, at.slot) : null;
}

export function pillarOfAction(data: ChartData, id: ActionId): number | null {
	return slotOf(data, id)?.pillarIndex ?? data.cleared?.[id]?.pillar ?? null;
}

export function wordsOf(data: ChartData, id: ActionId): string {
	const at = slotOf(data, id);
	return at ? (data.actions[at.pillarIndex]?.[at.slot] ?? '').trim() : (data.cleared?.[id]?.text ?? '');
}

export function idOfKey(data: ChartData, key: string): ActionId | null {
	const match = key.match(/^a([0-7])_([0-7])$/);
	return match ? idAt(data, Number(match[1]), Number(match[2])) : null;
}

function pointedAt(data: ChartData, id: ActionId): boolean {
	if (data.meta?.[id]) return true;
	if (Object.values(data.tools ?? {}).some((list) => list.some((tool) => tool.action === id))) return true;
	return Object.values(data.days ?? {}).some(
		(log) => log.focus.includes(id) || log.checked.includes(id) || log.dropped?.includes(id) || log.declined?.includes(id)
	);
}

function clearLine(data: ChartData, pillarIndex: number, slot: number, words: string): void {
	const id = idAt(data, pillarIndex, slot);
	if (pointedAt(data, id)) data.cleared = { ...data.cleared, [id]: { text: words.trim(), pillar: pillarIndex, slot } };
	data.actionIds[pillarIndex]![slot] = newId('action');
}

/** Words that come back to the place they were cleared from, as an undo does, bring their action back. */
function bringBack(data: ChartData, pillarIndex: number, slot: number, words: string): void {
	const found = Object.entries(data.cleared ?? {}).find(
		([, line]) => line.pillar === pillarIndex && line.slot === slot && line.text === words.trim()
	);
	if (!found || pointedAt(data, idAt(data, pillarIndex, slot))) return;
	const id = found[0] as ActionId;
	data.actionIds[pillarIndex]![slot] = id;
	const cleared = { ...data.cleared };
	delete cleared[id];
	data.cleared = Object.keys(cleared).length > 0 ? cleared : undefined;
}

export function idx(p: number): number {
	return p < 4 ? p : p - 1;
}

export function blockOfK(k: number): number {
	return k < 4 ? k : k + 1;
}

export function info(b: number, c: number): CellInfo {
	if (b === 4 && c === 4) return { type: 'goal' };
	if (b === 4) return { type: 'pillar', k: idx(c) };
	if (c === 4) return { type: 'pillar', k: idx(b) };
	return { type: 'action', k: idx(b) };
}

export function cellKey(b: number, c: number): string {
	const i = info(b, c);
	if (i.type === 'goal') return 'g';
	if (i.type === 'pillar') return `p${i.k}`;
	return `a${i.k}_${idx(c)}`;
}

export function actionKey(k: number, j: number): string {
	return `a${k}_${j}`;
}

export function allKeys(): string[] {
	const out = ['g'];
	for (let k = 0; k < 8; k++) out.push(`p${k}`);
	for (let k = 0; k < 8; k++) {
		for (let j = 0; j < 8; j++) out.push(`a${k}_${j}`);
	}
	return out;
}

export function kOfKey(key: string): number {
	if (key === 'g') return -1;
	return key.charAt(0) === 'p' ? Number(key.slice(1)) : Number(key.slice(1).split('_')[0]);
}

export function blockOfKey(key: string): number {
	return key === 'g' ? 4 : blockOfK(kOfKey(key));
}

/**
 * A copy, with a new id for every action and everything that points at one moved over. A chart that arrives
 * as a new one (a duplicate, an import, a share) gets its own ids, so no two charts hold the same action.
 */
export function withNewIds(data: ChartData): ChartData {
	const ids = new Map<ActionId, ActionId>();
	const swap = (id: ActionId): ActionId => {
		let next = ids.get(id);
		if (!next) {
			next = newId('action');
			ids.set(id, next);
		}
		return next;
	};
	const list = (values: ActionId[] | undefined) => values?.map(swap);
	const keyed = <T>(record: Record<ActionId, T> | undefined) =>
		record ? (Object.fromEntries(Object.entries(record).map(([id, value]) => [swap(id as ActionId), value])) as Record<ActionId, T>) : undefined;
	const copy = parseChart(JSON.stringify(data)) ?? emptyChart();
	return {
		...copy,
		actionIds: copy.actionIds.map((row) => row.map(swap)),
		meta: keyed(copy.meta),
		cleared: keyed(copy.cleared),
		days: copy.days
			? Object.fromEntries(
					Object.entries(copy.days).map(([dateKey, log]) => [
						dateKey,
						{
							...log,
							focus: list(log.focus)!,
							checked: list(log.checked)!,
							dropped: list(log.dropped),
							declined: list(log.declined),
							at: keyed(log.at),
							shown: log.shown?.map((signature) => signature.replace(/action_[0-9a-z]{26}/g, (id) => swap(id as ActionId)))
						}
					])
				)
			: undefined,
		tools: copy.tools
			? Object.fromEntries(Object.entries(copy.tools).map(([key, list]) => [key, list.map((tool) => (tool.action ? { ...tool, action: swap(tool.action) } : tool))]))
			: undefined
	};
}

/** A cell (`g`, `p{k}`, `a{k}_{j}`) or an action's id. */
export type Ref = string;

export function getByKey(data: ChartData, ref: Ref): string {
	const key = isActionId(ref) ? keyOf(data, ref) : ref;
	if (!key) return '';
	if (key === 'g') return data.goal;
	if (key.charAt(0) === 'p') return data.pillars[Number(key.slice(1))] ?? '';
	const [k, j] = key.slice(1).split('_').map(Number);
	return data.actions[k]?.[j] ?? '';
}

/** Clearing an action's words clears the action: the line gets a new id, and what pointed at the old one stays with it. */
export function setByKey(data: ChartData, ref: Ref, value: string): void {
	const key = isActionId(ref) ? keyOf(data, ref) : ref;
	if (!key) return;
	const v = value.slice(0, TEXT_MAX);
	if (key === 'g') {
		data.goal = v;
		return;
	}
	if (key.charAt(0) === 'p') {
		data.pillars[Number(key.slice(1))] = v;
		return;
	}
	const [k, j] = key.slice(1).split('_').map(Number);
	const row = data.actions[k!];
	if (!row || j === undefined) return;
	const before = row[j] ?? '';
	row[j] = v;
	if (before.trim() && !v.trim()) clearLine(data, k!, j, before);
	else if (v.trim() && data.cleared) bringBack(data, k!, j, v);
}

export function labelOfKey(data: ChartData, ref: Ref): string {
	if (isActionId(ref)) {
		const pillarIndex = pillarOfAction(data, ref);
		return pillarIndex === null ? 'A cleared line' : data.pillars[pillarIndex]?.trim() || `Pillar ${pillarIndex + 1}`;
	}
	const key = ref;
	if (key === 'g') return 'Goal';
	const k = kOfKey(key);
	if (key.charAt(0) === 'p') return `Pillar ${k + 1}`;
	return data.pillars[k]?.trim() || `Pillar ${k + 1}`;
}

export function describe(b: number, c: number): string {
	const i = info(b, c);
	if (i.type === 'goal') return 'Goal';
	if (i.type === 'pillar') return `Pillar ${i.k + 1}`;
	return `Pillar ${i.k + 1} action ${idx(c) + 1}`;
}

export type Milestones = {
	goalSet: boolean;
	pillarsCount: number;
	actionsCount: number;
	pillarActionCounts: number[];
	completedPillarsCount: number;
};

export function wholeness(data: ChartData): { pillars: boolean[]; chart: boolean } {
	const pillars = [0, 1, 2, 3, 4, 5, 6, 7].map(
		(pillarIndex) =>
			(data.pillars[pillarIndex] ?? '').trim() !== '' &&
			Array.from({ length: 8 }, (_, actionIndex) => data.actions[pillarIndex]?.[actionIndex] ?? '').every((action) => action.trim() !== '')
	);
	return { pillars, chart: data.goal.trim() !== '' && pillars.every(Boolean) };
}

export function completedBy(
	before: { pillars: boolean[]; chart: boolean },
	after: { pillars: boolean[]; chart: boolean }
): { pillars: number[]; chart: boolean } {
	return {
		pillars: after.pillars.flatMap((whole, pillarIndex) => (whole && !before.pillars[pillarIndex] ? [pillarIndex] : [])),
		chart: after.chart && !before.chart
	};
}

export function progressMilestones(data: ChartData): Milestones {
	const goalSet = data.goal.trim() !== '';
	let pillarsCount = 0;
	for (let pillarIndex = 0; pillarIndex < 8; pillarIndex++) {
		if ((data.pillars[pillarIndex] ?? '').trim() !== '') pillarsCount++;
	}

	const pillarActionCounts: number[] = [];
	let actionsCount = 0;
	let completedPillarsCount = 0;

	for (let pillarIndex = 0; pillarIndex < 8; pillarIndex++) {
		let currentPillarActions = 0;
		for (let actionIndex = 0; actionIndex < 8; actionIndex++) {
			const actionText = data.actions[pillarIndex]?.[actionIndex]?.trim() ?? '';
			if (actionText !== '') {
				currentPillarActions++;
			}
		}
		pillarActionCounts.push(currentPillarActions);
		actionsCount += currentPillarActions;
		if (currentPillarActions === 8) {
			completedPillarsCount++;
		}
	}

	return {
		goalSet,
		pillarsCount,
		actionsCount,
		pillarActionCounts,
		completedPillarsCount
	};
}

export function filledCount(data: ChartData): number {
	let count = 0;
	for (const key of allKeys()) {
		if (getByKey(data, key).trim()) count++;
	}
	return count;
}

export function searchHits(data: ChartData, query: string): string[] {
	const trimmedQuery = query.trim().toLowerCase();
	if (!trimmedQuery) return [];
	return allKeys().filter((key) => getByKey(data, key).toLowerCase().includes(trimmedQuery));
}

export function hasContent(data: ChartData): boolean {
	if (data.goal.trim()) return true;
	if (data.pillars.some((pillar) => pillar.trim())) return true;
	return data.actions.some((row) => row.some((action) => action.trim()));
}

export function parseChart(raw: string): ChartData | null {
	try {
		const parsedObject = JSON.parse(raw) as unknown;
		if (!parsedObject || typeof parsedObject !== 'object') return null;
		const record = parsedObject as Record<string, unknown>;
		// A newer version's chart would lose what this one does not know, and be written back without it.
		if (typeof record.version === 'number' && record.version > CHART_VERSION) return null;
		if (typeof record.goal !== 'string') return null;
		if (!Array.isArray(record.pillars) || record.pillars.length !== 8) return null;
		if (!record.pillars.every((pillar) => typeof pillar === 'string')) return null;
		if (!Array.isArray(record.actions) || record.actions.length !== 8) return null;
		if (
			!record.actions.every(
				(row) =>
					Array.isArray(row) &&
					row.length === 8 &&
					row.every((action) => typeof action === 'string')
			)
		) {
			return null;
		}

		const actionIds = parseActionIds(record.actionIds);
		return {
			version: CHART_VERSION,
			goal: record.goal,
			pillars: record.pillars as string[],
			actions: record.actions as string[][],
			actionIds,
			meta: parseMeta(record.meta),
			days: (record.days && typeof record.days === 'object' ? record.days : undefined) as Record<string, DayLog> | undefined,
			weeks: (record.weeks && typeof record.weeks === 'object' ? record.weeks : undefined) as Record<string, WeekReflection> | undefined,
			brief: parseBrief(record.brief),
			tools: parseTools(record.tools),
			icons: parseIcons(record.icons),
			cleared: parseCleared(record.cleared, new Set(actionIds.flat()))
		};
	} catch {
		return null;
	}
}

/** A chat app's reply has no ids, so a place without a readable one gets a new one. */
function parseActionIds(value: unknown): ActionId[][] {
	const seen = new Set<string>();
	const rows = Array.isArray(value) ? value : [];
	return Array.from({ length: 8 }, (_, pillarIndex) => {
		const row: unknown[] = Array.isArray(rows[pillarIndex]) ? rows[pillarIndex] : [];
		return Array.from({ length: 8 }, (_, slot) => {
			const id = row[slot];
			if (!isId('action', id) || seen.has(id)) return newId('action');
			seen.add(id);
			return id;
		});
	});
}

function parseMeta(value: unknown): Record<ActionId, ActionMeta> | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const entries = Object.entries(value as Record<string, unknown>).filter(
		(entry): entry is [ActionId, ActionMeta] => isId('action', entry[0]) && !!entry[1] && typeof entry[1] === 'object'
	);
	return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function parseCleared(value: unknown, live: ReadonlySet<string>): Record<ActionId, ClearedAction> | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const out: Record<ActionId, ClearedAction> = {};
	for (const [id, line] of Object.entries(value as Record<string, unknown>)) {
		if (!isId('action', id) || live.has(id) || !line || typeof line !== 'object') continue;
		const { text, pillar, slot } = line as Record<string, unknown>;
		if (typeof text !== 'string' || !isPlace(pillar) || !isPlace(slot)) continue;
		out[id] = { text: text.slice(0, TEXT_MAX), pillar, slot };
	}
	return Object.keys(out).length > 0 ? out : undefined;
}

function isPlace(value: unknown): value is number {
	return Number.isInteger(value) && (value as number) >= 0 && (value as number) < 8;
}

export function parseText(raw: string): ChartData | null {
	if (!raw || typeof raw !== 'string') return null;
	const trimmed = raw.trim();
	if (!trimmed) return null;

	if (trimmed.startsWith('{') || (trimmed.includes('{') && trimmed.includes('}'))) {
		const jsonParsed = parseChart(trimmed);
		if (jsonParsed) return jsonParsed;

		const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
		const candidateText = fencedMatch?.[1]?.trim() ?? trimmed;
		const startIndex = candidateText.indexOf('{');
		const endIndex = candidateText.lastIndexOf('}');
		if (startIndex >= 0 && endIndex > startIndex) {
			const candidateParsed = parseChart(candidateText.slice(startIndex, endIndex + 1));
			if (candidateParsed) return candidateParsed;
		}
	}

	const isIgnoredPlaceholder = (value: string): boolean => {
		const normalized = value.trim().toLowerCase();
		return (
			normalized === '(not set)' ||
			normalized === '(unnamed)' ||
			normalized === '(empty)'
		);
	};

	const sanitizeEntry = (value: string): string => {
		if (isIgnoredPlaceholder(value)) return '';
		return value.replace(/\s+/g, ' ').trim().slice(0, TEXT_MAX);
	};

	const lines = trimmed.split(/\r?\n/);
	const data = emptyChart();

	let currentPillarIndex = -1;
	let nextAvailablePillarIndex = 0;
	let foundExplicitStructure = false;

	for (const originalLine of lines) {
		const trimmedLine = originalLine.trim();
		if (!trimmedLine) continue;

		const goalMatch = trimmedLine.match(/^(?:#+\s*)?(?:goal|aim|target)\s*[:=\-]\s*(.*)$/i);
		if (goalMatch) {
			data.goal = sanitizeEntry(goalMatch[1] ?? '');
			foundExplicitStructure = true;
			currentPillarIndex = -1;
			continue;
		}

		if (currentPillarIndex < 0 && trimmedLine.startsWith('# ')) {
			data.goal = sanitizeEntry(trimmedLine.slice(2));
			foundExplicitStructure = true;
			continue;
		}

		const pillarPrefixMatch = trimmedLine.match(
			/^(?:#+\s*)?pillar\s*(?:(\d+)\b)?\s*[:.\-]?\s*(.*)$/i
		);
		const markdownHeadingMatch = !pillarPrefixMatch
			? trimmedLine.match(/^##+\s*(?:(\d+)\s*[:.)\-]\s*)?(.*)$/)
			: null;

		if (pillarPrefixMatch || markdownHeadingMatch) {
			const numberString = pillarPrefixMatch
				? pillarPrefixMatch[1]
				: markdownHeadingMatch?.[1];
			const titleString = pillarPrefixMatch
				? pillarPrefixMatch[2]
				: markdownHeadingMatch?.[2];

			let targetPillarIndex: number;
			if (numberString) {
				const parsedNumber = parseInt(numberString, 10);
				if (parsedNumber >= 1 && parsedNumber <= 8) {
					targetPillarIndex = parsedNumber - 1;
				} else {
					targetPillarIndex = Math.min(nextAvailablePillarIndex, 7);
				}
			} else {
				targetPillarIndex = Math.min(nextAvailablePillarIndex, 7);
			}

			currentPillarIndex = targetPillarIndex;
			nextAvailablePillarIndex = Math.max(nextAvailablePillarIndex, targetPillarIndex + 1);

			const cleanedTitle = sanitizeEntry(titleString ?? '');
			if (cleanedTitle) {
				data.pillars[currentPillarIndex] = cleanedTitle;
			}
			foundExplicitStructure = true;
			continue;
		}

		const numberedPillarMatch = originalLine.match(/^(\d+)\s*[:.)\-]\s+(.+)$/);
		if (
			numberedPillarMatch &&
			(currentPillarIndex < 0 ||
				(data.actions[currentPillarIndex]?.filter(Boolean).length ?? 0) >= 8)
		) {
			const parsedNumber = parseInt(numberedPillarMatch[1] ?? '', 10);
			if (parsedNumber >= 1 && parsedNumber <= 8) {
				currentPillarIndex = parsedNumber - 1;
				nextAvailablePillarIndex = Math.max(nextAvailablePillarIndex, currentPillarIndex + 1);
				const cleanedTitle = sanitizeEntry(numberedPillarMatch[2] ?? '');
				if (cleanedTitle) {
					data.pillars[currentPillarIndex] = cleanedTitle;
				}
				foundExplicitStructure = true;
				continue;
			}
		}

		if (currentPillarIndex >= 0 && currentPillarIndex < 8) {
			const bulletMatch = trimmedLine.match(/^(?:[-*•+—]|(?:\d+[.)]|\(\d+\)|\[\d+\]))\s+(.*)$/);
			const rawAction = bulletMatch ? bulletMatch[1]! : trimmedLine;
			const cleanedAction = sanitizeEntry(rawAction);

			const actionRow = data.actions[currentPillarIndex]!;
			const emptySlotIndex = actionRow.findIndex((action) => action === '');
			if (emptySlotIndex >= 0 && emptySlotIndex < 8) {
				actionRow[emptySlotIndex] = cleanedAction;
			}
			foundExplicitStructure = true;
		}
	}

	if (!foundExplicitStructure) {
		return null;
	}

	if (
		!data.goal.trim() &&
		!data.pillars.some((pillar) => pillar.trim()) &&
		!data.actions.some((row) => row.some((action) => action.trim()))
	) {
		return null;
	}

	return data;
}

export function exportJson(data: ChartData): string {
	return JSON.stringify(data, null, 2);
}

export function exportFilename(data: ChartData): string {
	const sanitizedGoal = data.goal
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return sanitizedGoal ? `mandala-${sanitizedGoal}.json` : 'mandala-chart.json';
}

export function exportText(data: ChartData): string {
	const lines: string[] = [];
	lines.push(`Goal: ${data.goal.trim() || '(not set)'}`);
	data.pillars.forEach((pillarText, pillarIndex) => {
		const actions = data.actions[pillarIndex]!
			.map((action) => action.trim())
			.filter(Boolean);
		if (!pillarText.trim() && !actions.length) return;
		lines.push('');
		lines.push(`Pillar ${pillarIndex + 1}: ${pillarText.trim() || '(unnamed)'}`);
		actions.forEach((action) => lines.push(`  - ${action.trim()}`));
	});
	return lines.join('\n');
}

export function dateKeyOf(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export function clockOf(date: Date): string {
	return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function todayKey(): string {
	return dateKeyOf(new Date());
}

function dateOf(key: string): Date {
	const [year, month, day] = key.split('-').map(Number);
	return new Date(year!, month! - 1, day!, 12);
}

/**
 * The Monday of the week whose reflection is on offer: the week of the last offer time that has passed.
 * Before Sunday evening that is last week's, so a Monday morning still gets the week that just ended.
 */
export function reflectionWeekOf(at: ReflectAt, now: Date = new Date()): string {
	const monday = dateOf(weekStartKey(now));
	const offer = new Date(monday);
	offer.setDate(monday.getDate() + ((at.day + 6) % 7));
	offer.setHours(at.hour, 0, 0, 0);
	if (now.getTime() >= offer.getTime()) return weekStartKey(monday);
	const previous = new Date(monday);
	previous.setDate(monday.getDate() - 7);
	return weekStartKey(previous);
}

export function weekHadTicks(data: ChartData, weekKey: string): boolean {
	const start = dateOf(weekKey);
	for (let offset = 0; offset < 7; offset++) {
		if ((data.days?.[dateKeyOffset(offset, start)]?.checked.length ?? 0) > 0) return true;
	}
	return false;
}

export function dateKeyOffset(offset: number, base: Date = new Date()): string {
	const date = new Date(base);
	date.setDate(date.getDate() + offset);
	return dateKeyOf(date);
}

export function weekStartKey(date: Date = new Date()): string {
	const dayOfWeek = date.getDay();
	const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
	const monday = new Date(date);
	monday.setDate(date.getDate() - daysToMonday);
	const year = monday.getFullYear();
	const month = String(monday.getMonth() + 1).padStart(2, '0');
	const day = String(monday.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export function isRoutine(meta: ActionMeta | undefined): boolean {
	return meta?.kind === 'routine';
}

export function isOpenFocus(meta: ActionMeta | undefined): boolean {
	if (isRoutine(meta)) return false;
	if (meta?.kind === 'milestone' && meta.done) return false;
	return true;
}

export function getMeta(data: ChartData, id: ActionId): ActionMeta | undefined {
	return data.meta?.[id];
}

export function setMeta(data: ChartData, id: ActionId, patch: Partial<ActionMeta>): void {
	if (!data.meta) data.meta = {};
	const existing = data.meta[id];
	if (existing) {
		Object.assign(existing, patch);
	} else {
		data.meta[id] = patch as ActionMeta;
	}
}

export function getDayLog(data: ChartData, dateKey: string): DayLog {
	return data.days?.[dateKey] ?? { focus: [], checked: [] };
}

export function getWeekReflection(data: ChartData, weekKey: string): WeekReflection {
	return data.weeks?.[weekKey] ?? { note: '' };
}

export function pillarActivityLast7(data: ChartData): number[] {
	const counts = Array.from({ length: 8 }, () => 0);
	if (!data.days) return counts;

	const today = new Date();
	for (let offset = 0; offset < 7; offset++) {
		const date = new Date(today);
		date.setDate(today.getDate() - offset);
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const dateKey = `${year}-${month}-${day}`;
		const log: DayLog | undefined = data.days[dateKey];
		if (!log) continue;

		for (const id of new Set([...log.focus, ...log.checked])) {
			const pillarIndex = pillarOfAction(data, id);
			if (pillarIndex !== null) counts[pillarIndex]!++;
		}
	}
	return counts;
}

export type DayActivity = { focusCount: number; checkedCount: number };

export function yearActivity(data: ChartData, year: number): Map<string, DayActivity> {
	const prefix = `${year}-`;
	const result = new Map<string, DayActivity>();
	if (!data.days) return result;
	for (const [key, log] of Object.entries(data.days)) {
		if (!key.startsWith(prefix)) continue;
		result.set(key, { focusCount: log.focus.length, checkedCount: log.checked.length });
	}
	return result;
}

export type YearStats = {
	daysWithFocus: number;
	checkedActions: number;
	bestStreak: number;
};

export function yearStats(data: ChartData, year: number): YearStats {
	let daysWithFocus = 0;
	let checkedActions = 0;
	let bestStreak = 0;
	let currentStreak = 0;
	for (
		const date = new Date(year, 0, 1);
		date.getFullYear() === year;
		date.setDate(date.getDate() + 1)
	) {
		const log = data.days?.[dateKeyOf(date)];
		const hasFocus = (log?.focus.length ?? 0) > 0;
		const hasChecked = (log?.checked.length ?? 0) > 0;
		if (hasFocus || hasChecked) {
			currentStreak += 1;
			bestStreak = Math.max(bestStreak, currentStreak);
			if (hasFocus) daysWithFocus += 1;
			checkedActions += log?.checked.length ?? 0;
		} else {
			currentStreak = 0;
		}
	}
	return { daysWithFocus, checkedActions, bestStreak };
}

export function isUrl(value: string): boolean {
	return /^https?:\/\//i.test(value.trim());
}
