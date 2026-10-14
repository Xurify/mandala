import { describe, expect, it } from 'vitest';
import { wrapText } from './export-image.ts';

const byChars = { measureText: (text: string) => ({ width: [...text].length }) } as unknown as CanvasRenderingContext2D;

describe('wrapText', () => {
	it('breaks at spaces, and keeps punctuation on its word', () => {
		expect(wrapText(byChars, 'Run three times a week!', 10, 3)).toEqual(['Run three', 'times a', 'week!']);
	});

	it('breaks between words in a language written without spaces', () => {
		const lines = wrapText(byChars, '毎朝十五分日本語の音声を聞く。', 6, 4);
		expect(lines.length).toBeGreaterThan(1);
		expect(lines.join('')).toBe('毎朝十五分日本語の音声を聞く。');
		expect(lines.every((line) => [...line].length <= 6)).toBe(true);
		expect(lines.some((line) => line.startsWith('。'))).toBe(false);
	});
});
