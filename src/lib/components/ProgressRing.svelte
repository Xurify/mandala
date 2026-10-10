<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { CELL_COUNT, HUES } from '$lib/chart/model';
	import { arcPath, pillarArc } from '$lib/chart/ring';
	import { cn } from './ui/cn';

	let { size = 64 }: { size?: number } = $props();

	const VIEW = 100;
	const CENTER = VIEW / 2;
	const GEOMETRY = { radius: 42, stroke: 9, gap: 6 };
	/** Seconds between arcs when the whole ring redraws for a full chart. */
	const WAVE = 0.07;

	const segments = $derived(
		HUES.map((hue, pillarIndex) => {
			const named = (chart.data.pillars[pillarIndex] ?? '').trim() !== '' ? 1 : 0;
			const actions = chart.milestones.pillarActionCounts[pillarIndex] ?? 0;
			const progress = (named + actions) / 9;
			const { start, end } = pillarArc(pillarIndex, GEOMETRY);
			const fillEnd = start + (end - start) * progress;
			return {
				hue,
				pillarIndex,
				track: arcPath(CENTER, CENTER, GEOMETRY.radius, start, end),
				fill: progress > 0 ? arcPath(CENTER, CENTER, GEOMETRY.radius, start, fillEnd) : ''
			};
		})
	);

	/** A pillar that just got its last line redraws its arc; a full chart redraws all of them, in order. */
	const landed = $derived(chart.landed);
	function lands(pillarIndex: number): boolean {
		return landed !== null && (landed.chart || landed.pillars.includes(pillarIndex));
	}
	const checkDelay = 0.35 + 8 * WAVE;
</script>

<div
	class="relative shrink-0"
	style:width="{size}px"
	style:height="{size}px"
	role="img"
	aria-label={landed?.chart ? 'Every cell is written' : `${chart.filled} of ${CELL_COUNT} cells filled`}
>
	<svg class="block overflow-visible" viewBox="0 0 {VIEW} {VIEW}" width={size} height={size} aria-hidden="true">
		{#each segments as segment (segment.pillarIndex)}
			<path class="ring-track fill-none stroke-[9] [stroke-linecap:round]" d={segment.track} style:--h={segment.hue} />
			{#if lands(segment.pillarIndex)}
				{#key landed?.id}
					<path
						class="pillar-stroke fill-none stroke-[9] [stroke-dasharray:1] [stroke-linecap:round] motion-safe:animate-[seal-draw_0.5s_cubic-bezier(0.65,0,0.35,1)_both,swell_0.7s_cubic-bezier(0.34,1.56,0.64,1)_both]"
						d={segment.track}
						pathLength="1"
						style:--h={segment.hue}
						style:animation-delay={landed?.chart ? `${segment.pillarIndex * WAVE}s` : undefined}
					/>
				{/key}
			{:else if segment.fill}
				<path
					class="pillar-stroke fill-none stroke-[9] [stroke-linecap:round] motion-safe:transition-[d] motion-safe:duration-300 motion-safe:ease-ui"
					d={segment.fill}
					style:--h={segment.hue}
				/>
			{/if}
		{/each}
		{#if landed?.chart}
			{#key landed.id}
				<!-- The last stroke of a full chart: the count steps aside for a check. -->
				<polyline
					class="fill-none stroke-current text-text [stroke-dasharray:1] [stroke-linecap:round] [stroke-linejoin:round] motion-safe:animate-seal-draw"
					points="64 41 45.5 59.5 36 50"
					stroke-width="5.5"
					pathLength="1"
					style:animation-delay="{checkDelay}s"
				/>
			{/key}
		{/if}
	</svg>
	<span
		class={cn(
			'absolute inset-0 flex items-center justify-center motion-safe:transition-opacity motion-safe:duration-500',
			chart.milestones.goalSet ? 'text-text' : 'text-muted',
			landed?.chart && 'opacity-0 motion-safe:duration-200'
		)}
	>
		<span class="font-serif text-[length:calc(var(--count-size))] leading-none font-[560] tracking-[-0.02em] tabular-nums" style:--count-size="{size * 0.3}px">{chart.filled}</span>
	</span>
</div>
