<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { deletedClock, deletedDayLabel, titleOf } from '$lib/chart/library';
	import { listVersions, WHY_LABELS, type Version } from '$lib/chart/versions';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';
	import Eyebrow from './ui/Eyebrow.svelte';

	interface Props {
		open?: boolean;
	}

	let { open = $bindable(false) }: Props = $props();

	let versions = $state<Version[] | null>(null);

	$effect(() => {
		if (!open) {
			versions = null;
			return;
		}
		void listVersions().then((list) => (versions = list));
	});

	const groups = $derived.by(() => {
		const out = new Map<string, Version[]>();
		for (const version of versions ?? []) out.set(version.chartId, [...(out.get(version.chartId) ?? []), version]);
		return [...out.entries()].map(([chartId, list]) => {
			const live = chart.charts.find((summary) => summary.id === chartId);
			return { chartId, title: live?.title ?? titleOf(list[0]!.data), here: Boolean(live), list };
		});
	});

	function restore(version: Version): void {
		chart.restoreVersion(version);
		open = false;
	}
</script>

<Dialog bind:open title="Earlier versions" size="sm">
	{#if versions === null}
		<p class="m-0 text-[0.95rem] text-muted">Looking…</p>
	{:else if versions.length === 0}
		<p class="m-0 text-[0.95rem] leading-[1.5] text-pretty">
			Nothing here yet. When sync changes a chart on this device, the version before it waits here for 30 days.
		</p>
	{:else}
		<p class="m-0 mb-4 text-[0.92rem] leading-[1.5] text-pretty text-muted">
			Kept on this device for 30 days. Going back keeps a copy of the chart as it is now, too.
		</p>
		{#each groups as group (group.chartId)}
			<section class="mb-4 last:mb-0" aria-label={group.title}>
				<Eyebrow class="mb-1.5">{group.title}</Eyebrow>
				<ul class="m-0 flex list-none flex-col gap-1.5 p-0">
					{#each group.list as version (version.id)}
						<li class="flex items-center gap-3 rounded-[18px] bg-sunken py-2 ps-4 pe-2" data-version={version.why}>
							<div class="flex min-w-0 flex-1 flex-col gap-0.5">
								<span class="text-[0.92rem] leading-snug font-[560] text-pretty">{WHY_LABELS[version.why]}</span>
								<span class="line-clamp-2 text-[0.8rem] text-muted tabular-nums">
									{deletedDayLabel(version.at)} at {deletedClock(version.at)} · “{titleOf(version.data)}”
								</span>
							</div>
							<Button variant="soft" size="sm" onclick={() => restore(version)} aria-label="{group.here ? 'Go back to' : 'Bring back'} {group.title}: {WHY_LABELS[version.why]}">
								{group.here ? 'Go back' : 'Bring back'}
							</Button>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	{/if}
</Dialog>
