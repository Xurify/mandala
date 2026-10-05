export const ACCENT_IDS = ['ink', 'walnut', 'olive', 'field', 'leaf'] as const;

export type AccentId = (typeof ACCENT_IDS)[number];

export const ACCENTS: { id: AccentId; label: string; title: string }[] = [
	{ id: 'ink', label: 'Ink', title: 'Same as the ink' },
	{ id: 'walnut', label: 'Walnut', title: 'Wood brown' },
	{ id: 'olive', label: 'Olive', title: 'Green olive' },
	{ id: 'field', label: 'Field', title: 'Light sap green' },
	{ id: 'leaf', label: 'Leaf', title: 'Bright green' }
];

export function isAccent(value: string): value is AccentId {
	return (ACCENT_IDS as readonly string[]).includes(value);
}
