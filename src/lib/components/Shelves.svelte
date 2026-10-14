<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { HUES } from '$lib/chart/model';
	import { shelfOf, toolDetail, upNext } from '$lib/chart/tools';
	import ToolFace from './ToolFace.svelte';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';

	const planks = $derived(
		chart.data.pillars.map((pillar, pillarIndex) => {
			const tools = shelfOf(chart.data, pillarIndex);
			const known = tools.filter((tool) => tool.known);
			return {
				pillarIndex,
				name: pillar.trim() || `Pillar ${pillarIndex + 1}`,
				named: pillar.trim() !== '',
				tools: [...tools.filter((tool) => !tool.known), ...known],
				known: known.length
			};
		})
	);
	const stocked = $derived(planks.filter((plank) => plank.tools.length > 0));
	const bare = $derived(planks.filter((plank) => plank.named && plank.tools.length === 0).map((plank) => plank.name));
	const total = $derived(stocked.reduce((sum, plank) => sum + plank.tools.length, 0));
	const known = $derived(stocked.reduce((sum, plank) => sum + plank.known, 0));
	const next = $derived(chart.browsingShelves ? stocked.map((plank) => upNext(chart.data, plank.pillarIndex)) : []);

	const description = $derived(
		total === 0
			? 'Nothing on a shelf yet.'
			: `${total} ${total === 1 ? 'link' : 'links'} on ${stocked.length} ${stocked.length === 1 ? 'shelf' : 'shelves'}${known ? `, ${known} known by now` : ''}.`
	);

	function openShelf(pillarIndex: number): void {
		chart.browsingShelves = false;
		chart.openShelf(pillarIndex);
	}
</script>

<Dialog bind:open={chart.browsingShelves} title="Your shelves" {description}>
	{#if stocked.length === 0}
		<p class="m-0 max-w-[48ch] leading-snug text-muted">
			A shelf holds what a pillar's actions use: videos, texts, sites. Paste a link anywhere on the chart, outside a field, to put it on one.
		</p>
	{:else}
		<div class="flex flex-col gap-5">
			{#each stocked as plank, index (plank.pillarIndex)}
				<section class="flex flex-col gap-1.5 motion-safe:animate-pop-in" style:animation-delay="{index * 45}ms" aria-labelledby="shelves-{plank.pillarIndex}">
					<div class="flex items-center gap-2.5 ps-2">
						<span class="pip size-2.5 shrink-0 rounded-full" style:--pip-h={HUES[plank.pillarIndex]} aria-hidden="true"></span>
						<h3 id="shelves-{plank.pillarIndex}" class="m-0 flex min-w-0 flex-1 items-baseline gap-1.5 text-[0.92rem] leading-snug font-[620]">
							<span class="truncate">{plank.name}</span>
							<span class="shrink-0 text-[0.8rem] font-[560] text-muted tabular-nums">{plank.tools.length}</span>
						</h3>
						<Button size="sm" variant="ghost" icon="shelf" class="shrink-0" aria-label="Open the {plank.name} shelf" onclick={() => openShelf(plank.pillarIndex)}>Open</Button>
					</div>
					<ul class="m-0 flex list-none flex-col gap-0.5 rounded-[22px] bg-bg p-1.5">
						{#each plank.tools as tool (tool.id)}
							{@const nextFor = next[index]?.get(tool.id)}
							<li>
								<a
									href={tool.url}
									target="_blank"
									rel="noopener noreferrer"
									class="flex min-w-0 items-center rounded-[14px] px-2 py-1.5 text-text no-underline hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink"
									title={nextFor === undefined ? undefined : `Today hands this out for action ${nextFor + 1}`}
									onclick={() => chart.openTool(plank.pillarIndex, tool.id)}
								>
									<ToolFace {tool} detail={toolDetail(chart.data, plank.pillarIndex, tool)} tag={nextFor === undefined ? undefined : 'Up next'} class="min-w-0 flex-1" />
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		</div>
	{/if}
	{#if bare.length > 0 && stocked.length > 0}
		<p class="m-0 mt-5 ps-2 text-[0.84rem] leading-snug text-pretty text-muted">
			Nothing yet on {new Intl.ListFormat('en', { type: 'disjunction' }).format(bare)}.
		</p>
	{/if}
</Dialog>
