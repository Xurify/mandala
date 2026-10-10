<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { chart } from '$lib/chart/chart.svelte';
	import { weekInReview } from '$lib/chart/helper';
	import { HUES } from '$lib/chart/model';
	import DaySeal from './DaySeal.svelte';
	import Icon from './Icon.svelte';
	import WeekStrip from './WeekStrip.svelte';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';
	import Pages from './ui/Pages.svelte';
	import Select from './ui/Select.svelte';
	import { cn } from './ui/cn';
	import { textArea } from './ui/styles';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	type Step = 'week' | 'closed' | 'quiet' | 'note' | 'done';

	/** The week on offer: the one whose offer time passed last, so a Monday morning still gets the week that ended. */
	const weekKey = $derived(chart.reflectionWeek);
	// Live, so a pillar rewritten on the quiet page shows its new line at once.
	const review = $derived(weekInReview(chart.data, new Date(), weekKey));
	const steps = $derived<Step[]>(['week', 'closed', ...(review.quiet.length > 0 ? (['quiet'] as const) : []), 'note']);
	const named = $derived(chart.data.pillars.filter((pillar) => pillar.trim()).length);

	const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const DAYS = [1, 2, 3, 4, 5, 6, 0].map((day) => ({ value: String(day), label: DAY_NAMES[day]! }));
	/** A short list, so the picker fits inside the dialog: the hours a week gets looked back on. */
	const HOURS = [
		{ value: '0', label: 'Any time' },
		{ value: '8', label: '8 am' },
		{ value: '12', label: 'Noon' },
		{ value: '15', label: '3 pm' },
		{ value: '18', label: '6 pm' },
		{ value: '20', label: '8 pm' },
		{ value: '22', label: '10 pm' }
	];

	let step = $state<Step>('week');
	let direction = $state(1);
	let note = $state('');
	let editingKey = $state<string | null>(null);
	let expanded = $state<number | null>(null);
	/** The pillars the week moved, held when it is saved, so the ring draws what was true then. */
	let sealed = $state<number[]>([]);

	$effect(() => {
		if (!open) return;
		untrack(() => {
			step = 'week';
			direction = 1;
			editingKey = null;
			expanded = null;
			note = chart.data.weeks?.[weekKey]?.note ?? '';
		});
	});

	const index = $derived(steps.indexOf(step));
	const heading: Record<Step, string> = {
		week: 'How it went',
		closed: 'What you finished',
		quiet: 'What sat out',
		note: 'A line for next week',
		done: 'Week saved'
	};

	function turn(to: Step, way: 1 | -1): void {
		direction = way;
		editingKey = null;
		step = to;
		// The moment's only door is Done. The button that saved is gone, so focus goes there.
		if (to === 'done') void tick().then(() => document.querySelector<HTMLElement>('dialog[open] [data-done]')?.focus());
	}

	function next(): void {
		const following = steps[index + 1];
		if (following) turn(following, 1);
	}

	function back(): void {
		const before = steps[index - 1];
		if (before) turn(before, -1);
	}

	function save(): void {
		chart.saveWeekReflection(weekKey, { note: note.trim() });
		sealed = review.moved;
		turn('done', 1);
	}

	function dismiss(): void {
		chart.dismissWeekNotice(weekKey);
		open = false;
	}

	/** The field takes the line's own height, wrapping as the line did, so the row does not change size. */
	function focusField(node: HTMLTextAreaElement): () => void {
		const grow = (): void => {
			node.style.height = '0';
			node.style.height = `${node.scrollHeight}px`;
		};
		grow();
		node.focus();
		node.setSelectionRange(node.value.length, node.value.length);
		node.addEventListener('input', grow);
		return () => node.removeEventListener('input', grow);
	}

	function onkeydown(event: KeyboardEvent, key: string): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			(event.currentTarget as HTMLTextAreaElement).blur();
		} else if (event.key === 'Escape') {
			// Leave the field, not the reflection.
			event.stopPropagation();
			event.preventDefault();
			if (editingKey === key) editingKey = null;
		}
	}

	/** One geometry for every row on these pages: a 20px mark, a 12px gap, the words. The heading sits on the same left edge. */
	const row = 'flex min-h-11 w-full min-w-0 items-center gap-3 rounded-[16px] px-3 py-1.5';
</script>

{#snippet mark(pillarIndex: number | null)}
	<span class="grid size-5 shrink-0 place-items-center" aria-hidden="true">
		{#if pillarIndex !== null}
			<span class="pip size-2.5 rounded-full" style:--pip-h={HUES[pillarIndex]}></span>
		{/if}
	</span>
{/snippet}

<!-- A line that sat out. Rewrite swaps the words for a field in the same row, so nothing around it moves. -->
{#snippet rewrite(entry: { key: string; text: string }, pillarIndex: number, lead: boolean)}
	{#if editingKey === entry.key}
		<div class={cn(row, 'flex-1 bg-sunken shadow-[inset_0_0_0_1.5px_var(--ink)]')}>
			{@render mark(lead ? pillarIndex : null)}
			<span class="flex min-w-0 flex-1 flex-col">
				<textarea
					class="m-0 block w-full min-w-0 resize-none overflow-hidden border-0 bg-transparent p-0 font-sans text-[0.92rem] leading-snug text-text outline-none"
					rows="1"
					maxlength="120"
					aria-label="Rewrite {entry.text}"
					onblur={() => {
						if (editingKey === entry.key) editingKey = null;
					}}
					onchange={(event) => chart.setText(entry.key, event.currentTarget.value.replace(/\s+/g, ' ').trim())}
					onkeydown={(event) => onkeydown(event, entry.key)}
					{@attach focusField}>{entry.text}</textarea
				>
				{#if lead}
					<span class="pillar-ink truncate text-[0.74rem] font-[620]" style:--h={HUES[pillarIndex]}>{chart.data.pillars[pillarIndex]?.trim()}</span>
				{/if}
			</span>
		</div>
	{:else}
		<button
			type="button"
			class={cn(row, 'group/line flex-1 cursor-pointer border-0 bg-transparent text-start font-sans text-text hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink')}
			onclick={() => (editingKey = entry.key)}
		>
			{@render mark(lead ? pillarIndex : null)}
			<span class="flex min-w-0 flex-1 flex-col">
				<span class="text-[0.92rem] leading-snug text-pretty">{entry.text}</span>
				{#if lead}
					<span class="pillar-ink truncate text-[0.74rem] font-[620]" style:--h={HUES[pillarIndex]}>{chart.data.pillars[pillarIndex]?.trim()}</span>
				{/if}
			</span>
			<span class="shrink-0 text-[0.78rem] font-[560] text-muted group-hover/line:text-text">Rewrite</span>
		</button>
	{/if}
{/snippet}

<Dialog bind:open title="Your week" description="A calm look back, a page at a time.">
	{#if step !== 'done'}
		<!-- Where you are in the week's pages: the current one is a longer mark, the read ones are ink. -->
		<ol class="m-0 mb-4 flex list-none items-center gap-1.5 p-0" aria-label="Page {index + 1} of {steps.length}">
			{#each steps as entry, position (entry)}
				<li
					class={cn(
						'h-1.5 rounded-full motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]',
						position === index ? 'w-6 bg-ink' : position < index ? 'w-1.5 bg-ink' : 'w-1.5 bg-sunken-hover'
					)}
				></li>
			{/each}
		</ol>
	{/if}

	<!-- Room on both sides, so a row's hover and a field's focus ring are not cut at the page's edge. -->
	<Pages view={step} {direction} label={heading[step]} class="-mx-3 px-3 overflow-x-clip overflow-y-visible">
		{#snippet page(current)}
			{@const at = current as Step}
			{#if at === 'done'}
				<div class="flex flex-col items-center gap-3 pt-2 pb-2 text-center">
					<DaySeal moved={sealed} play step={Math.min(0.16, 0.6 / Math.max(1, sealed.length))} label="Week saved" class="size-[112px]" />
					<p class="m-0 text-[1.18rem] font-[620] motion-safe:animate-done-in" style:animation-delay="{0.35 + sealed.length * Math.min(0.16, 0.6 / Math.max(1, sealed.length)) + 0.35}s">
						Week saved
					</p>
					<p class="m-0 max-w-[36ch] text-[0.9rem] leading-snug text-pretty text-muted motion-safe:animate-done-in" style:animation-delay="{0.45 + sealed.length * Math.min(0.16, 0.6 / Math.max(1, sealed.length)) + 0.35}s">
						{note.trim() ? `“${note.trim().length > 90 ? `${note.trim().slice(0, 87)}…` : note.trim()}”` : 'A new week starts Monday.'}
					</p>
				</div>
			{:else}
				<div class="flex flex-col gap-3.5">
					<h3 class="m-0 text-[1.08rem] leading-tight font-[620]">{heading[at]}</h3>
					{#if at === 'week'}
						<!-- When the week's look back is offered: the person's own hour, not the chart's. Sits high on the
						     page, so a picker opens over the page instead of past the dialog's edge. -->
						<div class="-mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-2 text-[0.84rem] text-muted">
							<span class="inline-flex items-center gap-2">
								Offered every
								<Select
									size="sm"
									class="w-[8.6rem]"
									label="Day the week's reflection is offered"
									options={DAYS}
									value={String(chart.reflectAt.day)}
									onchange={(value) => chart.setReflectAt({ day: Number(value) })}
								/>
							</span>
							<span class="inline-flex items-center gap-2">
								from
								<Select
									size="sm"
									class="w-[6.4rem]"
									label="Time of day the week's reflection is offered"
									options={HOURS}
									value={String(chart.reflectAt.hour)}
									onchange={(value) => chart.setReflectAt({ hour: Number(value) })}
								/>
							</span>
						</div>
						<WeekStrip data={chart.data} />
						<p class="m-0 text-[0.94rem] leading-snug text-pretty">
							{#if review.ticks === 0}
								A quiet week. Nothing ticked in the last 7 days, and that is something to know too.
							{:else}
								{review.ticks} {review.ticks === 1 ? 'tick' : 'ticks'} from {review.moved.length} of {named} pillars.
							{/if}
						</p>
					{:else if at === 'closed'}
						{#if review.closed.length > 0}
							<ul class="-mx-3 m-0 flex list-none flex-col gap-0.5 p-0">
								{#each review.closed as milestone, position (milestone.key)}
									<li class={row}>
										<span
											class="flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-surface motion-safe:animate-stamp"
											style:animation-delay="{120 + position * 90}ms"
											aria-hidden="true"
										>
											<Icon name="check" size={12} strokeWidth={2.6} />
										</span>
										<span class="min-w-0 flex-1 text-[0.94rem] leading-snug text-pretty">{milestone.text}</span>
										<span class="pillar-ink shrink-0 text-[0.76rem] font-[620]" style:--h={HUES[milestone.pillarIndex]}>
											{chart.data.pillars[milestone.pillarIndex]?.trim()}
										</span>
									</li>
								{/each}
							</ul>
						{:else}
							<p class="m-0 text-[0.94rem] leading-snug text-pretty text-muted">
								Nothing closed this week. That is fine. Milestones you mark done show up here.
							</p>
						{/if}
					{:else if at === 'quiet'}
						<p class="m-0 text-[0.9rem] leading-snug text-pretty text-muted">
							No ticks here in 7 days. If an action is not happening, rewrite it smaller.
						</p>
						<ul class="-mx-3 m-0 flex list-none flex-col gap-0.5 p-0">
							{#each review.quiet as pillar (pillar.pillarIndex)}
								<li class="flex flex-col">
									<div class="flex items-center gap-1">
										{@render rewrite(pillar.lead, pillar.pillarIndex, true)}
										{#if pillar.rest.length > 0}
											<button
												type="button"
												class="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-muted hover:bg-sunken hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
												aria-expanded={expanded === pillar.pillarIndex}
												aria-label={expanded === pillar.pillarIndex ? 'Hide the other actions' : `Show ${pillar.rest.length} more`}
												onclick={() => (expanded = expanded === pillar.pillarIndex ? null : pillar.pillarIndex)}
											>
												<Icon
													name="chevron-down"
													size={15}
													class={cn('motion-safe:transition-transform motion-safe:duration-200', expanded !== pillar.pillarIndex && '-rotate-90')}
												/>
											</button>
										{/if}
									</div>
									{#if expanded === pillar.pillarIndex}
										<div class="flex flex-col motion-safe:animate-pop-in">
											{#each pillar.rest as action (action.key)}
												{@render rewrite(action, pillar.pillarIndex, false)}
											{/each}
										</div>
									{/if}
								</li>
							{/each}
						</ul>
					{:else if at === 'note'}
						<textarea
							class={cn(textArea, 'min-h-28 resize-none')}
							maxlength="600"
							aria-label="A line for next week"
							placeholder="What happened, and what you want next week to hold"
							bind:value={note}
						></textarea>
						<p class="m-0 text-[0.8rem] leading-snug text-pretty text-muted">Bindu says it back to you when the new week starts.</p>
					{/if}
				</div>
			{/if}
		{/snippet}
	</Pages>

	{#snippet footer()}
		{#if step === 'done'}
			<Button data-done onclick={() => (open = false)}>Done</Button>
		{:else}
			<!-- One button each side, relabelled rather than replaced, so keyboard focus stays put as pages turn. -->
			<div class="flex w-full items-center justify-between gap-2">
				<Button variant="ghost" onclick={index === 0 ? dismiss : back}>{index === 0 ? 'Not this week' : 'Back'}</Button>
				<Button onclick={step === 'note' ? save : next}>{step === 'note' ? 'Save the week' : 'Next'}</Button>
			</div>
		{/if}
	{/snippet}
</Dialog>
