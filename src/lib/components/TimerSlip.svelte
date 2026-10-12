<script lang="ts">
	import { tick } from 'svelte';
	import { chart } from '$lib/chart/chart.svelte';
	import { chime, readyChime } from '$lib/chart/chime';
	import { HUES, pillarOfAction, type ActionId } from '$lib/chart/model';
	import { finishedOn } from '$lib/chart/board';
	import {
		BLOCK_MINUTES,
		BREAK_MINUTES,
		clockFace,
		elapsedMs,
		formatMinutes,
		isOver,
		remainingMs,
		ringShare,
		actionLabel
	} from '$lib/chart/timer';
	import TimerRing from './TimerRing.svelte';
	import Button from './ui/Button.svelte';
	import Eyebrow from './ui/Eyebrow.svelte';
	import IconButton from './ui/IconButton.svelte';
	import { cn } from './ui/cn';
	import { slipOut } from './ui/motion';

	const LEAVE_MS = 680;
	const STAY_MS = 6000;
	/** A block that ran out longer ago than this ended while the page was shut, so it ends without a sound. */
	const LATE_MS = 60_000;

	let now = $state(Date.now());
	let held = $state(false);
	let leaving = $state(false);
	/** The action a break follows, so the end of the break can offer the next block. Forgotten on reload. */
	let breakAfter = $state<ActionId | null>(null);
	let slip = $state<HTMLElement | null>(null);

	const timer = $derived(chart.timer);
	const end = $derived(chart.timerEnd);
	const hueOf = (action: ActionId | undefined): number | undefined => {
		const pillar = action ? pillarOfAction(chart.data, action) : null;
		return pillar === null ? undefined : HUES[pillar];
	};
	const remaining = $derived(timer ? remainingMs(timer, now) : null);
	const face = $derived(timer ? clockFace(remaining === null ? elapsedMs(timer, now) : Math.ceil(remaining / 1000) * 1000) : '');
	const minutesIn = $derived(timer ? Math.floor(elapsedMs(timer, now) / 60_000) : 0);
	const nextLabel = $derived(breakAfter ? actionLabel(chart.data, breakAfter) : '');
	const label = $derived(!timer ? '' : timer.action ? actionLabel(chart.data, timer.action) : nextLabel ? `Then ${nextLabel}` : 'Away from the screen');
	const kicker = $derived(!timer ? '' : !timer.action ? `Break · ${timer.length} min` : timer.length ? `Focus block · ${timer.length} min` : 'Stopwatch');
	const spoken = $derived.by(() => {
		if (!timer) return '';
		if (remaining === null) return `${minutesIn === 1 ? '1 minute' : `${minutesIn} minutes`} so far`;
		const left = Math.ceil(remaining / 60_000);
		return `${left === 1 ? '1 minute' : `${left} minutes`} left`;
	});
	const endLabel = $derived(end?.action ? actionLabel(chart.data, end.action) : '');
	const ticked = $derived(end?.action ? finishedOn(chart.data, end.action, chart.today) : false);

	$effect(() => {
		if (!timer) return;
		now = Date.now();
		const wake = (): void => {
			now = Date.now();
		};
		const interval = setInterval(wake, 1000);
		document.addEventListener('visibilitychange', wake);
		// After a reload no tap has readied the sound yet, so the next one anywhere does.
		window.addEventListener('pointerdown', readyChime, { once: true });
		window.addEventListener('keydown', readyChime, { once: true });
		return () => {
			clearInterval(interval);
			document.removeEventListener('visibilitychange', wake);
			window.removeEventListener('pointerdown', readyChime);
			window.removeEventListener('keydown', readyChime);
		};
	});

	// Any open tab may end it; each writes the same session, and the copies reconcile to one.
	$effect(() => {
		if (!timer || !isOver(timer, now)) return;
		const endsAt = timer.since + (timer.length ?? 0) * 60_000;
		const ended = chart.finishTimer();
		if (ended && Date.now() - endsAt < LATE_MS) chime();
	});

	let baseTitle = '';
	$effect(() => {
		if (!timer) {
			if (baseTitle) document.title = baseTitle;
			baseTitle = '';
			return;
		}
		baseTitle ||= document.title;
		document.title = `${face} · ${timer.action ? label : "Break"}`;
	});

	// Only the word after a stop leaves on its own. The end of a block waits, since the person may be away.
	$effect(() => {
		leaving = false;
		if (!end || end.kind !== 'stopped' || timer || held) return;
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const fade = setTimeout(() => (leaving = !reduce), STAY_MS - LEAVE_MS);
		const gone = setTimeout(() => chart.dismissTimerEnd(), STAY_MS);
		return () => {
			clearTimeout(fade);
			clearTimeout(gone);
		};
	});

	async function stop(): Promise<void> {
		chart.stopTimer();
		await tick();
		slip?.querySelector<HTMLElement>('[data-next]')?.focus();
	}

	function tickIt(): void {
		if (end?.action && !ticked) chart.finish(end.action);
	}

	function takeBreak(): void {
		readyChime();
		breakAfter = end?.action ?? null;
		chart.startBreak(BREAK_MINUTES);
	}

	function nextBlock(): void {
		if (!breakAfter) return;
		readyChime();
		chart.startTimer(breakAfter, BLOCK_MINUTES);
		breakAfter = null;
	}

	function close(): void {
		breakAfter = null;
		chart.dismissTimerEnd();
	}
</script>

{#if timer || end}
	<div
		bind:this={slip}
		class="@container pointer-events-auto w-[min(25rem,calc(100vw-2rem))] print:hidden"
		role="group"
		aria-label="Timer"
		out:slipOut={{ duration: 600 }}
		onmouseenter={() => (held = true)}
		onmouseleave={() => (held = false)}
		onfocusin={() => (held = true)}
		onfocusout={() => (held = false)}
	>
		<div
			class={cn(
				'flex flex-wrap items-center gap-1 rounded-[22px] bg-surface p-1.5 shadow-float motion-safe:animate-sheet-in transition-[opacity,translate] ease-[cubic-bezier(0.33,0,0.2,1)]',
				leaving && 'opacity-0 motion-safe:-translate-y-2'
			)}
			style:transition-duration="{LEAVE_MS}ms"
		>
			{#if timer}
				<button
					type="button"
					class="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-[16px] border-0 bg-transparent py-1 ps-1 pe-2.5 text-start font-sans text-text hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink"
					aria-label="{label}, {spoken}. Open today"
					onclick={() => chart.setViewMode('today')}
				>
					<TimerRing share={ringShare(timer, now)} hue={hueOf(timer.action)} class="size-10" />
					<!-- A phone's slip is too narrow for the name beside the time, so the time goes on top of the name. -->
					<span class="flex min-w-0 flex-1 flex-col gap-0.5">
						<Eyebrow class="@max-[21rem]:hidden">{kicker}</Eyebrow>
						<span class="hidden text-[1.15rem] leading-none font-[620] tracking-[-0.02em] tabular-nums @max-[21rem]:block">{face}</span>
						<span class="truncate text-[0.94rem] leading-tight font-medium @max-[21rem]:text-[0.86rem] @max-[21rem]:text-muted">{label}</span>
					</span>
					<span class="shrink-0 text-[1.15rem] leading-none font-[620] tracking-[-0.02em] tabular-nums @max-[21rem]:hidden">{face}</span>
				</button>
				<IconButton
					icon="stop"
					label={!timer.action ? 'End the break' : timer.length ? 'Stop the block' : 'Stop the stopwatch'}
					class="shrink-0"
					onclick={stop}
				/>
			{:else if end}
				{@const sentence =
					end.kind === 'break'
						? nextLabel || 'Ready when you are.'
						: end.minutes > 0
							? `${formatMinutes(end.minutes)} on ${endLabel}.`
							: 'Under a minute, so nothing was logged.'}
				{#key end.id}
					<div class="flex min-w-0 flex-1 items-center gap-2.5 py-1 ps-1 pe-1" role="status">
						<TimerRing share={1} hue={hueOf(end.kind === 'break' ? undefined : end.action)} done play class="size-10" />
						<span class="flex min-w-0 flex-1 flex-col gap-0.5 motion-safe:animate-done-in motion-safe:[animation-delay:0.5s]">
							<Eyebrow>{end.kind === 'block' ? 'Block done' : end.kind === 'break' ? "Break's over" : end.minutes > 0 ? 'Logged' : 'Stopped'}</Eyebrow>
							<span class="line-clamp-2 text-[0.94rem] leading-tight font-medium text-pretty">{sentence}</span>
						</span>
					</div>
				{/key}
				{#if end.kind !== 'stopped'}
					<IconButton icon="close" label="Close" class="size-9 shrink-0 self-start" onclick={close} />
				{/if}
				{#if end.kind === 'block' || (end.kind === 'stopped' && end.minutes > 0) || breakAfter}
					<!-- Under the words, lined up with them: the ring, its gap, and the row's inset. -->
					<div class="flex basis-full flex-wrap items-center gap-1 ps-[54px] pb-1 motion-safe:animate-done-in motion-safe:[animation-delay:0.65s]">
						{#if end.kind === 'block'}
							<Button size="sm" variant="soft" data-next onclick={takeBreak}>Take {BREAK_MINUTES}</Button>
						{:else if end.kind === 'break'}
							<Button size="sm" variant="soft" data-next onclick={nextBlock}>Another {BLOCK_MINUTES}</Button>
						{/if}
						{#if end.kind !== 'break'}
							<Button
								size="sm"
								variant={end.kind === 'block' ? 'ghost' : 'soft'}
								icon={ticked ? 'check' : undefined}
								disabled={ticked}
								data-next={end.kind === 'stopped' ? true : undefined}
								onclick={tickIt}
							>
								{ticked ? 'Ticked' : 'Tick it'}
							</Button>
						{/if}
					</div>
				{/if}
			{/if}
		</div>
	</div>
{/if}
