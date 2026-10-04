import { cubicOut } from 'svelte/easing';
import type { TransitionConfig } from 'svelte/transition';

/** A note folding back toward its corner. It settles rather than bouncing, and travels only a few pixels. */
export function noteOut(_node: Element, { duration = 520 } = {}): TransitionConfig {
	const reduce =
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (reduce) return { duration: 160, css: (t) => `opacity: ${t}` };
	return {
		duration,
		easing: cubicOut,
		css: (t) => `opacity: ${t}; transform: translateY(${(1 - t) * 8}px)`
	};
}

/** A slip being replaced fades and settles. It does not travel, so it never crosses the one arriving. */
export function slipOut(_node: Element, { duration = 440 } = {}): TransitionConfig {
	const reduce =
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (reduce) return { duration: 0 };
	return {
		duration,
		easing: cubicOut,
		css: (t) => `opacity: ${t}`
	};
}
