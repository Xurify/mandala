import { cubicOut } from 'svelte/easing';
import type { TransitionConfig } from 'svelte/transition';

/** A slip being replaced fades and settles. It does not travel, so it never crosses the one arriving. */
export function slipOut(_node: Element, { duration = 440 } = {}): TransitionConfig {
	const reduce =
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (reduce) return { duration: 0 };
	return {
		duration,
		easing: cubicOut,
		css: (t) => `opacity: ${t}; transform: scale(${0.97 + t * 0.03})`
	};
}
