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

<svg class="mark" viewBox="0 0 100 100" aria-hidden="true">
	{#each segments as segment, pillarIndex (pillarIndex)}
		<path
			role="presentation"
			class="mark-arc"
			class:highlight={chart.hoveredColorIndex === pillarIndex}
			d={segment.d}
			style:--h={segment.hue}
			onpointerenter={(event) => enter(pillarIndex, event)}
			onpointerleave={leave}
		/>
	{/each}
	<circle
		role="presentation"
		class="mark-goal"
		class:highlight={chart.hoveredColorIndex === -1}
		cx="50"
		cy="50"
		r="13"
		onpointerenter={(event) => enter(-1, event)}
		onpointerleave={leave}
	/>
</svg>
