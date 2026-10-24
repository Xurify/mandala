import type { Attachment } from 'svelte/attachments';

export const GOAL_FONT_FLOOR_RATIO = 0.7;
export const GOAL_FONT_MIN_PX = 11;
export const FIELD_FONT_MIN_PX = 12;

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

/**
 * Shrinks a cell's field until its words fit the square, no smaller than `FIELD_FONT_MIN_PX`. Set `data-fit` to
 * the text, so words that arrive without an input event (another block, another pillar) fit again.
 */
export const fitCellField: Attachment = (element) => {
	if (!(element instanceof HTMLTextAreaElement)) return;
	let frame = 0;

	// A word too wide for the cell counts as not fitting, so "Pronunciation" shrinks before it breaks. A textarea
	// wraps a long word without reporting any overflow, so the widest word is measured on a canvas in its font.
	const widestWord = (size: number): number => {
		const style = getComputedStyle(element);
		const pen = measuringPen();
		if (!pen) return 0;
		pen.font = `${style.fontStyle} ${style.fontWeight} ${size}px ${style.fontFamily}`;
		return Math.max(0, ...element.value.split(/\s+/).map((word) => pen.measureText(word).width));
	};
	const fitsAt = (size: number): boolean => {
		element.style.fontSize = `${size}px`;
		const style = getComputedStyle(element);
		const across = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
		return element.scrollHeight <= element.clientHeight + 1 && widestWord(size) <= across + 0.5;
	};

	const apply = (): void => {
		element.style.fontSize = '';
		if (element === document.activeElement && typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches) return;
		if (element.clientHeight <= 0 || element.value.trim() === '') return;
		const max = parseFloat(getComputedStyle(element).fontSize);
		if (!Number.isFinite(max) || max <= FIELD_FONT_MIN_PX || fitsAt(max)) {
			element.style.fontSize = '';
			return;
		}
		const chosen = largestSizeThatFits(FIELD_FONT_MIN_PX, max, fitsAt);
		element.style.fontSize = `${Math.floor(chosen * 4) / 4}px`;
	};

	const schedule = (): void => {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(apply);
	};

	apply();
	const stopFace = remeasureWhenFontSettles(schedule);
	const resizeObserver = new ResizeObserver(schedule);
	resizeObserver.observe(element);
	element.addEventListener('focus', schedule);
	element.addEventListener('blur', schedule);
	// The value changes without an input event when the editor turns to another block.
	const textObserver = new MutationObserver(schedule);
	textObserver.observe(element, { attributes: true, attributeFilter: ['data-fit'] });
	return () => {
		cancelAnimationFrame(frame);
		stopFace();
		resizeObserver.disconnect();
		textObserver.disconnect();
		element.removeEventListener('focus', schedule);
		element.removeEventListener('blur', schedule);
		element.style.fontSize = '';
	};
};

let pen: CanvasRenderingContext2D | null | undefined;

function measuringPen(): CanvasRenderingContext2D | null {
	if (pen === undefined) pen = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
	return pen;
}
