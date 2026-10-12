import { describe, expect, it } from 'vitest';
import { isApplePlatform, modifierLabel, visibleShortcuts } from './shortcuts.ts';

describe('shortcuts', () => {
	it('detects Apple platforms', () => {
		expect(isApplePlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe(true);
		expect(isApplePlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
		expect(isApplePlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(false);
	});

	it('labels the modifier key', () => {
		expect(modifierLabel(true)).toBe('⌘');
		expect(modifierLabel(false)).toBe('Ctrl');
	});

	it('substitutes the modifier and hides desktop-only keys on mobile', () => {
		const mobile = visibleShortcuts('Ctrl', false).flatMap((group) => group.items);
		expect(mobile.some((item) => item.label === 'Split view')).toBe(false);
		expect(mobile.find((item) => item.label === 'Open commands')?.keys).toEqual(['Ctrl', 'K']);

		const desktop = visibleShortcuts('⌘', true).flatMap((group) => group.items);
		expect(desktop.some((item) => item.label === 'Split view')).toBe(true);
		expect(desktop.find((item) => item.label === 'Print')?.keys).toEqual(['⌘', 'P']);
	});

	it('lists the calendar under the key that opens it', () => {
		const items = visibleShortcuts('Ctrl', true).flatMap((group) => group.items);
		expect(items.find((item) => item.label === 'Calendar')?.keys).toEqual(['C']);
		expect(items.some((item) => item.keys.includes('Y'))).toBe(false);
	});

	it('lists the board and how to carry a card on it', () => {
		const groups = visibleShortcuts('Ctrl', false);
		expect(groups.flatMap((group) => group.items).find((item) => item.label === 'Board')?.keys).toEqual(['B']);
		expect(groups.find((group) => group.title === 'On the board')?.items.map((item) => item.keys[0])).toEqual(['Space', '←', '↑', 'Esc']);
	});
});
