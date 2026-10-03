<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { example } from '$lib/chart/example';
	import { formatDeletesIn, formatUpdated, titleOf, UNTITLED } from '$lib/chart/library';
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
			chart.say('Chart renamed.');
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
		chart.say('Opened the example chart.');
	}

	function addExampleCopy(): void {
		exampleOpen = false;
		chart.loadExample();
	}

	let deleteOpen = $state(false);
	let deletedOpen = $state(false);
	let confirmingId = $state('');

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
		confirmingId = '';
		deletedOpen = true;
	}

	function restoreDeleted(id: string): void {
		chart.restoreChart(id);
		confirmingId = '';
	}

	function forgetDeleted(id: string): void {
		chart.forgetChart(id);
		confirmingId = '';
	}

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

<Dialog
	bind:open={deletedOpen}
	title="Recently deleted"
	description="Deleted charts stay here for 30 days."
>
	{#if chart.deletedCharts.length === 0}
		<p class="m-0 text-[0.9rem] leading-[1.45] text-pretty text-muted">
			Nothing here yet. Delete a chart from the menu, and you can restore it from this list.
		</p>
	{:else}
		<ul class="m-0 flex list-none flex-col gap-2 p-0">
			{#each chart.deletedCharts as item (item.id)}
				<li class="flex flex-col gap-3 py-2 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
					<div class="min-w-0">
						<p class="m-0 truncate font-medium text-text">{item.title}</p>
						<p class="m-0 mt-0.5 text-[0.86rem] text-muted">
							{item.filled} of 73 · {formatDeletesIn(item.daysLeft)}
						</p>
					</div>
					{#if confirmingId === item.id}
						<p class="m-0 text-[0.86rem] leading-[1.4] text-pretty text-muted">
							Remove “{item.title}” from this device?
						</p>
						<div class="flex flex-wrap justify-end gap-2">
							<Button variant="ghost" size="sm" class="coarse:min-h-11" onclick={() => (confirmingId = '')}>
								Cancel
							</Button>
							<Button
								variant="danger"
								size="sm"
								class="coarse:min-h-11"
								onclick={() => forgetDeleted(item.id)}
							>
								Delete
							</Button>
						</div>
					{:else}
						<div class="flex flex-wrap justify-end gap-2">
							<Button
								variant="danger"
								size="sm"
								class="coarse:min-h-11"
								onclick={() => (confirmingId = item.id)}
							>
								Delete now
							</Button>
							<Button variant="soft" size="sm" class="coarse:min-h-11" onclick={() => restoreDeleted(item.id)}>
								Restore
							</Button>
						</div>
					{/if}
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
