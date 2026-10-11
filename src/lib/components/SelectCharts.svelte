<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { deletedClock, deletedDayLabel, formatAgo, TRASH_DAYS, type ChartSummary } from '$lib/chart/library';
	import FillRing from './FillRing.svelte';
	import Icon from './Icon.svelte';
	import PickMark from './PickMark.svelte';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';
	import Eyebrow from './ui/Eyebrow.svelte';
	import { cn } from './ui/cn';
	import { fieldInk } from './ui/styles';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let find = $state('');
	let picked = $state<string[]>([]);
	let anchorId = '';
	let now = $state(Date.now());

	const showFind = $derived(chart.charts.length > 5);
	const rows = $derived.by((): ChartSummary[] => {
		const q = showFind ? find.trim().toLowerCase() : '';
		const sorted = chart.charts.slice().sort((a, b) => b.updatedAt - a.updatedAt);
		return q ? sorted.filter((item) => item.title.toLowerCase().includes(q)) : sorted;
	});
	const groups = $derived.by(() => {
		const list: { label: string; items: ChartSummary[] }[] = [];
		for (const item of rows) {
			const label = deletedDayLabel(item.updatedAt);
			const last = list.at(-1);
			if (last && last.label === label) last.items.push(item);
			else list.push({ label, items: [item] });
		}
		return list;
	});
	const pickedItems = $derived(chart.charts.filter((item) => picked.includes(item.id)));
	const allShown = $derived(rows.length > 0 && rows.every((item) => picked.includes(item.id)));
	const everything = $derived(pickedItems.length === chart.charts.length);

	$effect(() => {
		if (!open) return;
		picked = [];
		anchorId = '';
		find = '';
		now = Date.now();
	});

	$effect(() => {
		const live = new Set(chart.charts.map((item) => item.id));
		const next = picked.filter((id) => live.has(id));
		if (next.length !== picked.length) picked = next;
	});

	function toggle(id: string, shift: boolean): void {
		const ids = rows.map((item) => item.id);
		if (shift && anchorId && ids.includes(anchorId)) {
			const from = Math.min(ids.indexOf(anchorId), ids.indexOf(id));
			const to = Math.max(ids.indexOf(anchorId), ids.indexOf(id));
			picked = [...new Set([...picked, ...ids.slice(from, to + 1)])];
			return;
		}
		anchorId = id;
		picked = picked.includes(id) ? picked.filter((item) => item !== id) : [...picked, id];
	}

	function toggleAll(): void {
		const shown = new Set(rows.map((item) => item.id));
		picked = allShown ? picked.filter((id) => !shown.has(id)) : [...new Set([...picked, ...shown])];
		anchorId = '';
	}

	function remove(): void {
		const ids = pickedItems.map((item) => item.id);
		if (ids.length === 0) return;
		open = false;
		chart.deleteCharts(ids);
	}
</script>

{#snippet footer()}
	{@const count = pickedItems.length}
	<div class="flex w-full flex-wrap items-center justify-end gap-x-2 gap-y-3">
		<div class="me-auto flex items-center gap-1">
			{#if rows.length > 1}
				<Button variant="ghost" size="sm" class="-ms-3.5 coarse:min-h-11" onclick={toggleAll}>
					{allShown ? 'Clear' : find.trim() ? 'Select these' : 'Select all'}
				</Button>
			{/if}
			<p class="m-0 text-[0.84rem] text-muted tabular-nums" aria-live="polite">
				{count === 0 ? 'None selected' : everything && count > 1 ? `All ${count} selected` : `${count} selected`}
			</p>
		</div>
		<Button
			variant="danger"
			size="sm"
			icon="trash"
			class="coarse:min-h-11"
			disabled={count === 0}
			aria-label={count === 1 ? `Delete ${pickedItems[0]?.title}` : `Delete ${count} charts`}
			onclick={remove}
		>
			{count > 1 ? `Delete ${count}` : 'Delete'}
		</Button>
	</div>
{/snippet}

<Dialog
	bind:open
	title="Select charts"
	description={everything && pickedItems.length > 0
		? `A blank chart stays open. Deleted charts wait in recently deleted for ${TRASH_DAYS} days.`
		: `Deleted charts wait in recently deleted for ${TRASH_DAYS} days.`}
	{footer}
>
	{#if showFind}
		<div class="relative mb-3">
			<span class="pointer-events-none absolute start-3.5 top-1/2 flex -translate-y-1/2 text-muted" aria-hidden="true">
				<Icon name="search" size={16} />
			</span>
			<input
				class={cn(fieldInk, 'ps-10', find ? 'pe-10' : 'pe-4')}
				type="text"
				placeholder="Find a chart"
				aria-label="Find a chart"
				aria-controls="select-chart-list"
				autocomplete="off"
				spellcheck="false"
				bind:value={find}
			/>
			{#if find}
				<button
					type="button"
					class="absolute end-[9px] top-1/2 flex size-[26px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 p-0 text-text bg-sunken-hover after:absolute after:-inset-2 after:content-[''] focus-visible:bg-ink focus-visible:text-on-ink focus-visible:outline-none"
					aria-label="Clear search"
					onclick={() => (find = '')}
				>
					<Icon name="close" size={12} strokeWidth={2.2} />
				</button>
			{/if}
		</div>
	{/if}
	<div id="select-chart-list" class="-mx-2.5">
		{#if rows.length === 0}
			<p class="m-0 px-3 py-2.5 text-[0.9rem] text-pretty text-muted">No matching chart.</p>
		{/if}
		{#each groups as group, groupIndex (group.label + groupIndex)}
			<section class={groupIndex === 0 ? '' : 'mt-3'} aria-label={group.label}>
				<Eyebrow class="px-3 pb-1">{group.label}</Eyebrow>
				<ul class="m-0 flex list-none flex-col gap-px p-0">
					{#each group.items as item (item.id)}
						{@const on = picked.includes(item.id)}
						<li>
							<button
								type="button"
								class="group flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-[14px] border-0 bg-transparent px-3 py-1.5 text-start select-none hover:bg-sunken focus-visible:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-checked:bg-sunken coarse:min-h-12"
								role="checkbox"
								aria-checked={on}
								aria-label="{item.title}{item.active ? ', open now' : ''}. {item.filled} of 73. Updated {deletedDayLabel(item.updatedAt)} at {deletedClock(item.updatedAt)}"
								onclick={(event) => toggle(item.id, event.shiftKey)}
							>
								<PickMark {on} />
								<FillRing filled={item.filled} />
								<span class="min-w-0 flex-1 truncate text-[0.92rem] font-medium text-text">{item.title}</span>
								{#if item.active}
									<span class="shrink-0 text-[0.8rem] font-[560] text-text">Open</span>
								{/if}
								<span class="shrink-0 text-[0.8rem] tabular-nums text-muted">{formatAgo(item.updatedAt, now)}</span>
							</button>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>
</Dialog>
