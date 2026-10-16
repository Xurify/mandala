<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { HUES } from '$lib/chart/model';
	import { shelfOf, toolDetail, upNext } from '$lib/chart/tools';
	import PickAll from './PickAll.svelte';
	import PickMark from './PickMark.svelte';
	import ToolFace from './ToolFace.svelte';
	import ToolRow from './ToolRow.svelte';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';
	import Eyebrow from './ui/Eyebrow.svelte';
	import Menu from './ui/Menu.svelte';
	import MenuItem from './ui/MenuItem.svelte';
	import { foldOut } from './ui/motion';

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

	let selecting = $state(false);
	let picked = $state<string[]>([]);
	let anchorId = '';
	let body = $state<HTMLElement | null>(null);

	const order = $derived(stocked.flatMap((plank) => plank.tools.map((tool) => ({ pillarIndex: plank.pillarIndex, id: tool.id }))));
	const picks = $derived(order.filter((entry) => picked.includes(entry.id)));

	$effect(() => {
		if (chart.browsingShelves) return;
		selecting = false;
		picked = [];
	});

	$effect(() => {
		const live = new Set(order.map((entry) => entry.id));
		const kept = picked.filter((id) => live.has(id));
		if (kept.length !== picked.length) picked = kept;
		if (selecting && live.size === 0) selecting = false;
	});

	function toggle(id: string, shift: boolean): void {
		const ids = order.map((entry) => entry.id);
		if (shift && anchorId && ids.includes(anchorId)) {
			const from = Math.min(ids.indexOf(anchorId), ids.indexOf(id));
			const to = Math.max(ids.indexOf(anchorId), ids.indexOf(id));
			picked = [...new Set([...picked, ...ids.slice(from, to + 1)])];
			return;
		}
		anchorId = id;
		picked = picked.includes(id) ? picked.filter((each) => each !== id) : [...picked, id];
	}

	function toggleAll(): void {
		picked = picked.length === order.length ? [] : order.map((entry) => entry.id);
		anchorId = '';
	}

	function stopSelecting(): void {
		selecting = false;
		picked = [];
		anchorId = '';
	}

	function removePicked(): void {
		chart.removeTools(picks);
		stopSelecting();
	}

	function movePicked(to: number): void {
		chart.moveTools(picks, to);
		stopSelecting();
	}

	function openShelf(pillarIndex: number, toolId: string | null = null): void {
		chart.browsingShelves = false;
		chart.openShelf(pillarIndex, toolId);
	}
</script>

{#snippet footer()}
	{@const count = picks.length}
	{#if selecting}
		<div class="flex w-full flex-wrap items-center justify-end gap-2">
			<Button variant="ghost" size="sm" class="me-auto coarse:min-h-11" onclick={stopSelecting}>Cancel</Button>
			<Menu label="Move to a shelf" float>
				{#snippet trigger({ expanded, toggle })}
					<Button variant="soft" size="sm" icon="arrow-right" class="coarse:min-h-11" disabled={count === 0} aria-haspopup="menu" aria-expanded={expanded} onclick={toggle}>
						{count > 1 ? `Move ${count}` : 'Move'}
					</Button>
				{/snippet}
				<Eyebrow class="px-3 pt-1.5 pb-1">Move to</Eyebrow>
				{#each planks as plank (plank.pillarIndex)}
					<MenuItem count={plank.tools.length} onclick={() => movePicked(plank.pillarIndex)}>
						<span class="pip size-2.5 shrink-0 rounded-full" style:--pip-h={HUES[plank.pillarIndex]} aria-hidden="true"></span>
						<span class="truncate">{plank.name}</span>
					</MenuItem>
				{/each}
			</Menu>
			<Button
				variant="danger"
				size="sm"
				icon="trash"
				class="coarse:min-h-11"
				disabled={count === 0}
				aria-label={count === 1 ? 'Remove 1 link' : `Remove ${count} links`}
				onclick={removePicked}
			>
				{count > 1 ? `Remove ${count}` : 'Remove'}
			</Button>
		</div>
	{:else}
		<Button variant="ghost" size="sm" icon="check" class="coarse:min-h-11" onclick={() => (selecting = true)}>Select links</Button>
	{/if}
{/snippet}

<Dialog bind:open={chart.browsingShelves} title="Your shelves" {description} footer={total > 0 ? footer : undefined}>
	{#if stocked.length === 0}
		<p class="m-0 max-w-[48ch] leading-snug text-muted">
			A shelf holds what a pillar's actions use: videos, texts, sites. Paste a link anywhere on the chart, outside a field, to put it on one.
		</p>
	{:else}
		<div bind:this={body} class="flex flex-col gap-5">
			{#if selecting}
				<div class="-mx-1.5 -mb-3">
					<PickAll total={order.length} picked={picks.length} onclick={toggleAll} />
				</div>
			{/if}
			{#each stocked as plank, index (plank.pillarIndex)}
				<section class="relative flex flex-col gap-1.5 has-[[role=menu]]:z-10 motion-safe:animate-pop-in" style:animation-delay="{index * 45}ms" aria-labelledby="shelves-{plank.pillarIndex}" out:foldOut>
					<div class="flex min-h-9 items-center gap-2.5 ps-2">
						<span class="pip size-2.5 shrink-0 rounded-full" style:--pip-h={HUES[plank.pillarIndex]} aria-hidden="true"></span>
						<h3 id="shelves-{plank.pillarIndex}" class="m-0 flex min-w-0 flex-1 items-baseline gap-1.5 text-[0.92rem] leading-snug font-[620]">
							<span class="truncate">{plank.name}</span>
							<span class="shrink-0 text-[0.8rem] font-[560] text-muted tabular-nums">{plank.tools.length}</span>
						</h3>
						{#if !selecting}
							<Button size="sm" variant="ghost" icon="shelf" class="shrink-0" aria-label="Open the {plank.name} shelf" onclick={() => openShelf(plank.pillarIndex)}>Open</Button>
						{/if}
					</div>
					<ul class="m-0 flex list-none flex-col gap-0.5 rounded-[22px] bg-bg p-1.5">
						{#each plank.tools as tool (tool.id)}
							{@const on = picked.includes(tool.id)}
							<li class="relative has-[[role=menu]]:z-10" out:foldOut>
								{#if selecting}
									<button
										type="button"
										class="group flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-[14px] border-0 bg-transparent px-2.5 py-1.5 text-start text-text select-none hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink aria-checked:bg-sunken"
										role="checkbox"
										aria-checked={on}
										onclick={(event) => toggle(tool.id, event.shiftKey)}
									>
										<PickMark {on} />
										<ToolFace {tool} detail={toolDetail(chart.data, plank.pillarIndex, tool)} class="min-w-0 flex-1" />
									</button>
								{:else}
									<ToolRow
										pillarIndex={plank.pillarIndex}
										{tool}
										nextFor={next[index]?.get(tool.id)}
										onsettings={() => openShelf(plank.pillarIndex, tool.id)}
										onempty={() => body?.querySelector<HTMLElement>('[data-tool-face]')?.focus()}
									/>
								{/if}
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
