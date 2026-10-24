<script lang="ts">
	import { HUES, info } from '$lib/chart/model';
	import { PILLAR_ANGLES } from '$lib/chart/ring';
	import { cn } from './ui/cn';

	interface Props {
		label?: string;
		class?: string;
	}

	let { label = 'Loading the chart', class: className }: Props = $props();

	const PERIOD_MS = 2800;

	// Each pillar breathes in turn, clockwise from the top, where it sits on the ring.
	function delay(k: number): string {
		return `${Math.round((PILLAR_ANGLES[k]! / 360) * PERIOD_MS)}ms`;
	}
</script>

<div
	class={cn(
		'mandala @container grid aspect-square w-full grid-cols-3 gap-2.5 max-[900px]:mx-auto max-[900px]:max-w-[480px] max-[900px]:gap-1',
		className
	)}
	role="status"
	aria-label={label}
>
	{#each Array(9) as _, blockIndex (blockIndex)}
		<div class="grid grid-cols-3 gap-[5px] rounded-[22px] bg-surface p-2 shadow-card max-[900px]:gap-0.5 max-[900px]:rounded-[13px] max-[900px]:p-1">
			{#each Array(9) as _, cellIndex (cellIndex)}
				{@const cell = info(blockIndex, cellIndex)}
				{#if cell.type === 'goal'}
					<div class="aspect-square rounded-[28%] bg-sunken-hover"></div>
				{:else if cell.type === 'pillar'}
					<div
						class="pillar-cell aspect-square rounded-[28%] opacity-30 motion-safe:animate-breathe"
						style:--h={HUES[cell.k]}
						style:animation-delay={delay(cell.k)}
					></div>
				{:else}
					<div class="aspect-square rounded-[11px] bg-sunken"></div>
				{/if}
			{/each}
		</div>
	{/each}
</div>
