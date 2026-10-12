import type { ChartData } from './model.ts';
import { PRESETS, type Preset } from './presets/index.ts';

/** A chart started from the center out: the goal, the ring of pillars, a pillar to begin with, its actions. */
export type StartPage = 'goal' | 'pillars' | 'pick' | 'actions';

/**
 * Where a reload carries on: the goal until there is one, then the ring, which shows what is named and leads to
 * the pick, then the pillar that has actions under it.
 */
export function startPage(data: ChartData): { page: StartPage; pillar: number | null } {
	if (!data.goal.trim()) return { page: 'goal', pillar: null };
	const pillar = data.actions.findIndex((row, k) => Boolean(data.pillars[k]?.trim()) && row.some((action) => action.trim()));
	return pillar < 0 ? { page: 'pillars', pillar: null } : { page: 'actions', pillar };
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
