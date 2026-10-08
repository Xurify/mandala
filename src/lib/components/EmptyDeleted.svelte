<script lang="ts">
	import { HUES } from '$lib/chart/model';
	import { arcPath, pillarArc } from '$lib/chart/ring';
	import Icon from './Icon.svelte';

	/** `ring` is the one in use. `trash` and `count` stay for the lab on /dev/ui. */
	let { days, take = 'ring' }: { days: number; take?: 'ring' | 'count' | 'trash' } = $props();

	const GEOMETRY = { radius: 42, stroke: 9, gap: 6 };
	const segments = HUES.map((hue, pillarIndex) => {
		const { start, end } = pillarArc(pillarIndex, GEOMETRY);
		return { hue, d: arcPath(50, 50, GEOMETRY.radius, start, end) };
	});
</script>

<div class="flex flex-col items-center gap-4 pt-3 pb-2 text-center">
	{#if take === 'trash'}
		<span class="grid size-16 place-items-center rounded-full bg-sunken text-muted" aria-hidden="true">
			<Icon name="trash" size={24} />
		</span>
	{:else}
		<!-- The chart's ring with nothing on it: the same picture as the progress ring, empty. -->
		<span class="relative block size-[76px]" aria-hidden="true">
			<svg class="block overflow-visible" viewBox="0 0 100 100" width="76" height="76">
				{#each segments as segment, index (index)}
					<path
						class="ring-track fill-none stroke-[9] [stroke-linecap:round] motion-safe:animate-pop-in"
						d={segment.d}
						style:--h={segment.hue}
						style:animation-delay="{index * 35}ms"
					/>
				{/each}
			</svg>
			<span class="absolute inset-0 grid place-items-center text-muted">
				{#if take === 'count'}
					<span class="font-serif text-[1.4rem] leading-none font-[560] tabular-nums">0</span>
				{:else}
					<Icon name="trash" size={20} />
				{/if}
			</span>
		</span>
	{/if}
	<div class="flex flex-col gap-1">
		<p class="m-0 text-[1rem] font-[620] text-text">Nothing deleted</p>
		<p class="m-0 max-w-[36ch] text-[0.9rem] leading-[1.45] text-balance text-muted">
			Delete a chart from the menu and it waits here for {days} days, in case you want it back.
		</p>
	</div>
</div>
