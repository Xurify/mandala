export const ACCENT_IDS = ['ink', 'leaf', 'field', 'walnut', 'olive'] as const;

export type AccentId = (typeof ACCENT_IDS)[number];

export const ACCENTS: { id: AccentId; label: string; title: string }[] = [
	{ id: 'ink', label: 'Ink', title: 'Same as the ink' },
	{ id: 'leaf', label: 'Leaf', title: 'Bright green' },
	{ id: 'field', label: 'Field', title: 'Light sap green' },
	{ id: 'walnut', label: 'Walnut', title: 'Wood brown' },
	{ id: 'olive', label: 'Olive', title: 'Green olive' }
];

export function isAccent(value: string): value is AccentId {
	return (ACCENT_IDS as readonly string[]).includes(value);
}
