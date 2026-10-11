import { flushSync } from 'svelte';

let inside = false;
let queue: (() => void)[] | null = null;
let active: ViewTransition | null = null;

/**
 * The browser applies the change a frame later, after taking the before picture. A morph called inside that
 * change, or before it runs (a click that selects and then switches view), joins it, so it is one transition.
 */
export function morph(update: () => void, type?: string): ViewTransition | null {
	if (inside) {
		update();
		return null;
	}
	if (queue) {
		queue.push(update);
		return active;
	}
	const reduce = typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
	if (reduce || typeof document === 'undefined' || typeof document.startViewTransition !== 'function') {
		update();
		return null;
	}
	queue = [update];
	// A frosted bar (the dock) is captured without what is behind it, so it reads as see-through. While
	// marked, it is solid paper instead.
	document.documentElement.dataset.morphing = '';
	const run = () => {
		const changes = queue ?? [];
		queue = null;
		inside = true;
		try {
			flushSync(() => {
				for (const change of changes) change();
			});
		} finally {
			inside = false;
		}
	};
	const settle = (transition: ViewTransition): ViewTransition => {
		void transition.finished.finally(() => {
			if (active === transition) delete document.documentElement.dataset.morphing;
		});
		active = transition;
		return transition;
	};
	if (type) {
		try {
			return settle(document.startViewTransition({ update: run, types: [type] }));
		} catch {
			// Browsers before transition types take only a callback.
		}
	}
	return settle(document.startViewTransition(run));
}
