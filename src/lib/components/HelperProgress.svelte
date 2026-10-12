<script lang="ts">
	import type { HelperStore } from '$lib/chart/helper.svelte';
	import { progressOf } from '$lib/chart/helper';
	import { HUES } from '$lib/chart/model';
	import { formatMinutes } from '$lib/chart/timer';
	import Button from './ui/Button.svelte';
	import WeekStrip from './WeekStrip.svelte';

	let { helper, reveal }: { helper: HelperStore; reveal: (key: string) => void } = $props();

	const progress = $derived(progressOf(helper.data));
	const named = $derived(helper.data.pillars.filter((pillar) => pillar.trim()).length);
	const quiet = $derived(progress.quiet.map((index) => helper.data.pillars[index]?.trim()).filter(Boolean));
	const timeTotal = $derived(progress.minutes.reduce((sum, minutes) => sum + minutes, 0));
	const timed = $derived(
		progress.minutes
			.map((minutes, pillarIndex) => ({ minutes, pillarIndex, name: helper.data.pillars[pillarIndex]?.trim() || `Pillar ${pillarIndex + 1}` }))
			.filter((row) => row.minutes > 0)
			.sort((a, b) => b.minutes - a.minutes)
	);

	function listNames(names: readonly (string | undefined)[]): string {
		if (names.length <= 1) return names[0] ?? '';
		return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
	}
</script>

<div class="flex flex-col gap-4 px-4 pt-1 pb-4">
	<WeekStrip data={helper.data} />
	<div class="-mt-2 flex justify-end">
		<Button size="sm" variant="ghost" icon="calendar" onclick={() => helper.openCalendar()}>Every day, on the calendar</Button>
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

		{#if timeTotal > 0}
			{@const longest = timed[0]?.minutes ?? 1}
			<section class="flex flex-col gap-2 rounded-[18px] bg-bg px-3 pt-2.5 pb-3" aria-labelledby="bindu-time">
				<div class="flex items-baseline justify-between gap-3">
					<h3 id="bindu-time" class="m-0 text-[0.76rem] font-normal text-muted">Time logged</h3>
					<p class="m-0 text-[1.05rem] leading-tight font-[620] tabular-nums">{formatMinutes(timeTotal)}</p>
				</div>
				<ul class="m-0 flex list-none flex-col gap-1.5 p-0">
					{#each timed as row (row.pillarIndex)}
						<li class="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_auto] items-center gap-2.5 text-[0.84rem] leading-tight">
							<span class="pillar-ink truncate font-[600]" style:--h={HUES[row.pillarIndex]}>{row.name}</span>
							<span class="h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
								<span class="pip block h-full rounded-full" style:--pip-h={HUES[row.pillarIndex]} style:width="{Math.max(4, (row.minutes / longest) * 100)}%"></span>
							</span>
							<span class="text-muted tabular-nums">{formatMinutes(row.minutes)}</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

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
