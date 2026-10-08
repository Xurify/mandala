/** What Bindu loads. The lab can still pick another id from `COACH_CANDIDATES`. */
export const COACH_MODEL_ID = 'Qwen3-4B-q4f16_1-MLC';

export const COACH_CANDIDATES = [
	{ id: 'Qwen3-4B-q4f16_1-MLC', label: 'Qwen3 4B', thinking: false },
	{ id: 'Qwen3-4B-q4f16_1-MLC', label: 'Qwen3 4B, thinking', thinking: true }
] as const;

/** Weight download, shown on the consent card. GPU use is larger than this. */
export const COACH_WEIGHT_DOWNLOAD = '2.3 GB';

/** The id the built-in provider answers to. It has one model, chosen by the browser. */
export const BUILTIN_MODEL = 'built-in';
