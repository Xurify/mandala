/** Which kind of call a job makes. Talk answers open questions. Write drafts, fills and rewrites. */
export type CoachTier = 'talk' | 'write';

export type CoachCandidate = { id: string; label: string; thinking: boolean; download: string };

/**
 * Models the lab can pick. `download` is the weight size from each model's tensor cache, measured
 * 2026-10-07. GPU use is larger than this.
 */
export const COACH_CANDIDATES: readonly CoachCandidate[] = [
	{ id: 'Qwen3-0.6B-q4f16_1-MLC', label: 'Qwen3 0.6B', thinking: false, download: '340 MB' },
	{ id: 'Qwen3.5-0.8B-q4f16_1-MLC', label: 'Qwen3.5 0.8B', thinking: false, download: '420 MB' },
	{ id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 1.5B', thinking: false, download: '870 MB' },
	{ id: 'Qwen3-1.7B-q4f16_1-MLC', label: 'Qwen3 1.7B', thinking: false, download: '1 GB' },
	{ id: 'Qwen3.5-2B-q4f16_1-MLC', label: 'Qwen3.5 2B', thinking: false, download: '1.1 GB' },
	{ id: 'Qwen3-4B-q4f16_1-MLC', label: 'Qwen3 4B', thinking: false, download: '2.3 GB' },
	{ id: 'Qwen3-4B-q4f16_1-MLC', label: 'Qwen3 4B, thinking', thinking: true, download: '2.3 GB' }
];

/**
 * What each tier loads. Both are 4B: on the 2026-10-08 run (`docs/bindu-models.md`) 1.7B invented counts and
 * facts in open chat and wrote weaker lines. The lab can still put another model on either tier.
 */
export const COACH_TIERS: Readonly<Record<CoachTier, string>> = {
	talk: 'Qwen3-4B-q4f16_1-MLC',
	write: 'Qwen3-4B-q4f16_1-MLC'
};

/** What Bindu writes with. */
export const COACH_MODEL_ID = COACH_TIERS.write;

/** The id the built-in provider answers to. It has one model, chosen by the browser. */
export const BUILTIN_MODEL = 'built-in';

export function downloadOf(model: string): string {
	return COACH_CANDIDATES.find((candidate) => candidate.id === model)?.download ?? '';
}

/**
 * The model a tier runs on, given the models this device already has (loaded, cached, or agreed to).
 * Talk borrows the writer when it is here, so it never asks for a second download.
 */
export function tierModel(tier: CoachTier, have: readonly string[] = []): string {
	if (tier === 'talk' && have.includes(COACH_TIERS.write)) return COACH_TIERS.write;
	return COACH_TIERS[tier];
}
