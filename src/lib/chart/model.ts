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
export const STORAGE_KEY = 'mandala-goal-chart-v1';
export const CELL_COUNT = 73;
export const TEXT_MAX = 120;

export type CellType = 'goal' | 'pillar' | 'action';

export type CellInfo =
	| { type: 'goal' }
	| { type: 'pillar'; k: number }
	| { type: 'action'; k: number };

export type ActionKind = 'routine' | 'milestone';

export type ActionMeta = {
	kind: ActionKind;
	pinned?: boolean;
	done?: boolean;
	doneAt?: string;
	note?: string;
};

export type DayLog = {
	focus: string[];
	checked: string[];
	started?: boolean;
	/** Local time of each tick, "HH:MM". */
	at?: Record<string, string>;
	/** Picks taken off the day's list. */
	dropped?: string[];
	/** Suggestions turned down that day: skipped or swapped out. */
	declined?: string[];
	/** Insights Bindu showed that day, as `id:key`. */
	shown?: string[];
};

export type WeekReflection = {
	note: string;
	swapped: string[];
	dismissed?: boolean;
};

/** What the person said when Bindu drafted this chart. Stays on the device and out of share links. */
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

export type ChartData = {
	goal: string;
	pillars: string[];
	actions: string[][];
	meta?: Record<string, ActionMeta>;
	days?: Record<string, DayLog>;
	weeks?: Record<string, WeekReflection>;
	brief?: ChartBrief;
};

export function emptyChart(): ChartData {
	return {
		goal: '',
		pillars: Array.from({ length: 8 }, () => ''),
		actions: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => ''))
	};
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

export function getByKey(data: ChartData, key: string): string {
	if (key === 'g') return data.goal;
	if (key.charAt(0) === 'p') return data.pillars[Number(key.slice(1))] ?? '';
	const [k, j] = key.slice(1).split('_').map(Number);
	return data.actions[k]?.[j] ?? '';
}

export function setByKey(data: ChartData, key: string, value: string): void {
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
	const row = data.actions[k];
	if (row && j !== undefined) row[j] = v;
}

export function labelOfKey(data: ChartData, key: string): string {
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

export function placeholderFor(sel: number, c: number): string {
	const i = info(sel, c);
	if (i.type === 'goal') return 'Your main goal, 6 to 12 months out';
	if (sel === 4) return `Pillar ${i.k + 1}`;
	if (i.type === 'pillar') return 'Name this pillar';
	return `Action ${idx(c) + 1}`;
}

export type Milestones = {
	goalSet: boolean;
	pillarsCount: number;
	actionsCount: number;
	pillarActionCounts: number[];
	completedPillarsCount: number;
};

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

		return {
			goal: record.goal,
			pillars: record.pillars as string[],
			actions: record.actions as string[][],
			meta: (record.meta && typeof record.meta === 'object' ? record.meta : undefined) as Record<string, ActionMeta> | undefined,
			days: (record.days && typeof record.days === 'object' ? record.days : undefined) as Record<string, DayLog> | undefined,
			weeks: (record.weeks && typeof record.weeks === 'object' ? record.weeks : undefined) as Record<string, WeekReflection> | undefined,
			brief: parseBrief(record.brief)
		};
	} catch {
		return null;
	}
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

export function getMeta(data: ChartData, key: string): ActionMeta | undefined {
	return data.meta?.[key];
}

export function setMeta(data: ChartData, key: string, patch: Partial<ActionMeta>): void {
	if (!data.meta) data.meta = {};
	const existing = data.meta[key];
	if (existing) {
		Object.assign(existing, patch);
	} else {
		data.meta[key] = patch as ActionMeta;
	}
}

export function getDayLog(data: ChartData, dateKey: string): DayLog {
	return data.days?.[dateKey] ?? { focus: [], checked: [] };
}

export function getWeekReflection(data: ChartData, weekKey: string): WeekReflection {
	return data.weeks?.[weekKey] ?? { note: '', swapped: [] };
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

		const activeKeys: Set<string> = new Set([...log.focus, ...log.checked]);
		for (const key of activeKeys) {
			if (!key.startsWith('a')) continue;
			const pillarIndex = Number(key.slice(1).split('_')[0]);
			if (pillarIndex >= 0 && pillarIndex < 8) {
				counts[pillarIndex]!++;
			}
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
