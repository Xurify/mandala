import { describe, expect, it } from 'vitest';
import { goalFitKey, goalTypeMin, largestFittingSize, watchFaceSwap } from './goal-fit';

describe('goal type fit', () => {
	it('keeps the design size when it is already under 11px', () => {
		expect(goalTypeMin(9.5)).toBe(9.5);
	});

	it('floors a large design size at 70 percent, and not under 11px', () => {
		expect(goalTypeMin(16)).toBeCloseTo(11.2);
		expect(goalTypeMin(20)).toBeCloseTo(14);
	});

	it('buckets the fit cache by mode, scale, width, and goal', () => {
		expect(goalFitKey('Run', 'view', 'fit', 1280)).toBe(goalFitKey('Run', 'view', 'fit', 1290));
		expect(goalFitKey('Run', 'view', 'fit', 1280)).not.toBe(goalFitKey('Run', 'edit', 'fit', 1280));
		expect(goalFitKey('Run', 'view', 'fit', 1280)).not.toBe(goalFitKey('Ship', 'view', 'fit', 1280));
		const stop = watchFaceSwap(() => {});
		stop();
	});

	it('picks the largest size that fits, or the floor when none do', () => {
		expect(largestFittingSize(11, 17, (size) => size <= 13)).toBeCloseTo(13, 1);
		expect(largestFittingSize(11, 17, () => true)).toBe(17);
		expect(largestFittingSize(11, 17, () => false)).toBe(11);
	});
});
