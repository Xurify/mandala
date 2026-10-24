<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { HUES, idAt, isOpenFocus, isRoutine, isUrl, dateKeyOffset } from '$lib/chart/model';
	import type { ActionId, ActionMeta } from '$lib/chart/model';
	import DaySeal from './DaySeal.svelte';
	import FocusPicker from './FocusPicker.svelte';
	import Icon from './Icon.svelte';
	import ToolFace from './ToolFace.svelte';
	import IconButton from './ui/IconButton.svelte';
	import { dealOrder, dealTools, toolsFor } from '$lib/chart/tools';
	import { dealFirst, finishedOn } from '$lib/chart/board';
	import { welcomeBack } from '$lib/chart/helper';
	import { readyChime } from '$lib/chart/chime';
	import { BLOCK_MINUTES, elapsedMs, formatMinutes, minutesOn, ringShare } from '$lib/chart/timer';
	import TimerRing from './TimerRing.svelte';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';
	import Eyebrow from './ui/Eyebrow.svelte';
	import Menu from './ui/Menu.svelte';
	import MenuDivider from './ui/MenuDivider.svelte';
	import MenuItem from './ui/MenuItem.svelte';
	import Notice from './ui/Notice.svelte';
	import { cn } from './ui/cn';

	const dateKey = chart.today;
	/** Tools passed over with "Another" this visit, per action. Forgotten on reload, so nothing is lost. */
	let passed = $state<Map<ActionId, Set<string>>>(new Map());

	type ActionEntry = {
		id: ActionId;
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
				const text = (chart.data.actions[pillarIndex]?.[actionIndex] ?? '').trim();
				if (!text) continue;
				const id = idAt(chart.data, pillarIndex, actionIndex);
				entries.push({ id, text, meta: chart.metaOf(id), pillarIndex, pillarName });
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
	/** Today's tool per action, dealt routines first so two on one shelf never show the same thing. */
	const dealt = $derived(dealTools(chart.data, dealOrder(chart.data), new Date(), passed));

	let minuteNow = $state(Date.now());
	$effect(() => {
		if (!chart.timer) return;
		minuteNow = Date.now();
		const interval = setInterval(() => (minuteNow = Date.now()), 15_000);
		return () => clearInterval(interval);
	});

	function startTimer(action: ActionId, length?: number): void {
		readyChime();
		chart.startTimer(action, length);
	}

	function passOver(key: ActionId, id: string): void {
		const next = new Map(passed);
		next.set(key, new Set([...(passed.get(key) ?? []), id]));
		passed = next;
	}

	function openKeys(keys: ActionId[]): ActionId[] {
		return keys.filter((key) => {
			const entry = allActions.find((action) => action.id === key);
			return entry ? isOpenFocus(entry.meta) : false;
		});
	}

	const pickerActions = $derived([...pickable].sort((a, b) => dealFirst(a.meta, b.meta)));

	const ticked = (key: ActionId): boolean => finishedOn(chart.data, key, dateKey);

	let selectedKeys = $state<ActionId[]>([]);
	let confirmed = $state(chart.todayLog.started === true || chart.todayLog.focus.length > 0);
	let justCheckedKey = $state<ActionId | null>(null);
	let celebrate = $state(false);

	let seenFocus = '';
	$effect(() => {
		const log = chart.todayLog;
		const signature = log.started || log.focus.length > 0 ? `${log.focus.join(',')}|` : '';
		if (signature === seenFocus) return;
		seenFocus = signature;
		if (signature) {
			confirmed = true;
			selectedKeys = openKeys(log.focus);
		}
	});

	function confirm(): void {
		const keys = [...new Set([...chart.todayLog.focus.filter(ticked), ...openKeys(selectedKeys)])];
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
			.map((focusKey) => allActions.find((actionEntry) => actionEntry.id === focusKey))
			.filter((entry): entry is ActionEntry => entry !== undefined && (isOpenFocus(entry.meta) || ticked(entry.id)));
	});

	const trackedKeys = $derived.by((): ActionId[] => {
		const keys = habits.map((entry) => entry.id);
		if (confirmed) {
			for (const entry of focusEntries) keys.push(entry.id);
		}
		return keys;
	});

	const checkedCount = $derived(trackedKeys.filter(ticked).length);

	const allDone = $derived(
		trackedKeys.length > 0 &&
			(confirmed || pickable.length === 0) &&
			trackedKeys.every(ticked)
	);

	function toggleChecked(key: ActionId): void {
		const wasChecked = ticked(key);
		const wasDone = allDone;
		if (wasChecked) chart.reopen(key);
		else chart.finish(key);
		justCheckedKey = wasChecked ? null : key;
		celebrate = !wasChecked && !wasDone && allDone;
	}

	const picking = $derived(allActions.length > 0 && !confirmed && pickable.length > 0);
	const back = $derived(welcomeBack(chart.data));

	const heading = $derived.by((): string => {
		if (confirmed && focusEntries.length > 0) return "Today's focus";
		if (picking) return back ? 'Welcome back' : 'Pick three for today';
		return 'Today';
	});

	const closed = $derived((confirmed || pickable.length === 0) && allDone);

	const closedEntries = $derived(confirmed ? [...habits, ...focusEntries] : habits);

	const movedPillars = $derived([...new Set(closedEntries.map((entry) => entry.pillarIndex))].sort((a, b) => a - b));

	const COUNT_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];

	const pillarName = (pillarIndex: number): string => chart.data.pillars[pillarIndex]?.trim() || `Pillar ${pillarIndex + 1}`;
	const movedLine = $derived.by((): string => {
		const names = movedPillars.map(pillarName);
		if (names.length === 1) return `${names[0]} moved forward.`;
		if (names.length === 2) return `${names[0]} and ${names[1]} moved forward.`;
		if (names.length === 3) return `${names[0]}, ${names[1]}, and ${names[2]} moved forward.`;
		return `${COUNT_WORDS[names.length]} pillars moved forward.`;
	});
	const joiner = (index: number, count: number): string => (index === 0 ? '' : count === 2 ? ' and ' : index === count - 1 ? ', and ' : ', ');

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
	let tomorrowSelected = $state<ActionId[]>([]);
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
		'group flex w-full min-h-11 cursor-pointer items-center gap-3.5 rounded-full border-0 px-3 py-2.5 text-left leading-none hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
</script>

{#snippet checkRow(entry: ActionEntry)}
	{@const isChecked = ticked(entry.id)}
	{@const justChecked = justCheckedKey === entry.id}
	{@const tool = dealt.get(entry.id) ?? null}
	{@const timed = chart.timer?.action === entry.id ? chart.timer : null}
	{@const spent = minutesOn(chart.data, dateKey, entry.id)}
	<div class="group/row flex flex-col">
		<div class="flex items-center gap-0.5">
		<button
			type="button"
			class={cn(rowClass, 'min-w-0 flex-1')}
			onclick={() => toggleChecked(entry.id)}
			aria-pressed={isChecked}
		>
			<span
				class={cn(
					'flex size-5 shrink-0 items-center justify-center rounded-full border-2 motion-safe:transition-[border-color] motion-safe:duration-150',
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
			<span
				class={cn(
					'min-w-0 flex-1 text-[0.95rem] font-medium leading-5 motion-safe:transition-colors motion-safe:duration-200',
					isChecked && 'text-muted line-through'
				)}>{entry.text}</span>
			<span
				class={cn(
					'pip size-2 shrink-0 rounded-full motion-safe:transition-opacity motion-safe:duration-200',
					isChecked && 'opacity-40'
				)}
				style:--pip-h={HUES[entry.pillarIndex]}
				title={entry.pillarName}
				aria-hidden="true"
			></span>
			<span class="sr-only">, {entry.pillarName}</span>
		</button>
		{#if timed}
			{@const minutes = Math.floor(elapsedMs(timed, minuteNow) / 60_000)}
			<button
				type="button"
				class="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink coarse:size-11"
				aria-label="{timed.length ? 'Stop the block' : 'Stop the stopwatch'} on {entry.text}, {minutes === 1 ? '1 minute' : `${minutes} minutes`} so far"
				title={timed.length ? 'Stop the block' : 'Stop the stopwatch'}
				onclick={() => chart.stopTimer()}
			>
				<TimerRing share={ringShare(timed, minuteNow)} hue={HUES[entry.pillarIndex]} class="size-6" />
			</button>
		{:else}
			<Menu label="Time on {entry.text}">
				{#snippet trigger({ expanded, toggle })}
					<IconButton
						icon="timer"
						label="Time on {entry.text}"
						class="size-10 text-muted hover:text-text coarse:size-11 can-hover:opacity-0 can-hover:group-hover/row:opacity-100 can-hover:focus-visible:opacity-100 can-hover:aria-expanded:opacity-100"
						aria-haspopup="menu"
						aria-expanded={expanded}
						onclick={toggle}
					/>
				{/snippet}
				<MenuItem icon="timer" badge="until you stop" onclick={() => startTimer(entry.id)}>Stopwatch</MenuItem>
				<MenuItem icon="hourglass" badge="{BLOCK_MINUTES} min, then a break" onclick={() => startTimer(entry.id, BLOCK_MINUTES)}>Focus block</MenuItem>
				<MenuDivider />
				<MenuItem icon="plus" onclick={() => (chart.loggingTime = { action: entry.id })}>Log time</MenuItem>
				{#if spent > 0}
					<MenuDivider />
					<MenuItem icon="trash" tone="danger" badge={formatMinutes(spent)} onclick={() => chart.removeTime(dateKey, entry.id)}>Remove time entry</MenuItem>
				{/if}
			</Menu>
		{/if}
		</div>
		{#if tool || entry.meta?.note || spent > 0}
			<!-- Lined up under the text: the row's padding, the check, and the gap between them. -->
			<div class="-mt-0.5 flex min-w-0 flex-col gap-0.5 ps-[46px] pe-3 pb-2.5">
				{#if spent > 0}
					<span class="flex items-center gap-1 text-[0.78rem] leading-snug text-muted tabular-nums">
						<Icon name="clock" size={12} />{formatMinutes(spent)} today
					</span>
				{/if}
				{#if tool}
					<div class="flex min-w-0 items-center gap-1 rounded-[16px] bg-bg p-1.5 pe-1" role="group" aria-label="Today's tool for {entry.text}">
						<a
							href={tool.url}
							target="_blank"
							rel="noopener noreferrer"
							class="flex min-w-0 flex-1 items-center rounded-[12px] px-1 py-0.5 text-text no-underline hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink"
							onclick={() => chart.openTool(entry.pillarIndex, tool.id)}
						>
							<ToolFace {tool} class="min-w-0 flex-1" />
						</a>
						{#if toolsFor(chart.data, entry.id).filter((other) => !other.known).length > 1}
							<IconButton
								icon="refresh"
								label="Another tool for {entry.text}"
								class="size-9 shrink-0 text-muted hover:bg-surface hover:text-text coarse:size-11"
								onclick={() => passOver(entry.id, tool.id)}
							/>
						{/if}
						<IconButton
							icon="shelf"
							label="Open the {entry.pillarName} shelf"
							class="size-9 shrink-0 text-muted hover:bg-surface hover:text-text coarse:size-11"
							onclick={() => chart.openShelf(entry.pillarIndex)}
						/>
					</div>
				{/if}
				{#if entry.meta?.note}
					<span class="text-[0.78rem] leading-snug text-muted">
						{#if isUrl(entry.meta.note)}
							<a
								href={entry.meta.note}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1 underline underline-offset-2 hover:text-text"
							>
								<Icon name="link" size={11} />
								{entry.meta.note}
							</a>
						{:else}
							{entry.meta.note}
						{/if}
					</span>
				{/if}
			</div>
		{/if}
	</div>
{/snippet}

{#snippet alsoToday(className = '')}
	{#if chart.elsewhere.length > 0}
		<section class={cn('mx-auto w-full max-w-[520px] rounded-[22px] bg-surface p-1.5 shadow-card', className)} aria-labelledby="also-today">
			<h3 id="also-today" class="m-0 px-3 pt-2 pb-1 text-[0.78rem] font-normal text-muted">Also today</h3>
			{#each chart.elsewhere as other (other.id)}
				<button
					type="button"
					class="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-full border-0 bg-transparent px-3 py-2 text-left text-text hover:bg-sunken active:scale-[0.98] motion-safe:transition-[scale] motion-safe:duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
					aria-label="Open {other.title}: {other.left} left today"
					onclick={() => chart.switchChart(other.id)}
				>
					<span class="size-1.5 shrink-0 rounded-full bg-ink" aria-hidden="true"></span>
					<span class="min-w-0 flex-1 truncate text-[0.95rem]">{other.title}</span>
					<span class="shrink-0 text-[0.84rem] text-muted tabular-nums">{other.left} left</span>
					<Icon name="chevron-right" size={16} class="shrink-0 text-muted" />
				</button>
			{/each}
		</section>
	{/if}
{/snippet}

<div
	class={cn(
		'mx-auto w-full px-4 py-6 max-[900px]:px-0 max-[900px]:py-2',
		picking && !closed ? 'max-w-[1040px]' : 'max-w-[620px]'
	)}
>
	{#if closed}
		<div class="mx-auto mb-2 flex w-full max-w-[520px] justify-end max-[900px]:mb-1">
			<Button size="sm" variant="ghost" icon="calendar" onclick={() => chart.setViewMode('calendar')}>Calendar</Button>
		</div>
	{/if}
	{#if chart.weekReflectionDue}
		<div class={cn('mb-5', picking && !closed ? 'max-w-full' : 'mx-auto max-w-[520px]')}>
			<Notice>
				{#snippet children()}
					Take a moment to reflect on your week.
				{/snippet}
				{#snippet action()}
					<Button size="sm" variant="soft" onclick={() => (chart.reflecting = true)}>
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
					'm-0 font-serif text-[2.6rem] font-[480] leading-[1.05] tracking-[-0.015em] text-balance text-text max-[900px]:text-[2.1rem]',
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
				{#if movedPillars.length <= 3}
					{#each movedPillars as pillarIndex, index (pillarIndex)}{joiner(index, movedPillars.length)}<span
							class="pillar-ink font-[600]"
							style:--h={HUES[pillarIndex]}>{pillarName(pillarIndex)}</span
						>{/each}{' '}moved forward.
				{:else}
					{movedLine}
				{/if}
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
			{#each closedEntries as entry (entry.id)}
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

		{@render alsoToday(cn('mt-4 max-w-[440px]', receipt.class))}

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
	{:else if picking}
		<FocusPicker actions={pickerActions} bind:selected={selectedKeys}>
			{#snippet head()}
				<header class="flex items-start justify-between gap-4 pt-1">
					<div class="min-w-0">
						<Eyebrow class="mb-2">{dayLabel}</Eyebrow>
						<h2
							id="today-title"
							class="m-0 font-serif text-[2rem] leading-[1.08] font-[480] tracking-[-0.012em] text-balance text-text max-[900px]:text-[1.6rem]"
						>
							{heading}
						</h2>
						<p class="m-0 mt-1.5 max-w-[52ch] text-[0.95rem] text-pretty text-muted">
							{back ? 'One action is enough to start again. Pick more if you like.' : 'Three actions from your chart, small enough to finish today.'}
						</p>
					</div>
				</header>
			{/snippet}
			{#snippet extra()}
				{#if habits.length > 0}
					<section class="rounded-[20px] bg-sunken px-4 pt-3 pb-3.5" aria-labelledby="habits-today">
						<div class="flex items-baseline justify-between gap-3">
							<Eyebrow><span id="habits-today">Habits</span></Eyebrow>
							<span class="text-[0.8rem] text-muted">Already in your day</span>
						</div>
						<ul class="m-0 mt-2.5 grid list-none gap-x-6 gap-y-2 p-0 @min-[540px]:grid-cols-2">
							{#each habits as entry (entry.id)}
								{@const done = ticked(entry.id)}
								<li class="flex min-w-0 items-center gap-2.5 text-[0.9rem] leading-snug">
									<span class={cn('pip size-2 shrink-0 rounded-full', done && 'opacity-40')} style:--pip-h={HUES[entry.pillarIndex]} aria-hidden="true"></span>
									<span class={cn('min-w-0 truncate', done && 'text-muted line-through')}>{entry.text}</span>
									{#if done}<span class="sr-only">, done</span>{/if}
								</li>
							{/each}
						</ul>
					</section>
				{/if}
			{/snippet}
			{#snippet footer()}
				<Button disabled={selectedKeys.length === 0 && habits.length === 0} onclick={confirm}>
					Start my day
				</Button>
			{/snippet}
		</FocusPicker>
	{:else}
		<section
			class="mx-auto mt-2 w-full max-w-[520px] rounded-[28px] bg-surface p-2 shadow-card max-[900px]:mt-0 max-[900px]:rounded-3xl"
			aria-labelledby="today-title"
		>
			<header class="flex items-end justify-between gap-4 px-3 pt-4 pb-3">
				<div class="min-w-0">
					<Eyebrow class="mb-1.5">{dayLabel}</Eyebrow>
					<h2
						id="today-title"
						class="m-0 font-serif text-[1.6rem] leading-[1.1] font-[480] tracking-[-0.01em] text-balance text-text max-[900px]:text-[1.4rem]"
					>
						{heading}
					</h2>
				</div>
				<div class="flex shrink-0 items-center gap-1">
					{#if trackedKeys.length > 0}
						<p class="m-0 text-[0.84rem] text-muted tabular-nums">
							<span class="font-semibold text-text">{checkedCount}</span> of {trackedKeys.length}
						</p>
					{/if}
				</div>
			</header>

			{#if allActions.length === 0}
				<div class="flex flex-col items-start gap-4 px-3 pt-1 pb-4">
					<p class="m-0 text-[0.92rem] text-pretty text-muted">Add actions on the chart first.</p>
					<Button onclick={() => chart.setViewMode('view')}>Open the chart</Button>
				</div>
			{:else}
				<div class="flex flex-col gap-0.5 pb-1">
					{#if habits.length > 0 && focusEntries.length > 0}
						<Eyebrow class="mt-1 mb-1 px-3">Habits</Eyebrow>
					{/if}
					{#each habits as entry (entry.id)}
						{@render checkRow(entry)}
					{/each}
					{#if habits.length > 0 && focusEntries.length > 0}
						<Eyebrow class="mt-3 mb-1 px-3">One-time</Eyebrow>
					{/if}
					{#each focusEntries as entry (entry.id)}
						{@render checkRow(entry)}
					{/each}
					{#if habits.length === 0 && focusEntries.length === 0}
						<p class="m-0 px-3 py-3 text-[0.92rem] text-pretty text-muted">Those one-time actions are done.</p>
					{/if}
				</div>

				<div class="-mx-0.5 mt-2 flex items-center justify-between gap-2">
					{#if pickable.length > 0}
						<Button variant="ghost" size="sm" icon="refresh" onclick={adjust}>Adjust</Button>
					{:else}
						<span></span>
					{/if}
					<Button variant="ghost" size="sm" icon="moon" onclick={openPlanning}>
						Plan tomorrow
						{#if tomorrowPlannedCount > 0}
							<span class="tabular-nums">· {tomorrowPlannedCount} set</span>
						{/if}
					</Button>
				</div>
			{/if}
		</section>
		{@render alsoToday('mt-4')}
	{/if}

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
