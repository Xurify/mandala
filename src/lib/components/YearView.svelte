<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import {
		dateKeyOf,
		getByKey,
		labelOfKey,
		yearActivity,
		yearStats,
		type DayActivity
	} from '$lib/chart/model';
	import Icon from './Icon.svelte';
	import { cn } from './ui/cn';

	const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	/** Same left edge every year. Day-of-year of the 1st, ignoring weekday and leap day. */
	const MONTH_LABEL_LEFT = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334].map((day) => (day / 7) * 12);
	const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
	/** Ink opacity per activity level: 0 none, 1 planned only, 2..4 checked count. */
	const LEVEL_OPACITY = [0.14, 0.32, 0.55, 0.78, 1];

	const currentYear = new Date().getFullYear();
	let year = $state(currentYear);

	const activity = $derived(yearActivity(chart.data, year));
	const stats = $derived(yearStats(chart.data, year));

	type GridDay = { key: string; date: Date } | null;

	const grid = $derived.by((): GridDay[][] => {
		const first = new Date(year, 0, 1);
		const weeks: GridDay[][] = [];
		let week: GridDay[] = Array.from({ length: first.getDay() }, () => null);
		for (const date = new Date(first); date.getFullYear() === year; date.setDate(date.getDate() + 1)) {
			week.push({ key: dateKeyOf(date), date: new Date(date) });
			if (week.length === 7) {
				weeks.push(week);
				week = [];
			}
		}
		if (week.length > 0) {
			weeks.push([...week, ...Array.from({ length: 7 - week.length }, () => null)]);
		}
		return weeks;
	});

	function levelOf(entry: DayActivity | undefined): number {
		if (!entry || (entry.focusCount === 0 && entry.checkedCount === 0)) return 0;
		if (entry.checkedCount === 0) return 1;
		return Math.min(2 + entry.checkedCount, 4);
	}

	function labelOf(entry: DayActivity | undefined): string {
		if (!entry || (entry.focusCount === 0 && entry.checkedCount === 0)) return 'No focus';
		if (entry.checkedCount === 0) return `${entry.focusCount} planned, none done`;
		return `${entry.checkedCount} of ${entry.focusCount} done`;
	}

	let selectedKey = $state<string | null>(null);

	const selectedEntries = $derived.by(() => {
		if (!selectedKey) return [];
		const log = chart.data.days?.[selectedKey];
		if (!log) return [];
		return log.focus.map((key) => ({
			key,
			text: getByKey(chart.data, key).trim(),
			pillar: labelOfKey(chart.data, key),
			isChecked: log.checked.includes(key)
		}));
	});

	function selectDay(day: GridDay): void {
		if (!day) return;
		const entry = activity.get(day.key);
		if (!entry || (entry.focusCount === 0 && entry.checkedCount === 0)) return;
		selectedKey = selectedKey === day.key ? null : day.key;
	}

	function jumpTo(key: string): void {
		chart.jumpToKey(key);
	}

	function formatDay(key: string): string {
		const date = new Date(`${key}T12:00:00`);
		return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
	}
</script>

<div class="mx-auto w-full max-w-[720px] px-4 py-6 max-[900px]:px-3 max-[900px]:py-4">
	<div class="mb-5 flex items-end justify-between gap-3">
		<div>
			<p class="text-[0.72rem] font-semibold tracking-[0.12em] text-muted uppercase">Year in focus</p>
			<h2 class="font-serif text-[1.7rem] font-[480] leading-[1.15] tracking-[-0.02em] text-text max-[900px]:text-[1.45rem]">
				{year}
			</h2>
		</div>
		<div class="flex items-center gap-1">
			<button
				type="button"
				class="inline-flex size-9 cursor-pointer items-center justify-center rounded-full border-0 p-0 text-muted hover:bg-sunken hover:text-text motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
				aria-label="Previous year"
				onclick={() => (year -= 1)}
			>
				<Icon name="chevron-left" size={15} />
			</button>
			<button
				type="button"
				class="inline-flex size-9 cursor-pointer items-center justify-center rounded-full border-0 p-0 text-muted hover:bg-sunken hover:text-text motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
				aria-label="Next year"
				disabled={year >= currentYear}
				onclick={() => (year += 1)}
			>
				<Icon name="chevron-right" size={15} />
			</button>
		</div>
	</div>

	<dl class="m-0 mb-5 grid grid-cols-3 gap-3">
		<div class="rounded-[22px] bg-surface px-4 py-3 shadow-card">
			<dt class="m-0 text-[0.72rem] font-semibold tracking-[0.1em] text-muted uppercase">Focus days</dt>
			<dd class="m-0 mt-1 font-[620] text-[1.5rem] leading-none tabular-nums text-text">{stats.daysWithFocus}</dd>
		</div>
		<div class="rounded-[22px] bg-surface px-4 py-3 shadow-card">
			<dt class="m-0 text-[0.72rem] font-semibold tracking-[0.1em] text-muted uppercase">Actions done</dt>
			<dd class="m-0 mt-1 font-[620] text-[1.5rem] leading-none tabular-nums text-text">{stats.checkedActions}</dd>
		</div>
		<div class="rounded-[22px] bg-surface px-4 py-3 shadow-card">
			<dt class="m-0 text-[0.72rem] font-semibold tracking-[0.1em] text-muted uppercase">Best streak</dt>
			<dd class="m-0 mt-1 flex items-baseline gap-0.5 font-[620] text-[1.5rem] leading-none tabular-nums text-text">
				{stats.bestStreak}<span class="text-[0.9rem] font-medium text-muted">d</span>
			</dd>
		</div>
	</dl>

	<div class="overflow-x-auto pb-1">
		<div class="grid min-w-[640px] grid-cols-[14px_minmax(0,1fr)] gap-x-[2px] gap-y-1">
			<div></div>
			<div class="relative h-3.5" aria-hidden="true">
				{#each MONTH_NAMES as name, month (name)}
					<span
						class="absolute top-0 whitespace-nowrap text-[0.66rem] font-semibold leading-none text-muted"
						style:left="{MONTH_LABEL_LEFT[month]}px">{name}</span>
				{/each}
			</div>
			<div class="flex flex-col gap-[2px]" aria-hidden="true">
				{#each WEEKDAY_LABELS as weekday, weekdayIndex (weekdayIndex)}
					<span class="flex h-[10px] items-center text-[0.62rem] font-medium leading-none text-muted">{weekday}</span>
				{/each}
			</div>
			<div class="flex gap-[2px]">
				{#each grid as week, weekIndex (weekIndex)}
					<div class="flex shrink-0 flex-col gap-[2px]">
						{#each week as day, dayIndex (dayIndex)}
							{@const entry = day ? activity.get(day.key) : undefined}
							{@const level = levelOf(entry)}
							{@const isSelected = day !== null && selectedKey === day.key}
							<button
								type="button"
								class="size-[10px] shrink-0 cursor-pointer rounded-[2.5px] border-0 p-0 motion-safe:transition-[transform] motion-safe:duration-150 {level === 0
									? 'bg-sunken'
									: 'bg-ink'} {isSelected && 'ring-2 ring-ink ring-offset-1 ring-offset-bg'} hover:scale-125 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink disabled:cursor-default"
								style:opacity={level === 0 ? 1 : LEVEL_OPACITY[level]}
								aria-label={day ? `${formatDay(day.key)}: ${labelOf(entry)}` : undefined}
								title={day ? `${formatDay(day.key)}: ${labelOf(entry)}` : undefined}
								aria-pressed={isSelected}
								disabled={day === null || level === 0}
								onclick={() => selectDay(day)}
							></button>
						{/each}
					</div>
				{/each}
			</div>
		</div>
	</div>

	{#if selectedKey}
		<div class="mt-5 rounded-[22px] bg-surface p-4 shadow-card">
			<p class="text-[0.72rem] font-semibold tracking-[0.12em] text-muted uppercase">{formatDay(selectedKey)}</p>
			<ul class="mt-2.5 flex list-none flex-col gap-1.5 p-0">
				{#each selectedEntries as entry (entry.key)}
					<li>
						<button
							type="button"
							class="flex w-full cursor-pointer items-center gap-3 rounded-[14px] border-0 px-3.5 py-2.5 text-left bg-sunken hover:bg-sunken-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
							onclick={() => jumpTo(entry.key)}
						>
							<span
								class={cn(
									'flex size-5 shrink-0 items-center justify-center rounded-full',
									entry.isChecked ? 'bg-success text-surface' : 'bg-transparent'
								)}
								aria-hidden="true"
							>
								{#if entry.isChecked}
									<Icon name="check" size={11} strokeWidth={2.5} />
								{/if}
							</span>
							<span class="min-w-0 flex-1 truncate text-[0.88rem] font-medium text-text" class:line-through={entry.isChecked} class:text-muted={entry.isChecked}>
								{entry.text}
							</span>
							<span class="shrink-0 text-[0.72rem] text-muted">{entry.pillar}</span>
						</button>
					</li>
				{/each}
			</ul>
			<p class="mt-2.5 text-[0.78rem] text-muted">Tap an action to edit it in the chart.</p>
		</div>
	{/if}
</div>
