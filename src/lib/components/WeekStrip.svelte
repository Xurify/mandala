<script lang="ts">
	import { weekStrip } from '$lib/chart/helper';
	import { HUES, type ChartData } from '$lib/chart/model';
	import { cn } from './ui/cn';

	let { data, class: className }: { data: ChartData; class?: string } = $props();

	const strip = $derived(weekStrip(data));
	/** Pips a day column shows before it says how many more. */
	const STACK = 7;
	const summary = $derived(strip.map((day) => day.ticks.length).join(', '));
	/** The strip is as tall as the busiest day, so a quiet week is not a tall empty box. */
	const tallest = $derived(Math.max(3, Math.min(STACK, ...strip.map((day) => day.ticks.length))));
</script>

<!-- The week as it happened: a column per day, a pip per tick, in the pillar's hue. -->
<div
	class={cn('rounded-[22px] bg-bg px-3.5 pt-3.5 pb-3', className)}
	role="img"
	aria-label="Ticks in the last 7 days, oldest first: {summary}."
>
	<div class="flex items-stretch justify-between gap-1.5" style:height="{tallest * 11 + 26}px">
		{#each strip as day, column (day.key)}
			<div class="flex min-w-0 flex-1 flex-col items-center gap-2">
				<div class="flex w-full max-w-[26px] flex-1 flex-col-reverse items-stretch gap-[3px]">
					{#each day.ticks.slice(0, STACK) as pillarIndex, row (row)}
						<span
							class="pip h-2 shrink-0 rounded-full motion-safe:animate-stack-in"
							style:--pip-h={HUES[pillarIndex]}
							style:animation-delay="{120 + column * 45 + row * 35}ms"
						></span>
					{/each}
					{#if day.ticks.length === 0}
						<span class="h-[3px] shrink-0 rounded-full bg-sunken"></span>
					{:else if day.ticks.length > STACK}
						<span class="text-center text-[0.66rem] leading-none font-[620] text-muted tabular-nums">+{day.ticks.length - STACK}</span>
					{/if}
				</div>
				<span class="text-[0.72rem] leading-none font-[620] {day.today ? 'text-text' : 'text-muted'}">{day.today ? 'Today' : day.label}</span>
			</div>
		{/each}
	</div>
</div>
