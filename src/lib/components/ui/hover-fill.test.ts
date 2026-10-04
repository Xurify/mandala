import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../../..');

function files(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return files(path);
		if (entry.name === 'hover-fill.test.ts') return [];
		return entry.name.endsWith('.svelte') || entry.name.endsWith('.ts') ? [path] : [];
	});
}

describe('hover fill', () => {
	it('does not fade background-color on a control', () => {
		const hits = files(root).flatMap((path) =>
			readFileSync(path, 'utf8')
				.split('\n')
				.flatMap((line, index) => {
					const fadesBackground =
						/transition-\[[^\]]*background-color/.test(line) ||
						/(?:^|[\s"'`])transition-all(?:[\s"'`]|$)/.test(line) ||
						/(?:^|[\s"'`])plate(?:[\s"'`]|$)/.test(line) ||
						line.includes('--plate');
					return fadesBackground ? [`${path}:${index + 1}: ${line.trim()}`] : [];
				})
		);
		expect(hits).toEqual([]);
	});

	it('keeps the fade off the default color transition', () => {
		const css = readFileSync(join(root, 'app.css'), 'utf8');
		expect(css).not.toContain('@utility plate');
		const utility = css.slice(css.indexOf('@utility transition-colors'));
		const block = utility.slice(0, utility.indexOf('@utility pillar-cell'));
		expect(block).not.toContain('background-color');
		expect(css).toContain('scale: 1');
	});
});
