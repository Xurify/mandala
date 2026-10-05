import { describe, expect, it } from 'vitest';
import {
	fullLinesThatFit,
	largestSizeThatFits,
	remeasureWhenFontSettles,
	sharedGoalFitKey,
	smallestEditorGoalFontSize,
	smallestFontSizeForSentence
} from './goal-fit';

describe('goal type fit', () => {
	it('keeps the design size when it is already under 11px', () => {
		expect(smallestEditorGoalFontSize(9.5)).toBe(9.5);
	});

	it('floors a large design size at 70 percent, and not under 11px', () => {
		expect(smallestEditorGoalFontSize(16)).toBeCloseTo(11.2);
		expect(smallestEditorGoalFontSize(20)).toBeCloseTo(14);
	});

	it('buckets the fit cache by mode, scale, width, and goal', () => {
		expect(sharedGoalFitKey('Run', 'view', 'fit', 1280)).toBe(sharedGoalFitKey('Run', 'view', 'fit', 1290));
		expect(sharedGoalFitKey('Run', 'view', 'fit', 1280)).not.toBe(sharedGoalFitKey('Run', 'edit', 'fit', 1280));
		expect(sharedGoalFitKey('Run', 'view', 'fit', 1280)).not.toBe(sharedGoalFitKey('Ship', 'view', 'fit', 1280));
		const stop = remeasureWhenFontSettles(() => {});
		stop();
	});

	it('shrinks a long cell below the editor floor, and never past the design size', () => {
		expect(smallestFontSizeForSentence(16, 'goal')).toBeCloseTo(7.68);
		expect(smallestFontSizeForSentence(16, 'pillar')).toBeCloseTo(10.24);
		expect(smallestFontSizeForSentence(13, 'action')).toBe(6.5);
		expect(smallestFontSizeForSentence(6, 'action')).toBe(6);
	});

	it('counts only whole lines', () => {
		expect(fullLinesThatFit(40, 10)).toBe(4);
		expect(fullLinesThatFit(39, 10)).toBe(3);
		expect(fullLinesThatFit(0, 10)).toBe(1);
	});

	it('picks the largest size that fits, or the floor when none do', () => {
		expect(largestSizeThatFits(11, 17, (size) => size <= 13)).toBeCloseTo(13, 1);
		expect(largestSizeThatFits(11, 17, () => true)).toBe(17);
		expect(largestSizeThatFits(11, 17, () => false)).toBe(11);
	});
});
