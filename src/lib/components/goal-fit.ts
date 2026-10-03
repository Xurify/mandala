/** Smallest goal type, as a fraction of the design size, and never under 11px. */
export const GOAL_TYPE_FLOOR = 0.7;
export const GOAL_TYPE_MIN_PX = 11;

export function goalTypeMin(maxPx: number): number {
	if (!Number.isFinite(maxPx) || maxPx <= 0) return maxPx;
	return Math.min(maxPx, Math.max(GOAL_TYPE_MIN_PX, maxPx * GOAL_TYPE_FLOOR));
}

export const GOAL_FIT_KEY = 'mandala_goal_fit';

export type GoalFitPart = 'cell' | 'field';

type StoredGoalFit = { k: string; cell?: string; field?: string };

let fitKey = '';

/** Same goal, mode, scale, and width bucket share one saved size. */
export function goalFitKey(goal: string, mode: string, scale: string, width: number): string {
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

/**
 * Apply the last fitted size before the goal paints.
 * The app bundle is deferred and the body is empty until it runs, so this
 * does not block HTML. A matching key means the first paint is already correct.
 */
export function bindGoalFit(goal: string, mode: string, scale: string, width: number): void {
	if (typeof document === 'undefined') return;
	fitKey = goalFitKey(goal, mode, scale, width);
	const stored = readStored();
	const root = document.documentElement;
	const match = stored?.k === fitKey ? stored : null;
	if (match?.cell) root.style.setProperty('--goal-cell-size', match.cell);
	else root.style.removeProperty('--goal-cell-size');
	if (match?.field) root.style.setProperty('--goal-field-size', match.field);
	else root.style.removeProperty('--goal-field-size');
}

/** Remember a measured size for the next visit. Skips the write when nothing changed. */
export function rememberGoalFit(part: GoalFitPart, px: number): void {
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

/** Re-measure when a webfont settles. The fallback face is metric-matched, so this is a no-op when the size holds. */
export function watchFaceSwap(measure: () => void): () => void {
	if (typeof document === 'undefined' || !('fonts' in document)) return () => {};
	const onFonts = (): void => measure();
	document.fonts.addEventListener('loadingdone', onFonts);
	void document.fonts.ready.then(onFonts);
	return () => document.fonts.removeEventListener('loadingdone', onFonts);
}

/** Largest size in [min, max] for which `fits` is true. Returns min when nothing fits. */
export function largestFittingSize(min: number, max: number, fits: (size: number) => boolean): number {
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
