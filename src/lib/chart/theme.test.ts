import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { oklchToRgb, toHex } from './ring.ts';
import { THEME_COLORS, accentOf, themeOf } from './theme.ts';

const root = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(root, '../../app.css'), 'utf8');
const html = readFileSync(join(root, '../../app.html'), 'utf8');
const manifest = JSON.parse(readFileSync(join(root, '../../../static/manifest.webmanifest'), 'utf8')) as { theme_color: string; background_color: string };

function bgOf(selector: string): string {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const block = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
	const [, l, c, h] = block.match(/--bg:\s*oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/) ?? [];
	return toHex(oklchToRgb(Number(l), Number(c), Number(h)));
}

describe('theme', () => {
	it("paints the browser's bar in the page's own paper, before first paint and in the manifest", () => {
		expect(THEME_COLORS.light).toBe(bgOf(':root'));
		expect(THEME_COLORS.dark).toBe(bgOf(":root[data-theme='dark']"));
		expect(THEME_COLORS.dark).toBe(bgOf(":root:not([data-theme='light'])"));
		for (const color of Object.values(THEME_COLORS)) expect(html.split(color).length - 1).toBe(2);
		expect(manifest.theme_color).toBe(THEME_COLORS.light);
		expect(manifest.background_color).toBe(THEME_COLORS.light);
	});

	it('reads a stored choice, and anything else as the default', () => {
		expect(themeOf('dark')).toBe('dark');
		expect(themeOf('sepia')).toBe('system');
		expect(themeOf(null)).toBe('system');
		expect(accentOf('leaf')).toBe('leaf');
		expect(accentOf('sap')).toBe('clay');
	});
});
