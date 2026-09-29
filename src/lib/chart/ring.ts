import { HUES } from './model';

/** Clockwise angle (0 = top) of each pillar's position around the goal, indexed by pillar k. */
export const PILLAR_ANGLES = [315, 0, 45, 270, 90, 225, 180, 135] as const;

export const SEGMENT_SPAN = 45;

export type Arc = { start: number; end: number };

export type RingGeometry = { radius: number; stroke: number; gap: number };

/** `gap` is the visible gap in degrees between neighbouring round-capped segments. */
export function pillarArc(k: number, { radius, stroke, gap }: RingGeometry): Arc {
	const center = PILLAR_ANGLES[k]!;
	const cap = (Math.asin(Math.min(1, stroke / 2 / radius)) * 180) / Math.PI;
	const half = Math.max(0.5, SEGMENT_SPAN / 2 - gap / 2 - cap);
	return { start: center - half, end: center + half };
}

function polar(cx: number, cy: number, radius: number, angle: number): [number, number] {
	const radians = ((angle - 90) * Math.PI) / 180;
	return [cx + radius * Math.cos(radians), cy + radius * Math.sin(radians)];
}

export function arcPath(cx: number, cy: number, radius: number, start: number, end: number): string {
	const [x0, y0] = polar(cx, cy, radius, start);
	const [x1, y1] = polar(cx, cy, radius, end);
	const large = end - start > 180 ? 1 : 0;
	return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/** OKLCH to 8-bit sRGB, for places CSS color functions can't reach (PNG icons, poster export). */
export function oklchToRgb(l: number, c: number, h: number): [number, number, number] {
	const hr = (h * Math.PI) / 180;
	const a = c * Math.cos(hr);
	const b = c * Math.sin(hr);
	const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
	const linear = [
		4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
		-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
		-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_
	];
	return linear.map((channel) => {
		const clamped = Math.min(1, Math.max(0, channel));
		const encoded =
			clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
		return Math.round(encoded * 255);
	}) as [number, number, number];
}

export function toHex([r, g, b]: [number, number, number]): string {
	return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

export const BRAND = {
	ink: oklchToRgb(0.24, 0.012, 60),
	paper: oklchToRgb(0.972, 0.008, 85),
	pillars: HUES.map((hue) => oklchToRgb(0.7, 0.13, hue))
};
