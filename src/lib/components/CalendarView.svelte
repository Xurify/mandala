<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { dayTitle, firstDoneMonth, monthLine, monthOf, shiftMonth, type MonthDay } from '$lib/chart/calendar';
	import { HUES, todayKey } from '$lib/chart/model';
	import Icon from './Icon.svelte';
	import Button from './ui/Button.svelte';
	import Eyebrow from './ui/Eyebrow.svelte';
	import IconButton from './ui/IconButton.svelte';
	import Pages from './ui/Pages.svelte';
	import { cn } from './ui/cn';

	const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
	/** Pips a day shows before it says how many more. */
	const SHOWN = 4;

	const now = new Date();
	let year = $state(now.getFullYear());
	let month = $state(now.getMonth());
	let direction = $state(1);
	let selected = $state<string>(todayKey());

	const current = $derived(monthOf(chart.data, year, month));
	const thisMonth = $derived(year === now.getFullYear() && month === now.getMonth());
	const earliest = $derived(firstDoneMonth(chart.data));
	/** No earlier than the first month with anything in it, or the month before this one on a fresh chart. */
	const atStart = $derived.by(() => {
		const floor = earliest ?? shiftMonth(now.getFullYear(), now.getMonth(), -1);
		return year < floor.year || (year === floor.year && month <= floor.month);
	});
	const picked = $derived(current.weeks.flat().find((day) => day.key === selected) ?? null);

	function go(by: 1 | -1): void {
		direction = by;
		({ year, month } = shiftMonth(year, month, by));
	}

	function open(day: MonthDay): void {
		if (!day.inMonth || day.future) return;
		selected = day.key;
	}

	/** Arrow keys walk the days: a column is a day, a row is a week. */
	function walk(event: KeyboardEvent): void {
		const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
		const step = steps[event.key];
		if (!step || !(event.currentTarget instanceof HTMLElement)) return;
		const days = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-day]:not(:disabled)')];
		const at = days.findIndex((day) => day === document.activeElement);
		if (at < 0) return;
		event.preventDefault();
		days[Math.max(0, Math.min(days.length - 1, at + step))]?.focus();
	}

	function clock(at: string): string {
		const [hours, minutes] = at.split(':').map(Number);
		const date = new Date(2000, 0, 1, hours ?? 0, minutes ?? 0);
		return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(' AM', ' am').replace(' PM', ' pm');
	}

	/** One geometry for the day list: a 20px mark, a 12px gap, the words, lined up with the heading. */
	const row = 'flex min-h-11 w-full min-w-0 items-center gap-3 rounded-[14px] px-3 py-1.5';
</script>

<div class="mx-auto w-full max-w-[560px] px-4 py-6 max-[900px]:px-0 max-[900px]:py-2">
	<div class="mb-5 flex items-end justify-between gap-3 px-1">
		<div class="min-w-0">
			<Eyebrow class="mb-1.5">Calendar</Eyebrow>
			<h2 class="m-0 font-serif text-[1.9rem] leading-[1.1] font-[480] tracking-[-0.025em] text-text max-[900px]:text-[1.6rem]">{current.title}</h2>
			<p class="m-0 mt-1.5 text-[0.9rem] text-muted">{monthLine(current)}</p>
		</div>
		<div class="flex shrink-0 items-center gap-1">
			<IconButton icon="chevron-left" label="Previous month" disabled={atStart} onclick={() => go(-1)} />
			<IconButton icon="chevron-right" label="Next month" disabled={thisMonth} onclick={() => go(1)} />
		</div>
	</div>

	<!-- The month: a quiet grid of numbers, a pip per thing finished, today in ink. -->
	<div class="rounded-[26px] bg-surface px-3 pt-3 pb-2 shadow-card select-none max-[900px]:rounded-3xl max-[900px]:px-2 max-[900px]:pt-2">
		<div class="grid grid-cols-7 pb-1" aria-hidden="true">
			{#each WEEKDAYS as weekday, index (index)}
				<span class="py-1 text-center text-[0.7rem] font-[620] tracking-[0.08em] text-muted">{weekday}</span>
			{/each}
		</div>
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<Pages view={current.title} {direction} label={current.title} class="overflow-x-clip">
			{#snippet page()}
				<div class="grid grid-cols-7" role="grid" tabindex="-1" aria-label={current.title} onkeydown={walk}>
					{#each current.weeks as week, rowIndex (week[0]?.key)}
						{#each week as day, columnIndex (day.key)}
							{@const quiet = !day.inMonth || day.future}
							{@const chosen = day.key === selected}
							<button
								type="button"
								role="gridcell"
								data-day={day.key}
								class={cn(
									'relative flex h-[66px] cursor-pointer flex-col items-center justify-start gap-1.5 rounded-[14px] border-0 bg-transparent px-1 pt-2 pb-1.5 font-sans text-text focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink max-[900px]:h-[58px] max-[900px]:rounded-[12px]',
									!quiet && !chosen && 'hover:bg-sunken',
									quiet && 'cursor-default',
									chosen && 'bg-sunken'
								)}
								aria-selected={chosen}
								aria-label="{dayTitle(day.key)}: {day.done.length === 0 ? 'nothing finished' : day.done.length === 1 ? '1 thing finished' : `${day.done.length} things finished`}"
								disabled={quiet}
								onclick={() => open(day)}
							>
								<span
									class={cn(
										'grid size-6 place-items-center rounded-full text-[0.82rem] leading-none font-[600] tabular-nums',
										day.today ? 'bg-ink text-on-ink' : quiet ? 'text-muted opacity-45' : 'text-text'
									)}>{day.day}</span
								>
								{#if day.inMonth && day.done.length > 0}
									<span class="flex h-2 items-center gap-[3px]">
										{#each day.done.slice(0, SHOWN) as entry, pip (entry.key)}
											<span
												class="pip size-[6px] rounded-full motion-safe:animate-stack-in"
												style:--pip-h={HUES[entry.pillarIndex]}
												style:animation-delay="{rowIndex * 40 + columnIndex * 12 + pip * 30}ms"
											></span>
										{/each}
										{#if day.done.length > SHOWN}
											<span class="ms-px text-[0.6rem] leading-none font-[620] text-muted tabular-nums">+{day.done.length - SHOWN}</span>
										{/if}
									</span>
								{/if}
							</button>
						{/each}
					{/each}
				</div>
			{/snippet}
		</Pages>
	</div>

	{#if picked}
		{#key picked.key}
			<section class="mt-4 rounded-[22px] bg-surface px-4 pt-4 pb-3 shadow-card motion-safe:animate-pop-in" aria-labelledby="calendar-day">
				<div class="flex items-baseline justify-between gap-3 pb-1.5">
					<h3 id="calendar-day" class="m-0 text-[0.98rem] leading-tight font-[620]">{picked.today ? 'Today' : dayTitle(picked.key)}</h3>
					{#if picked.done.length > 0}
						<span class="shrink-0 text-[0.8rem] text-muted tabular-nums">{picked.done.length} finished</span>
					{/if}
				</div>
				{#if picked.done.length === 0}
					<p class="m-0 mt-1 pb-1.5 text-[0.9rem] leading-snug text-pretty text-muted">{picked.today ? 'Nothing finished yet today.' : 'Nothing finished this day.'}</p>
					{#if picked.today}
						<Button class="mt-2 mb-1" size="sm" variant="soft" icon="calendar" onclick={() => chart.setViewMode('today')}>Open today</Button>
					{/if}
				{:else}
					<ul class="-mx-3 m-0 flex list-none flex-col gap-px p-0">
						{#each picked.done as entry (entry.key)}
							<li>
								<button
									type="button"
									class={cn(row, 'cursor-pointer border-0 bg-transparent text-start font-sans text-text hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink')}
									onclick={() => chart.jumpToKey(entry.key)}
								>
									<span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-surface" aria-hidden="true">
										<Icon name="check" size={12} strokeWidth={2.6} />
									</span>
									<span class="flex min-w-0 flex-1 flex-col gap-px">
										<span class="text-[0.92rem] leading-snug text-pretty">{entry.text}</span>
										<span class="flex items-center gap-1.5 text-[0.74rem] leading-tight font-[620]">
											<span class="pillar-ink truncate" style:--h={HUES[entry.pillarIndex]}>{chart.data.pillars[entry.pillarIndex]?.trim() || `Pillar ${entry.pillarIndex + 1}`}</span>
											{#if entry.milestone}
												<span class="shrink-0 rounded-full bg-sunken px-1.5 py-px text-[0.66rem] font-[620] tracking-[0.04em] text-muted uppercase">Milestone</span>
											{/if}
										</span>
									</span>
									{#if entry.at}
										<span class="shrink-0 text-[0.78rem] text-muted tabular-nums">{clock(entry.at)}</span>
									{/if}
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/key}
	{/if}
</div>
