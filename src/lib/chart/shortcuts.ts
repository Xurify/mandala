export type ShortcutItem = {
	label: string;
	keys: readonly string[];
};

export type ShortcutGroup = {
	title: string;
	items: readonly ShortcutItem[];
};

type ShortcutDef = ShortcutItem & { desktopOnly?: boolean };

const GROUPS: readonly { title: string; items: readonly ShortcutDef[] }[] = [
	{
		title: 'Find',
		items: [
			{ label: 'Open commands', keys: ['mod', 'K'] },
			{ label: 'Search the chart', keys: ['/'] }
		]
	},
	{
		title: 'Move around',
		items: [
			{ label: 'Today', keys: ['T'] },
			{ label: 'Board', keys: ['B'] },
			{ label: 'Calendar', keys: ['C'] },
			{ label: 'Chart', keys: ['V'] },
			{ label: 'Editor', keys: ['E'] },
			{ label: 'Split view', keys: ['S'], desktopOnly: true },
			{ label: 'Open the editor from the chart', keys: ['Enter'] },
			{ label: 'Next pillar', keys: ['Alt', '→'] },
			{ label: 'Previous pillar', keys: ['Alt', '←'] }
		]
	},
	{
		title: 'This chart',
		items: [
			{ label: 'Rename', keys: ['R'] },
			{ label: 'Duplicate', keys: ['D'] },
			{ label: 'New chart', keys: ['N'] },
			{ label: 'Delete chart', keys: ['Del'] }
		]
	},
	{
		title: 'On the board',
		items: [
			{ label: 'Pick up a card, or put it down', keys: ['Space'] },
			{ label: 'Carry it to another list', keys: ['←', '→'] },
			{ label: 'Carry it up or down', keys: ['↑', '↓'] },
			{ label: 'Put it back where it was', keys: ['Esc'] }
		]
	},
	{
		title: 'While editing',
		items: [{ label: 'Next cell', keys: ['Enter'] }]
	},
	{
		title: 'General',
		items: [
			{ label: 'Keyboard shortcuts', keys: ['?'] },
			{ label: 'Print', keys: ['mod', 'P'] },
			{ label: 'Clear search, leave the editor, or select the goal', keys: ['Esc'] }
		]
	}
];

export function isApplePlatform(userAgent: string): boolean {
	return /Mac|iPhone|iPad|iPod/i.test(userAgent);
}

export function modifierLabel(apple: boolean): string {
	return apple ? '⌘' : 'Ctrl';
}

export function visibleShortcuts(mod: string, desktop: boolean): ShortcutGroup[] {
	return GROUPS.map((group) => ({
		title: group.title,
		items: group.items
			.filter((item) => desktop || !item.desktopOnly)
			.map((item) => ({
				label: item.label,
				keys: item.keys.map((key) => (key === 'mod' ? mod : key))
			}))
	})).filter((group) => group.items.length > 0);
}

type Target = { closest?(selector: string): unknown; ownerDocument?: { body: unknown; documentElement: unknown } | null };

/**
 * A key or paste the page did not start: from a browser extension's panel, say. A field in a shadow root reaches the
 * page with the root's host as its target, so it does not look like a field. An open root still shows the field
 * first in the path; a closed one hides it, but its host sits outside the app's own nodes (`data-app`).
 */
export function fromOutside(event: { target: EventTarget | null; composedPath(): EventTarget[] }): boolean {
	const origin = event.composedPath()[0];
	if (origin !== undefined && origin !== event.target) return true;
	const target = event.target as Target | null;
	if (typeof target?.closest !== 'function') return false;
	const page = target.ownerDocument;
	if (target === page?.body || target === page?.documentElement) return false;
	return target.closest('[data-app]') === null;
}
