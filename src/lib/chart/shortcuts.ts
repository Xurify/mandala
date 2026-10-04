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
			{ label: 'Year in focus', keys: ['Y'] },
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
