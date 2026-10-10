<script lang="ts">
	import type { HelperMood } from '$lib/chart/helper.svelte';
	import { HUES } from '$lib/chart/model';
	import { arcPath, pillarArc } from '$lib/chart/ring';
	import { cn } from './ui/cn';

	interface Props {
		mood?: HelperMood;
		size?: number;
		class?: string;
	}

	let { mood = 'idle', size = 40, class: className }: Props = $props();

	const ring = { radius: 39, stroke: 12, gap: 8 };
	// Inner edge of the stroke is radius 33. A smaller face leaves a gap that
	// rasterizes as a light pixel on the left segment.
	const faceRadius = ring.radius - ring.stroke / 2 + 1;

	const segments = HUES.map((hue, pillarIndex) => {
		const { start, end } = pillarArc(pillarIndex, ring);
		return { hue, d: arcPath(50, 50, ring.radius, start, end) };
	});
</script>

<svg
	class={cn(
		'block shrink-0 overflow-visible',
		mood === 'happy' && 'motion-safe:animate-cheer',
		mood === 'offering' && 'motion-safe:animate-nod',
		className
	)}
	width={size}
	height={size}
	viewBox="0 0 100 100"
	aria-hidden="true"
>
	<circle class="fill-ink" cx="50" cy="50" r={faceRadius} />
	{#each segments as segment, pillarIndex (pillarIndex)}
		<path
			class="pillar-stroke fill-none stroke-[12] [stroke-linecap:round] motion-safe:transition-[stroke-width] motion-safe:duration-[180ms] motion-safe:ease-[cubic-bezier(0.34,1.56,0.64,1)] can-hover:group-hover/launcher:stroke-[14]"
			style:--h={segment.hue}
			d={segment.d}
		/>
	{/each}
	{#if mood === 'happy'}
		<g
			class="fill-none stroke-on-ink stroke-[3.2] [stroke-linecap:round] [stroke-linejoin:round] [transform-box:fill-box] origin-center motion-safe:animate-joy"
		>
			<path d="M37.5 49 Q41.5 43.5 45.5 49" />
			<path d="M54.5 49 Q58.5 43.5 62.5 49" />
			<path d="M42 56 Q50 64 58 56" />
		</g>
	{:else if mood === 'listening'}
		<g
			class="origin-center [transform-box:fill-box] motion-safe:animate-listen motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-ui"
		>
			<g class="fill-on-ink [transform-box:fill-box] origin-center motion-safe:animate-listen-blink">
				<ellipse cx="41.5" cy="47" rx="3.3" ry="4.4" />
				<ellipse cx="58.5" cy="47" rx="3.3" ry="4.4" />
			</g>
			<path
				class="fill-none stroke-on-ink stroke-[2.8] [stroke-linecap:round]"
				d="M46 57.5 Q50 60.5 54 57.5"
			/>
		</g>
	{:else if mood === 'puzzled'}
		<g class="[transform-box:fill-box] origin-center motion-safe:animate-puzzle">
			<g class="fill-on-ink [transform-box:fill-box] origin-center motion-safe:animate-squint">
				<ellipse cx="41.5" cy="47" rx="3.3" ry="4.4" />
				<ellipse cx="58.5" cy="47" rx="3.3" ry="3" />
			</g>
			<path
				class="fill-none stroke-on-ink stroke-[2.8] [stroke-linecap:round]"
				d="M43.5 58.5 Q46.75 55.5 50 58.5 Q53.25 61.5 56.5 58.5"
			/>
		</g>
	{:else if mood === 'offering'}
		<g class="[transform-box:fill-box] origin-center">
			<g class="fill-on-ink [transform-box:fill-box] origin-center motion-safe:animate-offer-blink">
				<ellipse cx="41.5" cy="47" rx="3.3" ry="4.4" />
				<ellipse cx="58.5" cy="47" rx="3.3" ry="4.4" />
			</g>
			<path
				class="fill-none stroke-on-ink stroke-[2.8] [stroke-linecap:round]"
				d="M45 56.5 Q50 60.5 55 56.5"
			/>
		</g>
	{:else if mood === 'curious'}
		<g class="[transform-box:fill-box] origin-center motion-safe:animate-curious">
			<g class="fill-on-ink [transform-box:fill-box] origin-center motion-safe:animate-curious-blink">
				<ellipse cx="41.5" cy="45" rx="3.3" ry="4.4" />
				<ellipse cx="58.5" cy="43" rx="3.3" ry="4.4" />
			</g>
			<path
				class="fill-none stroke-on-ink stroke-[2.8] [stroke-linecap:round]"
				d="M45.5 56.5 Q50 60 54.5 56.5"
			/>
		</g>
	{:else}
		<g
			class="fill-on-ink [transform-box:fill-box] origin-center motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-ui motion-safe:animate-blink"
		>
			<ellipse cx="41.5" cy="47" rx="3.3" ry="4.4" />
			<ellipse cx="58.5" cy="47" rx="3.3" ry="4.4" />
		</g>
		<path
			class="fill-none stroke-on-ink stroke-[2.8] [stroke-linecap:round]"
			d="M44 56.5 Q50 61.5 56 56.5"
		/>
	{/if}
</svg>
