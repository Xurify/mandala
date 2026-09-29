<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { HUES } from '$lib/chart/model';
	import { arcPath, pillarArc } from '$lib/chart/ring';

	const segments = HUES.map((hue, pillarIndex) => {
		const { start, end } = pillarArc(pillarIndex, { radius: 36, stroke: 15, gap: 7 });
		return { hue, d: arcPath(50, 50, 36, start, end) };
	});

	function enter(colorIndex: number, event: PointerEvent): void {
		if (event.pointerType === 'touch') return;
		chart.hoveredColorIndex = colorIndex;
	}

	function leave(event: PointerEvent): void {
		if (event.pointerType === 'touch') return;
		chart.hoveredColorIndex = null;
	}
</script>

<svg class="block size-[30px] shrink-0 overflow-visible" viewBox="0 0 100 100" aria-hidden="true">
	{#each segments as segment, pillarIndex (pillarIndex)}
		<path
			role="presentation"
			class="pillar-stroke cursor-pointer fill-none stroke-[15] [stroke-linecap:round] motion-safe:transition-[stroke-width] motion-safe:duration-[180ms] motion-safe:ease-[cubic-bezier(0.34,1.56,0.64,1)] can-hover:hover:stroke-[18] can-hover:[&.highlight]:stroke-[18]"
			class:highlight={chart.hoveredColorIndex === pillarIndex}
			d={segment.d}
			style:--h={segment.hue}
			onpointerenter={(event) => enter(pillarIndex, event)}
			onpointerleave={leave}
		/>
	{/each}
	<circle
		role="presentation"
		class="origin-center cursor-pointer fill-ink motion-safe:transition-transform motion-safe:duration-[180ms] motion-safe:ease-[cubic-bezier(0.34,1.56,0.64,1)] [transform-box:fill-box] can-hover:hover:scale-125 can-hover:[&.highlight]:scale-125"
		class:highlight={chart.hoveredColorIndex === -1}
		cx="50"
		cy="50"
		r="13"
		onpointerenter={(event) => enter(-1, event)}
		onpointerleave={leave}
	/>
</svg>
