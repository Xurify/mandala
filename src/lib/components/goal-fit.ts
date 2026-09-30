/** Smallest goal type, as a fraction of the design size, and never under 11px. */
export const GOAL_TYPE_FLOOR = 0.7;
export const GOAL_TYPE_MIN_PX = 11;

export function goalTypeMin(maxPx: number): number {
	if (!Number.isFinite(maxPx) || maxPx <= 0) return maxPx;
	return Math.min(maxPx, Math.max(GOAL_TYPE_MIN_PX, maxPx * GOAL_TYPE_FLOOR));
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
