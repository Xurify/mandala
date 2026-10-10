<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { SLIP_MS, SLIP_UNDO_MS, type Slip } from '$lib/chart/toast';
	import { slipOut } from './motion';
	import ToastSlip from './ToastSlip.svelte';

	let last: Slip | null = null;
	// Holds the last slip while it fades out, so the words don't vanish first.
	const shown = $derived.by(() => {
		const front = chart.slips.at(-1) ?? null;
		if (front) last = front;
		return front ?? last;
	});
	const on = $derived(chart.slips.length > 0);
	const canUndo = $derived(on && (shown?.undo.length ?? 0) > 0);
	const life = $derived(
		!shown || shown.until === Number.POSITIVE_INFINITY ? 0 : shown.undo.length > 0 ? SLIP_UNDO_MS : SLIP_MS
	);
	const subject = $derived(
		shown?.mixed ? `${shown.count} ${shown.count === 1 ? 'chart' : 'charts'}` : (shown?.subject ?? '')
	);

	let held = $state(false);

	function setHeld(next: boolean): void {
		chart.holdToasts(next);
		held = next;
	}
</script>

<!--
	On a phone the row above the dock can hold a control at its right edge. `--dock-aside` is the room it
	needs, set by the page. The slip centers in the space beside it, so it never covers it.
-->
<div
	class="absolute bottom-[calc(100%+12px)] left-1/2 z-10 grid w-max max-w-[min(26rem,calc(100vw-2rem))] grid-cols-[minmax(0,1fr)] justify-items-center max-[600px]:left-[calc(50%-var(--dock-aside,0px)/2)] max-[600px]:max-w-[calc(100vw-2rem-var(--dock-aside,0px))] transition-opacity duration-300 ease-[cubic-bezier(0.33,0,0.2,1)] {on
		? 'pointer-events-auto'
		: 'pointer-events-none'}"
	style:translate="-50% 0"
	style:opacity={on ? 1 : 0}
	inert={!on}
	role="status"
	aria-live="polite"
	aria-atomic="true"
	onmouseenter={() => setHeld(true)}
	onmouseleave={() => setHeld(false)}
	onfocusin={() => setHeld(true)}
	onfocusout={() => setHeld(false)}
>
	{#if shown}
		{#key shown.id}
			<div class="col-start-1 row-start-1 max-w-full" out:slipOut>
				<ToastSlip
					class="motion-safe:animate-sheet-in"
					kicker={shown.kicker}
					{subject}
					count={shown.mixed ? 1 : shown.count}
					{life}
					until={shown.until}
					{held}
					clock="{shown.id}-{shown.count}"
					onundo={canUndo ? () => chart.undoSlip() : undefined}
				/>
			</div>
		{/key}
	{/if}
</div>
