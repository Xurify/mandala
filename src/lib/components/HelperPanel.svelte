<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { HelperMessage, HelperStore } from '$lib/chart/helper.svelte';
	import { BRIEF_LABELS, describeKey, draftButton, editWords, groupEdits } from '$lib/chart/helper';
	import { cellKey, getByKey, HUES, info, type ChartData } from '$lib/chart/model';
	import HelperFace from './HelperFace.svelte';
	import Button from './ui/Button.svelte';
	import IconButton from './ui/IconButton.svelte';
	import { cn } from './ui/cn';
	import { textField } from './ui/styles';

	interface Props {
		helper: HelperStore;
		onclose?: () => void;
		autofocus?: boolean;
		class?: string;
	}

	let { helper, onclose, autofocus = false, class: className }: Props = $props();

	const field = cn(textField, 'min-w-0 flex-1');
	const link =
		'cursor-pointer border-0 bg-transparent p-0 font-sans text-[0.8rem] font-[560] text-muted underline decoration-line underline-offset-4 hover:text-text hover:decoration-text focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

	let text = $state('');
	let copied = $state(false);
	let scroller: HTMLDivElement | null = $state(null);

	const chips = $derived(helper.chips);
	const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	$effect(() => {
		void helper.messages.length;
		const node = scroller;
		if (!node) return;
		requestAnimationFrame(() => {
			const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			node.scrollTo({ top: node.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
		});
	});

	function submit(event: SubmitEvent): void {
		event.preventDefault();
		const value = text;
		if (!value.trim()) return;
		text = '';
		helper.send(value);
	}

	function onkeydown(event: KeyboardEvent): void {
		if (event.key !== 'Escape') return;
		event.stopPropagation();
		if (helper.step !== 'idle') {
			helper.cancel();
			return;
		}
		if (onclose) onclose();
	}

	async function copyPrompt(prompt: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(prompt);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			copied = false;
		}
	}

	function focusOnMount(node: HTMLInputElement): void {
		if (autofocus) requestAnimationFrame(() => node.focus({ preventScroll: true }));
	}

	function primaryLabel(message: HelperMessage): string {
		const card = message.card;
		if (!card) return '';
		if (card.kind === 'chart') return draftButton(helper.data);
		if (card.kind === 'cells') return editWords(helper.data, card.edits).button;
		if (card.kind === 'picks') return card.scope === 'today' ? "Pick today's three" : 'Plan this week';
		return '';
	}

	function skipLabel(message: HelperMessage): string {
		const card = message.card;
		if (card?.kind === 'chart') return 'Not this one';
		if (card?.kind === 'findings') return 'Leave them';
		if (card?.kind === 'cells') return 'Skip';
		return 'Not now';
	}

</script>

{#snippet dot(pillarIndex: number)}
	<span class="pip mt-[0.38em] size-2.5 shrink-0 rounded-full" style:--pip-h={HUES[pillarIndex]} aria-hidden="true"></span>
{/snippet}

{#snippet miniChart(data: ChartData, written: number)}
	<!-- The chart itself, small: written actions take the pillar's tone, empty ones keep the light tint. -->
	<div class="grid shrink-0 grid-cols-3 gap-[3px]" role="img" aria-label="{written} of 64 actions written">
		{#each { length: 9 } as _, block (block)}
			<div class="grid grid-cols-3 gap-px">
				{#each { length: 9 } as _, cell (cell)}
					{@const where = info(block, cell)}
					{@const filled = getByKey(data, cellKey(block, cell)).trim() !== ''}
					<span
						class={cn(
							'relative size-[9px] overflow-hidden rounded-[2.5px]',
							where.type === 'goal' ? 'bg-ink' : where.type === 'pillar' ? 'bg-sunken' : 'pillar-action'
						)}
						style:--h={where.type === 'goal' ? undefined : HUES[where.k]}
						style:--pip-h={where.type === 'goal' ? undefined : HUES[where.k]}
					>
						{#if filled && where.type !== 'goal'}
							<span class={cn('absolute inset-0', where.type === 'pillar' ? 'pip' : 'pillar-cell')} in:fade={{ duration: reduceMotion ? 0 : 420 }}></span>
						{/if}
					</span>
				{/each}
			</div>
		{/each}
	</div>
{/snippet}

{#snippet card(message: HelperMessage)}
	{@const value = message.card}
	{#if value}
		<div class="mt-2 flex flex-col gap-3 rounded-[20px] bg-bg px-4 py-3.5">
			{#if value.kind === 'chart'}
				{@const written = value.data.actions.flat().filter((action) => action.trim()).length}
				<p class="m-0 text-[1rem] leading-snug font-[620] text-pretty">{value.data.goal}</p>
				<div class="flex items-center gap-3.5">
					{@render miniChart(value.data, written)}
					<p class="m-0 min-w-0 flex-1 text-[0.8rem] leading-snug text-muted">
						{written === 64 ? '64 actions included.' : `${written} of 64 actions.`}
					</p>
				</div>
				<ol class="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-1 p-0 text-[0.86rem] leading-[1.35] max-[420px]:grid-cols-1">
					{#each value.data.pillars as pillar, pillarIndex (pillarIndex)}
						<li class="flex min-w-0 gap-2">{@render dot(pillarIndex)}<span class="min-w-0">{pillar}</span></li>
					{/each}
				</ol>
			{:else if value.kind === 'cells'}
				<div class="flex flex-col gap-3.5">
					{#each groupEdits(helper.data, value.edits) as group (group.key)}
						<section class="flex min-w-0 flex-col gap-1.5" aria-label={group.label}>
							{#if group.pillarIndex !== null}
								<p class="m-0 flex items-center gap-2 text-[0.78rem] font-semibold text-muted">
									<span class="pip size-2.5 shrink-0 rounded-full" style:--pip-h={HUES[group.pillarIndex]} aria-hidden="true"></span>
									{group.label}
								</p>
							{/if}
							<ul class="m-0 flex list-none flex-col gap-1.5 p-0">
								{#each group.edits as edit (edit.key)}
									{@const pillarOf = edit.key.startsWith('p') ? Number(edit.key.slice(1)) : null}
									<li class="flex min-w-0 gap-2 text-[0.9rem] leading-snug">
										{#if pillarOf !== null}{@render dot(pillarOf)}{/if}
										<span class="flex min-w-0 flex-col">
											{#if edit.before}
												<s class="text-muted decoration-line">{edit.before}</s>
											{/if}
											<span class="text-pretty">{edit.after}</span>
										</span>
									</li>
								{/each}
							</ul>
						</section>
					{/each}
				</div>
			{:else if value.kind === 'picks'}
				<ul class="m-0 flex list-none flex-col gap-2.5 p-0">
					{#each value.picks as pick (pick.key)}
						<li class="flex min-w-0 gap-2.5 text-[0.9rem] leading-snug">
							{@render dot(pick.pillarIndex)}
							<span class="flex min-w-0 flex-1 flex-col gap-0.5">
								<span class="text-pretty">{pick.text}</span>
								<span class="text-[0.78rem] text-muted">{pick.why}</span>
							</span>
							{#if message.state === 'open'}
								<button type="button" class={cn(link, 'shrink-0 self-start')} aria-label="Swap {pick.text}" onclick={() => helper.swap(message.id, pick.key)}>Swap</button>
							{/if}
						</li>
					{/each}
				</ul>
			{:else if value.kind === 'findings'}
				<ul class="m-0 flex list-none flex-col gap-2.5 p-0">
					{#each value.findings as finding (finding.key)}
						<li class="flex min-w-0 flex-col gap-0.5 text-[0.9rem] leading-snug">
							<span class="flex items-baseline justify-between gap-3">
								<span class="text-[0.74rem] font-semibold text-muted">{describeKey(helper.data, finding.key)}</span>
								<button type="button" class={link} onclick={() => helper.showCell(finding.key)}>Show</button>
							</span>
							<span class="text-pretty">{finding.text}</span>
							<span class="text-[0.78rem] text-muted">{finding.reason}</span>
						</li>
					{/each}
				</ul>
			{:else if value.kind === 'facts'}
				{@const brief = helper.data.brief}
				{#if brief && Object.keys(brief).length > 0}
					<ul class="m-0 flex list-none flex-col gap-2.5 p-0">
						{#each Object.entries(BRIEF_LABELS) as [field, label] (field)}
							{@const said = brief[field as keyof typeof BRIEF_LABELS]}
							{#if said}
								<li class="flex min-w-0 flex-col gap-0.5 text-[0.9rem] leading-snug">
									<span class="flex items-baseline justify-between gap-3">
										<span class="text-[0.74rem] font-semibold text-muted">{label}</span>
										<button type="button" class={link} aria-label="Forget {label.toLowerCase()}" onclick={() => helper.forget(field as keyof typeof BRIEF_LABELS)}>Forget</button>
									</span>
									<span class="text-pretty">{said}</span>
								</li>
							{/if}
						{/each}
					</ul>
				{:else}
					<p class="m-0 text-[0.86rem] text-muted">Forgotten. I'll write from the chart alone.</p>
				{/if}
			{:else if value.kind === 'prompt'}
				<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
					<Button size="sm" variant="soft" icon="copy" onclick={() => copyPrompt(value.text)}>{copied ? 'Copied' : 'Copy the prompt'}</Button>
					<span class="text-[0.8rem] text-muted">Paste the reply in the box below.</span>
				</div>
			{/if}

			{#if message.state === 'open' && value.kind !== 'prompt' && value.kind !== 'facts'}
				<div class="flex flex-wrap items-center gap-2">
					{#if primaryLabel(message)}
						<Button size="sm" onclick={() => helper.use(message.id)}>{primaryLabel(message)}</Button>
					{/if}
					<Button size="sm" variant="ghost" onclick={() => helper.skip(message.id)}>{skipLabel(message)}</Button>
				</div>
			{:else if message.state === 'skipped' && value.kind !== 'prompt' && value.kind !== 'facts'}
				<p class="m-0 text-[0.8rem] text-muted">Left as it was.</p>
			{/if}
		</div>
	{/if}
{/snippet}

<div
	class={cn('flex min-h-0 flex-col overflow-hidden rounded-[28px] bg-surface text-text', className)}
	role="dialog"
	tabindex="-1"
	aria-label="Bindu"
	data-helper
	{onkeydown}
>
	<header class="relative flex min-h-[78px] shrink-0 items-start gap-3 pt-2.5 pb-1.5 ps-4 pe-2">
		<HelperFace mood={helper.mood} size={44} class="mt-0.5 shrink-0" />
		<div class="min-w-0 flex-1">
			<h2 class="m-0 text-[1.02rem] leading-tight font-[620]">Bindu</h2>
			<p class="m-0 mt-0.5 truncate text-[0.8rem] leading-snug text-muted">Reads your chart, on this device</p>
		</div>
		<div class="mt-0.5 flex shrink-0 items-center gap-0.5">
			<IconButton icon="refresh" label="Clear this chat" onclick={() => helper.reset()} />
			{#if onclose}
				<IconButton icon="close" label="Close Bindu" onclick={onclose} />
			{/if}
		</div>
	</header>

	<div bind:this={scroller} class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-1.5 pb-3">
		<ol class="m-0 flex list-none flex-col gap-3 p-0" aria-live="polite">
			{#each helper.messages as message (message.id)}
				<li
					class={cn(
						'flex min-w-0 flex-col motion-safe:animate-pop-in',
						message.from === 'you'
							? 'max-w-[85%] origin-bottom-right self-end rounded-[20px] rounded-ee-md bg-sunken px-3.5 py-2'
							: 'origin-bottom-left'
					)}
				>
					<p class={cn('m-0 text-[0.94rem] leading-[1.45] text-pretty', message.from === 'you' && 'break-words')}>
						{message.text}
					</p>
					{#if message.card}
						{@render card(message)}
					{/if}
				</li>
			{/each}
		</ol>
		{#if chips.length}
			<div class="mt-3 flex flex-wrap gap-1.5">
				{#each chips as chip (chip.label)}
					<Button size="sm" variant="soft" onclick={() => helper.choose(chip)}>{chip.label}</Button>
				{/each}
			</div>
		{/if}
	</div>

	<form class="flex shrink-0 items-center gap-1.5 px-3 pt-1 pb-3" onsubmit={submit}>
		<input
			class={field}
			type="text"
			maxlength="20000"
			autocomplete="off"
			aria-label="Message Bindu"
			placeholder={helper.placeholder}
			bind:value={text}
			onfocus={() => (helper.listening = true)}
			onblur={() => (helper.listening = false)}
			{@attach focusOnMount}
		/>
		<IconButton icon="arrow-right" label="Send" type="submit" disabled={!text.trim()} class="disabled:pointer-events-none disabled:opacity-40" />
	</form>
</div>
