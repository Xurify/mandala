import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ACCENT_IDS, isAccent } from './accent.ts';
import { oklchToRgb } from './ring.ts';

const root = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(root, '../../app.css'), 'utf8');
const html = readFileSync(join(root, '../../app.html'), 'utf8');

type Stop = [number, number, number];

function declarations(selector: string): Map<string, Stop> {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
	if (!match?.[1]) throw new Error(`missing ${selector}`);
	const found = new Map<string, Stop>();
	for (const token of match[1].matchAll(
		/--([\w-]+):\s*oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\)/g
	)) {
		const name = token[1];
		if (!name) continue;
		found.set(name, [Number(token[2]), Number(token[3]), Number(token[4])]);
	}
	return found;
}

function inGamut(l: number, c: number, h: number): boolean {
	const hr = (h * Math.PI) / 180;
	const a = c * Math.cos(hr);
	const b = c * Math.sin(hr);
	const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
	const linear = [
		4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
		-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
		-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_
	];
	return linear.every((channel) => channel >= -0.0005 && channel <= 1.0005);
}

function luminance([l, c, h]: Stop): number {
	const [r, g, b] = oklchToRgb(l, c, h);
	const linear = [r, g, b].map((channel) => {
		const encoded = channel / 255;
		return encoded <= 0.04045 ? encoded / 12.92 : ((encoded + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function contrast(foreground: Stop, background: Stop): number {
	const lighter = Math.max(luminance(foreground), luminance(background));
	const darker = Math.min(luminance(foreground), luminance(background));
	return (lighter + 0.05) / (darker + 0.05);
}

const lightPaper = {
	bg: [0.972, 0.008, 85] as Stop,
	surface: [0.994, 0.004, 85] as Stop
};

const darkPaper = {
	bg: [0.185, 0.008, 65] as Stop,
	surface: [0.225, 0.009, 65] as Stop
};

const swatchIds = ACCENT_IDS.filter((id) => id !== 'ink');

describe('accent ramp', () => {
	it('names ink and the four kept swatches', () => {
		expect(ACCENT_IDS).toHaveLength(5);
		expect(isAccent('ink')).toBe(true);
		expect(isAccent('leaf')).toBe(true);
		expect(isAccent('field')).toBe(true);
		expect(isAccent('walnut')).toBe(true);
		expect(isAccent('olive')).toBe(true);
		expect(isAccent('sap')).toBe(false);
		expect(isAccent('honey')).toBe(false);
		for (const id of swatchIds) expect(isAccent(id)).toBe(true);
	});

	it('paints each swatch before first paint and aliases it onto the accent tokens', () => {
		for (const id of swatchIds) {
			expect(html).toContain(`'${id}'`);
			expect(css).toContain(`:root[data-accent='${id}']`);
			expect(css).toContain(`--accent: var(--swatch-${id});`);
			expect(css).toContain(`--accent-hover: var(--swatch-${id}-hover);`);
			expect(css).toContain(`--on-accent: var(--swatch-${id}-on);`);
		}
	});

	it('keeps text at 4.5:1 and the fill at 3:1 on paper and surface', () => {
		expect(css).toContain('--bg: oklch(0.972 0.008 85);');
		expect(css).toContain('--surface: oklch(0.994 0.004 85);');
		expect(css).toContain('--bg: oklch(0.185 0.008 65);');
		expect(css).toContain('--surface: oklch(0.225 0.009 65);');

		const modes = [
			{ selector: ':root', paper: lightPaper },
			{ selector: ":root:not([data-theme='light'])", paper: darkPaper },
			{ selector: ":root[data-theme='dark']", paper: darkPaper }
		];

		for (const id of swatchIds) {
			for (const mode of modes) {
				const tokens = declarations(mode.selector);
				const fill = tokens.get(`swatch-${id}`);
				const hover = tokens.get(`swatch-${id}-hover`);
				const label = tokens.get(`swatch-${id}-on`);
				expect(fill, `${mode.selector} ${id}`).toBeDefined();
				expect(hover, `${mode.selector} ${id}`).toBeDefined();
				expect(label, `${mode.selector} ${id}`).toBeDefined();
				for (const stop of [fill!, hover!, label!]) {
					expect(inGamut(...stop), `${mode.selector} ${id} ${stop.join(' ')}`).toBe(true);
				}
				for (const face of [fill!, hover!]) {
					expect(contrast(label!, face), `${mode.selector} ${id} text`).toBeGreaterThanOrEqual(4.5);
					expect(contrast(face, mode.paper.bg), `${mode.selector} ${id} paper`).toBeGreaterThanOrEqual(3);
					expect(contrast(face, mode.paper.surface), `${mode.selector} ${id} surface`).toBeGreaterThanOrEqual(
						3
					);
				}
			}
		}
	});

	it('uses the same dark swatches in both dark blocks', () => {
		const media = declarations(":root:not([data-theme='light'])");
		const forced = declarations(":root[data-theme='dark']");
		for (const id of swatchIds) {
			for (const suffix of ['', '-hover', '-on']) {
				const key = `swatch-${id}${suffix}`;
				expect(forced.get(key)).toEqual(media.get(key));
			}
		}
	});
});
