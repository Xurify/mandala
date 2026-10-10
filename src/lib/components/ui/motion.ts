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

function reduced(): boolean {
	return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** A page turning in: it slides a little from the side it comes from and settles. */
export function pageIn(_node: Element, { direction = 1, duration = 380, delay = 70 }: { direction?: number; duration?: number; delay?: number } = {}): TransitionConfig {
	if (reduced()) return { duration: 160, css: (t) => `opacity: ${t}` };
	return {
		duration,
		delay,
		easing: expoOut,
		css: (t, u) => `opacity: ${Math.min(1, t * 1.6)}; transform: translateX(${u * direction * 28}px)`
	};
}

/** A page turning away. It fades where it is and drifts a few pixels the other way, never into the new one. */
export function pageOut(_node: Element, { direction = 1, duration = 220 }: { direction?: number; duration?: number } = {}): TransitionConfig {
	if (reduced()) return { duration: 120, css: (t) => `opacity: ${t}` };
	return {
		duration,
		easing: cubicOut,
		css: (t, u) => `opacity: ${t}; transform: translateX(${u * direction * -14}px) scale(${1 - u * 0.015})`
	};
}

/** A line that was fixed leaving its list: it fades and folds its height so the rest close up. */
export function foldOut(node: Element, { duration = 520 } = {}): TransitionConfig {
	const height = (node as HTMLElement).offsetHeight;
	if (reduced()) return { duration: 120, css: (t) => `opacity: ${t}` };
	return {
		duration,
		easing: cubicOut,
		css: (t) => `opacity: ${Math.max(0, t * 2 - 1)}; height: ${t * height}px; overflow: hidden`
	};
}

function expoOut(t: number): number {
	return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}
