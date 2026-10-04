<script lang="ts">
	import { fade } from 'svelte/transition';
	import { COACH_WEIGHT_DOWNLOAD } from '$lib/chart/coach-model';
	import type { HelperMessage, HelperStore } from '$lib/chart/helper.svelte';
	import { describeKey } from '$lib/chart/helper';
	import { HUES } from '$lib/chart/model';
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
		if (card.kind === 'chart') return 'Use this chart';
		if (card.kind === 'cells') return card.edits.length === 1 ? 'Change this line' : 'Change these lines';
		if (card.kind === 'picks') return card.scope === 'today' ? "Pick today's three" : 'Plan this week';
		if (card.kind === 'findings') return 'Rewrite them';
		if (card.kind === 'download') return 'Download';
		return '';
	}

	function skipLabel(message: HelperMessage): string {
		const card = message.card;
		if (card?.kind === 'chart') return 'Not this one';
		if (card?.kind === 'findings') return 'Leave them';
		if (card?.kind === 'cells') return 'Skip';
		return 'Not now';
	}

	function primary(message: HelperMessage): void {
		if (message.card?.kind === 'download') helper.allowDownload(message.id);
		else helper.use(message.id);
	}
</script>

{#snippet dot(pillarIndex: number)}
	<span class="pip mt-[0.38em] size-2.5 shrink-0 rounded-full" style:--pip-h={HUES[pillarIndex]} aria-hidden="true"></span>
{/snippet}

{#snippet card(message: HelperMessage)}
	{@const value = message.card}
	{#if value}
		<div class="mt-2 flex flex-col gap-3 rounded-[20px] bg-bg px-4 py-3.5">
			{#if value.kind === 'chart'}
				<p class="m-0 text-[1rem] leading-snug font-[620] text-pretty">{value.data.goal}</p>
				<ol class="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-1 p-0 text-[0.86rem] leading-[1.35] max-[420px]:grid-cols-1">
					{#each value.data.pillars as pillar, pillarIndex (pillarIndex)}
						<li class="flex min-w-0 gap-2">{@render dot(pillarIndex)}<span class="min-w-0">{pillar}</span></li>
					{/each}
				</ol>
				{@const written = value.data.actions.flat().filter((action) => action.trim()).length}
				{#if message.state === 'working'}
					<div class="flex items-center gap-2.5">
						<span class="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
							<span
								class="block h-full rounded-full bg-ink motion-safe:transition-[width] motion-safe:duration-500 motion-safe:ease-ui"
								style:width="{(written / 64) * 100}%"
							></span>
						</span>
						<span class="text-[0.8rem] text-muted tabular-nums">{written} of 64</span>
					</div>
				{:else}
					<p class="m-0 text-[0.8rem] text-muted">{written === 64 ? '64 actions included.' : `${written} of 64. The rest stayed blank.`}</p>
				{/if}
			{:else if value.kind === 'cells'}
				<ul class="m-0 flex list-none flex-col gap-2.5 p-0">
					{#each value.edits as edit (edit.key)}
						<li class="flex min-w-0 flex-col gap-0.5 text-[0.9rem] leading-snug">
							<span class="text-[0.74rem] font-semibold text-muted">{describeKey(helper.data, edit.key)}</span>
							{#if edit.before}
								<s class="text-muted decoration-line">{edit.before}</s>
							{/if}
							<span class="text-pretty">{edit.after}</span>
						</li>
					{/each}
				</ul>
			{:else if value.kind === 'picks'}
				<ul class="m-0 flex list-none flex-col gap-2.5 p-0">
					{#each value.picks as pick (pick.key)}
						<li class="flex min-w-0 gap-2.5 text-[0.9rem] leading-snug">
							{@render dot(pick.pillarIndex)}
							<span class="flex min-w-0 flex-col gap-0.5">
								<span class="text-pretty">{pick.text}</span>
								<span class="text-[0.78rem] text-muted">{pick.why}</span>
							</span>
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
				{#if message.state === 'used' && (helper.progress?.label === 'Downloading.' || helper.progress?.label === 'Starting the download.')}
					<p class="m-0 text-[0.86rem] leading-snug text-pretty text-muted">
						{helper.progress.detail ? `${helper.progress.detail} of about ${COACH_WEIGHT_DOWNLOAD}.` : 'Starting the download.'}
						After that I start in seconds, even offline. Your chart never leaves this device.
					</p>
				{:else}
					<p class="m-0 text-[0.86rem] leading-snug text-pretty text-muted">
						About {COACH_WEIGHT_DOWNLOAD}, once. After that I start in seconds, even offline. Your chart never leaves this device.
					</p>
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
					<Button size="sm" variant="ghost" onclick={() => helper.skip(message.id)}>{skipLabel(message)}</Button>
				</div>
			{:else if message.state === 'used' && value.kind !== 'download' && value.kind !== 'findings'}
				<p class="m-0 text-[0.8rem] font-[560] text-success">Used.</p>
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
						{activeStatusLabel}
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
			<IconButton icon="refresh" label="Start over" onclick={() => helper.reset()} disabled={helper.busy} class="disabled:pointer-events-none disabled:opacity-40" />
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
