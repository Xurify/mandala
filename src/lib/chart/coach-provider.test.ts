import { describe, expect, it } from 'vitest';
import { replyText } from './coach-provider.ts';

describe('replyText', () => {
	it('drops thinking blocks and trims', () => {
		expect(replyText('<think>plan</think>\n Walk after dinner ')).toBe('Walk after dinner');
		expect(replyText(undefined)).toBe('');
	});
});
