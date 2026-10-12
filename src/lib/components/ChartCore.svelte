<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { HUES } from '$lib/chart/model';
	import BlockSheet from './BlockSheet.svelte';
	import { cn } from './ui/cn';
	import { fitWords } from './ui/fit';

	let { class: className }: { class?: string } = $props();

	/** The center block's places, row by row: the goal in the middle, each pillar where the grid has it. */
	const PLACES = [0, 1, 2, 3, -1, 4, 5, 6, 7];

	let open = $state<number | null>(null);

	const goal = $derived(chart.data.goal.trim());
	const written = (pillarIndex: number): number => (chart.data.actions[pillarIndex] ?? []).filter((text) => text.trim()).length;
</script>

<!-- On a phone 81 cells cannot hold their words, so the chart is read from its center: a pillar opens its block. -->
<div class={cn('mx-auto grid aspect-square w-full max-w-[480px] grid-cols-3 grid-rows-3 gap-1.5 rounded-[24px] bg-surface p-2 shadow-card', className)}>
	{#each PLACES as pillarIndex (pillarIndex)}
		{#if pillarIndex < 0}
			<button
				type="button"
				class="flex min-w-0 cursor-pointer items-center justify-center overflow-hidden rounded-[28%] border-0 p-[10%] text-center font-serif text-[0.9rem] leading-[1.15] font-[560] text-balance text-goal-fg bg-goal can-hover:hover:bg-goal-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
				aria-label={goal ? `Edit the goal: ${goal}` : 'Write the goal'}
				onclick={() => chart.jumpToKey('g')}
			>
				<span class={cn('line-clamp-5 w-full', !goal && 'opacity-60')} {@attach fitWords(goal)}>{goal || 'Your goal'}</span>
			</button>
		{:else}
			{@const name = chart.data.pillars[pillarIndex]?.trim() ?? ''}
			{@const count = written(pillarIndex)}
			<button
				type="button"
				class="flex min-w-0 cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-[28%] border-0 p-[10%] text-center font-sans text-on-p pillar-cell can-hover:hover:pillar-hot focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
				style:--h={HUES[pillarIndex]}
				aria-haspopup="dialog"
				aria-label="{name || `Pillar ${pillarIndex + 1}`}: {count} of 8 actions"
				onclick={() => (open = pillarIndex)}
			>
				<span class={cn('line-clamp-3 w-full text-[0.92rem] leading-tight font-[620] text-balance', !name && 'opacity-60')} {@attach fitWords(name)}>
					{name || `Pillar ${pillarIndex + 1}`}
				</span>
				<span class="text-[0.74rem] leading-none font-[560] tabular-nums opacity-75" aria-hidden="true">{count} of 8</span>
			</button>
		{/if}
	{/each}
</div>

<BlockSheet bind:pillar={open} />
