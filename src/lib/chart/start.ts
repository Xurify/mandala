import type { ChartData } from './model.ts';
import { PRESETS, type Preset, type PresetId } from './presets/index.ts';

export type StartStep = 'goal' | 'pillars' | 'overview' | 'actions';

function isPillarNamed(data: ChartData, k: number): boolean {
	return Boolean(data.pillars[k]?.trim());
}

function actionCount(data: ChartData, k: number): number {
	return data.actions[k]?.filter((action) => action.trim()).length ?? 0;
}

export function resumeStep(data: ChartData): { step: StartStep; pillar: number | null } {
	if (!data.goal.trim()) return { step: 'goal', pillar: null };
	const counts = data.pillars.map((_, k) => (isPillarNamed(data, k) ? actionCount(data, k) : 0));
	const halfWrittenPillar = counts.findIndex((count) => count > 0 && count < 8);
	if (halfWrittenPillar >= 0) return { step: 'actions', pillar: halfWrittenPillar };
	const anyActions = counts.some((count) => count > 0);
	return { step: anyActions ? 'overview' : 'pillars', pillar: null };
}

export function countCompletedBlocks(data: ChartData): number {
	return data.pillars.filter((_, k) => isPillarNamed(data, k) && actionCount(data, k) === 8).length;
}

export function nextUnfinishedPillar(data: ChartData, after = -1): number | null {
	for (let step = 1; step <= 8; step++) {
		const k = (after + step + 8) % 8;
		if (k !== after && isPillarNamed(data, k) && actionCount(data, k) < 8) return k;
	}
	return null;
}

export function presetWithMostMatchingPillars(data: ChartData): PresetId | null {
	let bestPreset: PresetId | null = null;
	let mostMatches = 0;
	for (const preset of PRESETS) {
		const matches = preset.pillars.filter((name, k) => data.pillars[k]?.trim() === name).length;
		if (matches > mostMatches) {
			bestPreset = preset.id;
			mostMatches = matches;
		}
	}
	return bestPreset;
}

function hasNoOwnPillars(data: ChartData): boolean {
	if (data.pillars.every((name) => !name.trim())) return true;
	return PRESETS.some((preset) => preset.pillars.every((name, k) => data.pillars[k] === name));
}

export function pillarsToWrite(data: ChartData, borrowedPreset: Preset | undefined): string[] | null {
	if (!hasNoOwnPillars(data)) return null;
	const suggestion: string[] = borrowedPreset ? [...borrowedPreset.pillars] : Array.from({ length: 8 }, () => '');
	const unchanged = suggestion.every((name, k) => name === data.pillars[k]);
	return unchanged ? null : suggestion;
}

export function presetActionsToLend(data: ChartData, borrowedPreset: Preset | undefined, k: number): string[] | null {
	if (!borrowedPreset || data.pillars[k]?.trim() !== borrowedPreset.pillars[k]) return null;
	if (data.actions[k]?.some((action) => action.trim())) return null;
	return [...(borrowedPreset.actions[k] ?? [])];
}

export function actionsMatchPreset(data: ChartData, borrowedPreset: Preset | undefined, k: number): boolean {
	const presetActions = borrowedPreset?.actions[k];
	if (!presetActions) return false;
	return presetActions.every((action, i) => data.actions[k]?.[i] === action);
}
