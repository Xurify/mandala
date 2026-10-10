<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { HUES } from '$lib/chart/model';
	import { fetchTitle, hostOf, shelfOf } from '$lib/chart/tools';
	import ToolFace from './ToolFace.svelte';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';

	let open = $state(false);
	let title = $state<string | null>(null);

	// A link arriving by share or paste opens the sheet; closing it lets the link go.
	$effect(() => {
		const url = chart.pendingLink;
		open = url !== null;
		title = null;
		if (!url) return;
		let current = true;
		void fetchTitle(url).then((found) => {
			if (current && chart.pendingLink === url) title = found;
		});
		return () => {
			current = false;
		};
	});
	$effect(() => {
		if (!open) chart.pendingLink = null;
	});

	const preview = $derived(chart.pendingLink ? { url: chart.pendingLink, title: title ?? hostOf(chart.pendingLink), kind: 'repeat' as const } : null);

	function put(pillarIndex: number): void {
		const url = chart.pendingLink;
		if (!url) return;
		const tool = chart.addTool(pillarIndex, url, title ?? '');
		if (!title) void fetchTitle(url).then((found) => found && chart.updateTool(pillarIndex, tool.id, { title: found }));
		chart.say(`Added to ${chart.data.pillars[pillarIndex]?.trim() || `Pillar ${pillarIndex + 1}`}.`);
		chart.pendingLink = null;
	}
</script>

<Dialog bind:open title="Add to a shelf" description="Which pillar is this for?" size="sm">
	{#if preview}
		<div class="mb-4 rounded-[18px] bg-bg px-3 py-2.5">
			<ToolFace tool={preview} size="md" />
		</div>
		<ul class="m-0 grid list-none grid-cols-2 gap-1.5 p-0 max-[420px]:grid-cols-1">
			{#each chart.data.pillars as pillar, pillarIndex (pillarIndex)}
				{@const count = shelfOf(chart.data, pillarIndex).length}
				<li>
					<button
						type="button"
						class="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-[14px] border-0 bg-transparent px-3 text-start font-sans text-[0.92rem] text-text hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink"
						onclick={() => put(pillarIndex)}
					>
						<span class="pip size-2.5 shrink-0 rounded-full" style:--pip-h={HUES[pillarIndex]} aria-hidden="true"></span>
						<span class="min-w-0 flex-1 truncate font-[560]">{pillar.trim() || `Pillar ${pillarIndex + 1}`}</span>
						{#if count}
							<span class="shrink-0 text-[0.78rem] text-muted tabular-nums">{count}</span>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (open = false)}>Not now</Button>
	{/snippet}
</Dialog>
