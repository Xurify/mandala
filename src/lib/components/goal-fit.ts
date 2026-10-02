/** Smallest goal type, as a fraction of the design size, and never under 11px. */
export const GOAL_TYPE_FLOOR = 0.7;
export const GOAL_TYPE_MIN_PX = 11;

export function goalTypeMin(maxPx: number): number {
	if (!Number.isFinite(maxPx) || maxPx <= 0) return maxPx;
	return Math.min(maxPx, Math.max(GOAL_TYPE_MIN_PX, maxPx * GOAL_TYPE_FLOOR));
}

/** True once no webfont is still swapping in. A missing FontFaceSet counts as ready. */
export function faceIsReady(): boolean {
	return typeof document === 'undefined' || !('fonts' in document) || document.fonts.status === 'loaded';
}

/** Re-measure when faces settle. `reveal` runs if a face never arrives. */
export function watchFaceSwap(measure: () => void, reveal: () => void): () => void {
	if (typeof document === 'undefined' || !('fonts' in document)) return () => {};
	const onFonts = (): void => measure();
	document.fonts.addEventListener('loadingdone', onFonts);
	void document.fonts.ready.then(onFonts);
	const timer = window.setTimeout(reveal, 1200);
	return () => {
		document.fonts.removeEventListener('loadingdone', onFonts);
		window.clearTimeout(timer);
	};
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
