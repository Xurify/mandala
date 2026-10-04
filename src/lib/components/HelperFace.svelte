<script lang="ts">
	import type { HelperMood } from '$lib/chart/helper.svelte';
	import { HUES } from '$lib/chart/model';
	import { arcPath, PILLAR_ANGLES, pillarArc } from '$lib/chart/ring';
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
		return { hue, d: arcPath(50, 50, ring.radius, start, end), delay: (PILLAR_ANGLES[pillarIndex] / 360) * 1.4 };
	});
</script>

<svg
	class={cn('block shrink-0 overflow-visible', mood === 'happy' && 'motion-safe:animate-hop', className)}
	width={size}
	height={size}
	viewBox="0 0 100 100"
	aria-hidden="true"
>
	<circle class="fill-ink" cx="50" cy="50" r={faceRadius} />
	{#each segments as segment, pillarIndex (pillarIndex)}
		<path
			class={cn(
				'pillar-stroke fill-none stroke-[12] [stroke-linecap:round] motion-safe:transition-[stroke-width] motion-safe:duration-[180ms] motion-safe:ease-[cubic-bezier(0.34,1.56,0.64,1)] can-hover:group-hover/launcher:stroke-[14]',
				mood === 'thinking' && 'motion-safe:animate-think'
			)}
			style:--h={segment.hue}
			style:animation-delay={mood === 'thinking' ? `${segment.delay}s` : undefined}
			d={segment.d}
		/>
	{/each}
	{#if mood === 'happy'}
		<g class="fill-none stroke-on-ink stroke-[3.2] [stroke-linecap:round] [stroke-linejoin:round]">
			<path d="M37.5 49 Q41.5 43.5 45.5 49" />
			<path d="M54.5 49 Q58.5 43.5 62.5 49" />
			<path d="M42 56 Q50 64 58 56" />
		</g>
	{:else}
		<g
			class={cn(
				'fill-on-ink [transform-box:fill-box] origin-center motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-ui',
				mood === 'idle' && 'motion-safe:animate-blink',
				mood === 'thinking' && 'translate-x-[2.5px] -translate-y-[3px]'
			)}
		>
			<ellipse cx="41.5" cy="47" rx="3.3" ry={mood === 'listening' ? 5 : 4.4} />
			<ellipse cx="58.5" cy="47" rx="3.3" ry={mood === 'listening' ? 5 : mood === 'puzzled' ? 3 : 4.4} />
		</g>
		{#if mood === 'listening'}
			<circle class="fill-on-ink" cx="50" cy="58" r="2.4" />
		{:else}
			<path
				class="fill-none stroke-on-ink stroke-[2.8] [stroke-linecap:round]"
				d={mood === 'thinking'
					? 'M46 58 L54 58'
					: mood === 'puzzled'
						? 'M43.5 58.5 Q46.75 55.5 50 58.5 Q53.25 61.5 56.5 58.5'
						: 'M44 56.5 Q50 61.5 56 56.5'}
			/>
		{/if}
	{/if}
</svg>
