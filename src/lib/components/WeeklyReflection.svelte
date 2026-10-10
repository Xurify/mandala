<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { chart } from '$lib/chart/chart.svelte';
	import { weekInReview } from '$lib/chart/helper';
	import { HUES, weekStartKey } from '$lib/chart/model';
	import DaySeal from './DaySeal.svelte';
	import Icon from './Icon.svelte';
	import WeekStrip from './WeekStrip.svelte';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';
	import Pages from './ui/Pages.svelte';
	import { cn } from './ui/cn';
	import { textArea, textField } from './ui/styles';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	type Step = 'week' | 'closed' | 'quiet' | 'note' | 'done';

	const weekKey = $derived(weekStartKey());
	// Live, so a pillar rewritten on the quiet page shows its new line at once.
	const review = $derived(weekInReview(chart.data));
	const steps = $derived<Step[]>(['week', 'closed', ...(review.quiet.length > 0 ? (['quiet'] as const) : []), 'note']);
	const named = $derived(chart.data.pillars.filter((pillar) => pillar.trim()).length);

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

	function focusField(node: HTMLInputElement): void {
		node.focus();
		node.setSelectionRange(node.value.length, node.value.length);
	}

	function onkeydown(event: KeyboardEvent, key: string): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			(event.currentTarget as HTMLInputElement).blur();
		} else if (event.key === 'Escape') {
			// Leave the field, not the reflection.
			event.stopPropagation();
			event.preventDefault();
			if (editingKey === key) editingKey = null;
		}
	}
</script>

{#snippet rewrite(entry: { key: string; text: string }, pillarIndex: number, lead: boolean)}
	{#if editingKey === entry.key}
		<input
			type="text"
			class={cn(textField, 'min-w-0 flex-1 text-[0.92rem]')}
			value={entry.text}
			maxlength="120"
			aria-label="Rewrite {entry.text}"
			onblur={() => {
				if (editingKey === entry.key) editingKey = null;
			}}
			onchange={(event) => chart.setText(entry.key, event.currentTarget.value)}
			onkeydown={(event) => onkeydown(event, entry.key)}
			{@attach focusField}
		/>
	{:else}
		<button
			type="button"
			class="group/line flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-[16px] border-0 bg-transparent px-3 py-1.5 text-start font-sans text-text hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
			onclick={() => (editingKey = entry.key)}
		>
			{#if lead}
				<span class="pip size-2.5 shrink-0 rounded-full" style:--pip-h={HUES[pillarIndex]} aria-hidden="true"></span>
			{/if}
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

	<Pages view={step} {direction} label={heading[step]} class="overflow-x-clip overflow-y-visible">
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
							<ul class="m-0 flex list-none flex-col gap-1 p-0">
								{#each review.closed as milestone, position (milestone.key)}
									<li class="flex min-h-11 items-center gap-3 px-1">
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
						<ul class="-mx-2 m-0 flex list-none flex-col gap-0.5 p-0">
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
										<div class="flex flex-col ps-5 motion-safe:animate-pop-in">
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
