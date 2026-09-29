<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { CELL_COUNT, HUES } from '$lib/chart/model';
	import { arcPath, pillarArc } from '$lib/chart/ring';

	let { size = 64 }: { size?: number } = $props();

	const VIEW = 100;
	const CENTER = VIEW / 2;
	const GEOMETRY = { radius: 42, stroke: 9, gap: 6 };

	const segments = $derived(
		HUES.map((hue, pillarIndex) => {
			const named = (chart.data.pillars[pillarIndex] ?? '').trim() !== '' ? 1 : 0;
			const actions = chart.milestones.pillarActionCounts[pillarIndex] ?? 0;
			const progress = (named + actions) / 9;
			const { start, end } = pillarArc(pillarIndex, GEOMETRY);
			const fillEnd = start + (end - start) * progress;
			return {
				hue,
				track: arcPath(CENTER, CENTER, GEOMETRY.radius, start, end),
				fill: progress > 0 ? arcPath(CENTER, CENTER, GEOMETRY.radius, start, fillEnd) : ''
			};
		})
	);
</script>

<div
	class="ring"
	style:--ring-size="{size}px"
	role="img"
	aria-label="{chart.filled} of {CELL_COUNT} cells filled"
>
	<svg viewBox="0 0 {VIEW} {VIEW}" width={size} height={size} aria-hidden="true">
		{#each segments as segment, pillarIndex (pillarIndex)}
			<path class="ring-track" d={segment.track} style:--h={segment.hue} />
			{#if segment.fill}
				<path class="ring-fill" d={segment.fill} style:--h={segment.hue} />
			{/if}
		{/each}
	</svg>
	<span class="ring-center" class:goal-set={chart.milestones.goalSet}>
		<span class="ring-count">{chart.filled}</span>
	</span>
</div>
