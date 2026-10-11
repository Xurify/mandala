<script lang="ts">
	import { tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import type { HelperStore } from '$lib/chart/helper.svelte';
	import { HUES } from '$lib/chart/model';
	import ToolFace from './ToolFace.svelte';
	import Button from './ui/Button.svelte';
	import IconButton from './ui/IconButton.svelte';
	import { cn } from './ui/cn';

	let { helper }: { helper: HelperStore } = $props();

	const picks = $derived(helper.picks?.picks ?? []);
	const scope = $derived(helper.picks?.scope ?? 'today');
	/** Picks that arrived by a swap turn over in place. The first hand is dealt. */
	let swapped = $state<Set<string>>(new Set());

	let list: HTMLOListElement | null = $state(null);

	function swap(key: string, index: number): void {
		const before = new Set(picks.map((pick) => pick.key));
		helper.swap(key);
		const arrived = (helper.picks?.picks ?? []).filter((pick) => !before.has(pick.key)).map((pick) => pick.key);
		swapped = new Set([...swapped, ...arrived]);
		// The card turned over took its button with it. Focus goes to the new card's, in the same place.
		const next = helper.picks?.picks[index];
		if (!next) return;
		void tick().then(() => list?.querySelector<HTMLButtonElement>(`[aria-label="${CSS.escape(`Swap ${next.text}`)}"]`)?.focus({ preventScroll: true }));
	}
</script>

<div class="flex flex-col gap-3 px-4 pt-1 pb-4">
	{#if picks.length === 0}
		<div class="flex flex-col items-start gap-1 rounded-[22px] bg-bg px-4 py-4">
			<p class="m-0 text-[0.98rem] font-[600]">Nothing open to pick</p>
			<p class="m-0 text-[0.86rem] leading-snug text-pretty text-muted">
				Everything is ticked, pinned away, or turned down for today. Add a few actions, or come back tomorrow.
			</p>
		</div>
	{:else}
		<ol bind:this={list} class="m-0 flex list-none flex-col gap-2.5 p-0" aria-live="polite">
			{#each picks as pick, index (index)}
				<li class="grid motion-safe:animate-deal-in" style:animation-delay="{60 + index * 70}ms">
					{#key pick.key}
						<div
							class={cn(
								'flex min-w-0 items-start gap-3 rounded-[20px] bg-bg py-3 ps-4 pe-1.5 shadow-card [grid-area:1/1]',
								swapped.has(pick.key) && 'origin-top motion-safe:animate-flip-in'
							)}
							out:fade={{ duration: 160 }}
						>
							<span class="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
								<span class="flex items-center gap-1.5 text-[0.76rem] leading-none font-[620]">
									<span class="pip size-2 shrink-0 rounded-full" style:--pip-h={HUES[pick.pillarIndex]} aria-hidden="true"></span>
									<span class="pillar-ink truncate" style:--h={HUES[pick.pillarIndex]}>{helper.data.pillars[pick.pillarIndex]?.trim()}</span>
								</span>
								<span class="text-[0.98rem] leading-snug font-[560] text-pretty">{pick.text}</span>
								<span class="text-[0.8rem] leading-snug text-muted">{pick.why}</span>
								{#if pick.tool}
									{@const tool = pick.tool}
									<a
										href={tool.url}
										target="_blank"
										rel="noopener noreferrer"
										class="mt-1 -ms-1 flex min-w-0 items-center rounded-[12px] p-1 text-text no-underline hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
										onclick={() => helper.openTool(pick.pillarIndex, tool.id)}
									>
										<ToolFace {tool} class="min-w-0 flex-1" />
									</a>
								{/if}
							</span>
							<IconButton icon="refresh" label="Swap {pick.text}" class="-my-0.5 text-muted hover:text-text" onclick={() => swap(pick.key, index)} />
						</div>
					{/key}
				</li>
			{/each}
		</ol>
		<!-- Stays in reach while a long week scrolls under it. -->
		<div class="sticky bottom-0 z-[2] -mx-4 -mb-4 flex items-center gap-2 bg-surface px-4 pt-2 pb-4">
			<Button class="flex-1" onclick={() => helper.commit()}>{scope === 'today' ? 'Put these on today' : 'Pin these for the week'}</Button>
			<Button variant="ghost" onclick={() => helper.decline()}>Not now</Button>
		</div>
	{/if}
</div>
