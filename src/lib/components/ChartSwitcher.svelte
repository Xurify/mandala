<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { example } from '$lib/chart/example';
	import { formatDeleted, formatDeletesIn, formatUpdated, titleOf, UNTITLED } from '$lib/chart/library';
	import { TEXT_MAX } from '$lib/chart/model';
	import Icon from './Icon.svelte';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';
	import Menu from './ui/Menu.svelte';
	import MenuDivider from './ui/MenuDivider.svelte';
	import MenuItem from './ui/MenuItem.svelte';

	const activeTitle = $derived(titleOf(chart.data));
	const activeUpdated = $derived(chart.charts.find((item) => item.active)?.updatedAt);
	const updatedLabel = $derived(activeUpdated === undefined ? '' : formatUpdated(activeUpdated));

	let renameOpen = $state(false);
	let name = $state('');
	let nameField = $state<HTMLInputElement | null>(null);

	function handleSelect(id: string): void {
		chart.switchChart(id);
	}

	function openRename(): void {
		name = chart.data.goal;
		renameOpen = true;
	}

	function saveRename(): void {
		const next = name.trim().slice(0, TEXT_MAX);
		if (next !== chart.data.goal.trim()) {
			chart.setText('g', next);
			chart.note('Renamed', next);
		}
		renameOpen = false;
	}

	function handleDuplicate(): void {
		chart.duplicateChart();
	}

	function handleNew(): void {
		chart.newChart();
	}

	let exampleOpen = $state(false);
	let exampleAlreadyOpen = $state(false);
	let exampleId = $state('');

	function handleExample(): void {
		const match = chart.checkForMatchingExample();
		if (!match) {
			chart.loadExample();
			return;
		}
		exampleAlreadyOpen = match.active;
		exampleId = match.id;
		exampleOpen = true;
	}

	function openExistingExample(): void {
		exampleOpen = false;
		if (exampleAlreadyOpen) return;
		chart.switchChart(exampleId);
		chart.note('Opened', chart.data.goal);
	}

	function addExampleCopy(): void {
		exampleOpen = false;
		chart.loadExample();
	}

	let deleteOpen = $state(false);
	let deletedOpen = $state(false);
	let picked = $state<string[]>([]);
	let anchorId = $state('');
	let confirming = $state(false);

	const pickedItems = $derived(chart.deletedCharts.filter((item) => picked.includes(item.id)));
	const allPicked = $derived(
		chart.deletedCharts.length > 0 && pickedItems.length === chart.deletedCharts.length
	);
	const deletedDescription = $derived(
		!confirming
			? 'Deleted charts stay here for 30 days.'
			: pickedItems.length === 1
				? `Remove “${pickedItems[0]?.title}” from this device?`
				: `Remove ${pickedItems.length} charts from this device?`
	);

	const activeChart = $derived(chart.charts.find((item) => item.active));

	function handleDelete(): void {
		if (!activeChart) return;
		deleteOpen = true;
	}

	function confirmDelete(): void {
		const active = activeChart;
		if (!active) return;
		deleteOpen = false;
		chart.deleteChart(active.id);
	}

	function openDeleted(): void {
		chart.purgeExpired();
		const first = chart.deletedCharts[0];
		picked = first ? [first.id] : [];
		anchorId = first?.id ?? '';
		confirming = false;
		deletedOpen = true;
	}

	function toggleDeleted(id: string, shift: boolean): void {
		confirming = false;
		const ids = chart.deletedCharts.map((item) => item.id);
		if (shift && anchorId && ids.includes(anchorId)) {
			const from = Math.min(ids.indexOf(anchorId), ids.indexOf(id));
			const to = Math.max(ids.indexOf(anchorId), ids.indexOf(id));
			picked = ids.slice(from, to + 1);
			return;
		}
		anchorId = id;
		picked = picked.includes(id) ? picked.filter((item) => item !== id) : [...picked, id];
	}

	function toggleAllDeleted(): void {
		confirming = false;
		picked = allPicked ? [] : chart.deletedCharts.map((item) => item.id);
		anchorId = chart.deletedCharts[0]?.id ?? '';
	}

	function askForget(): void {
		if (pickedItems.length === 0) return;
		confirming = true;
	}

	function cancelForget(): void {
		confirming = false;
		setTimeout(() => document.getElementById('deleted-remove')?.focus(), 0);
	}

	function holdForget(event: Event): void {
		if (!confirming) return;
		event.preventDefault();
		cancelForget();
	}

	function restoreDeleted(): void {
		const ids = pickedItems.map((item) => item.id);
		if (ids.length === 0) return;
		chart.restoreCharts(ids);
		picked = [];
		confirming = false;
	}

	function forgetDeleted(): void {
		const ids = pickedItems.map((item) => item.id);
		if (ids.length === 0) return;
		chart.forgetCharts(ids);
		picked = [];
		confirming = false;
	}

	$effect(() => {
		if (deletedOpen) return;
		picked = [];
		anchorId = '';
		confirming = false;
	});

	$effect(() => {
		const live = new Set(chart.deletedCharts.map((item) => item.id));
		const next = picked.filter((id) => live.has(id));
		if (next.length === picked.length) return;
		picked = next;
		if (next.length === 0) confirming = false;
	});

	$effect(() => {
		if (!confirming) return;
		const timer = setTimeout(() => {
			if (!confirming) return;
			document.getElementById('forget-cancel')?.focus();
		}, 0);
		return () => clearTimeout(timer);
	});

	function isTypingTarget(target: EventTarget | null): boolean {
		if (!(target instanceof HTMLElement)) return false;
		if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true;
		return target.isContentEditable;
	}

	function handleWindowKeydown(event: KeyboardEvent): void {
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		if (isTypingTarget(event.target)) return;
		if (document.querySelector('dialog[open]')) return;

		const key = event.key.toLowerCase();
		if (key === 'r') {
			event.preventDefault();
			openRename();
			return;
		}
		if (key === 'd') {
			event.preventDefault();
			handleDuplicate();
			return;
		}
		if (key === 'n') {
			event.preventDefault();
			handleNew();
			return;
		}
		if (key === 'delete') {
			event.preventDefault();
			handleDelete();
		}
	}

	$effect(() => {
		if (!renameOpen || !nameField) return;
		const field = nameField;
		const timer = setTimeout(() => {
			field.focus();
			field.select();
		}, 0);
		return () => clearTimeout(timer);
	});
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<Menu class="max-w-full" align="start" label="Switch chart">
	{#snippet trigger({ expanded, toggle })}
		<button
			class="group inline-block max-w-full min-w-0 cursor-pointer rounded-[14px] border-0 bg-transparent py-0.5 ps-0 pe-1 -ms-1 text-start font-serif text-[clamp(1.85rem,3.4vw,2.55rem)] leading-[1.12] font-[460] tracking-[-0.028em] text-text focus-visible:outline-none max-[900px]:text-[clamp(1.7rem,7.2vw,2.15rem)]"
			type="button"
			aria-haspopup="menu"
			aria-expanded={expanded}
			aria-label="Switch chart: {activeTitle}"
			title={activeTitle}
			onclick={toggle}
		>
			<span class="line-clamp-2">
				{activeTitle}<span
					class="ms-[0.35em] inline-flex size-[34px] translate-y-[-0.06em] items-center justify-center rounded-full bg-sunken align-middle text-text motion-safe:transition-colors motion-safe:duration-150 group-hover:bg-sunken-hover group-focus-visible:bg-ink group-focus-visible:text-on-ink group-aria-expanded:bg-sunken-hover max-[900px]:size-[30px]"
				>
				<Icon
					name="chevron-down"
					size={16}
					strokeWidth={2}
					class="motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] group-aria-expanded:rotate-180"
				/>
				</span>
			</span>
		</button>
	{/snippet}
	{#each chart.charts as item (item.id)}
		<MenuItem
			icon={item.active ? 'check' : undefined}
			active={item.active}
			badge="{item.filled}/73"
			onclick={() => handleSelect(item.id)}
		>
			{#if !item.active}
				<span class="inline-block size-4 shrink-0" aria-hidden="true"></span>
			{/if}
			<span class="flex min-w-0 flex-col gap-px">
				<span class="max-w-[28ch] truncate">{item.title}</span>
				<span class="text-[0.72rem] leading-tight font-normal text-muted">{formatUpdated(item.updatedAt)}</span>
			</span>
		</MenuItem>
	{/each}
	<MenuDivider />
	<MenuItem
		icon="clock"
		badge={chart.deletedCharts.length > 0 ? String(chart.deletedCharts.length) : undefined}
		onclick={openDeleted}
	>
		Recently deleted
	</MenuItem>
	<MenuItem icon="edit" badge="R" onclick={openRename}>Rename chart</MenuItem>
	<MenuItem icon="copy" badge="D" onclick={handleDuplicate}>Duplicate chart</MenuItem>
	<MenuItem icon="grid" badge="N" onclick={handleNew}>New blank chart</MenuItem>
	<MenuItem icon="target" onclick={handleExample}>Example chart</MenuItem>
	<MenuDivider />
	<MenuItem icon="trash" tone="danger" badge="Del" onclick={handleDelete}>Delete chart</MenuItem>
</Menu>
{#if updatedLabel}
	<p class="m-0 mt-1 text-[0.86rem] text-muted">{updatedLabel}</p>
{/if}

<Dialog
	bind:open={deleteOpen}
	title="Delete this chart?"
	description={activeChart
		? `“${activeChart.title}” moves to recently deleted for 30 days.`
		: 'This chart moves to recently deleted for 30 days.'}
	size="sm"
>
	<p class="m-0 text-[0.9rem] leading-[1.45] text-pretty text-muted">
		{#if chart.chartCount === 1}
			A blank chart stays open.
		{:else}
			Restore it anytime in those 30 days.
		{/if}
	</p>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (deleteOpen = false)}>Cancel</Button>
		<Button onclick={confirmDelete}>Delete</Button>
	{/snippet}
</Dialog>

{#snippet pickMark(state: 'on' | 'off' | 'mixed')}
	<span
		class="grid size-[22px] shrink-0 place-items-center rounded-full {state === 'off'
			? 'bg-sunken group-hover:bg-surface group-focus-visible:bg-surface'
			: 'bg-ink text-on-ink'}"
		aria-hidden="true"
	>
		{#if state === 'on'}
			<Icon name="check" size={13} strokeWidth={2.6} />
		{:else if state === 'mixed'}
			<span class="block h-0.5 w-2.5 rounded-full bg-on-ink"></span>
		{/if}
	</span>
{/snippet}

{#snippet deletedFooter()}
	{#if confirming}
		<Button id="forget-cancel" variant="ghost" class="coarse:min-h-11" onclick={cancelForget}>
			Cancel
		</Button>
		<Button variant="danger" class="coarse:min-h-11" onclick={forgetDeleted}>Delete</Button>
	{:else}
		<Button
			id="deleted-remove"
			variant="danger"
			class="coarse:min-h-11"
			disabled={pickedItems.length === 0}
			aria-label={pickedItems.length === 1
				? `Remove ${pickedItems[0]?.title} from this device`
				: `Remove ${pickedItems.length} charts from this device`}
			onclick={askForget}
		>
			{pickedItems.length > 1 ? `Delete ${pickedItems.length}` : 'Delete now'}
		</Button>
		<Button
			id="deleted-restore"
			class="coarse:min-h-11"
			disabled={pickedItems.length === 0}
			aria-label={pickedItems.length === 1
				? `Restore ${pickedItems[0]?.title}`
				: `Restore ${pickedItems.length} charts`}
			onclick={restoreDeleted}
		>
			{pickedItems.length > 1 ? `Restore ${pickedItems.length}` : 'Restore'}
		</Button>
	{/if}
{/snippet}

<Dialog
	bind:open={deletedOpen}
	title="Recently deleted"
	description={deletedDescription}
	footer={chart.deletedCharts.length > 0 ? deletedFooter : undefined}
	oncancel={holdForget}
>
	{#if chart.deletedCharts.length === 0}
		<p class="m-0 max-w-[36ch] text-[0.9rem] leading-[1.45] text-pretty text-muted">
			Nothing here yet. Delete a chart from the menu, and you can restore it from this list.
		</p>
	{:else}
		<ul class="-mx-1.5 m-0 flex list-none flex-col gap-px p-0">
			{#if chart.deletedCharts.length > 1}
				<li>
					<button
						type="button"
						class="group flex w-full min-h-[42px] cursor-pointer items-center gap-3 rounded-[14px] border-0 bg-transparent px-3 py-2 text-start text-[0.9rem] font-medium text-text select-none hover:bg-sunken focus-visible:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-checked:bg-sunken coarse:min-h-[46px]"
						role="checkbox"
						aria-checked={allPicked ? 'true' : pickedItems.length > 0 ? 'mixed' : 'false'}
						onclick={toggleAllDeleted}
					>
						{@render pickMark(allPicked ? 'on' : pickedItems.length > 0 ? 'mixed' : 'off')}
						{allPicked ? 'Clear selection' : 'Select all'}
					</button>
				</li>
			{/if}
			{#each chart.deletedCharts as item (item.id)}
				<li>
					<button
						type="button"
						class="group flex w-full min-h-[42px] cursor-pointer items-center gap-3 rounded-[14px] border-0 bg-transparent px-3 py-2 text-start select-none hover:bg-sunken focus-visible:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-checked:bg-sunken coarse:min-h-[46px]"
						role="checkbox"
						aria-checked={picked.includes(item.id)}
						onclick={(event) => toggleDeleted(item.id, event.shiftKey)}
					>
						{@render pickMark(picked.includes(item.id) ? 'on' : 'off')}
						<span class="flex min-w-0 flex-1 flex-col gap-px">
							<span class="text-[0.9rem] font-medium text-pretty text-text">{item.title}</span>
							<span class="text-[0.72rem] leading-tight font-normal text-muted">
								{item.filled} of 73 · {formatDeleted(item.deletedAt)}
							</span>
						</span>
						<span
							class="shrink-0 rounded-[7px] px-[7px] py-px text-[0.72rem] font-[560] whitespace-nowrap text-muted tabular-nums {picked.includes(item.id)
								? 'bg-surface'
								: 'bg-sunken group-hover:bg-surface group-focus-visible:bg-surface'}"
						>
							{formatDeletesIn(item.daysLeft)}
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</Dialog>

<Dialog
	bind:open={exampleOpen}
	title="You already have this example"
	description={exampleAlreadyOpen
		? 'This chart is already the example.'
		: `“${example.goal}” is already saved on this device.`}
	size="sm"
>
	<p class="m-0 text-[0.9rem] leading-[1.45] text-pretty text-muted">
		{#if exampleAlreadyOpen}
			Add another copy of “{example.goal}”?
		{:else}
			Open that chart, or add another copy.
		{/if}
	</p>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (exampleOpen = false)}>Cancel</Button>
		<Button variant={exampleAlreadyOpen ? 'primary' : 'soft'} onclick={addExampleCopy}>
			Add another copy
		</Button>
		{#if !exampleAlreadyOpen}
			<Button onclick={openExistingExample}>Open chart</Button>
		{/if}
	{/snippet}
</Dialog>

<Dialog
	bind:open={renameOpen}
	title="Rename chart"
	description="The name is the goal in the center."
	size="sm"
>
	<form id="rename-chart" onsubmit={(event) => { event.preventDefault(); saveRename(); }}>
		<label class="flex flex-col gap-1.5">
			<span class="sr-only">Chart name</span>
			<input
				bind:this={nameField}
				class="h-[42px] w-full rounded-full border-0 bg-sunken px-4 font-sans text-base text-text motion-safe:transition-[background-color,box-shadow] motion-safe:duration-150 placeholder:text-muted hover:bg-sunken-hover focus:bg-surface focus:shadow-[0_0_0_1.5px_var(--ink)] focus:outline-none"
				type="text"
				placeholder={UNTITLED}
				maxlength={TEXT_MAX}
				autocomplete="off"
				spellcheck="false"
				bind:value={name}
			/>
		</label>
	</form>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (renameOpen = false)}>Cancel</Button>
		<Button type="submit" form="rename-chart">Save</Button>
	{/snippet}
</Dialog>
