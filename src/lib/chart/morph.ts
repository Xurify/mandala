import { flushSync } from 'svelte';

/**
 * Runs a change that swaps what is on screen as one view transition. The stage fades, and anything that
 * carries the same `view-transition-name` before and after travels from its old place to its new one.
 * `type` lets the stylesheet treat a kind of change on its own, like a theme that crossfades the whole page.
 * Without the API, or under reduced motion, the change just happens.
 */
export function morph(update: () => void, type?: string): void {
	const reduce = typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
	if (reduce || typeof document === 'undefined' || typeof document.startViewTransition !== 'function') {
		update();
		return;
	}
	const run = () => flushSync(update);
	if (type) {
		try {
			document.startViewTransition({ update: run, types: [type] });
			return;
		} catch {
			// Browsers before transition types take only a callback.
		}
	}
	document.startViewTransition(run);
}
