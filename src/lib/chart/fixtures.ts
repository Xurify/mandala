import type { ActionId, ChartData } from './model.ts';

type Place = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Cell = `a${Place}_${Place}`;

/** For tests: an id for each cell that names it, `A.a0_0` for `a0_0`, so a test reads like the chart it builds. */
export const A = Object.fromEntries(
	Array.from({ length: 64 }, (_, index) => {
		const pillarIndex = Math.floor(index / 8);
		const slot = index % 8;
		return [`a${pillarIndex}_${slot}`, `action_${'0'.repeat(24)}${pillarIndex}${slot}`];
	})
) as Record<Cell, ActionId>;

/** Gives every cell its `A` id. */
export function slotted<T extends ChartData>(data: T): T {
	data.actionIds = Array.from({ length: 8 }, (_, pillarIndex) => Array.from({ length: 8 }, (_, slot) => A[`a${pillarIndex}_${slot}` as Cell]));
	return data;
}
