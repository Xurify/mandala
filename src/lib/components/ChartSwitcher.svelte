<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { example } from '$lib/chart/example';
	import {
		deletedClock,
		deletedDayLabel,
		formatAgo,
		formatDaysLeft,
		formatUpdated,
		titleOf,
		TRASH_DAYS,
		UNTITLED,
		type ChartSummary,
		type DeletedSummary
	} from '$lib/chart/library';
	import { TEXT_MAX } from '$lib/chart/model';
	import FillRing from './FillRing.svelte';
	import Icon from './Icon.svelte';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';
	import Eyebrow from './ui/Eyebrow.svelte';
	import Menu from './ui/Menu.svelte';
	import MenuDivider from './ui/MenuDivider.svelte';
	import MenuItem from './ui/MenuItem.svelte';
	import { cn } from './ui/cn';
	import { fieldInk, textField } from './ui/styles';

	const activeTitle = $derived(titleOf(chart.data));
	const activeUpdated = $derived(chart.charts.find((item) => item.active)?.updatedAt);
	const updatedLabel = $derived(activeUpdated === undefined ? '' : formatUpdated(activeUpdated));

	let find = $state('');
	const showFind = $derived(chart.charts.length > 8);

	const chartRows = $derived.by(() => {
		const q = showFind ? find.trim().toLowerCase() : '';
		const rows = chart.charts.slice().sort((a, b) => b.updatedAt - a.updatedAt);
		if (!q) return rows;
		return rows.filter((item) =>
			`${item.title} ${deletedDayLabel(item.updatedAt)} ${deletedClock(item.updatedAt)}`
				.toLowerCase()
				.includes(q)
		);
	});

	const chartGroups = $derived.by(() => {
		const groups: { label: string; items: ChartSummary[] }[] = [];
		for (const item of chartRows) {
			const label = deletedDayLabel(item.updatedAt);
			const last = groups.at(-1);
			if (last && last.label === label) last.items.push(item);
			else groups.push({ label, items: [item] });
		}
		return groups;
	});

	let menuOpen = $state(false);
	let now = $state(Date.now());

	function onMenu(open: boolean): void {
		menuOpen = open;
		if (!open) find = '';
	}

	function pinMenu(list: HTMLElement): () => void {
		const band = list.parentElement;
		const panel = band?.parentElement;
		const fade = band?.querySelector<HTMLElement>('[data-menu-fade]');
		// The shared menu scrolls as one piece. This one keeps the actions on screen.
		if (panel) panel.style.overflowY = 'hidden';

		function place(): void {
			if (!panel) return;
			const trigger = panel.parentElement?.querySelector<HTMLElement>('[aria-haspopup="menu"]');
			if (!trigger) return;
			const dock = document.querySelector<HTMLElement>(
				'[role="tablist"][aria-label="Layout view mode"]'
			);
			const limit = (dock ? dock.getBoundingClientRect().top : window.innerHeight) - 12;
			const room = Math.min(640, Math.max(220, Math.floor(limit - trigger.getBoundingClientRect().bottom - 8)));
			const next = `${room}px`;
			if (panel.style.maxHeight !== next) panel.style.maxHeight = next;
		}

		// A row that still has charts under it dissolves into the actions instead of
		// being sliced by the foot. A lip plus the divider above it drew two edges.
		function mark(): void {
			if (!fade) return;
			const leftover = list.scrollHeight - list.clientHeight - list.scrollTop;
			const open = fade.hasAttribute('data-more');
			const more = open ? leftover > 1 : leftover > 8;
			if (more === open) return;
			fade.toggleAttribute('data-more', more);
		}

		function revealActive(): void {
			const active = list.querySelector<HTMLElement>('#switch-active-chart');
			if (!active) return;
			const listTop = list.getBoundingClientRect().top;
			const item = active.getBoundingClientRect();
			if (item.top < listTop) list.scrollTop -= listTop - item.top;
			else if (item.bottom > listTop + list.clientHeight) {
				list.scrollTop += item.bottom - (listTop + list.clientHeight);
			}
		}

		place();
		const frame = requestAnimationFrame(() => {
			place();
			revealActive();
			mark();
		});
		const onWindow = () => {
			place();
			mark();
		};
		// The panel is sized to the dock after this runs, and a filter changes how
		// much is left. Both move the fade without a scroll.
		const size = new ResizeObserver(mark);
		size.observe(list);
		window.addEventListener('resize', onWindow);
		window.addEventListener('scroll', onWindow, { passive: true });
		list.addEventListener('scroll', mark, { passive: true });
		return () => {
			cancelAnimationFrame(frame);
			size.disconnect();
			window.removeEventListener('resize', onWindow);
			window.removeEventListener('scroll', onWindow);
			list.removeEventListener('scroll', mark);
		};
	}

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
	// The subtitle already states the 30-day hold. A row only repeats it near the end.
	const SOON_DAYS = 7;
	function groupDeleted(items: DeletedSummary[]): { label: string; items: DeletedSummary[] }[] {
		const groups: { label: string; items: DeletedSummary[] }[] = [];
		for (const item of items) {
			const label = deletedDayLabel(item.deletedAt);
			const last = groups.at(-1);
			if (last && last.label === label) last.items.push(item);
			else groups.push({ label, items: [item] });
		}
		return groups;
	}

	const deletedGroups = $derived(groupDeleted(chart.deletedCharts));

	$effect(() => {
		if (!menuOpen && !deletedOpen) return;
		now = Date.now();
		const timer = setInterval(() => (now = Date.now()), 30_000);
		return () => clearInterval(timer);
	});

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

<Menu
	class="max-w-full [&_[role=menu]]:w-[min(24rem,calc(100vw-32px))]"
	align="start"
	label="Switch chart"
	onopenchange={onMenu}
>
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
					class="ms-[0.35em] inline-flex size-[34px] translate-y-[-0.06em] items-center justify-center rounded-full align-middle text-text bg-sunken group-hover:bg-sunken-hover group-focus-visible:bg-ink group-focus-visible:text-on-ink group-aria-expanded:bg-sunken-hover max-[900px]:size-[30px]"
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
	{#if showFind}
		<div data-menu-find-bar class="shrink-0 px-1 pt-0.5 pb-1.5">
			<div class="relative">
				<span
					class="pointer-events-none absolute start-3.5 top-1/2 flex -translate-y-1/2 text-muted"
					aria-hidden="true"
				>
					<Icon name="search" size={16} />
				</span>
				<input
					data-menu-find
					class={cn(fieldInk, 'ps-10', find ? 'pe-10' : 'pe-4')}
					type="text"
					placeholder="Find a chart"
					aria-label="Find a chart"
					aria-controls="chart-switch-list"
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
		</div>
	{/if}
	<div class="relative flex min-h-0 flex-auto flex-col">
		<div
			id="chart-switch-list"
			class="flex min-h-0 flex-auto flex-col gap-px overflow-x-clip overflow-y-auto overscroll-none"
			{@attach pinMenu}
		>
		{#if chartRows.length === 0}
			<p class="m-0 px-3 py-2.5 text-[0.86rem] text-pretty text-muted">No matching chart.</p>
		{/if}
		{#each chartGroups as group, groupIndex (group.label + groupIndex)}
			<div role="group" aria-label={group.label}>
				{#if chartGroups.length > 1 || group.label !== 'Today'}
					<Eyebrow class="px-3 pt-2 pb-1">{group.label}</Eyebrow>
				{/if}
				{#each group.items as item (item.id)}
					<MenuItem
						id={item.active ? 'switch-active-chart' : undefined}
						active={item.active}
						onclick={() => handleSelect(item.id)}
					>
						<FillRing filled={item.filled} />
						<span class="min-w-0 flex-1 truncate" title={item.title}>{item.title}</span>
						<span class="sr-only">, {item.filled} of 73, updated {deletedClock(item.updatedAt)}</span>
						<span class="shrink-0 text-[0.8rem] font-normal tabular-nums text-muted" aria-hidden="true">
							{formatAgo(item.updatedAt, now)}
						</span>
						<span class="flex w-4 shrink-0 justify-end text-text" aria-hidden="true">
							{#if item.active}
								<Icon name="check" size={16} strokeWidth={2.2} />
							{/if}
						</span>
					</MenuItem>
				{/each}
			</div>
		{/each}
		</div>
		<div
			data-menu-fade
			class="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-b from-transparent to-surface opacity-0 motion-safe:transition-opacity motion-safe:duration-200 motion-safe:ease-ui [&[data-more]]:opacity-100"
			aria-hidden="true"
		></div>
	</div>
	<div class="relative z-10 flex shrink-0 flex-col gap-px">
		<MenuDivider />
		<div class="flex gap-px">
			<MenuItem icon="grid" shortcut="N" class="flex-1" onclick={handleNew}>New chart</MenuItem>
			<MenuItem icon="target" class="flex-1" onclick={handleExample}>
				Example<span class="sr-only"> chart</span>
			</MenuItem>
		</div>
		<div class="flex gap-px">
			<MenuItem icon="edit" shortcut="R" class="flex-1" onclick={openRename}>Rename chart</MenuItem>
			<MenuItem icon="copy" shortcut="D" class="flex-1" onclick={handleDuplicate}>
				Duplicate chart
			</MenuItem>
		</div>
		<MenuDivider />
		<MenuItem
			icon="clock"
			badge={chart.deletedCharts.length > 0 ? String(chart.deletedCharts.length) : undefined}
			onclick={openDeleted}
		>
			Recently deleted
		</MenuItem>
		<MenuItem icon="trash" tone="danger" shortcut="Del" onclick={handleDelete}>Delete chart</MenuItem>
	</div>
</Menu>
{#if updatedLabel}
	<p class="m-0 mt-1 text-[0.86rem] text-muted">{updatedLabel}</p>
{/if}

<Dialog
	bind:open={deleteOpen}
	title="Delete this chart?"
	description={chart.chartCount === 1
		? `Moves to recently deleted for ${TRASH_DAYS} days. A blank chart stays open.`
		: `Moves to recently deleted for ${TRASH_DAYS} days.`}
	size="sm"
>
	<div class="flex min-h-[48px] items-center gap-3 rounded-[16px] bg-sunken px-3.5 py-2">
		<FillRing filled={activeChart?.filled ?? 0} />
		<span class="min-w-0 flex-1 truncate text-[0.95rem] font-medium text-text">
			{activeChart?.title ?? UNTITLED}
		</span>
		<span class="shrink-0 text-[0.8rem] tabular-nums text-muted">{activeChart?.filled ?? 0} of 73</span>
	</div>
	{#snippet footer()}
		<Button variant="ghost" size="sm" class="coarse:min-h-11" onclick={() => (deleteOpen = false)}>Cancel</Button>
		<Button size="sm" class="coarse:min-h-11" onclick={confirmDelete}>Delete chart</Button>
	{/snippet}
</Dialog>

{#snippet pickMark(on: boolean)}
	<span
		class="flex size-4 shrink-0 items-center justify-center rounded-[5px] motion-safe:transition-colors motion-safe:duration-150 {on
			? 'bg-accent text-on-accent'
			: 'shadow-[inset_0_0_0_1.5px_var(--line)] group-hover:shadow-[inset_0_0_0_1.5px_var(--muted)]'}"
		aria-hidden="true"
	>
		{#if on}
			<svg class="block" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
				<path
					d="M3.45 8.95 6.2 11.7 12.45 5.35"
					stroke="currentColor"
					stroke-width="2.25"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		{/if}
	</span>
{/snippet}

{#snippet deletedFooter()}
	{@const count = pickedItems.length}
	<div class="flex w-full flex-wrap items-center justify-end gap-x-2 gap-y-3">
		{#if confirming}
			<div class="me-auto min-w-0" role="status">
				<p class="m-0 text-[0.92rem] font-medium text-text">
					{count === 1 ? 'Delete this chart for good?' : `Delete ${count} charts for good?`}
				</p>
				<p class="m-0 text-[0.8rem] text-muted">You can't restore {count === 1 ? 'it' : 'them'} after this.</p>
			</div>
			<Button id="forget-cancel" variant="ghost" size="sm" class="coarse:min-h-11" onclick={cancelForget}>
				Cancel
			</Button>
			<Button variant="danger" size="sm" icon="trash" class="coarse:min-h-11" onclick={forgetDeleted}>
				{count > 1 ? `Delete ${count}` : 'Delete'}
			</Button>
		{:else}
			<div class="me-auto flex items-center gap-1">
				{#if chart.deletedCharts.length > 1}
					<Button variant="ghost" size="sm" class="-ms-3.5 coarse:min-h-11" onclick={toggleAllDeleted}>
						{allPicked ? 'Clear' : 'Select all'}
					</Button>
				{/if}
				<p class="m-0 text-[0.84rem] text-muted tabular-nums">
					{count === 0 ? 'None selected' : `${count} selected`}
				</p>
			</div>
			<Button
				id="deleted-remove"
				variant="danger"
				size="sm"
				icon="trash"
				class="coarse:min-h-11"
				disabled={count === 0}
				aria-label={count === 1
					? `Delete ${pickedItems[0]?.title} for good`
					: `Delete ${count} charts for good`}
				onclick={askForget}
			>
				{count > 1 ? `Delete ${count}` : 'Delete'}
			</Button>
			<Button
				id="deleted-restore"
				size="sm"
				icon="undo"
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
	</div>
{/snippet}

<Dialog
	bind:open={deletedOpen}
	title="Recently deleted"
	description="Deleted charts stay here for {TRASH_DAYS} days."
	footer={chart.deletedCharts.length > 0 ? deletedFooter : undefined}
	oncancel={holdForget}
>
	{#if chart.deletedCharts.length === 0}
		<p class="m-0 max-w-[36ch] text-[0.9rem] leading-[1.45] text-pretty text-muted">
			Nothing here yet. Delete a chart from the menu, and you can restore it from this list.
		</p>
	{:else}
		<div class="-mx-2.5">
			{#each deletedGroups as group, groupIndex (group.label)}
				<section class={groupIndex === 0 ? '' : 'mt-3'} aria-label={group.label}>
					<Eyebrow class="px-3 pb-1">{group.label}</Eyebrow>
					<ul class="m-0 flex list-none flex-col gap-px p-0">
						{#each group.items as item (item.id)}
							{@const on = picked.includes(item.id)}
							<li>
								<button
									type="button"
									class="group flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-[14px] border-0 px-3 py-1.5 text-start select-none motion-safe:transition-[opacity] motion-safe:duration-150 hover:bg-sunken focus-visible:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-checked:bg-sunken coarse:min-h-12 {confirming &&
									!on
										? 'opacity-40'
										: ''}"
									role="checkbox"
									aria-checked={on}
									aria-label="{item.title}. {item.filled} of 73. Deleted {deletedDayLabel(item.deletedAt)} at {deletedClock(item.deletedAt)}{item.daysLeft <= SOON_DAYS ? `. ${formatDaysLeft(item.daysLeft)}` : ''}"
									onclick={(event) => toggleDeleted(item.id, event.shiftKey)}
								>
									{@render pickMark(on)}
									<FillRing filled={item.filled} />
									<span class="min-w-0 flex-1 truncate text-[0.92rem] font-medium text-text">{item.title}</span>
									{#if item.daysLeft <= SOON_DAYS}
										<span class="shrink-0 text-[0.8rem] font-[560] tabular-nums text-danger">
											{formatDaysLeft(item.daysLeft)}
										</span>
									{:else}
										<span class="shrink-0 text-[0.8rem] tabular-nums text-muted">
											{formatAgo(item.deletedAt, now)}
										</span>
									{/if}
								</button>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		</div>
	{/if}
</Dialog>

<Dialog
	bind:open={exampleOpen}
	title="You already have this example"
	description={exampleAlreadyOpen
		? 'Add another copy of this chart?'
		: 'Open that chart, or add another copy.'}
	size="sm"
>
	<div class="flex min-h-[52px] items-center rounded-[16px] bg-sunken px-3 py-2">
		<span class="block truncate text-[0.95rem] font-medium text-text">{example.goal}</span>
	</div>
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
				class={textField}
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
