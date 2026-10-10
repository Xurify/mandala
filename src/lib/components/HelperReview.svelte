<script lang="ts">
	import { onMount } from 'svelte';
	import type { HelperStore } from '$lib/chart/helper.svelte';
	import { describeKey, reviewChart } from '$lib/chart/helper';
	import { HUES } from '$lib/chart/model';
	import MiniChart from './MiniChart.svelte';
	import Icon from './Icon.svelte';
	import { foldOut } from './ui/motion';

	let { helper, reveal }: { helper: HelperStore; reveal: (key: string) => void } = $props();

	// Live: a line fixed in the chart leaves this list while the page is open.
	const findings = $derived(reviewChart(helper.data));
	const lines = $derived(helper.data.pillars.filter((pillar) => pillar.trim()).length + helper.data.actions.flat().filter((action) => action.trim()).length);
	/** The sweep plays when the page opens. Later changes just show. */
	let reading = $state(true);
	onMount(() => {
		const timer = setTimeout(() => (reading = false), 1100);
		return () => clearTimeout(timer);
	});

	function pillarOf(key: string): number {
		return key.startsWith('p') ? Number(key.slice(1)) : Number(key.slice(1).split('_')[0]);
	}
</script>

<div class="flex flex-col gap-4 px-4 pt-1 pb-4">
	<div class="flex items-center gap-4 rounded-[22px] bg-bg p-3.5">
		<MiniChart
			data={helper.data}
			flagged={findings.map((finding) => finding.key)}
			play={reading ? 'read' : null}
			cell={8}
			label={findings.length ? `${findings.length} marked on the chart` : 'Every line passes'}
		/>
		<div class="flex min-w-0 flex-col gap-1">
			{#if lines === 0}
				<p class="m-0 text-[0.98rem] leading-snug font-[620]">Nothing to read yet</p>
				<p class="m-0 text-[0.84rem] leading-snug text-pretty text-muted">Write a few lines, then I can check them.</p>
			{:else if findings.length === 0}
				<p class="m-0 text-[0.98rem] leading-snug font-[620] motion-safe:animate-pop-in [animation-delay:520ms]">Every line passes</p>
				<p class="m-0 text-[0.84rem] leading-snug text-pretty text-muted motion-safe:animate-pop-in [animation-delay:600ms]">
					Each one can be marked done, and each one is yours to do.
				</p>
			{:else}
				<p class="m-0 text-[1.6rem] leading-none font-[620] tabular-nums motion-safe:animate-pop-in [animation-delay:520ms]">{findings.length}</p>
				<p class="m-0 text-[0.84rem] leading-snug text-pretty text-muted motion-safe:animate-pop-in [animation-delay:600ms]">
					{findings.length === 1 ? 'line could be clearer.' : 'lines could be clearer.'} Open one and make it something you can tick.
				</p>
			{/if}
		</div>
	</div>

	{#if findings.length}
		<ul class="-mx-1.5 m-0 flex list-none flex-col p-0" aria-live="polite">
			{#each findings as finding, index (finding.key)}
				{@const pillar = pillarOf(finding.key)}
				<li class="motion-safe:animate-pop-in" style:animation-delay="{reading ? 640 + index * 50 : 0}ms" out:foldOut>
					<button
						type="button"
						class="group/finding flex w-full cursor-pointer items-start gap-3 rounded-[18px] border-0 bg-transparent px-2.5 py-2.5 text-start font-sans text-text hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink active:scale-[0.985] motion-safe:transition-[scale] motion-safe:duration-150 motion-safe:ease-ui"
						onclick={() => reveal(finding.key)}
					>
						<span class="pip mt-[0.42em] size-2 shrink-0 rounded-full" style:--pip-h={HUES[pillar]} aria-hidden="true"></span>
						<span class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span class="text-[0.74rem] leading-tight font-[620] text-muted">{describeKey(helper.data, finding.key)}</span>
							<span class="text-[0.94rem] leading-snug text-pretty">{finding.text}</span>
							<span class="text-[0.8rem] leading-snug text-pretty text-muted">{finding.reason}</span>
						</span>
						<Icon
							name="arrow-right"
							size={16}
							class="mt-1 shrink-0 text-muted motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-ui can-hover:group-hover/finding:translate-x-0.5"
						/>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
