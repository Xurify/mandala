<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { LANES, LANE_NAMES, canGo, historyOf, tomorrowOf, type Card, type Lane, type Moment } from '$lib/chart/board';
	import { dateKeyOffset } from '$lib/chart/model';
	import Button from './ui/Button.svelte';
	import Eyebrow from './ui/Eyebrow.svelte';
	import IconButton from './ui/IconButton.svelte';
	import SegmentedControl from './ui/SegmentedControl.svelte';
	import { noteOut } from './ui/motion';
	import { toBody } from './ui/portal';
	import { textArea } from './ui/styles';
	import { cn } from './ui/cn';

	type Props = {
		card: Card;
		lane: Lane;
		onmove: (lane: Lane) => void;
		onclose: () => void;
		oneditor: () => void;
	};

	let { card, lane, onmove, onclose, oneditor }: Props = $props();

	const KINDS = [
		{ value: 'standard', label: 'Standard' },
		{ value: 'routine', label: 'Routine' },
		{ value: 'milestone', label: 'Milestone' }
	];

	let sheet = $state<HTMLDivElement | null>(null);

	const meta = $derived(chart.metaOf(card.key));
	const pillar = $derived(chart.data.pillars[card.pillarIndex]?.trim() || `Pillar ${card.pillarIndex + 1}`);
	const history = $derived(historyOf(chart.data, card.key));
	const today = $derived(chart.today);

	const status = $derived.by((): string | null => {
		if (lane === 'done') return card.doneAt === today ? 'Finished today. It is on the calendar.' : `Finished ${dayOf(card.doneAt ?? today).toLowerCase()}. It is on the calendar.`;
		if (card.routine && chart.todayLog.checked.includes(card.key)) return 'A routine, ticked today. It never goes to Done.';
		if (card.routine) return 'A routine never goes to Done. Tick it in Today, day by day.';
		if (chart.todayLog.focus.includes(card.key)) return "One of today's three.";
		if (chart.data.days?.[tomorrowOf(today)]?.focus.includes(card.key)) return 'Planned for tomorrow.';
		return null;
	});

	function dayOf(dateKey: string): string {
		if (dateKey === today) return 'Today';
		if (dateKey === dateKeyOffset(-1, new Date(`${today}T12:00`))) return 'Yesterday';
		if (dateKey === tomorrowOf(today)) return 'Tomorrow';
		return new Date(`${dateKey}T12:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
	}

	function clock(at: string): string {
		const [hours, minutes] = at.split(':').map(Number);
		return new Date(2000, 0, 1, hours ?? 0, minutes ?? 0)
			.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
			.replace(' AM', ' am')
			.replace(' PM', ' pm');
	}

	function said(moment: Moment): string {
		if (moment.what === 'finished') return moment.at ? `Finished at ${clock(moment.at)}` : 'Finished';
		if (moment.what === 'ticked') return moment.at ? `Ticked at ${clock(moment.at)}` : 'Ticked';
		if (moment.what === 'dropped') return 'Taken off the day';
		return moment.dateKey > today ? 'Planned for the day' : 'Picked for the day';
	}

	const key = $derived(card.key);

	// The board hands over a fresh card on every edit; only a different card takes focus back to the sheet.
	$effect(() => {
		void key;
		sheet?.focus({ preventScroll: true });
	});
</script>

<!-- Not modal, like a ticket beside a board: clicking another card shows that one here. -->
<div
	bind:this={sheet}
	tabindex="-1"
	role="dialog"
	aria-modal="false"
	{@attach toBody}
	class="fixed end-3 top-3 bottom-3 z-50 flex w-[min(420px,calc(100vw-24px))] flex-col overflow-clip rounded-[28px] bg-surface text-text shadow-float outline-none motion-safe:animate-note-in max-[600px]:inset-x-2 max-[600px]:top-auto max-[600px]:bottom-2 max-[600px]:max-h-[88dvh] max-[600px]:w-auto max-[600px]:rounded-[24px]"
	aria-labelledby="card-sheet-title"
	onkeydown={(event) => {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		event.stopPropagation();
		onclose();
	}}
	out:noteOut
>
	<header class="flex shrink-0 items-center justify-between gap-3 ps-6 pe-3 pt-3.5">
		<Eyebrow pip={card.pillarIndex} class="min-w-0">{pillar}</Eyebrow>
		<IconButton icon="close" label="Close the card" onclick={onclose} />
	</header>

	<div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain ps-6 pe-5 pb-5 scrollbar-gutter-stable">
		<textarea
			id="card-sheet-title"
			class="m-0 -mx-1.5 w-[calc(100%+0.75rem)] resize-none rounded-[12px] border-0 bg-transparent px-1.5 py-1 font-serif text-[1.45rem] leading-[1.2] font-[480] tracking-[-0.01em] text-balance text-text [field-sizing:content] hover:bg-sunken focus:bg-sunken focus:outline-none"
			maxlength="120"
			rows="1"
			aria-label="Action"
			value={chart.textOf(card.key)}
			oninput={(event) => chart.setText(card.key, event.currentTarget.value)}
			onkeydown={(event) => {
				if (event.key === 'Enter') {
					event.preventDefault();
					event.currentTarget.blur();
				}
			}}
		></textarea>

		<dl class="m-0 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 text-[0.9rem]">
			<dt class="text-muted">List</dt>
			<dd class="m-0 flex justify-end">
				<SegmentedControl
					label="List"
					size="sm"
					options={LANES.filter((each) => canGo(card, each)).map((each) => ({ value: each, label: LANE_NAMES[each] }))}
					value={lane}
					onchange={(value) => onmove(value as Lane)}
				/>
			</dd>
			<dt class="text-muted">Kind</dt>
			<dd class="m-0 flex justify-end">
				<SegmentedControl
					label="Kind"
					size="sm"
					options={KINDS}
					value={meta?.kind ?? 'standard'}
					onchange={(value) => chart.setActionMeta(card.key, { kind: value === 'routine' || value === 'milestone' ? value : undefined })}
				/>
			</dd>
		</dl>

		{#if status}
			<p class="m-0 -mt-2 text-[0.88rem] leading-snug text-pretty text-muted">{status}</p>
		{/if}

		<section class="flex flex-col gap-2" aria-labelledby="card-sheet-notes">
			<h3 id="card-sheet-notes" class="m-0 text-[0.95rem] font-semibold">Notes</h3>
			<textarea
				class={cn(textArea, 'min-h-36 resize-none [field-sizing:content]')}
				placeholder="What your tutor said, new words, what to try next time"
				value={meta?.details ?? ''}
				oninput={(event) => {
					const value = event.currentTarget.value;
					chart.setActionMeta(card.key, { details: value.trim() ? value : undefined });
				}}
			></textarea>
		</section>

		<section class="flex flex-col gap-1" aria-labelledby="card-sheet-activity">
			<h3 id="card-sheet-activity" class="m-0 text-[0.95rem] font-semibold">Activity</h3>
			{#if history.length === 0}
				<p class="m-0 text-[0.88rem] text-muted">Nothing yet. Pick it in Today, or move it on the board.</p>
			{:else}
				<ol class="m-0 flex list-none flex-col p-0">
					{#each history as moment (moment.dateKey)}
						<li class="flex items-baseline justify-between gap-3 border-b border-line py-2 text-[0.88rem] last:border-b-0">
							<span class={cn(moment.what === 'finished' || moment.what === 'ticked' ? 'text-text' : 'text-muted')}>{said(moment)}</span>
							<span class="shrink-0 text-muted tabular-nums">{dayOf(moment.dateKey)}</span>
						</li>
					{/each}
				</ol>
			{/if}
		</section>
	</div>

	<footer class="flex shrink-0 justify-end bg-surface px-5 pt-3 pb-4">
		<Button variant="soft" icon="edit" onclick={oneditor}>Open in the editor</Button>
	</footer>
</div>
