<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onDestroy } from 'svelte';
	import { HUES } from '$lib/chart/model';
	import { arcPath, pillarArc } from '$lib/chart/ring';
	import Button from '$lib/components/ui/Button.svelte';
	import { cn } from '$lib/components/ui/cn';
	import { slipOut } from '$lib/components/ui/motion';
	import ToastSlip from '$lib/components/ui/ToastSlip.svelte';
	import { dock } from '$lib/components/ui/styles';

	type Demo = { id: number; kicker: string; subject: string; count: number; undo: boolean };

	const NAME = 'More organized life';
	const LONG = 'Run a half marathon in under 2:00 by October and keep running after';

	const segments = HUES.map((hue, pillar) => {
		const { start, end } = pillarArc(pillar, { radius: 34, stroke: 9, gap: 8 });
		return { hue, d: arcPath(50, 50, 34, start, end) };
	});
	const dockBar = dock().bar();

	let seq = 2;
	let demo = $state<Demo | null>({ id: 2, kicker: 'Duplicated', subject: NAME, count: 3, undo: false });
	let timers = $state(false);
	let story: ReturnType<typeof setTimeout>[] = [];
	let expiry: ReturnType<typeof setTimeout> | null = null;
	let until = $state(0);
	let remaining = 0;
	let held = $state(false);

	const life = $derived(timers && demo ? (demo.undo ? 8000 : 5000) : 0);
	const clock = $derived(demo ? `${demo.id}-${demo.count}` : '');

	function fire(kicker: string, subject: string, undo = false): void {
		if (demo && kicker && demo.kicker === kicker && demo.subject === subject) {
			demo = { ...demo, count: demo.count + 1 };
		} else {
			seq += 1;
			demo = { id: seq, kicker, subject, count: 1, undo };
		}
		arm();
	}

	function undo(): void {
		fire('Restored', demo?.subject ?? NAME);
	}

	function clear(): void {
		stopStory();
		demo = null;
		arm();
	}

	function expire(): void {
		demo = null;
		expiry = null;
	}

	function arm(): void {
		if (expiry) clearTimeout(expiry);
		expiry = null;
		if (!timers || !demo) return;
		until = Date.now() + life;
		if (!held) expiry = setTimeout(expire, life);
	}

	function hold(on: boolean): void {
		if (on === held) return;
		held = on;
		if (!timers || !demo) return;
		if (on) {
			if (expiry) clearTimeout(expiry);
			expiry = null;
			remaining = Math.max(0, until - Date.now());
		} else {
			until = Date.now() + remaining;
			expiry = setTimeout(expire, remaining);
		}
	}

	function stopStory(): void {
		for (const step of story) clearTimeout(step);
		story = [];
	}

	function play(): void {
		stopStory();
		demo = null;
		arm();
		const steps: [number, () => void][] = [
			[300, () => fire('Duplicated', NAME)],
			[950, () => fire('Duplicated', NAME)],
			[1550, () => fire('Duplicated', NAME)],
			[3300, () => fire('Deleted', NAME, true)],
			[5900, undo],
			[8400, () => fire('', 'Copied as text')]
		];
		story = steps.map(([at, run]) => setTimeout(run, at));
	}

	onDestroy(() => {
		stopStory();
		if (expiry) clearTimeout(expiry);
	});
</script>

{#snippet ring(className: string)}
	<svg class={cn('block shrink-0 overflow-visible', className)} viewBox="0 0 100 100" aria-hidden="true">
		{#each segments as segment, pillar (pillar)}
			<path class="pillar-stroke fill-none stroke-[9] [stroke-linecap:round]" d={segment.d} style:--h={segment.hue} />
		{/each}
		<circle class="fill-ink" cx="50" cy="50" r="10" />
	</svg>
{/snippet}

{#snippet times(d: Demo, className = '')}
	{#if d.count > 1}
		{#key d.count}
			<span class={cn('inline-block shrink-0 font-[620] tabular-nums motion-safe:animate-toast-tick', className)}>×{d.count}</span>
		{/key}
	{/if}
{/snippet}

{#snippet slip(d: Demo)}
	<ToastSlip
		class="motion-safe:animate-sheet-in"
		kicker={d.kicker}
		subject={d.subject}
		count={d.count}
		{life}
		until={life > 0 ? until : 0}
		{held}
		{clock}
		onundo={d.undo ? undo : undefined}
	/>
{/snippet}

{#snippet pill(d: Demo)}
	<div
		class="flex min-h-12 w-max max-w-full items-center gap-4 rounded-full bg-ink py-1.5 text-[0.92rem] leading-[1.3] text-on-ink shadow-float motion-safe:animate-sheet-in {d.undo
			? 'pr-1.5 pl-5'
			: 'px-5'}"
	>
		<p class="m-0 flex min-w-0 items-baseline gap-1.5">
			{#if d.kicker}
				<span class="shrink-0 font-semibold">{d.kicker}</span>
				<span class="min-w-0 truncate opacity-70">{d.subject}</span>
			{:else}
				<span class="min-w-0">{d.subject}</span>
			{/if}
			{@render times(d, 'opacity-70')}
		</p>
		{#if d.undo}
			<button
				type="button"
				class="h-9 shrink-0 cursor-pointer rounded-full border-0 px-4 font-sans text-[0.86rem] font-semibold text-on-ink bg-[color-mix(in_oklch,var(--on-ink)_16%,transparent)] hover:bg-[color-mix(in_oklch,var(--on-ink)_28%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-ink"
				onclick={undo}>Undo</button
			>
		{/if}
	</div>
{/snippet}

{#snippet seed(d: Demo)}
	<div class="group flex w-max max-w-full items-center gap-1 rounded-full bg-surface p-1.5 text-text shadow-float motion-safe:animate-sheet-in">
		<span class="relative flex">
			{@render ring('size-9')}
			{#if d.count > 1}
				{#key d.count}
					<span
						class="absolute -top-1 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[0.68rem] leading-none font-[680] text-on-ink tabular-nums motion-safe:animate-toast-tick"
						>{d.count}</span
					>
				{/key}
			{/if}
		</span>
		{#key clock}
			<span
				class="overflow-hidden whitespace-nowrap {d.undo
					? 'max-w-[22rem]'
					: 'max-w-0 opacity-0 transition-[max-width,opacity] duration-300 ease-ui group-hover:max-w-[22rem] group-hover:animate-none group-hover:opacity-100 motion-safe:animate-seed-fold motion-reduce:max-w-[22rem] motion-reduce:opacity-100'}"
			>
				<span class="flex items-baseline gap-1.5 pr-3 pl-2 text-[0.92rem]">
					{#if d.kicker}<span class="font-semibold">{d.kicker}</span>{/if}
					<span class="max-w-[14rem] truncate text-muted">{d.subject}</span>
				</span>
			</span>
		{/key}
		{#if d.undo}
			<Button size="sm" variant="soft" icon="undo" onclick={undo}>Undo</Button>
		{/if}
	</div>
{/snippet}

{#snippet stage(name: string, note: string, body: Snippet<[Demo]>, live = false)}
	<figure class="m-0 flex min-w-0 flex-col gap-3">
		<div class="flex h-64 flex-col items-center justify-end gap-3 overflow-hidden rounded-[22px] bg-bg px-4 pb-4 shadow-card">
			<div
				class="grid w-full min-w-0 justify-items-center"
				role="group"
				aria-label="{name} toast"
				onmouseenter={() => hold(true)}
				onmouseleave={() => hold(false)}
				onfocusin={() => hold(true)}
				onfocusout={() => hold(false)}
			>
				{#if demo}
					{#key demo.id}
						<div class="col-start-1 row-start-1 max-w-full" out:slipOut>
							{@render body(demo)}
						</div>
					{/key}
				{:else}
					<p class="col-start-1 row-start-1 m-0 text-[0.82rem] text-muted">Nothing showing</p>
				{/if}
			</div>
			<div class={cn(dockBar, 'pointer-events-none relative w-fit')} aria-hidden="true">
				<span class="inline-flex min-h-10 items-center rounded-full px-4 text-[0.86rem] font-[560] text-muted">Today</span>
				<span class="inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-[0.86rem] font-[560] text-on-accent">Chart</span>
				<span class="inline-flex min-h-10 items-center rounded-full px-4 text-[0.86rem] font-[560] text-muted">Edit</span>
			</div>
		</div>
		<figcaption class="flex flex-col gap-1 px-1">
			<span class="flex items-center gap-2 text-[0.95rem] font-[620]">
				{name}
				{#if live}
					<span class="rounded-full bg-sunken px-2 py-0.5 text-[0.7rem] font-[620] text-muted">In the app</span>
				{/if}
			</span>
			<span class="text-[0.86rem] text-pretty text-muted">{note}</span>
		</figcaption>
	</figure>
{/snippet}

<div class="flex flex-col gap-5">
	<div class="flex flex-wrap items-center gap-2">
		<Button size="sm" icon="refresh" onclick={play}>Play the story</Button>
		<Button size="sm" variant="soft" icon="copy" onclick={() => fire('Duplicated', NAME)}>Duplicate</Button>
		<Button size="sm" variant="soft" icon="trash" onclick={() => fire('Deleted', NAME, true)}>Delete</Button>
		<Button size="sm" variant="soft" onclick={() => fire('Deleted', '3 charts', true)}>Delete three</Button>
		<Button size="sm" variant="soft" onclick={() => fire('Renamed', LONG)}>Long name</Button>
		<Button size="sm" variant="soft" onclick={() => fire('', 'Copied as text')}>Plain note</Button>
		<Button size="sm" variant="ghost" onclick={clear}>Clear</Button>
		<label class="ml-auto flex cursor-pointer items-center gap-2 text-[0.88rem]">
			<input class="size-4 cursor-pointer accent-ink" type="checkbox" bind:checked={timers} onchange={arm} />
			Run the clock
		</label>
	</div>

	<div class="grid gap-x-5 gap-y-7 lg:grid-cols-3">
		{@render stage(
			'Slip',
			'Paper, the mark, the name. Repeats stack sheets behind it. The ring empties one pillar at a time while it shows, and hovering holds it.',
			slip,
			true
		)}
		{@render stage(
			'Seed',
			'Says it once, then folds back into the mark with a count. Hover to read it again. Undo keeps it open.',
			seed
		)}
		{@render stage(
			'Ink pill',
			'The generic one, kept for contrast. Loud, flat, and it could belong to any app.',
			pill
		)}
	</div>
</div>
