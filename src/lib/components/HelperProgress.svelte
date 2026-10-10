<script lang="ts">
	import type { HelperStore } from '$lib/chart/helper.svelte';
	import { progressOf, weekStrip } from '$lib/chart/helper';
	import { HUES } from '$lib/chart/model';
	import Button from './ui/Button.svelte';

	let { helper, reveal }: { helper: HelperStore; reveal: (key: string) => void } = $props();

	const progress = $derived(progressOf(helper.data));
	const strip = $derived(weekStrip(helper.data));
	const named = $derived(helper.data.pillars.filter((pillar) => pillar.trim()).length);
	const quiet = $derived(progress.quiet.map((index) => helper.data.pillars[index]?.trim()).filter(Boolean));
	/** Pips a day column shows before it says how many more. */
	const STACK = 7;

	function listNames(names: readonly (string | undefined)[]): string {
		if (names.length <= 1) return names[0] ?? '';
		return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
	}

	const summary = $derived(strip.map((day) => day.ticks.length).join(', '));
	/** The strip is as tall as the busiest day, so a quiet week is not a tall empty box. */
	const tallest = $derived(Math.max(3, Math.min(STACK, ...strip.map((day) => day.ticks.length))));
</script>

<div class="flex flex-col gap-4 px-4 pt-1 pb-4">
	<!-- The week as it happened: a column per day, a pip per tick, in the pillar's hue. -->
	<div
		class="rounded-[22px] bg-bg px-3.5 pt-3.5 pb-3"
		role="img"
		aria-label="Ticks in the last 7 days, oldest first: {summary}."
	>
		<div class="flex items-stretch justify-between gap-1.5" style:height="{tallest * 11 + 26}px">
			{#each strip as day, column (day.key)}
				<div class="flex min-w-0 flex-1 flex-col items-center gap-2">
					<div class="flex w-full max-w-[26px] flex-1 flex-col-reverse items-stretch gap-[3px]">
						{#each day.ticks.slice(0, STACK) as pillarIndex, row (row)}
							<span
								class="pip h-2 shrink-0 rounded-full motion-safe:animate-stack-in"
								style:--pip-h={HUES[pillarIndex]}
								style:animation-delay="{120 + column * 45 + row * 35}ms"
							></span>
						{/each}
						{#if day.ticks.length === 0}
							<span class="h-[3px] shrink-0 rounded-full bg-sunken"></span>
						{:else if day.ticks.length > STACK}
							<span class="text-center text-[0.66rem] leading-none font-[620] text-muted tabular-nums">+{day.ticks.length - STACK}</span>
						{/if}
					</div>
					<span class="text-[0.72rem] leading-none font-[620] {day.today ? 'text-text' : 'text-muted'}">{day.today ? 'Today' : day.label}</span>
				</div>
			{/each}
		</div>
	</div>

	{#if !progress.everTicked}
		<div class="flex flex-col items-start gap-3">
			<p class="m-0 text-[0.94rem] leading-snug text-pretty">
				{progress.written === 0 ? 'Nothing ticked yet. Write a few actions, then pick three for a day.' : 'Nothing ticked yet. Pick three for today and the log starts.'}
			</p>
			{#if progress.written > 0}
				<Button variant="soft" size="sm" onclick={() => helper.go('today')}>Pick today's three</Button>
			{/if}
		</div>
	{:else}
		<dl class="m-0 grid grid-cols-3 gap-2">
			<div class="flex flex-col gap-0.5 rounded-[18px] bg-bg px-3 py-2.5">
				<dt class="text-[0.76rem] text-muted">Ticks</dt>
				<dd class="m-0 text-[1.3rem] leading-tight font-[620] tabular-nums">{progress.ticks}</dd>
			</div>
			<div class="flex flex-col gap-0.5 rounded-[18px] bg-bg px-3 py-2.5">
				<dt class="text-[0.76rem] text-muted">Pillars</dt>
				<dd class="m-0 text-[1.3rem] leading-tight font-[620] tabular-nums">
					{progress.pillars.length}<span class="text-[0.9rem] font-medium text-muted">/{named}</span>
				</dd>
			</div>
			<div class="flex flex-col gap-0.5 rounded-[18px] bg-bg px-3 py-2.5">
				<dt class="text-[0.76rem] text-muted">In a row</dt>
				<dd class="m-0 text-[1.3rem] leading-tight font-[620] tabular-nums">
					{progress.streak}<span class="ms-1 text-[0.9rem] font-medium text-muted">{progress.streak === 1 ? 'day' : 'days'}</span>
				</dd>
			</div>
		</dl>

		{#if quiet.length > 0 || progress.insights.length > 0}
			<ul class="m-0 flex list-none flex-col gap-2.5 p-0">
				{#if quiet.length > 0 && quiet.length < named}
					<li class="text-[0.92rem] leading-snug text-pretty">
						{quiet.length <= 3 ? `Nothing from ${listNames(quiet)} this week.` : `${quiet.length} pillars sat out this week.`}
					</li>
				{/if}
				{#each progress.insights as insight (insight.id + (insight.key ?? insight.ref ?? ''))}
					<li class="flex flex-col items-start gap-1 text-[0.92rem] leading-snug text-pretty">
						<span>{insight.text}</span>
						{#if insight.key}
							{@const key = insight.key}
							<button
								type="button"
								class="cursor-pointer border-0 bg-transparent p-0 font-sans text-[0.82rem] font-[600] text-text underline decoration-line underline-offset-4 hover:decoration-text focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
								onclick={() => reveal(key)}
							>
								Open it
							</button>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>
