import type { ChartData } from './model.ts';
import { PRESETS, type Preset, type PresetId } from './presets/index.ts';

/** A chart written from the center out: the goal, the ring of pillars, the outer ring, one pillar's block. */
export type StartPage = 'goal' | 'pillars' | 'pick' | 'actions';

function named(data: ChartData, k: number): boolean {
	return Boolean(data.pillars[k]?.trim());
}

function written(data: ChartData, k: number): number {
	return data.actions[k]?.filter((action) => action.trim()).length ?? 0;
}

/**
 * Where a reload, or Keep building, carries on: the goal until there is one, then the ring, then a block left
 * half written, then the outer ring to pick the next one from.
 */
export function startPage(data: ChartData): { page: StartPage; pillar: number | null } {
	if (!data.goal.trim()) return { page: 'goal', pillar: null };
	const counts = data.pillars.map((_, k) => (named(data, k) ? written(data, k) : 0));
	const half = counts.findIndex((count) => count > 0 && count < 8);
	if (half >= 0) return { page: 'actions', pillar: half };
	return counts.some((count) => count > 0) ? { page: 'pick', pillar: null } : { page: 'pillars', pillar: null };
}

/** A pillar's block is written when the pillar has a name and all eight actions. */
export function blocksWritten(data: ChartData): number {
	return data.pillars.filter((_, k) => named(data, k) && written(data, k) === 8).length;
}

/** The next named pillar after `from`, going round, whose block still has an empty line. -1 starts at the first. */
export function nextPillar(data: ChartData, from: number): number | null {
	for (let step = 1; step <= 8; step++) {
		const k = (from + step + 8) % 8;
		if (k !== from && named(data, k) && written(data, k) < 8) return k;
	}
	return null;
}

/** The preset whose pillar names the chart still carries most of, so carrying on can still lend its actions. */
export function lenderOf(data: ChartData): PresetId | null {
	let lender: PresetId | null = null;
	let most = 0;
	for (const preset of PRESETS) {
		const same = preset.pillars.filter((name, k) => data.pillars[k]?.trim() === name).length;
		if (same > most) {
			lender = preset.id;
			most = same;
		}
	}
	return lender;
}

/** Nothing in the ring is the person's own yet: it is empty, or holds a preset's eight pillars as they came. */
function ringUntouched(data: ChartData): boolean {
	if (data.pillars.every((name) => !name.trim())) return true;
	return PRESETS.some((preset) => preset.pillars.every((name, k) => data.pillars[k] === name));
}

/**
 * What the ring should hold when the person reaches it: the borrowed preset's pillars, or nothing once they
 * stopped borrowing. Null leaves the ring alone, which it always does once a pillar is their own.
 */
export function ringFor(data: ChartData, preset: Preset | undefined): string[] | null {
	if (!ringUntouched(data)) return null;
	const next: string[] = preset ? [...preset.pillars] : Array.from({ length: 8 }, () => '');
	return next.every((name, k) => name === data.pillars[k]) ? null : next;
}

/** The preset's eight actions for pillar k, when the pillar still has the preset's name and nothing under it. */
export function actionsFor(data: ChartData, preset: Preset | undefined, k: number): string[] | null {
	if (!preset || data.pillars[k]?.trim() !== preset.pillars[k]) return null;
	if (data.actions[k]?.some((action) => action.trim())) return null;
	return [...(preset.actions[k] ?? [])];
}

/** Pillar k still holds the preset's actions word for word, so turning back can take them away again. */
export function actionsUntouched(data: ChartData, preset: Preset | undefined, k: number): boolean {
	const lent = preset?.actions[k];
	return Boolean(lent) && (lent ?? []).every((action, i) => data.actions[k]?.[i] === action);
}
