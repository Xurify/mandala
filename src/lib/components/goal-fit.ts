export const GOAL_FONT_FLOOR_RATIO = 0.7;
export const GOAL_FONT_MIN_PX = 11;

export type CellKind = 'goal' | 'pillar' | 'action';

export function smallestFontSizeForSentence(maxPx: number, kind: CellKind): number {
	if (!Number.isFinite(maxPx) || maxPx <= 0) return maxPx;
	const ratio = kind === 'pillar' ? 0.64 : kind === 'goal' ? 0.48 : 0.45;
	const floor = kind === 'pillar' ? 7.5 : 6.5;
	return Math.min(maxPx, Math.max(floor, maxPx * ratio));
}

export function fullLinesThatFit(available: number, lineHeight: number): number {
	if (!Number.isFinite(available) || available <= 0) return 1;
	const line = Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : available;
	return Math.max(1, Math.floor((available + 0.5) / line));
}

export function smallestEditorGoalFontSize(maxPx: number): number {
	if (!Number.isFinite(maxPx) || maxPx <= 0) return maxPx;
	return Math.min(maxPx, Math.max(GOAL_FONT_MIN_PX, maxPx * GOAL_FONT_FLOOR_RATIO));
}

export const GOAL_FIT_KEY = 'mandala_goal_fit';

export type GoalFitPart = 'cell' | 'field';

type StoredGoalFit = { k: string; cell?: string; field?: string };

let fitKey = '';

export function sharedGoalFitKey(goal: string, mode: string, scale: string, width: number): string {
	const bucket = Math.round(width / 40) * 40;
	return `${mode}|${scale}|${bucket}|${goal}`;
}

function readStored(): StoredGoalFit | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(GOAL_FIT_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as StoredGoalFit;
		if (!parsed || typeof parsed.k !== 'string') return null;
		return parsed;
	} catch {
		return null;
	}
}

export function applySavedGoalFit(goal: string, mode: string, scale: string, width: number): void {
	if (typeof document === 'undefined') return;
	fitKey = sharedGoalFitKey(goal, mode, scale, width);
	const stored = readStored();
	const root = document.documentElement;
	const match = stored?.k === fitKey ? stored : null;
	if (match?.cell) root.style.setProperty('--goal-cell-size', match.cell);
	else root.style.removeProperty('--goal-cell-size');
	if (match?.field) root.style.setProperty('--goal-field-size', match.field);
	else root.style.removeProperty('--goal-field-size');
}

export function saveGoalFitForNextVisit(part: GoalFitPart, px: number): void {
	if (!fitKey || typeof document === 'undefined' || !Number.isFinite(px) || px <= 0) return;
	const value = `${px.toFixed(2)}px`;
	const prop = part === 'cell' ? '--goal-cell-size' : '--goal-field-size';
	document.documentElement.style.setProperty(prop, value);
	const stored = readStored();
	const next: StoredGoalFit = stored?.k === fitKey ? { ...stored, k: fitKey } : { k: fitKey };
	if (next[part] === value) return;
	next[part] = value;
	try {
		localStorage.setItem(GOAL_FIT_KEY, JSON.stringify(next));
	} catch {
		// private mode / blocked storage
	}
}

export function remeasureWhenFontSettles(measure: () => void): () => void {
	if (typeof document === 'undefined' || !('fonts' in document)) return () => {};
	const onFonts = (): void => measure();
	document.fonts.addEventListener('loadingdone', onFonts);
	void document.fonts.ready.then(onFonts);
	return () => document.fonts.removeEventListener('loadingdone', onFonts);
}

export function largestSizeThatFits(min: number, max: number, fits: (size: number) => boolean): number {
	if (fits(max)) return max;
	if (!fits(min)) return min;
	let low = min;
	let high = max;
	for (let step = 0; step < 8; step += 1) {
		const mid = (low + high) / 2;
		if (fits(mid)) low = mid;
		else high = mid;
	}
	return low;
}
