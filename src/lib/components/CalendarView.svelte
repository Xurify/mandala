<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { dayTitle, firstDoneMonth, lastDoneDay, monthLine, monthOf, openedOn, shiftMonth, type Goal, type GoalDone, type MonthDay } from '$lib/chart/calendar';
	import { HUES, pillarOfAction, todayKey, wordsOf, type ActionId } from '$lib/chart/model';
	import { arcPath, pillarArc } from '$lib/chart/ring';
	import { formatMinutes, sessionsOn } from '$lib/chart/timer';
	import { toolInChart } from '$lib/chart/tools';
	import Icon from './Icon.svelte';
	import ToolFace from './ToolFace.svelte';
	import Button from './ui/Button.svelte';
	import IconButton from './ui/IconButton.svelte';
	import Eyebrow from './ui/Eyebrow.svelte';
	import Pages from './ui/Pages.svelte';
	import { cn } from './ui/cn';

	const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
	const VIEW = 100;
	const CENTER = VIEW / 2;
	const GEOMETRY = { radius: 44, stroke: 9, gap: 9 };
	const ARCS = HUES.map((hue, pillarIndex) => {
		const { start, end } = pillarArc(pillarIndex, GEOMETRY);
		return { hue, pillarIndex, path: arcPath(CENTER, CENTER, GEOMETRY.radius, start, end) };
	});

	const now = new Date();
	const today = todayKey();
	let year = $state(now.getFullYear());
	let month = $state(now.getMonth());
	let direction = $state(1);
	let selected = $state<string>(today);
	const inScope = $derived.by((): Goal[] => {
		const chosen = chart.goals.filter((goal) => goal.id === chart.calendarScope);
		return chosen.length > 0 ? chosen : chart.goals;
	});
	const across = $derived(inScope.length > 1);
	const current = $derived(monthOf(inScope, year, month));
	const days = $derived(current.weeks.flat());
	const thisMonth = $derived(year === now.getFullYear() && month === now.getMonth());
	const earliest = $derived(firstDoneMonth(inScope));
	const atStart = $derived(earliest === null || year < earliest.year || (year === earliest.year && month <= earliest.month));
	const turnable = $derived(!atStart || !thisMonth);
	const selectedDay = $derived(days.find((day) => day.inMonth && day.key === selected));
	const fallbackKey = $derived(thisMonth ? today : lastDoneDay(current));
	const picked = $derived(selectedDay ?? days.find((day) => day.key === fallbackKey) ?? null);
	const groups = $derived(
		picked
			? inScope
					.map((goal) => ({
						goal,
						done: picked.done.filter((entry) => entry.goal === goal.id),
						sessions: sessionsOn(goal.data, picked.key),
						opened: openedOn(goal.data, picked.key)
					}))
					.filter((group) => group.done.length > 0 || group.sessions.length > 0 || group.opened.length > 0)
			: []
	);
	const tally = $derived(
		across && current.finishedCount > 0
			? current.byGoal.flatMap(({ goal, finished }) => {
					const found = inScope.find((each) => each.id === goal);
					return found ? [{ goal: found, finished }] : [];
				})
			: []
	);
	const outside = $derived.by(() => {
		const others = chart.goals.filter((goal) => !inScope.includes(goal));
		return others.length > 0 ? monthOf(others, year, month).finishedCount : 0;
	});

	function pillarName(goal: Goal, pillarIndex: number): string {
		return goal.data.pillars[pillarIndex]?.trim() || `Pillar ${pillarIndex + 1}`;
	}

	function openToday(): void {
		const only = inScope.length === 1 ? inScope[0]! : null;
		if (only && only.id !== chart.activeId) chart.switchChart(only.id);
		chart.setViewMode('today');
	}

	function openAction(goal: Goal, action: ActionId): void {
		if (goal.id !== chart.activeId) chart.switchChart(goal.id);
		chart.jumpToKey(action);
	}

	function openEntry(entry: GoalDone): void {
		if (entry.goal !== chart.activeId) chart.switchChart(entry.goal);
		chart.jumpToKey(entry.id);
	}

	function go(by: 1 | -1): void {
		direction = by;
		({ year, month } = shiftMonth(year, month, by));
	}

	function open(day: MonthDay): void {
		if (day.future) return;
		selected = day.key;
	}

	function walk(event: KeyboardEvent): void {
		const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
		const step = steps[event.key];
		if (!step || !(event.currentTarget instanceof HTMLElement)) return;
		const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-day]:not(:disabled)')];
		const at = buttons.findIndex((button) => button === document.activeElement);
		if (at < 0) return;
		event.preventDefault();
		buttons[Math.max(0, Math.min(buttons.length - 1, at + step))]?.focus();
	}

	function clock(at: string): string {
		const [hours, minutes] = at.split(':').map(Number);
		const date = new Date(2000, 0, 1, hours ?? 0, minutes ?? 0);
		return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(' AM', ' am').replace(' PM', ' pm');
	}

	function spoken(day: MonthDay): string {
		const count = day.done.length;
		const goals = across && day.goals.length > 1 ? `, ${day.goals.length} goals` : '';
		const time = day.minutes > 0 ? `, ${formatMinutes(day.minutes)} logged` : '';
		return `${dayTitle(day.key)}: ${count === 0 ? 'nothing finished' : count === 1 ? '1 thing finished' : `${count} things finished`}${goals}${time}`;
	}
</script>

<div class="mx-auto w-full max-w-[520px] px-4 pb-6 max-[900px]:px-0 max-[900px]:pb-2">
	<section class="rounded-[28px] bg-surface p-2 shadow-card select-none max-[900px]:rounded-3xl" aria-labelledby="calendar-month">
		<header class="flex items-center gap-2 pt-2 pb-1 ps-4 pe-0.5">
			<div class="min-w-0 flex-1">
				<h2 id="calendar-month" class="m-0 font-serif text-[1.45rem] leading-tight font-[540] tracking-[-0.01em] text-text">{current.title}</h2>
				<p class="m-0 mt-0.5 text-[0.86rem] text-muted">{monthLine(current)}</p>
				{#if outside > 0}
					<p class="m-0 mt-0.5 text-[0.86rem] text-pretty text-muted">
						{outside} more in your other charts.
						<button
							type="button"
							class="cursor-pointer border-0 bg-transparent p-0 font-sans text-[0.86rem] font-[600] text-text underline decoration-line underline-offset-4 hover:decoration-text focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
							onclick={() => (chart.calendarScope = 'all')}
						>
							Show all charts
						</button>
					</p>
				{/if}
			</div>
			{#if turnable}
				<div class="flex shrink-0 items-center">
					<IconButton icon="chevron-left" label="Previous month" disabled={atStart} onclick={() => go(-1)} />
					<IconButton icon="chevron-right" label="Next month" disabled={thisMonth} onclick={() => go(1)} />
				</div>
			{/if}
		</header>

		<div class="mt-2 grid grid-cols-7" aria-hidden="true">
			{#each WEEKDAYS as weekday, index (index)}
				<span class="py-1 text-center text-[0.7rem] font-[620] tracking-[0.08em] text-muted">{weekday}</span>
			{/each}
		</div>
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<Pages view={current.title} {direction} label={current.title} class="overflow-x-clip">
			{#snippet page()}
				<div class="flex flex-col gap-y-0.5" role="grid" tabindex="-1" aria-label={current.title} onkeydown={walk}>
					{#each current.weeks as week, rowIndex (week[0]?.key)}
						<div class="grid grid-cols-7" role="row">
							{#each week as day, columnIndex (day.key)}
								{#if !day.inMonth}
									<span class="h-12" aria-hidden="true"></span>
								{:else}
									{@const chosen = day.key === picked?.key}
									<button
										type="button"
										role="gridcell"
										data-day={day.key}
										class={cn(
											'grid h-12 cursor-pointer place-items-center rounded-[14px] border-0 bg-transparent p-0 font-sans focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink',
											day.future ? 'cursor-default' : !chosen && 'hover:bg-sunken',
											chosen && 'bg-sunken'
										)}
										aria-selected={chosen}
										aria-label={spoken(day)}
										disabled={day.future}
										onclick={() => open(day)}
									>
										{#if across}
											{#if day.goals.length > 0}
												<span class="flex gap-[3px] self-end pb-[3px] [grid-area:1/1]" aria-hidden="true">
													{#each day.goals as goal, order (goal)}
														<span class="size-[5px] rounded-full bg-ink motion-safe:animate-pop-in" style:animation-delay="{rowIndex * 50 + columnIndex * 15 + order * 40}ms"></span>
													{/each}
												</span>
											{/if}
										{:else if day.pillars.length > 0}
											<svg class="size-[42px] overflow-visible [grid-area:1/1]" viewBox="0 0 {VIEW} {VIEW}" aria-hidden="true">
												{#each ARCS as arc (arc.pillarIndex)}
													{@const order = day.pillars.indexOf(arc.pillarIndex)}
													{#if order < 0}
														<path class="ring-track fill-none stroke-[9] [stroke-linecap:round]" d={arc.path} style:--h={arc.hue} />
													{:else}
														<path
															class="pillar-stroke fill-none stroke-[9] [stroke-dasharray:1] [stroke-linecap:round] motion-safe:animate-seal-draw"
															d={arc.path}
															pathLength="1"
															style:--h={arc.hue}
															style:animation-delay="{rowIndex * 50 + columnIndex * 15 + order * 40}ms"
														/>
													{/if}
												{/each}
											</svg>
										{/if}
										<span
											class={cn(
												'grid size-6 place-items-center rounded-full text-[0.84rem] leading-none tabular-nums [grid-area:1/1]',
												day.today
													? 'bg-ink font-[650] text-on-ink'
													: day.future
														? 'font-[560] text-muted opacity-45'
														: day.done.length > 0
															? 'font-[650] text-text'
															: 'font-[560] text-muted'
											)}>{day.day}</span
										>
									</button>
								{/if}
							{/each}
						</div>
					{/each}
				</div>
			{/snippet}
		</Pages>

		{#if picked}
			{#key picked.key}
				<section
					class="mt-2 rounded-[20px] bg-bg p-1.5 motion-safe:animate-pop-in max-[900px]:rounded-[16px]"
					aria-labelledby="calendar-day"
				>
					<div class="flex items-baseline justify-between gap-3 px-2.5 pt-2 pb-1">
						<h3 id="calendar-day" class="m-0 text-[0.95rem] leading-tight font-[620] text-text">{picked.today ? 'Today' : dayTitle(picked.key)}</h3>
						{#if picked.done.length > 0}
							<span class="shrink-0 text-[0.8rem] text-muted tabular-nums">{picked.done.length} finished</span>
						{/if}
					</div>
					{#if picked.done.length === 0}
						<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-2.5 pb-2">
							<p class="m-0 text-[0.9rem] leading-snug text-pretty text-muted">{picked.today ? 'Nothing finished yet today.' : 'Nothing finished this day.'}</p>
							{#if picked.today}
								<Button size="sm" variant="soft" icon="calendar" onclick={openToday}>Open today</Button>
							{/if}
						</div>
					{/if}
					{#each groups as group, groupIndex (group.goal.id)}
						{#if across}
							<h4 class="m-0 flex min-w-0 items-center gap-2 px-2.5 pt-2.5 pb-1 text-[0.8rem] leading-tight font-[620] text-muted">
								<span class="size-[5px] shrink-0 rounded-full bg-ink" aria-hidden="true"></span>
								<span class="truncate">{group.goal.title}</span>
							</h4>
						{/if}
						{#if group.done.length > 0}
							<ul class="m-0 flex list-none flex-col gap-px p-0">
								{#each group.done as entry, index (entry.id)}
									<li class="motion-safe:animate-pop-in" style:animation-delay="{(groupIndex * 2 + index) * 45}ms">
										<button
											type="button"
											class="flex min-h-11 w-full min-w-0 cursor-pointer items-center gap-3 rounded-[14px] border-0 bg-transparent px-2.5 py-1.5 text-start font-sans text-text select-text hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink max-[900px]:rounded-[10px]"
											onclick={() => openEntry(entry)}
										>
											<span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-surface" aria-hidden="true">
												<Icon name="check" size={12} strokeWidth={2.6} />
											</span>
											<span class="flex min-w-0 flex-1 flex-col gap-px">
												<span class="text-[0.92rem] leading-snug text-pretty">{entry.text}</span>
												<span class="flex items-center gap-1.5 text-[0.74rem] leading-tight font-[620]">
													<span class="pillar-ink truncate" style:--h={HUES[entry.pillarIndex]}>{pillarName(group.goal, entry.pillarIndex)}</span>
													{#if entry.milestone}
														<span class="shrink-0 rounded-full bg-sunken px-1.5 py-px text-[0.68rem] font-[620] text-muted">Milestone</span>
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
						{#if group.sessions.length > 0}
							<div class="flex items-baseline justify-between gap-3 px-2.5 pt-3 pb-1">
								<h5 class="m-0 flex items-center gap-1.5 text-[0.84rem] leading-tight font-[620] text-muted"><Icon name="clock" size={14} />Time logged</h5>
								<span class="shrink-0 text-[0.8rem] text-muted tabular-nums">{formatMinutes(group.sessions.reduce((sum, session) => sum + session.minutes, 0))}</span>
							</div>
							<ul class="m-0 flex list-none flex-col gap-px p-0">
								{#each group.sessions as session, index (`${session.action}-${session.at}-${index}`)}
									{@const pillarIndex = pillarOfAction(group.goal.data, session.action) ?? 0}
									{@const text = wordsOf(group.goal.data, session.action) || 'A line since removed'}
									{@const tool = session.link ? toolInChart(group.goal.data, session.link)?.tool : null}
									<li class="flex items-center gap-0.5 motion-safe:animate-pop-in" style:animation-delay="{(groupIndex * 2 + group.done.length + index) * 45}ms">
										<button
											type="button"
											class="flex min-h-11 w-full min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-[14px] border-0 bg-transparent px-2.5 py-1.5 text-start font-sans text-text select-text hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink max-[900px]:rounded-[10px]"
											onclick={() => openAction(group.goal, session.action)}
										>
											<span class="grid size-5 shrink-0 place-items-center" aria-hidden="true">
												<span class="pip size-2 rounded-full" style:--pip-h={HUES[pillarIndex]}></span>
											</span>
											<span class="flex min-w-0 flex-1 flex-col gap-px">
												<span class="text-[0.92rem] leading-snug text-pretty">
													{text}
													{#if tool}
														<span class="font-normal text-muted"> · {tool.title}</span>
													{/if}
												</span>
												<span class="flex min-w-0 items-center gap-1.5 text-[0.74rem] leading-tight">
													<span class="pillar-ink truncate font-[620]" style:--h={HUES[pillarIndex]}>{pillarName(group.goal, pillarIndex)}</span>
													<span class="shrink-0 text-muted tabular-nums">from {clock(session.at)}</span>
												</span>
											</span>
											<span class="shrink-0 text-[0.86rem] font-[620] whitespace-nowrap text-text tabular-nums">{formatMinutes(session.minutes)}</span>
										</button>
										{#if group.goal.id === chart.activeId}
											<IconButton
												icon="close"
												label="Remove {formatMinutes(session.minutes)} on {text}{tool ? ` (${tool.title})` : ''}"
												class="size-9 shrink-0 text-muted hover:text-text coarse:size-11"
												onclick={() => chart.removeTime(picked.key, session.action, session)}
											/>
										{/if}
									</li>
								{/each}
							</ul>
						{/if}
						{#if group.opened.length > 0}
							<div class="flex items-baseline justify-between gap-3 px-2.5 pt-3 pb-1">
								<h5 class="m-0 flex items-center gap-1.5 text-[0.84rem] leading-tight font-[620] text-muted"><Icon name="shelf" size={14} />Opened from the shelf</h5>
								<span class="shrink-0 text-[0.8rem] text-muted tabular-nums">{group.opened.length}</span>
							</div>
							<ul class="m-0 flex list-none flex-col gap-px p-0">
								{#each group.opened as entry, index (entry.tool.id)}
									<li class="motion-safe:animate-pop-in" style:animation-delay="{(groupIndex * 2 + group.done.length + index) * 45}ms">
										<a
											href={entry.tool.url}
											target="_blank"
											rel="noopener noreferrer"
											class="flex min-h-11 min-w-0 items-center gap-3 rounded-[14px] px-2.5 py-1.5 text-text no-underline hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink max-[900px]:rounded-[10px]"
											onclick={() => {
												if (group.goal.id === chart.activeId) chart.openTool(entry.pillarIndex, entry.tool.id);
											}}
										>
											<ToolFace tool={entry.tool} class="min-w-0 flex-1" />
											<span class="pip size-2 shrink-0 rounded-full" style:--pip-h={HUES[entry.pillarIndex]} title={pillarName(group.goal, entry.pillarIndex)} aria-hidden="true"></span>
											<span class="sr-only">, {pillarName(group.goal, entry.pillarIndex)}</span>
										</a>
									</li>
								{/each}
							</ul>
						{/if}
					{/each}
				</section>
			{/key}
		{/if}

		{#if tally.length > 1}
			<section class="mt-3 px-0.5 pb-0.5" aria-labelledby="calendar-goals">
				<Eyebrow class="px-2.5 pb-1"><span id="calendar-goals">Goals this month</span></Eyebrow>
				<ul class="m-0 flex list-none flex-col gap-px p-0">
					{#each tally as row (row.goal.id)}
						<li>
							<button
								type="button"
								class="flex min-h-11 w-full min-w-0 cursor-pointer items-center gap-3 rounded-[14px] border-0 bg-transparent px-2.5 py-1.5 text-start font-sans hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink max-[900px]:rounded-[10px]"
								aria-label="{row.goal.title}: {row.finished > 0 ? `${row.finished} finished` : 'nothing finished yet'}. Show only this chart"
								onclick={() => (chart.calendarScope = row.goal.id)}
							>
								<span class={cn('size-[7px] shrink-0 rounded-full', row.finished > 0 ? 'bg-ink' : 'shadow-[inset_0_0_0_1.5px_var(--muted)]')} aria-hidden="true"></span>
								<span class={cn('min-w-0 flex-1 truncate text-[0.9rem]', row.finished > 0 ? 'font-[560] text-text' : 'text-muted')}>{row.goal.title}</span>
								<span class="shrink-0 text-[0.8rem] text-muted tabular-nums">{row.finished > 0 ? `${row.finished} finished` : 'Nothing yet'}</span>
							</button>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</section>
</div>
