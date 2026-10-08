<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { HelperMessage, HelperStore } from '$lib/chart/helper.svelte';
	import { BRIEF_LABELS, describeKey, draftButton, editWords, groupEdits } from '$lib/chart/helper';
	import { cellKey, getByKey, HUES, info, type ChartData } from '$lib/chart/model';
	import HelperFace from './HelperFace.svelte';
	import BouncingDots from './ui/BouncingDots.svelte';
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
	/** A job is running and nothing on screen shows it yet: hold its place in the conversation. */
	const holding = $derived(
		helper.busy &&
			helper.pending !== null &&
			helper.progress?.downloadFillRatio == null &&
			!helper.messages.some((message) => message.state === 'working')
	);
	/** The conversation names the step in progress, so the header only says that Bindu is at work. */
	const stepInChat = $derived(
		(holding && helper.pending !== 'reply') || helper.messages.some((message) => message.state === 'working')
	);
	const isReady = $derived(Boolean(helper.progress?.label?.startsWith('Ready')));
	const activeStatusLabel = $derived.by(() => {
		if (isReady) return null;
		if (helper.progress?.label) {
			return helper.progress.label.replace(/[.…]+$/, '').trim();
		}
		if (helper.progress?.downloadFillRatio != null) {
			return 'Downloading';
		}
		if (helper.busy) {
			return 'Thinking';
		}
		return null;
	});

	$effect(() => {
		void helper.messages.length;
		void helper.busy;
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
		void helper.send(value);
	}

	function onkeydown(event: KeyboardEvent): void {
		if (event.key !== 'Escape') return;
		event.stopPropagation();
		if (helper.busy) {
			void helper.stop();
			return;
		}
		if (helper.step !== 'idle') {
			helper.cancel();
			return;
		}
		if (onclose) onclose();
	}

	async function copyPrompt(): Promise<void> {
		try {
			await navigator.clipboard.writeText(helper.promptText());
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
		if (card.kind === 'chart') return card.sketch ? 'Write the actions' : draftButton(helper.data);
		if (card.kind === 'cells') return editWords(helper.data, card.edits).button;
		if (card.kind === 'picks') return card.scope === 'today' ? "Pick today's three" : 'Plan this week';
		if (card.kind === 'findings') return 'Rewrite them';
		if (card.kind === 'download') return 'Download';
		return '';
	}

	function skipLabel(message: HelperMessage): string {
		const card = message.card;
		if (card?.kind === 'chart') return card.sketch ? 'Other pillars' : 'Not this one';
		if (card?.kind === 'findings') return 'Leave them';
		if (card?.kind === 'cells') return 'Skip';
		return 'Not now';
	}

	function primary(message: HelperMessage): void {
		if (message.card?.kind === 'download') helper.allowDownload(message.id);
		else helper.use(message.id);
	}

	function secondary(message: HelperMessage): void {
		if (message.card?.kind === 'chart' && message.card.sketch) helper.otherPillars();
		else helper.skip(message.id);
	}
</script>

{#snippet dot(pillarIndex: number)}
	<span class="pip mt-[0.38em] size-2.5 shrink-0 rounded-full" style:--pip-h={HUES[pillarIndex]} aria-hidden="true"></span>
{/snippet}

{#snippet status()}
	{@const pillar = helper.progress?.pillar}
	<!-- Wraps rather than cuts, so the pillar is named in full. -->
	<span class="min-w-0 text-[0.8rem] leading-snug text-pretty text-muted">
		{#if pillar}
			Writing actions for <b class="pillar-ink font-[620]" style:--h={HUES[pillar.index]}>{pillar.name}</b>
		{:else}
			{activeStatusLabel ?? 'Working'}
		{/if}<BouncingDots />
	</span>
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

{#snippet placeholder()}
	<!-- The card that is on its way, in outline. It is replaced by the real one. -->
	<div class="mt-2 flex flex-col gap-3 rounded-[20px] bg-bg px-4 py-3.5 motion-safe:animate-pulse" aria-hidden="true">
		{#if helper.pending === 'chart'}
			<span class="h-3.5 w-3/5 rounded-full bg-sunken"></span>
			<div class="grid grid-cols-2 gap-x-3 gap-y-2.5">
				{#each HUES as hue, index (index)}
					<span class="flex items-center gap-2">
						<span class="pip size-2.5 shrink-0 rounded-full opacity-40" style:--pip-h={hue}></span>
						<span class="h-2.5 rounded-full bg-sunken" style:width="{55 + ((index * 17) % 35)}%"></span>
					</span>
				{/each}
			</div>
		{:else}
			<span class="h-2.5 w-2/5 rounded-full bg-sunken"></span>
			{#each [80, 64, 72, 58] as width, index (index)}
				<span class="h-3 rounded-full bg-sunken" style:width="{width}%"></span>
			{/each}
		{/if}
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
					<div class="flex min-w-0 flex-1 flex-col gap-1.5">
						{#if message.state === 'working'}
							<span class="text-[0.86rem] font-[560] tabular-nums">{written} of 64</span>
							<span class="h-1.5 overflow-hidden rounded-full bg-sunken">
								<span
									class="block h-full rounded-full bg-ink motion-safe:transition-[width] motion-safe:duration-500 motion-safe:ease-ui"
									style:width="{(written / 64) * 100}%"
								></span>
							</span>
							{@render status()}
						{:else}
							<p class="m-0 text-[0.8rem] leading-snug text-muted">
								{written === 64 ? '64 actions included.' : value.sketch ? `${written} of 64. Actions come next.` : `${written} of 64 actions.`}
							</p>
						{/if}
					</div>
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
					{#if message.state === 'working'}
						{@render status()}
					{/if}
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
			{:else if value.kind === 'download'}
				{@const fetching = message.state === 'used' && (helper.progress?.label === 'Downloading.' || helper.progress?.label === 'Starting the download.')}
				<p class="m-0 text-[0.86rem] leading-snug text-pretty text-muted">
					{#if value.builtin}
						{fetching ? 'Downloading.' : 'The browser decides the size.'} Your chart never leaves this device.
					{:else}
						{fetching
							? helper.progress?.detail
								? `${helper.progress.detail} of about ${value.size}.`
								: 'Starting the download.'
							: `About ${value.size}, once.`}
						After that I start in seconds, even offline. Your chart never leaves this device.
					{/if}
				</p>
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
					<Button size="sm" variant="soft" icon="copy" onclick={copyPrompt}>{copied ? 'Copied' : 'Copy the prompt'}</Button>
					<span class="text-[0.8rem] text-muted">Paste the reply in the box below.</span>
				</div>
			{/if}

			{#if message.state === 'open' && value.kind !== 'prompt'}
				<div class="flex flex-wrap items-center gap-2">
					<Button size="sm" onclick={() => primary(message)}>{primaryLabel(message)}</Button>
					<Button size="sm" variant="ghost" onclick={() => secondary(message)}>{skipLabel(message)}</Button>
				</div>
			{:else if message.state === 'skipped' && value.kind !== 'prompt'}
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
			<p
				class="m-0 mt-0.5 truncate text-[0.8rem] leading-snug text-muted"
				role="status"
				aria-label={activeStatusLabel ? `${activeStatusLabel}...` : undefined}
			>
				{#if activeStatusLabel}
					<span class="inline-flex items-center">
						{stepInChat ? 'Working' : activeStatusLabel}
						<BouncingDots />
					</span>
				{:else}
					{helper.progress?.label || (helper.modelReady ? 'Ready, on this device' : 'Lives in this browser')}
				{/if}
			</p>
			{#if helper.progress?.downloadFillRatio != null}
				{@const percent = Math.round(helper.progress.downloadFillRatio * 100)}
				<div
					class="mt-1 flex items-center gap-2.5 motion-safe:animate-note-in"
					role="progressbar"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={percent}
					aria-valuetext={helper.progress.detail ? `${helper.progress.detail}, ${percent}%` : `${percent}%`}
					aria-label={helper.progress.label}
					transition:fade={{ duration: 180 }}
				>
					<span class="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-sunken">
						<span
							class="block h-full rounded-full bg-ink motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-ui {percent > 0 ? 'min-w-[6px]' : ''}"
							style:width="{percent}%"
						></span>
					</span>
					<span class="shrink-0 text-[0.74rem] text-muted tabular-nums leading-none" aria-hidden="true">
						{helper.progress.detail ? `${helper.progress.detail} · ` : ''}{percent}%
					</span>
				</div>
			{/if}
		</div>
		<div class="mt-0.5 flex shrink-0 items-center gap-0.5">
			<IconButton icon="refresh" label="Clear this chat" onclick={() => helper.reset()} disabled={helper.busy} class="disabled:pointer-events-none disabled:opacity-40" />
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
			{#if holding}
				<li class="flex min-w-0 origin-bottom-left flex-col motion-safe:animate-pop-in" out:fade={{ duration: 160 }}>
					{#if helper.pending === 'reply'}
						<!-- Where the answer will appear. The header names the step. -->
						<span class="inline-flex h-6 items-center text-muted" aria-hidden="true"><BouncingDots class="ms-0 gap-1 [&>span]:size-1.5" /></span>
					{:else}
						{@render status()}
						{@render placeholder()}
					{/if}
				</li>
			{/if}
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
			maxlength="4000"
			autocomplete="off"
			aria-label="Message Bindu"
			placeholder={helper.placeholder}
			bind:value={text}
			onfocus={() => (helper.listening = true)}
			onblur={() => (helper.listening = false)}
			{@attach focusOnMount}
		/>
		{#if helper.busy}
			<IconButton icon="close" label="Stop" onclick={() => void helper.stop()} />
		{:else}
			<IconButton icon="arrow-right" label="Send" type="submit" disabled={!text.trim()} class="disabled:pointer-events-none disabled:opacity-40" />
		{/if}
	</form>
</div>
