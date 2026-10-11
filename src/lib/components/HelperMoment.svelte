<script lang="ts">
	import type { HelperMoment } from '$lib/chart/helper.svelte';
	import DaySeal from './DaySeal.svelte';
	import Button from './ui/Button.svelte';

	let { moment, ondone }: { moment: HelperMoment; ondone: () => void } = $props();

	/** A full ring draws faster than a few arcs, so the moment lasts about the same either way. */
	const step = $derived(Math.min(0.16, 0.6 / Math.max(1, moment.pillars.length)));
	/** The words wait for the ring: its arcs draw in pillar order, then the check, then this. */
	const after = $derived(0.35 + moment.pillars.length * step + 0.35);
</script>

<div class="flex flex-col items-center gap-4 px-6 pt-3 pb-5 text-center">
	<DaySeal moved={moment.pillars} play {step} label={moment.title} class="size-[116px]" />
	<div class="flex flex-col gap-1">
		<p class="m-0 text-[1.18rem] leading-tight font-[620] text-balance motion-safe:animate-done-in" style:animation-delay="{after}s">
			{moment.title}
		</p>
		<p class="m-0 max-w-[32ch] text-[0.9rem] leading-snug text-pretty text-muted motion-safe:animate-done-in" style:animation-delay="{after + 0.08}s">
			{moment.detail}
		</p>
	</div>
	<Button class="min-w-[9rem] motion-safe:animate-done-in" style="animation-delay: {after + 0.16}s" onclick={ondone} data-autofocus>Done</Button>
</div>
