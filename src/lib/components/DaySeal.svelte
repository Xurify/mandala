<script lang="ts">
	import { HUES } from '$lib/chart/model';
	import { arcPath, pillarArc } from '$lib/chart/ring';
	import { cn } from './ui/cn';

	type Props = {
		moved: number[];
		play?: boolean;
		label: string;
		/** Seconds between arcs as they draw. */
		step?: number;
		class?: string;
	};

	let { moved, play = false, label, step = 0.16, class: className }: Props = $props();

	const VIEW = 100;
	const CENTER = VIEW / 2;
	const GEOMETRY = { radius: 42, stroke: 7, gap: 7 };
	const DRAW_START = 0.35;

	const segments = $derived(
		HUES.map((hue, pillarIndex) => {
			const { start, end } = pillarArc(pillarIndex, GEOMETRY);
			return { hue, pillarIndex, d: arcPath(CENTER, CENTER, GEOMETRY.radius, start, end) };
		})
	);

	const drawOrder = $derived([...moved].sort((a, b) => a - b));
	const checkDelay = $derived(DRAW_START + drawOrder.length * step + 0.1);
</script>

<div
	class={cn('relative aspect-square', play && 'motion-safe:animate-seal-in', className)}
	role="img"
	aria-label={label}
>
	<svg class="block size-full overflow-visible" viewBox="0 0 {VIEW} {VIEW}" aria-hidden="true">
		{#each segments as segment (segment.pillarIndex)}
			{@const order = drawOrder.indexOf(segment.pillarIndex)}
			<path
				class="ring-track fill-none stroke-[7] [stroke-linecap:round]"
				d={segment.d}
				style:--h={segment.hue}
			/>
			{#if order >= 0}
				<path
					class={cn(
						'pillar-stroke fill-none stroke-[7] [stroke-dasharray:1] [stroke-linecap:round]',
						play && 'motion-safe:animate-seal-draw'
					)}
					d={segment.d}
					pathLength="1"
					style:--h={segment.hue}
					style:animation-delay={play ? `${DRAW_START + order * step}s` : undefined}
				/>
			{/if}
		{/each}
		<polyline
			class={cn(
				'fill-none stroke-current text-text [stroke-dasharray:1] [stroke-linecap:round] [stroke-linejoin:round]',
				play && 'motion-safe:animate-seal-draw'
			)}
			points="65 39.7 44.4 60.3 35 50.9"
			stroke-width="4.5"
			pathLength="1"
			style:animation-delay={play ? `${checkDelay}s` : undefined}
		/>
	</svg>
</div>
