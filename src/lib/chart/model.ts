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
export const UNREAD_LABEL = '(handwriting, not read yet)';

export type CellType = 'goal' | 'pillar' | 'action';
export type ReadFlag = 'ink' | 'stale' | 'kept';
export type InputMode = 'type' | 'ink';

export type CellInfo =
	| { type: 'goal' }
	| { type: 'pillar'; k: number }
	| { type: 'action'; k: number };

export type ChartData = {
	goal: string;
	pillars: string[];
	actions: string[][];
	ink: Record<string, number[][]>;
	rd: Record<string, ReadFlag>;
};

export function emptyChart(): ChartData {
	return {
		goal: '',
		pillars: Array.from({ length: 8 }, () => ''),
		actions: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => '')),
		ink: {},
		rd: {}
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

export function inkOf(data: ChartData, key: string): number[][] {
	return data.ink[key] ?? [];
}

export function needsRead(data: ChartData, key: string): boolean {
	if (!inkOf(data, key).length) return false;
	const r = data.rd[key];
	if (r === 'stale') return true;
	if (r === 'ink' || r === 'kept') return false;
	return getByKey(data, key).trim() === '';
}

export function unreadKeys(data: ChartData): string[] {
	return allKeys().filter((k) => needsRead(data, k));
}

export function filledCount(data: ChartData): number {
	let count = 0;
	for (const k of allKeys()) {
		if (getByKey(data, k).trim() || inkOf(data, k).length) count++;
	}
	return count;
}

export function searchHits(data: ChartData, query: string): string[] {
	const q = query.trim().toLowerCase();
	if (!q) return [];
	return allKeys().filter((k) => getByKey(data, k).toLowerCase().includes(q));
}

export function hasContent(data: ChartData): boolean {
	if (data.goal.trim()) return true;
	if (data.pillars.some((p) => p.trim())) return true;
	if (data.actions.some((row) => row.some((a) => a.trim()))) return true;
	return Object.keys(data.ink).length > 0;
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

		const ink: Record<string, number[][]> = {};
		if (record.ink && typeof record.ink === 'object') {
			for (const [key, value] of Object.entries(record.ink as Record<string, unknown>)) {
				if (Array.isArray(value) && value.every((stroke) => Array.isArray(stroke))) {
					ink[key] = value as number[][];
				}
			}
		}

		const readStatus: Record<string, ReadFlag> = {};
		if (record.rd && typeof record.rd === 'object') {
			for (const [key, flag] of Object.entries(record.rd as Record<string, unknown>)) {
				if (flag === 'ink' || flag === 'stale' || flag === 'kept') {
					readStatus[key] = flag;
				}
			}
		}

		return {
			goal: record.goal,
			pillars: record.pillars as string[],
			actions: record.actions as string[][],
			ink,
			rd: readStatus
		};
	} catch {
		return null;
	}
}

export function exampleChart(): ChartData {
	const data = emptyChart();
	data.goal = 'Run a half marathon in under 2:00 by October';
	data.pillars = [
		'Training plan',
		'Speed',
		'Endurance',
		'Recovery',
		'Nutrition',
		'Gear',
		'Mindset',
		'Schedule'
	];
	const ex = [
		['Pick a 16-week plan', 'Log every run', 'Run four days a week', 'Do a long run on Sundays'],
		['Run intervals on Tuesdays', 'Do a tempo run on Thursdays', 'Learn the 5:41/km target pace', 'Race one 10K'],
		['Add 1 km to the long run weekly', 'Cut back every fourth week', 'Practice race-day fueling', 'Run one 18 km long run'],
		['Sleep 7+ hours', 'Stretch after every run', 'Take one full rest day', 'Foam roll twice a week'],
		['Eat protein at breakfast', 'Drink water through the day', 'Test gels on long runs', 'Carb-load two days before the race'],
		['Get fitted for shoes', 'Track shoe mileage', 'Buy a running watch', 'Pack the race kit the night before'],
		['Write the goal on the fridge', 'Visualize the race on Sundays', 'Plan for bad-weather days', 'Celebrate each finished week'],
		['Block runs in the calendar', 'Lay out gear the night before', 'Register for the race', 'Tell a friend about the goal']
	];
	ex.forEach((row, k) => {
		row.forEach((a, j) => {
			data.actions[k]![j] = a;
		});
	});
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
	lines.push(
		`Goal: ${data.goal.trim() || (inkOf(data, 'g').length ? UNREAD_LABEL : '(not set)')}`
	);
	data.pillars.forEach((p, k) => {
		const acts = data.actions[k]!
			.map((a, j) => a.trim() || (inkOf(data, `a${k}_${j}`).length ? UNREAD_LABEL : ''))
			.filter(Boolean);
		if (!p.trim() && !acts.length && !inkOf(data, `p${k}`).length) return;
		lines.push('');
		lines.push(
			`Pillar ${k + 1}: ${p.trim() || (inkOf(data, `p${k}`).length ? UNREAD_LABEL : '(unnamed)')}`
		);
		acts.forEach((a) => lines.push(`  - ${a.trim()}`));
	});
	return lines.join('\n');
}

export function inkChanged(data: ChartData, key: string): void {
	const r = data.rd[key];
	if (r === 'ink') data.rd[key] = 'stale';
	else if (r === 'kept') delete data.rd[key];
}

export function markCaptionKept(data: ChartData, key: string): void {
	const r = data.rd[key];
	if (r === 'ink' || r === 'stale') data.rd[key] = 'kept';
}
