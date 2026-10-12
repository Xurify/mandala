<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { HUES } from '$lib/chart/model';
	import { elapsedMs, formatMinutes, timerLabel } from '$lib/chart/timer';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';
	import SegmentedControl from './ui/SegmentedControl.svelte';
	import { cn } from './ui/cn';
	import { textField } from './ui/styles';

	const CHOICES = [15, 30, 45, 60];
	const MAX_MINUTES = 12 * 60;

	let minutes = $state(30);
	let typed = $state('');

	const asking = $derived(chart.loggingTime);
	const key = $derived(asking?.key ?? '');
	const forgotten = $derived(asking?.forgotten);
	const pillarIndex = $derived(key ? Number(key[1]) : 0);
	const pillarName = $derived(chart.data.pillars[pillarIndex]?.trim() || `Pillar ${pillarIndex + 1}`);
	const text = $derived(key ? timerLabel(chart.data, { key, since: 0 }) : '');
	const chosen = $derived(typed.trim() ? Math.round(Number(typed)) : minutes);
	const valid = $derived(Number.isFinite(chosen) && chosen >= 1 && chosen <= MAX_MINUTES);

	let seen: typeof asking = null;
	$effect(() => {
		if (asking === seen) return;
		seen = asking;
		typed = '';
		minutes = 30;
	});

	function startedAt(since: number): string {
		return new Date(since)
			.toLocaleTimeString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
			.replace(' AM', ' am')
			.replace(' PM', ' pm');
	}

	function save(): void {
		if (!valid || !key) return;
		chart.logTime(key, chosen);
	}
</script>

<Dialog
	bind:open={() => asking !== null, (value) => {
		if (!value) chart.loggingTime = null;
	}}
	title={forgotten ? 'How long did it take?' : 'Log time'}
	description={forgotten ? `The stopwatch ran ${formatMinutes(Math.floor(elapsedMs(forgotten, Date.now()) / 60_000))}, from ${startedAt(forgotten.since)}.` : 'Time you spent away from the app.'}
	size="sm"
>
	<form
		class="flex flex-col gap-4"
		onsubmit={(event) => {
			event.preventDefault();
			save();
		}}
	>
		<div class="flex min-h-[52px] items-center gap-3 rounded-[16px] bg-sunken px-3 py-2">
			<span class="pip size-2 shrink-0 rounded-full" style:--pip-h={HUES[pillarIndex]} aria-hidden="true"></span>
			<span class="min-w-0">
				<span class="block text-[0.95rem] leading-snug font-medium text-pretty text-text">{text}</span>
				<span class="pillar-ink mt-0.5 block text-[0.74rem] leading-tight font-[620]" style:--h={HUES[pillarIndex]}>{pillarName}</span>
			</span>
		</div>
		<div class="flex flex-wrap items-center gap-x-3 gap-y-2.5">
			<SegmentedControl
				label="Minutes"
				options={CHOICES.map((choice) => ({ value: String(choice), label: `${choice} min` }))}
				value={typed.trim() ? '' : String(minutes)}
				onchange={(value) => {
					minutes = Number(value);
					typed = '';
				}}
			/>
			<label class="flex items-center gap-2 text-[0.88rem] text-muted">
				<span>Or</span>
				<input
					class={cn(textField, 'w-24 text-end tabular-nums')}
					type="number"
					inputmode="numeric"
					min="1"
					max={MAX_MINUTES}
					placeholder="90"
					aria-label="Minutes"
					value={typed}
					oninput={(event) => (typed = event.currentTarget.value)}
				/>
				<span>min</span>
			</label>
		</div>
	</form>
	{#snippet footer()}
		{#if forgotten}
			<Button variant="ghost" class="me-auto" onclick={() => chart.discardTimer()}>Don't log it</Button>
		{/if}
		<Button variant="ghost" onclick={() => (chart.loggingTime = null)}>Cancel</Button>
		<Button disabled={!valid} onclick={save}>Log {valid ? formatMinutes(chosen) : 'time'}</Button>
	{/snippet}
</Dialog>
