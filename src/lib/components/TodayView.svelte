<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { getByKey, isOpenFocus, isRoutine, isUrl, todayKey, dateKeyOffset } from '$lib/chart/model';
	import type { ActionMeta } from '$lib/chart/model';
	import DaySeal from './DaySeal.svelte';
	import FocusPicker from './FocusPicker.svelte';
	import Icon from './Icon.svelte';
	import WeeklyReflection from './WeeklyReflection.svelte';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';
	import Eyebrow from './ui/Eyebrow.svelte';
	import Notice from './ui/Notice.svelte';
	import { cn } from './ui/cn';

	const dateKey = todayKey();
	let reflectionOpen = $state(false);

	type ActionEntry = {
		key: string;
		text: string;
		meta: ActionMeta | undefined;
		pillarIndex: number;
		pillarName: string;
	};

	const allActions = $derived.by((): ActionEntry[] => {
		const entries: ActionEntry[] = [];
		for (let pillarIndex = 0; pillarIndex < 8; pillarIndex++) {
			const pillarName = chart.data.pillars[pillarIndex]?.trim() || `Pillar ${pillarIndex + 1}`;
			for (let actionIndex = 0; actionIndex < 8; actionIndex++) {
				const key = `a${pillarIndex}_${actionIndex}`;
				const text = getByKey(chart.data, key).trim();
				if (!text) continue;
				entries.push({ key, text, meta: chart.metaOf(key), pillarIndex, pillarName });
			}
		}
		return entries;
	});

	const habits = $derived.by((): ActionEntry[] => {
		const list = allActions.filter((entry) => isRoutine(entry.meta));
		const pinned = list.filter((entry) => entry.meta?.pinned);
		const rest = list.filter((entry) => !entry.meta?.pinned);
		return [...pinned, ...rest];
	});

	const pickable = $derived(allActions.filter((entry) => isOpenFocus(entry.meta)));

	function openKeys(keys: string[]): string[] {
		return keys.filter((key) => {
			const entry = allActions.find((action) => action.key === key);
			return entry ? isOpenFocus(entry.meta) : false;
		});
	}

	const pickerActions = $derived([
		...pickable.filter((entry) => entry.meta?.pinned),
		...pickable.filter((entry) => !entry.meta?.pinned)
	]);

	let selectedKeys = $state<string[]>([]);
	let confirmed = $state(chart.todayLog.started === true || chart.todayLog.focus.length > 0);
	let justCheckedKey = $state<string | null>(null);
	let celebrate = $state(false);

	let seeded = false;
	$effect(() => {
		const log = chart.todayLog;
		if (seeded) return;
		seeded = true;
		if (log.started || log.focus.length > 0) {
			confirmed = true;
			selectedKeys = openKeys(log.focus);
		}
	});

	function confirm(): void {
		const keys = openKeys(selectedKeys);
		if (keys.length === 0 && habits.length === 0) return;
		chart.setFocus(dateKey, keys);
		confirmed = true;
		celebrate = false;
	}

	function adjust(): void {
		confirmed = false;
		celebrate = false;
		selectedKeys = openKeys(chart.todayLog.focus);
	}

	const focusEntries = $derived.by((): ActionEntry[] => {
		return chart.todayLog.focus
			.map((focusKey) => allActions.find((actionEntry) => actionEntry.key === focusKey))
			.filter((entry): entry is ActionEntry => entry !== undefined && isOpenFocus(entry.meta));
	});

	const trackedKeys = $derived.by((): string[] => {
		const keys = habits.map((entry) => entry.key);
		if (confirmed) {
			for (const entry of focusEntries) keys.push(entry.key);
		}
		return keys;
	});

	const allDone = $derived(
		trackedKeys.length > 0 &&
			(confirmed || pickable.length === 0) &&
			trackedKeys.every((key) => chart.todayLog.checked.includes(key))
	);

	function toggleChecked(key: string): void {
		const wasChecked = chart.todayLog.checked.includes(key);
		const wasDone = allDone;
		chart.toggleChecked(dateKey, key);
		justCheckedKey = wasChecked ? null : key;
		celebrate = !wasChecked && !wasDone && allDone;
	}

	const picking = $derived(allActions.length > 0 && !confirmed && pickable.length > 0);

	const heading = $derived.by((): string => {
		if (confirmed && focusEntries.length > 0) return "Today's focus";
		if (picking) return 'Pick three for today';
		return 'Today';
	});

	const closed = $derived((confirmed || pickable.length === 0) && allDone);

	const closedEntries = $derived(confirmed ? [...habits, ...focusEntries] : habits);

	const movedPillars = $derived([...new Set(closedEntries.map((entry) => entry.pillarIndex))].sort((a, b) => a - b));

	const COUNT_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];

	const movedLine = $derived.by((): string => {
		const names = movedPillars.map(
			(pillarIndex) => chart.data.pillars[pillarIndex]?.trim() || `Pillar ${pillarIndex + 1}`
		);
		if (names.length === 1) return `${names[0]} moved forward.`;
		if (names.length === 2) return `${names[0]} and ${names[1]} moved forward.`;
		if (names.length === 3) return `${names[0]}, ${names[1]}, and ${names[2]} moved forward.`;
		return `${COUNT_WORDS[names.length]} pillars moved forward.`;
	});

	function rise(seconds: number): { class: string; delay: string | undefined } {
		return celebrate
			? { class: 'motion-safe:animate-done-in', delay: `${seconds}s` }
			: { class: '', delay: undefined };
	}

	const today = new Date();
	const dayLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

	const tomorrowKey = dateKeyOffset(1);
	const tomorrowDate = new Date();
	tomorrowDate.setDate(tomorrowDate.getDate() + 1);
	const tomorrowLabel = tomorrowDate.toLocaleDateString('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric'
	});

	let planningOpen = $state(false);
	let tomorrowSelected = $state<string[]>([]);
	const tomorrowPlannedCount = $derived(openKeys(chart.data.days?.[tomorrowKey]?.focus ?? []).length);

	function openPlanning(): void {
		tomorrowSelected = openKeys(chart.data.days?.[tomorrowKey]?.focus ?? []);
		planningOpen = true;
	}

	function saveTomorrow(): void {
		const keys = openKeys(tomorrowSelected);
		if (keys.length === 0) return;
		chart.setFocus(tomorrowKey, keys);
		planningOpen = false;
		chart.say('Tomorrow planned.');
	}

	const rowClass =
		'group flex w-full min-h-11 cursor-pointer items-start gap-3.5 rounded-full border-0 bg-transparent px-3 py-2.5 text-left motion-safe:transition-colors motion-safe:duration-150 hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
</script>

{#snippet checkRow(entry: ActionEntry)}
	{@const isChecked = chart.todayLog.checked.includes(entry.key)}
	{@const justChecked = justCheckedKey === entry.key}
	<button
		type="button"
		class={rowClass}
		onclick={() => toggleChecked(entry.key)}
		aria-pressed={isChecked}
	>
		<span
			class={cn(
				'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 motion-safe:transition-[background-color,border-color] motion-safe:duration-150',
				isChecked
					? 'border-success bg-success text-surface'
					: 'border-line bg-transparent group-hover:border-muted',
				justChecked && 'origin-center motion-safe:animate-check-settle'
			)}
			aria-hidden="true"
		>
			{#if isChecked}
				<Icon
					name="check"
					size={12}
					strokeWidth={2.5}
					class={justChecked ? 'origin-center motion-safe:animate-check-in' : ''}
				/>
			{/if}
		</span>
		<span class="flex min-w-0 flex-col gap-0.5">
			<span
				class={cn(
					'text-[0.95rem] font-medium leading-snug motion-safe:transition-colors motion-safe:duration-200',
					isChecked && 'text-muted line-through'
				)}>{entry.text}</span>
			{#if entry.meta?.note}
				<span class="text-[0.78rem] text-muted">
					{#if isUrl(entry.meta.note)}
						<a
							href={entry.meta.note}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-1 underline underline-offset-2 hover:text-text"
							onclick={(event) => event.stopPropagation()}
						>
							<Icon name="link" size={11} />
							{entry.meta.note}
						</a>
					{:else}
						{entry.meta.note}
					{/if}
				</span>
			{/if}
		</span>
	</button>
{/snippet}

<div
	class={cn(
		'mx-auto w-full px-4 py-6 max-[900px]:px-3 max-[900px]:py-4',
		picking && !closed ? 'max-w-[1040px]' : 'max-w-[620px]'
	)}
>
	{#if chart.weekReflectionDue}
		<div class="mb-5 max-w-[620px]">
			<Notice>
				{#snippet children()}
					Take a moment to reflect on your week.
				{/snippet}
				{#snippet action()}
					<Button size="sm" variant="soft" onclick={() => (reflectionOpen = true)}>
						Reflect
					</Button>
				{/snippet}
			</Notice>
		</div>
	{/if}

	{#if closed}
		{@const date = rise(0.75)}
		{@const title = rise(0.85)}
		{@const line = rise(1)}
		{@const receipt = rise(1.2)}
		{@const next = rise(1.4)}
		<section class="flex flex-col items-center pt-4 text-center" aria-labelledby="day-closed-title">
			<DaySeal
				moved={movedPillars}
				play={celebrate}
				label={movedLine}
				class="mb-8 w-[168px] max-[900px]:mb-6 max-[900px]:w-[136px]"
			/>
			<div class={date.class} style:animation-delay={date.delay}>
				<Eyebrow class="mb-3">{dayLabel}</Eyebrow>
			</div>
			<h2
				id="day-closed-title"
				class={cn(
					'm-0 font-serif text-[2.6rem] font-[480] leading-[1.05] tracking-[-0.03em] text-balance text-text max-[900px]:text-[2.1rem]',
					title.class
				)}
				style:animation-delay={title.delay}
			>
				Done for today.
			</h2>
			<p
				class={cn('mt-3 mb-0 max-w-[42ch] text-[1rem] text-pretty text-muted', line.class)}
				style:animation-delay={line.delay}
			>
				{movedLine}
			</p>
		</section>

		<div
			class={cn('mx-auto mt-9 w-full max-w-[440px] rounded-[22px] bg-surface p-1.5 shadow-card', receipt.class)}
			style:animation-delay={receipt.delay}
		>
			<p class="m-0 flex items-center justify-between px-3 pt-2 pb-1 text-[0.78rem] text-muted">
				<span>Today</span>
				<span class="tabular-nums">{closedEntries.length} of {closedEntries.length}</span>
			</p>
			{#each closedEntries as entry (entry.key)}
				{@render checkRow(entry)}
			{/each}
			{#if chart.data.goal.trim()}
				<div class="mt-1.5 rounded-[16px] bg-sunken px-4 py-3">
					<p class="m-0 text-[0.76rem] text-muted">One day closer to</p>
					<p class="m-0 mt-0.5 font-serif text-[0.98rem] font-[520] leading-snug text-pretty text-text">
						{chart.data.goal.trim()}
					</p>
				</div>
			{/if}
		</div>

		<div
			class={cn('mt-7 flex flex-col items-center gap-2', next.class)}
			style:animation-delay={next.delay}
		>
			<Button class="w-full max-w-[320px]" onclick={openPlanning}>
				Plan tomorrow
				{#if tomorrowPlannedCount > 0}
					<span class="tabular-nums">· {tomorrowPlannedCount} set</span>
				{/if}
			</Button>
			{#if pickable.length > 0}
				<button
					type="button"
					class="min-h-11 cursor-pointer rounded-full border-0 bg-transparent px-4 text-[0.82rem] font-medium text-muted hover:text-text motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
					onclick={adjust}
				>
					Adjust
				</button>
			{/if}
		</div>
	{:else}
	<div class={picking ? 'mb-7 max-[900px]:mb-5' : 'mb-5'}>
		<Eyebrow class="mb-2">{dayLabel}</Eyebrow>
		<h2
			class={cn(
				'm-0 font-serif font-[480] tracking-[-0.02em] text-balance text-text',
				picking
					? 'text-[2.3rem] leading-[1.05] tracking-[-0.03em] max-[900px]:text-[1.8rem]'
					: 'text-[1.7rem] leading-[1.15] max-[900px]:text-[1.45rem]'
			)}
		>
			{heading}
		</h2>
		{#if picking}
			<p class="m-0 mt-2 max-w-[52ch] text-[1rem] text-pretty text-muted">
				Three actions from your chart, small enough to finish today.
			</p>
		{/if}
	</div>

	{#if allActions.length === 0}
		<p class="mb-4 text-[0.88rem] text-pretty text-muted">Add actions on the chart first.</p>
		<div class="flex justify-center">
			<Button onclick={() => chart.setViewMode('view')}>Open the chart</Button>
		</div>
	{:else if !confirmed && pickable.length > 0}
		{#if habits.length > 0}
			<section class="mb-6 max-w-[620px]" aria-label="Habits">
				<Eyebrow class="mb-1">Habits</Eyebrow>
				<div class="flex flex-col">
					{#each habits as entry (entry.key)}
						{@render checkRow(entry)}
					{/each}
				</div>
			</section>
		{/if}
		<FocusPicker actions={pickerActions} bind:selected={selectedKeys}>
			{#snippet footer()}
				<Button disabled={selectedKeys.length === 0 && habits.length === 0} onclick={confirm}>
					Start my day
				</Button>
			{/snippet}
		</FocusPicker>
	{:else}
		<div class="mb-6 flex flex-col gap-0.5">
			{#if habits.length > 0 && focusEntries.length > 0}
				<Eyebrow class="mb-1 px-3">Habits</Eyebrow>
			{/if}
			{#each habits as entry (entry.key)}
				{@render checkRow(entry)}
			{/each}
			{#if habits.length > 0 && focusEntries.length > 0}
				<Eyebrow class="mt-3 mb-1 px-3">One-time</Eyebrow>
			{/if}
			{#each focusEntries as entry (entry.key)}
				{@render checkRow(entry)}
			{/each}
			{#if habits.length === 0 && focusEntries.length === 0}
				<p class="px-3 py-4 text-[0.88rem] text-pretty text-muted">Those one-time actions are done.</p>
			{/if}
		</div>

		<div class="flex flex-col items-center gap-3">
			<Button variant="ghost" icon="moon" onclick={openPlanning}>
				Plan tomorrow
				{#if tomorrowPlannedCount > 0}
					<span class="tabular-nums">· {tomorrowPlannedCount} set</span>
				{/if}
			</Button>
			{#if pickable.length > 0}
				<button
					type="button"
					class="cursor-pointer rounded-full border-0 bg-transparent px-3 py-2 text-[0.82rem] font-medium text-muted hover:text-text motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
					onclick={adjust}
				>
					Adjust
				</button>
			{/if}
		</div>
	{/if}
	{/if}

	<WeeklyReflection bind:open={reflectionOpen} />
</div>

<Dialog
	bind:open={planningOpen}
	title="Plan tomorrow"
	description={tomorrowLabel}
>
	<FocusPicker actions={pickerActions} bind:selected={tomorrowSelected} inset />
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (planningOpen = false)}>Cancel</Button>
		<Button disabled={tomorrowSelected.length === 0} onclick={saveTomorrow}>Save</Button>
	{/snippet}
</Dialog>
