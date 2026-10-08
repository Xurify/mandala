import { describe, expect, it } from 'vitest';
import { COACH_CANDIDATES, COACH_TIERS, downloadOf, tierModel } from './coach-model.ts';

describe('coach tiers', () => {
	it('talks and writes on 4B, one download', () => {
		expect(tierModel('talk')).toBe(COACH_TIERS.talk);
		expect(tierModel('write')).toBe(COACH_TIERS.write);
		expect(COACH_TIERS.talk).toBe(COACH_TIERS.write);
		expect(downloadOf(COACH_TIERS.write)).toBe('2.3 GB');
	});

	it('borrows the writer for talk when the writer is already here', () => {
		expect(tierModel('talk', [COACH_TIERS.write])).toBe(COACH_TIERS.write);
		expect(tierModel('write', [COACH_TIERS.talk])).toBe(COACH_TIERS.write);
	});

	it('lists every tier model, each with a download size', () => {
		for (const id of Object.values(COACH_TIERS)) expect(COACH_CANDIDATES.some((choice) => choice.id === id)).toBe(true);
		for (const choice of COACH_CANDIDATES) expect(choice.download).toMatch(/^\d+(?:\.\d+)? (?:MB|GB)$/);
		expect(downloadOf('not-a-model')).toBe('');
	});
});
