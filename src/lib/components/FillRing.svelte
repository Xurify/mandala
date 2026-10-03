<script lang="ts">
	import { CELL_COUNT } from '$lib/chart/model';

	let { filled, size = 16 }: { filled: number; size?: number } = $props();

	// The pie is a circle of radius r stroked 2r wide, so the dash draws a wedge.
	const PIE = 3.25;
	const LENGTH = 2 * Math.PI * PIE;
	const progress = $derived(Math.min(1, Math.max(0, filled / CELL_COUNT)));
</script>

<svg class="block shrink-0 -rotate-90" viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
	<circle cx="8" cy="8" r="7" class="fill-none stroke-muted" stroke-width="1.5" />
	{#if progress > 0}
		<circle
			cx="8"
			cy="8"
			r={PIE}
			class="fill-none stroke-muted"
			stroke-width={PIE * 2}
			stroke-dasharray="{LENGTH * progress} {LENGTH}"
		/>
	{/if}
</svg>
